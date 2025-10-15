/**
 * TypeScript AST analyzer for finding translation usage in components
 * Uses TypeScript Compiler API for fast, accurate parsing
 */

import ts from "typescript";
import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";

export interface TranslationUsage {
  key: string;
  componentPath: string;
  componentName: string;
  line: number;
  column: number;
}

export interface ComponentInfo {
  path: string;
  name: string;
  propsInterface?: string; // Name of the props interface
  translationKeys: string[];
}

export interface AnalysisCache {
  version: string;
  timestamp: number;
  translationUsages: TranslationUsage[];
  components: ComponentInfo[];
  // Index for O(1) lookups
  keyToComponents: Record<string, string[]>; // translation key -> component paths
  componentToKeys: Record<string, string[]>; // component path -> translation keys
}

const CACHE_FILE = "tmp/.translation-cache.json";
const CACHE_VERSION = "1.0.0";

/**
 * Find all TypeScript/TSX files in a directory
 */
async function findSourceFiles(dir: string, baseDir: string = dir): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      // Skip node_modules, dist, etc.
      if (entry.isDirectory()) {
        if (!["node_modules", "dist", "build", ".git"].includes(entry.name)) {
          files.push(...await findSourceFiles(fullPath, baseDir));
        }
      } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err);
  }

  return files;
}

/**
 * Extract the component name from a file
 */
