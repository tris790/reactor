/**
 * Translation Debugger Server
 * Bun server with WebSocket for live updates
 */

import { watch } from "node:fs";
import { join } from "node:path";
import { analyzeProject, loadCache, saveCache, type AnalysisCache } from "./analyzer";
import { parsePropsInterface, serializeProps } from "./prop-generator";
import index from "./index.html";

const PROJECT_ROOT = join(import.meta.dir, "..");
const PORT = 3456;

// Global state
let analysisCache: AnalysisCache | null = null;
let translations: Record<string, Record<string, any>> = {};
const propsCache = new Map<string, Record<string, any>>(); // Cache for generated props

/**
 * Load translations from JSON files
 */
async function loadTranslations() {
  try {
    const enFile = Bun.file(join(PROJECT_ROOT, "translations/en.json"));
    const frFile = Bun.file(join(PROJECT_ROOT, "translations/fr.json"));

    translations = {
      en: await enFile.json(),
      fr: await frFile.json(),
    };

    console.log("✅ Loaded translations");
  } catch (err) {
    console.error("Error loading translations:", err);
  }
}

/**
 * Initialize analysis cache
 */
async function initializeCache() {
  // Try to load existing cache
  analysisCache = await loadCache(PROJECT_ROOT);

  if (!analysisCache) {
    // Build fresh cache
    analysisCache = await analyzeProject(PROJECT_ROOT);
    await saveCache(PROJECT_ROOT, analysisCache);
  }
}

// React CDN configuration
const CDN_BASE = "https://esm.sh/";
const REACT_VERSION = "react@18.3.1";
const REACT_DOM_VERSION = "react-dom@18.3.1";
const PIN = "pin=v135";

/**
 * Transpile TypeScript/JSX code and rewrite React imports to use CDN
 */
