/**
 * Configuration loader for browser operation YAML files
 * Handles loading from files or strings and validates using Zod schemas
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { parse as parseYaml } from 'yaml';
import { OperationConfigSchema, OperationConfig } from './schema';
import { logger } from './logger';
import { interpolateConfig } from './env-interpolator';

/**
 * Configuration loader class
 * Follows the pattern of RequestRemapper for consistency
 */
export class ConfigLoader {
  /**
   * Load configuration from a file path
   * Supports both relative and absolute paths
   */
  static loadFromFile(filePath: string): OperationConfig {
    const startTime = Date.now();

    // Resolve path
    const resolvedPath = resolve(filePath);

    if (!existsSync(resolvedPath)) {
      throw new Error(`Configuration file not found: ${resolvedPath}`);
    }

    try {
      const content = readFileSync(resolvedPath, 'utf-8');
      const config = this.parseYaml(content);

      const duration = Date.now() - startTime;
      logger.debug(`[CONFIG_LOADER] Loaded config from ${resolvedPath} in ${duration}ms`);

      if (duration > 100) {
        logger.warn(`[CONFIG_LOADER] Parsing took ${duration}ms (>100ms threshold)`);
      }

      return config;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Configuration file not found')) {
        throw error;
      }
      throw new Error(`Failed to load configuration from ${resolvedPath}: ${error}`);
    }
  }

  /**
   * Parse YAML string into configuration
   * Interpolates environment variables BEFORE validation
   */
  static parseYaml(yamlString: string): OperationConfig {
    try {
      // Parse YAML
      const parsed = parseYaml(yamlString);

      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Configuration must be a valid YAML object');
      }

      // Interpolate environment variables BEFORE validation
      let interpolated: any;
      try {
        interpolated = interpolateConfig(parsed);
        logger.debug('[CONFIG_LOADER] Environment variables interpolated successfully');
      } catch (interpError: any) {
        throw new Error(`Failed to interpolate environment variables: ${interpError.message}`);
      }

      // Validate using Zod schema
      try {
        return OperationConfigSchema.parse(interpolated);
      } catch (validationError: any) {
        // Format Zod error messages for readability
        if (validationError.errors && Array.isArray(validationError.errors)) {
          const errorMessages = validationError.errors
            .map((err: any) => {
              const path = err.path.join('.');
              return `${path || 'root'}: ${err.message}`;
            })
            .join('\n');
          throw new Error(`Configuration validation failed:\n${errorMessages}`);
        }
        throw validationError;
      }
    } catch (error: any) {
      if (error instanceof SyntaxError) {
        throw new Error(`YAML parsing error: ${error.message}`);
      }

      // Re-throw known error types
      if (error instanceof Error && error.message.includes('Configuration')) {
        throw error;
      }

      // Wrap other errors
      if (error instanceof Error) {
        throw new Error(`Failed to parse configuration: ${error.message}`);
      }

      throw new Error(`Failed to parse configuration: ${String(error)}`);
    }
  }

  /**
   * Validate an inline config object using Zod schema
   * Useful when constructing config programmatically (e.g., from Command[])
   */
  static validate(config: any): OperationConfig {
    try {
      return OperationConfigSchema.parse(config);
    } catch (error: any) {
      const errorMessages = error.errors
        ?.map((err: any) => {
          const path = err.path.join('.');
          return `${path || 'root'}: ${err.message}`;
        })
        .join('\n');
      throw new Error(`Configuration validation failed:\n${errorMessages}`);
    }
  }

  /**
   * Load configuration from inline object or file path
   * Mirrors the RequestRemapper pattern for flexibility
   *
   * @param configOrPath - Either a OperationConfig object or a file path string
   * @returns Validated OperationConfig
   */
  static load(configOrPath: OperationConfig | string): OperationConfig {
    if (typeof configOrPath === 'string') {
      return this.loadFromFile(configOrPath);
    }

    // If it's already a config object, validate it anyway to ensure correctness
    try {
      return OperationConfigSchema.parse(configOrPath);
    } catch (error: any) {
      const errorMessages = error.errors
        ?.map((err: any) => {
          const path = err.path.join('.');
          return `${path || 'root'}: ${err.message}`;
        })
        .join('\n');
      throw new Error(`Configuration validation failed:\n${errorMessages}`);
    }
  }
}

/**
 * Global operator instance
 * Singleton pattern for consistency with RequestRemapper
 */
let globalConfigLoader: ConfigLoader | null = null;

/**
 * Get or create global config loader instance
 */
export function getGlobalConfigLoader(): ConfigLoader {
  if (!globalConfigLoader) {
    globalConfigLoader = new ConfigLoader();
  }
  return globalConfigLoader;
}

/**
 * Reset global config loader
 */
export function resetGlobalConfigLoader(): void {
  globalConfigLoader = null;
}