function getComponentName(sourceFile: ts.SourceFile): string | null {
  let componentName: string | null = null;

  function visit(node: ts.Node) {
    // Look for function components
    if (ts.isFunctionDeclaration(node) && node.name) {
      const name = node.name.text;
      // Check if it returns JSX
      if (returnsJSX(node)) {
        componentName = name;
        return;
      }
    }

    // Look for arrow function components exported as default or named
    if (ts.isVariableStatement(node)) {
      node.declarationList.declarations.forEach(decl => {
        if (ts.isVariableDeclaration(decl) && decl.name && ts.isIdentifier(decl.name)) {
          if (decl.initializer && returnsJSX(decl.initializer)) {
            componentName = decl.name.text;
          }
        }
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return componentName;
}

/**
 * Check if a node returns JSX
 */
function returnsJSX(node: ts.Node): boolean {
  let hasJSX = false;

  function visit(n: ts.Node) {
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) {
      hasJSX = true;
      return;
    }
    if (!hasJSX) {
      ts.forEachChild(n, visit);
    }
  }

  visit(node);
  return hasJSX;
}

/**
 * Extract props interface name from a component
 */
function getPropsInterface(sourceFile: ts.SourceFile, componentName: string): string | null {
  let propsInterface: string | null = null;

  function visit(node: ts.Node) {
    // Function component with typed props
    if (ts.isFunctionDeclaration(node) && node.name?.text === componentName) {
      const firstParam = node.parameters[0];
      if (firstParam?.type && ts.isTypeReferenceNode(firstParam.type)) {
        if (ts.isIdentifier(firstParam.type.typeName)) {
          propsInterface = firstParam.type.typeName.text;
        }
      }
    }

    // Arrow function component
    if (ts.isVariableStatement(node)) {
      node.declarationList.declarations.forEach(decl => {
        if (ts.isIdentifier(decl.name) && decl.name.text === componentName) {
          if (decl.initializer && ts.isArrowFunction(decl.initializer)) {
            const firstParam = decl.initializer.parameters[0];
            if (firstParam?.type && ts.isTypeReferenceNode(firstParam.type)) {
              if (ts.isIdentifier(firstParam.type.typeName)) {
                propsInterface = firstParam.type.typeName.text;
              }
            }
          }
        }
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return propsInterface;
}

/**
 * Find all calls to t("key") and <FormattedMessage id="key" /> in a source file
 */
function findTranslationKeys(sourceFile: ts.SourceFile): TranslationUsage[] {
  const usages: TranslationUsage[] = [];
  const componentName = getComponentName(sourceFile) || "Unknown";

  function visit(node: ts.Node) {
    // Look for t("key") pattern
    if (ts.isCallExpression(node)) {
      const expr = node.expression;

      // Check if it's a call to 't'
      if (ts.isIdentifier(expr) && expr.text === "t") {
        const firstArg = node.arguments[0];

        // Extract the string literal key
        if (firstArg && ts.isStringLiteral(firstArg)) {
          const key = firstArg.text;
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));

          usages.push({
            key,
            componentPath: sourceFile.fileName,
            componentName,
            line: line + 1,
            column: character + 1,
          });
        }
      }
    }

    // Look for <FormattedMessage id="key" /> pattern
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName;

      // Check if it's FormattedMessage
      if (ts.isIdentifier(tagName) && tagName.text === "FormattedMessage") {
        // Look for the 'id' attribute
        const idAttr = node.attributes.properties.find(attr => {
          if (ts.isJsxAttribute(attr) && ts.isIdentifier(attr.name)) {
            return attr.name.text === "id";
          }
          return false;
        });

        if (idAttr && ts.isJsxAttribute(idAttr) && idAttr.initializer) {
          let key: string | null = null;

          // Handle id="key" (string literal)
          if (ts.isStringLiteral(idAttr.initializer)) {
            key = idAttr.initializer.text;
          }
          // Handle id={"key"} or id={'key'} (JSX expression with string literal)
          else if (ts.isJsxExpression(idAttr.initializer) && idAttr.initializer.expression) {
            if (ts.isStringLiteral(idAttr.initializer.expression)) {
              key = idAttr.initializer.expression.text;
            }
          }

          if (key) {
            const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));

            usages.push({
              key,
              componentPath: sourceFile.fileName,
              componentName,
              line: line + 1,
              column: character + 1,
            });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return usages;
}

/**
 * Analyze all source files and build the index
 */
export async function analyzeProject(sourceDir: string): Promise<AnalysisCache> {
  console.log("🔍 Analyzing project for translation usage...");

  const startTime = Date.now();
  const sourceFiles = await findSourceFiles(sourceDir);

  console.log(`Found ${sourceFiles.length} source files`);

  const program = ts.createProgram(sourceFiles, {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    jsx: ts.JsxEmit.React,
    allowJs: true,
    skipLibCheck: true,
  });

  const allUsages: TranslationUsage[] = [];
  const components: ComponentInfo[] = [];

  for (const sourceFile of program.getSourceFiles()) {
    // Only analyze our source files, not node_modules
    if (!sourceFile.fileName.includes("node_modules")) {
      const usages = findTranslationKeys(sourceFile);
      allUsages.push(...usages);

      // Check if this file has a component (regardless of translation usage)
      const componentName = getComponentName(sourceFile);
      if (componentName) {
        const propsInterface = getPropsInterface(sourceFile, componentName);

        components.push({
          path: sourceFile.fileName,
          name: componentName,
          propsInterface: propsInterface || undefined,
          translationKeys: [...new Set(usages.map(u => u.key))],
        });
      }
    }
  }

  // Build indexes for fast lookups
  const keyToComponents: Record<string, string[]> = {};
  const componentToKeys: Record<string, string[]> = {};

  for (const component of components) {
    componentToKeys[component.path] = component.translationKeys;

    for (const key of component.translationKeys) {
      if (!keyToComponents[key]) {
        keyToComponents[key] = [];
      }
      keyToComponents[key].push(component.path);
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(`✅ Analysis complete in ${elapsed}ms`);
  console.log(`   Found ${allUsages.length} translation usages in ${components.length} components`);

  return {
    version: CACHE_VERSION,
    timestamp: Date.now(),
    translationUsages: allUsages,
    components,
    keyToComponents,
    componentToKeys,
  };
}

/**
 * Load cache from disk
 */
export async function loadCache(projectRoot: string): Promise<AnalysisCache | null> {
  try {
    const cachePath = join(projectRoot, CACHE_FILE);
    const file = Bun.file(cachePath);

    if (await file.exists()) {
      const cache = await file.json() as AnalysisCache;

      if (cache.version === CACHE_VERSION) {
        console.log(`📦 Loaded cache from ${cachePath}`);
        return cache;
      } else {
        console.log(`⚠️  Cache version mismatch, rebuilding...`);
      }
    }
  } catch (err) {
    console.error("Error loading cache:", err);
  }

  return null;
}

/**
 * Save cache to disk
 */
export async function saveCache(projectRoot: string, cache: AnalysisCache): Promise<void> {
  try {
    const cachePath = join(projectRoot, CACHE_FILE);
    await Bun.write(cachePath, JSON.stringify(cache, null, 2));
    console.log(`💾 Saved cache to ${cachePath}`);
  } catch (err) {
    console.error("Error saving cache:", err);
  }
}