async function transpileForBrowser(code: string, loader: 'tsx' | 'ts' | 'jsx' | 'js', includeJsxRuntime: boolean = true): Promise<string> {
  const transpiler = new Bun.Transpiler({
    loader,
    target: 'browser',
  });

  let transpiledCode = await transpiler.transform(code);

  // Add JSX runtime import at the top if needed
  if (includeJsxRuntime) {
    const jsxImport = `import { jsx, jsxs, Fragment } from "${CDN_BASE}${REACT_VERSION}/jsx-runtime?${PIN}";\n`;
    transpiledCode = jsxImport + transpiledCode;
  }

  // Rewrite all React imports to use exact same CDN URLs
  transpiledCode = transpiledCode.replace(/from\s+['"]react['"]/g, `from "${CDN_BASE}${REACT_VERSION}?${PIN}"`);
  transpiledCode = transpiledCode.replace(/from\s+['"]react\/jsx-runtime['"]/g, `from "${CDN_BASE}${REACT_VERSION}/jsx-runtime?${PIN}"`);
  transpiledCode = transpiledCode.replace(/from\s+['"]react\/jsx-dev-runtime['"]/g, `from "${CDN_BASE}${REACT_VERSION}/jsx-runtime?${PIN}"`);
  transpiledCode = transpiledCode.replace(/from\s+['"]react-dom\/client['"]/g, `from "${CDN_BASE}${REACT_DOM_VERSION}/client?${PIN}&deps=${REACT_VERSION}"`);

  // Replace mangled JSX function names with actual imports
  transpiledCode = transpiledCode.replace(/jsxDEV_\w+/g, 'jsx');  // Map jsxDEV to jsx (production runtime)
  transpiledCode = transpiledCode.replace(/jsx_\w+/g, 'jsx');
  transpiledCode = transpiledCode.replace(/jsxs_\w+/g, 'jsxs');
  transpiledCode = transpiledCode.replace(/Fragment_\w+/g, 'Fragment');

  return transpiledCode;
}

/**
 * Try to resolve a file with various extensions
 */
async function resolveFile(basePath: string, extensions: string[]): Promise<{ file: any; path: string } | null> {
  let file = Bun.file(basePath);
  if (await file.exists()) {
    return { file, path: basePath };
  }

  for (const ext of extensions) {
    const testPath = basePath + ext;
    const testFile = Bun.file(testPath);
    if (await testFile.exists()) {
      return { file: testFile, path: testPath };
    }
  }

  return null;
}

/**
 * Watch for file changes and update cache incrementally
 */
function watchFiles() {
  const srcDir = join(PROJECT_ROOT, "src");
  const translationsDir = join(PROJECT_ROOT, "translations");

  // Watch source files
  watch(srcDir, { recursive: true }, async (event, filename) => {
    if (filename && /\.(tsx?|jsx?)$/.test(filename)) {
      console.log(`📝 File changed: ${filename}, rebuilding cache...`);

      // Clear props cache since components may have changed
      propsCache.clear();

      analysisCache = await analyzeProject(PROJECT_ROOT);
      await saveCache(PROJECT_ROOT, analysisCache);

      console.log(`✅ Cache updated`);
    }
  });

  // Watch translation files
  watch(translationsDir, { recursive: false }, async (event, filename) => {
    if (filename && filename.endsWith(".json")) {
      console.log(`🌍 Translation file changed: ${filename}`);
      await loadTranslations();
      console.log(`✅ Translations reloaded`);
    }
  });

  console.log("👀 Watching for file changes...");
}

/**
 * Start the server
 */
async function start() {
  console.log("🚀 Starting Translation Debugger Server...\n");

  // Initialize
  await loadTranslations();
  await initializeCache();

  // Start file watcher
  watchFiles();

  // Create server - use PROJECT_ROOT as the base directory so Bun can resolve ../src imports
  const server = Bun.serve({
    port: PORT,
    routes: {
      "/": index,
      "/preview-component": {
        GET: async (req) => {
          const htmlPath = join(import.meta.dir, "preview-v2.html");
          const file = Bun.file(htmlPath);
          return new Response(file, {
            headers: { "Content-Type": "text/html" },
          });
        },
      },
      "/preview-loader.js": {
        GET: async (req) => {
          try {
            const loaderPath = join(import.meta.dir, "preview-loader.tsx");
            const file = Bun.file(loaderPath);

            if (!(await file.exists())) {
              return new Response("Preview loader not found", { status: 404 });
            }

            const code = await transpileForBrowser(await file.text(), 'tsx');

            return new Response(code, {
              headers: {
                "Content-Type": "application/javascript",
                "Cache-Control": "no-cache",
              },
            });
          } catch (err: any) {
            console.error("Error serving preview loader:", err);
            return new Response(`Error: ${err.message}`, { status: 500 });
          }
        },
      },

      // Serve node_modules for React and other dependencies
      "/node_modules/**": {
        GET: async (req) => {
          try {
            const url = new URL(req.url);
            const pathPart = url.pathname.replace(/^\/node_modules\//, '');
            const filePath = join(PROJECT_ROOT, "node_modules", pathPart);

            console.log("Serving node_module:", filePath);

            const resolved = await resolveFile(filePath, ['.js', '.mjs', '/index.js', '/index.mjs']);

            if (resolved) {
              return new Response(resolved.file, {
                headers: {
                  "Content-Type": "application/javascript",
                  "Cache-Control": "no-cache",
                },
              });
            }
            return new Response("Module not found", { status: 404 });
          } catch (err: any) {
            console.error("Error serving node_module:", err);
            return new Response(`Error: ${err.message}`, { status: 500 });
          }
        },
      },

      // Serve translations as ES modules
      "/translations/**": {
        GET: async (req) => {
          try {
            const url = new URL(req.url);
            const pathPart = url.pathname.replace(/^\//, '');
            const filePath = join(PROJECT_ROOT, pathPart);

            console.log("Serving translation:", filePath);

            const file = Bun.file(filePath);
            if (await file.exists()) {
              const jsonContent = await file.json();
              const jsCode = `export default ${JSON.stringify(jsonContent, null, 2)};`;

              return new Response(jsCode, {
                headers: {
                  "Content-Type": "application/javascript",
                  "Cache-Control": "no-cache",
                },
              });
            }
            return new Response("Translation file not found", { status: 404 });
          } catch (err: any) {
            console.error("Error serving translation:", err);
            return new Response(`Error: ${err.message}`, { status: 500 });
          }
        },
      },

      // Serve all source files (CSS, JS, TS, TSX, etc.)
      "/src/**": {
        GET: async (req) => {
          try {
            const url = new URL(req.url);
            const pathPart = url.pathname.replace(/^\//, ''); // Remove leading slash
            const filePath = join(PROJECT_ROOT, pathPart);

            console.log("Requested:", filePath);

            // Try to resolve file with various extensions
            const resolved = await resolveFile(filePath, ['.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts', '/index.jsx', '/index.js']);

            if (!resolved) {
              console.log("  → Not found");
              return new Response("File not found", { status: 404 });
            }

            console.log("  → Resolved to:", resolved.path);

            // Handle CSS files - convert to JS module that injects styles
            if (resolved.path.endsWith('.css')) {
              const cssContent = await resolved.file.text();
              const jsCode = `
const style = document.createElement('style');
style.textContent = ${JSON.stringify(cssContent)};
document.head.appendChild(style);
export default style;
`;
              return new Response(jsCode, {
                headers: {
                  "Content-Type": "application/javascript",
                  "Cache-Control": "no-cache",
                },
              });
            }

            // Handle JavaScript/TypeScript files - transpile them
            if (resolved.path.match(/\.(tsx?|jsx?)$/)) {
              const loader = resolved.path.endsWith('.tsx') ? 'tsx' :
                            resolved.path.endsWith('.ts') ? 'ts' :
                            resolved.path.endsWith('.jsx') ? 'jsx' : 'js';

              const includeJsxRuntime = resolved.path.match(/\.(tsx|jsx)$/) !== null;
              const code = await transpileForBrowser(await resolved.file.text(), loader, includeJsxRuntime);

              return new Response(code, {
                headers: {
                  "Content-Type": "application/javascript",
                  "Cache-Control": "no-cache",
                },
              });
            }

            // Other files - serve as-is
            return new Response(resolved.file);
          } catch (err: any) {
            console.error("Error serving file:", err);
            return new Response(`Error: ${err.message}`, { status: 500 });
          }
        },
      },

      // Serve component props (lazy loaded, with caching)
      "/api/component-props": {
        GET: async (req) => {
          const url = new URL(req.url);
          const componentPath = url.searchParams.get("path");

          if (!componentPath) {
            return Response.json({ error: "Missing path parameter" }, { status: 400 });
          }

          try {
            // Check cache first
            if (propsCache.has(componentPath)) {
              return Response.json(propsCache.get(componentPath));
            }

            // Find component in cache
            const component = analysisCache?.components.find(c => c.path === componentPath);

            if (!component) {
              return Response.json({ error: "Component not found" }, { status: 404 });
            }

            // Generate props if component has props interface
            let result: any = { props: {}, metadata: { enums: {} } };
            if (component.propsInterface) {
              const generatedProps = await parsePropsInterface(componentPath, component.propsInterface);
              result = serializeProps(generatedProps);
              // Cache the result
              propsCache.set(componentPath, result);
            }

            return Response.json(result);
          } catch (err: any) {
            return Response.json({ error: err.message }, { status: 500 });
          }
        },
      },

      // API: Get component info (without props - use /api/component-props for that)
      "/api/component": {
        GET: async (req) => {
          const url = new URL(req.url);
          const componentPath = url.searchParams.get("path");

          if (!componentPath) {
            return Response.json({ error: "Missing path parameter" }, { status: 400 });
          }

          try {
            // Find component in cache
            const component = analysisCache?.components.find(c => c.path === componentPath);

            if (!component) {
              return Response.json({ error: "Component not found" }, { status: 404 });
            }

            return Response.json({ component });
          } catch (err: any) {
            return Response.json({ error: err.message }, { status: 500 });
          }
        },
      },

      // API: Get all data
      "/api/data": {
        GET: (req) => {
          return Response.json({
            cache: analysisCache,
            translations,
          });
        },
      },

      // API: Refresh cache
      "/api/refresh-cache": {
        POST: async (req) => {
          try {
            console.log("🔄 Manual cache refresh requested...");

            // Clear props cache
            propsCache.clear();

            // Rebuild analysis cache
            analysisCache = await analyzeProject(PROJECT_ROOT);
            await saveCache(PROJECT_ROOT, analysisCache);

            console.log("✅ Cache refreshed successfully");

            return Response.json({
              success: true,
              cache: analysisCache,
              stats: {
                components: analysisCache.components.length,
                translationUsages: analysisCache.translationUsages.length
              }
            });
          } catch (err: any) {
            console.error("❌ Error refreshing cache:", err);
            return Response.json({ error: err.message }, { status: 500 });
          }
        },
      },

      // API: Open file in editor
      "/api/open-file": {
        POST: async (req) => {
          try {
            const { filePath } = await req.json();

            if (!filePath) {
              return Response.json({ error: "Missing filePath parameter" }, { status: 400 });
            }

            // Try VS Code first, then fallback to system default
            const commands = [
              ["code", filePath],
              ["code-insiders", filePath],
              ["xdg-open", filePath], // Linux
              ["open", filePath], // macOS
            ];

            let success = false;
            let lastError = null;

            for (const [cmd, ...args] of commands) {
              try {
                const proc = Bun.spawn([cmd, ...args], {
                  stdout: "ignore",
                  stderr: "pipe",
                });
                await proc.exited;

                if (proc.exitCode === 0) {
                  success = true;
                  console.log(`✅ Opened file in editor with '${cmd}': ${filePath}`);
                  break;
                }
              } catch (err: any) {
                lastError = err;
                continue;
              }
            }

            if (!success) {
              console.error(`❌ Failed to open file: ${filePath}`, lastError);
              return Response.json({
                error: "Could not open file in editor",
                details: lastError?.message
              }, { status: 500 });
            }

            return Response.json({ success: true });
          } catch (err: any) {
            return Response.json({ error: err.message }, { status: 500 });
          }
        },
      },
    },

    development: {
      hmr: true,
      console: true,
    },
  });

  console.log(`\n✨ Translation Debugger running at http://localhost:${PORT}`);
  console.log(`\n📊 Stats:`);
  console.log(`   - ${Object.keys(translations.en || {}).length} translation keys`);
  console.log(`   - ${analysisCache?.components.length || 0} components analyzed`);
  console.log(`   - ${analysisCache?.translationUsages.length || 0} translation usages found`);
  console.log(`\n🔄 Watching for changes...\n`);
}

// Start the server
start().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
