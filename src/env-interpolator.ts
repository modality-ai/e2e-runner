/**
 * Environment Variable Interpolation
 *
 * Replaces ${getenv:VAR_NAME} placeholders with environment variable values
 * Throws clear errors if environment variables are not found
 */

import { logger } from './logger';

/**
 * Pattern to match ${getenv:VARIABLE_NAME}
 */
const ENV_PATTERN = /\$\{getenv:([A-Z_][A-Z0-9_]*)\}/g;

/**
 * Interpolate environment variables in a string
 * Syntax: ${getenv:VARIABLE_NAME}
 *
 * @example
 * interpolateEnv('password=${getenv:DB_PASSWORD}')
 * // Returns: 'password=secret123' if process.env.DB_PASSWORD='secret123'
 *
 * @throws {Error} If referenced environment variable is not found
 */
export function interpolateEnv(value: string): string {
  if (typeof value !== 'string') {
    return value;
  }

  return value.replace(ENV_PATTERN, (match, varName: string) => {
    const envValue = process.env[varName];

    if (envValue === undefined) {
      const error = `Environment variable not found: ${varName}`;
      logger.error(`[ENV_INTERPOLATOR] ${error}`);
      throw new Error(error);
    }

    logger.debug(`[ENV_INTERPOLATOR] Replaced ${match} with ${varName} value`);
    return envValue;
  });
}

/**
 * Recursively interpolate environment variables in any value
 * Handles strings, objects, and arrays
 *
 * @throws {Error} If any referenced environment variable is not found
 */
export function interpolateCommand(command: any): any {
  if (typeof command === 'string') {
    return interpolateEnv(command);
  }

  if (Array.isArray(command)) {
    return command.map((item) => interpolateCommand(item));
  }

  if (command !== null && typeof command === 'object') {
    const interpolated: any = {};
    for (const [key, value] of Object.entries(command)) {
      interpolated[key] = interpolateCommand(value);
    }
    return interpolated;
  }

  return command;
}

/**
 * Interpolate entire configuration including settings and commands
 * Recursively replaces all ${getenv:VAR} patterns throughout the config
 */
export function interpolateConfig(config: any): any {
  return interpolateCommand(config);
}
