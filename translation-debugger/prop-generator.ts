import ts from "typescript";
import path from "path";

/**
 * Cache for parsed source files to avoid re-parsing the same file
 */
const sourceFileCache = new Map<string, ts.SourceFile>();

/**
 * Generate mock props for a component based on its props interface
 */
export async function generateProps(
  sourceFile: ts.SourceFile,
  interfaceName: string,
  filePath?: string
): Promise<Record<string, any>> {
  const props: Record<string, any> = {};

  async function visit(node: ts.Node) {
    if (ts.isInterfaceDeclaration(node) && node.name.text === interfaceName) {
      for (const member of node.members) {
        if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
          const propName = member.name.text;
          const propType = member.type;
          if (propType) {
            props[propName] = await generateValueForType(propType, propName, sourceFile, filePath);
          }
        }
      }
    }
    for (const child of node.getChildren()) {
      await visit(child);
    }
  }

  await visit(sourceFile);
  return props;
}

/**
 * Recursive search for an interface declaration in a node tree
 */
function findInterfaceDeclaration(
  typeName: string,
  node: ts.Node
): ts.InterfaceDeclaration | undefined {
  if (ts.isInterfaceDeclaration(node) && node.name.text === typeName) return node;
  let result: ts.InterfaceDeclaration | undefined = undefined;
  ts.forEachChild(node, child => {
    const found = findInterfaceDeclaration(typeName, child);
    if (found) result = found;
  });
  return result;
}

/**
 * Extract import information for a type from a source file
 */
function findImportForType(
  typeName: string,
  sourceFile: ts.SourceFile
): string | undefined {
  let importPath: string | undefined;

  ts.forEachChild(sourceFile, node => {
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier)) {
        const clause = node.importClause;
        if (!clause) return;

        // Check named imports (import { Video } from "...")
        if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
          for (const element of clause.namedBindings.elements) {
            if (element.name.text === typeName) {
              importPath = moduleSpecifier.text;
              return;
            }
          }
        }

        // Check type-only imports (import type { Video } from "...")
        // These are also captured by the above check
      }
    }
  });

  return importPath;
}

/**
 * Load and parse a source file from a path
 */
async function loadSourceFile(filePath: string): Promise<ts.SourceFile | undefined> {
  try {
    // Check cache first
    if (sourceFileCache.has(filePath)) {
      return sourceFileCache.get(filePath);
    }

    const sourceCode = await Bun.file(filePath).text();
    const sourceFile = ts.createSourceFile(
      filePath,
      sourceCode,
      ts.ScriptTarget.ESNext,
      true
    );

    sourceFileCache.set(filePath, sourceFile);
    return sourceFile;
  } catch (err) {
    console.error(`Failed to load source file ${filePath}:`, err);
    return undefined;
  }
}

/**
 * Resolve a relative import path to an absolute file path
 */
async function resolveImportPath(importPath: string, currentFilePath?: string): Promise<string | undefined> {
  if (!currentFilePath) return undefined;

  const currentDir = path.dirname(currentFilePath);
  let resolvedPath = path.resolve(currentDir, importPath);

  // If the path already has an extension, return it
  if (path.extname(resolvedPath)) {
    return resolvedPath;
  }

  // Try different extensions, checking if files exist
  const extensions = ['.tsx', '.ts', '.jsx', '.js'];
  for (const ext of extensions) {
    const pathWithExt = resolvedPath + ext;
    try {
      await Bun.file(pathWithExt).text();
      return pathWithExt;
    } catch {
      // File doesn't exist, continue to next extension
    }
  }

  return undefined;
}

/**
 * Generate a mock value for a TypeScript type node
 */
