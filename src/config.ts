/**
 * Configuration for Translation Debugger
 * Define paths to frontend source and translation files
 */

import { join, isAbsolute } from "node:path";

export interface TranslationDebuggerConfig {
  // Root directory of the project (usually where package.json is)
  projectRoot: string;

  // Directory containing the frontend source code (can be relative to projectRoot or absolute)
  sourceDir: string;

  // Directory containing translation files (can be relative to projectRoot or absolute)
  translationsDir: string;

  // Supported translation locales
  locales: string[];
}

/**
 * Load configuration from reactor.config.ts or use defaults
 */
export async function loadConfig(projectRoot: string): Promise<TranslationDebuggerConfig> {
  // Try to load reactor.config.ts from project root
  try {
    const configPath = join(projectRoot, "reactor.config.ts");
    const configFile = Bun.file(configPath);

    if (await configFile.exists()) {
      const configModule = await import(configPath);
      const userConfig = configModule.default || configModule.config;

      return {
        projectRoot,
        sourceDir: userConfig.sourceDir || "demo/src",
        translationsDir: userConfig.translationsDir || "demo/src/translations",
        locales: userConfig.locales || ["en", "fr"],
      };
    }
  } catch (err) {
    console.log("No config file found, using defaults");
  }

  // Default configuration
  return {
    projectRoot,
    sourceDir: "demo/src",
    translationsDir: "demo/src/translations",
    locales: ["en", "fr"],
  };
}

/**
 * Get absolute paths from config
 */
export function getAbsolutePaths(config: TranslationDebuggerConfig) {
  return {
    sourceDir: isAbsolute(config.sourceDir)
      ? config.sourceDir
      : join(config.projectRoot, config.sourceDir),
    translationsDir: isAbsolute(config.translationsDir)
      ? config.translationsDir
      : join(config.projectRoot, config.translationsDir),
  };
}
