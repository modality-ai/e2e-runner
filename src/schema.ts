/**
 * Zod schemas for operation configuration
 * Generic schema — consuming projects register their own command types via the registry
 */

import { z } from 'zod';

// ============================================================================
// Settings Schema
// ============================================================================

export const SettingsSchema = z.object({
  timeout: z.number().int().positive('timeout must be a positive integer').optional(),
  waitForCompletion: z.boolean().optional(),
  continueOnError: z.boolean().optional(),
  baseUrl: z.string().url('baseUrl must be a valid URL').optional(),
}).passthrough().optional();

// ============================================================================
// Command Schema (generic — any command name with any additional fields)
// ============================================================================

/**
 * Generic command schema: requires a `command` string, optional `description`,
 * and allows any additional fields via passthrough.
 */
export const CommandSchema = z.object({
  command: z.string().min(1, 'command name cannot be empty'),
  description: z.string().optional(),
}).passthrough();

// ============================================================================
// Top-Level Schema
// ============================================================================

/**
 * Top-level operation configuration schema
 */
export const OperationConfigSchema = z.object({
  version: z.string().min(1, 'version cannot be empty'),
  name: z.string().optional(),
  description: z.string().optional(),
  settings: SettingsSchema,
  commands: z.array(CommandSchema).min(1, 'at least one command is required'),
});

// ============================================================================
// Type Exports (inferred from Zod schemas)
// ============================================================================

/**
 * Main configuration type
 */
export type OperationConfig = z.infer<typeof OperationConfigSchema>;

/**
 * Generic command type — `command` string + any additional fields
 */
export type Command = z.infer<typeof CommandSchema>;

/**
 * Settings type
 */
export type Settings = z.infer<typeof SettingsSchema>;