async function generateValueForType(
  type: ts.TypeNode,
  propName: string,
  sourceFile: ts.SourceFile,
  currentFilePath?: string
): Promise<any> {
  if (type.kind === ts.SyntaxKind.StringKeyword) return generateStringValue(propName);
  if (type.kind === ts.SyntaxKind.NumberKeyword) return generateNumberValue(propName);
  if (type.kind === ts.SyntaxKind.BooleanKeyword) return false;
  if (ts.isFunctionTypeNode(type)) {
    // Create a named function so serialization can capture the name
    const mockFn = function mockFunction(...args: any[]) {
      console.log(`Mock function called: ${propName}`, args);
    };
    Object.defineProperty(mockFn, 'name', { value: propName });
    return mockFn;
  }

  if (ts.isArrayTypeNode(type)) {
    const elementType = type.elementType;

    // generate the element itself (ignore propName)
    const elementValue = await generateValueForType(elementType, "", sourceFile, currentFilePath);

    return [generateDeepCopy(elementValue), generateDeepCopy(elementValue)];
  }

  if (ts.isUnionTypeNode(type)) {
    const firstType = type.types[0];
    if (firstType) return await generateValueForType(firstType, propName, sourceFile, currentFilePath);
  }

  if (ts.isLiteralTypeNode(type)) {
    if (ts.isStringLiteral(type.literal)) return type.literal.text;
    if (ts.isNumericLiteral(type.literal)) return Number(type.literal.text);
    if (type.literal.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (type.literal.kind === ts.SyntaxKind.FalseKeyword) return false;
  }

  if (ts.isTypeReferenceNode(type)) {
    const typeName = ts.isIdentifier(type.typeName) ? type.typeName.text : "";

    if (typeName === "ReactNode" || typeName === "ReactElement") return null;
    if (typeName === "Date") return new Date();
    if (typeName === "File") return new File(["mock content"], "mock.txt", { type: "text/plain" });

    // First, try to find the interface in the current file
    let interfaceDecl = findInterfaceDeclaration(typeName, sourceFile);
    let sourceFileToUse = sourceFile;

    // If not found in the current file, check imports
    if (!interfaceDecl && currentFilePath) {
      const importPath = findImportForType(typeName, sourceFile);
      if (importPath) {
        const resolvedPath = await resolveImportPath(importPath, currentFilePath);
        if (resolvedPath) {
          // Load the imported file
          try {
            const importedSourceFile = await loadSourceFile(resolvedPath);
            if (importedSourceFile) {
              interfaceDecl = findInterfaceDeclaration(typeName, importedSourceFile);
              sourceFileToUse = importedSourceFile;
            }
          } catch (err) {
            console.error(`Failed to load imported file ${resolvedPath}:`, err);
          }
        }
      }
    }

    if (interfaceDecl) {
      const obj: Record<string, any> = {};
      for (const member of interfaceDecl.members) {
        if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
          const memberName = member.name.text;
          if (member.type) {
            obj[memberName] = await generateValueForType(member.type, memberName, sourceFileToUse, currentFilePath);
          }
        }
      }
      return obj;
    }

    return generateObjectValue(propName);
  }

  if (ts.isTypeLiteralNode(type)) {
    const obj: Record<string, any> = {};
    for (const member of type.members) {
      if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
        const memberName = member.name.text;
        if (member.type) {
          obj[memberName] = await generateValueForType(member.type, memberName, sourceFile, currentFilePath);
        }
      }
    }
    return obj;
  }

  return null;
}

/**
 * Generate a realistic string value based on prop name
 */
function generateStringValue(propName: string): string {
  const lower = propName.toLowerCase();

  if (lower.includes("id")) return "mock-id-123";
  if (lower.includes("title")) return "Mock Title";
  if (lower.includes("name")) return `Mock ${propName}`;
  if (lower.includes("description")) return "This is a mock description";
  if (lower.includes("email")) return "mock@example.com";
  if (lower.includes("url") || lower.includes("link")) return "https://example.com";
  if (lower.includes("path")) return "/mock/path";
  if (lower.includes("date")) return "2025-10-11";
  if (lower.includes("time")) return "12:34";
  if (lower.includes("duration")) return "10:24";
  if (lower.includes("color")) return "#4a90e2";
  if (lower.includes("thumbnail"))
    return "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzRhOTBlMiIvPjwvc3ZnPg==";

  return `Mock ${propName}`;
}

/**
 * Generate a realistic number value based on prop name
 */
function generateNumberValue(propName: string): number {
  const lower = propName.toLowerCase();

  if (lower.includes("count") || lower.includes("total")) return 42;
  if (lower.includes("views")) return 1234;
  if (lower.includes("age")) return 25;
  if (lower.includes("price") || lower.includes("cost")) return 99.99;
  if (lower.includes("percent")) return 75;
  if (lower.includes("index")) return 0;

  return 123;
}

/**
 * Fallback generic object
 */
function generateObjectValue(propName: string): Record<string, any> {
  return { [`mock${capitalize(propName)}`]: "mock-value" };
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Deep copy helper for array elements
 */
function generateDeepCopy(obj: any) {
  if (Array.isArray(obj)) return obj.map(generateDeepCopy);
  if (obj && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, generateDeepCopy(v)])
    );
  }
  return obj;
}

/**
 * Parse a TypeScript file and extract interface for prop generation
 */
export async function parsePropsInterface(
  filePath: string,
  interfaceName: string
): Promise<Record<string, any>> {
  try {
    const sourceCode = await Bun.file(filePath).text();
    const sourceFile = ts.createSourceFile(
      filePath,
      sourceCode,
      ts.ScriptTarget.ESNext,
      true
    );

    return await generateProps(sourceFile, interfaceName, filePath);
  } catch (err) {
    console.error(`Error parsing props interface from ${filePath}:`, err);
    return {};
  }
}

/**
 * Serialize props for JSON transmission, converting functions to markers
 */
export function serializeProps(props: Record<string, any>): Record<string, any> {
  function serialize(value: any): any {
    if (typeof value === "function") {
      const marker = { __type: "function", __name: value.name || "anonymous" };
      console.log(`Serializing function: ${value.name} ->`, marker);
      return marker;
    }
    if (Array.isArray(value)) {
      return value.map(serialize);
    }
    if (value && typeof value === "object") {
      const result: Record<string, any> = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = serialize(val);
      }
      return result;
    }
    return value;
  }

  const result = serialize(props);
  return result;
}
