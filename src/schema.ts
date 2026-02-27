/**
 * Zod schemas for browser operation configuration
 * Provides runtime validation and TypeScript type inference
 */

import { z } from 'zod';

// ============================================================================
// Settings Schema
// ============================================================================

/**
 * Auto-protect cookie pattern - protects cookies immediately when stored from matching URLs
 */
export const AutoProtectCookieSchema = z.object({
  name: z.string().min(1, 'cookie name cannot be empty'),
  urlPattern: z.string().min(1, 'URL pattern cannot be empty'), // Regex pattern to match URLs
  lock: z.boolean().optional(), // If true, cookie value cannot be changed
});

export const SettingsSchema = z.object({
  timeout: z.number().int().positive('timeout must be a positive integer').optional(),
  waitForCompletion: z.boolean().optional(),
  continueOnError: z.boolean().optional(),
  baseUrl: z.string().url('baseUrl must be a valid URL').optional(),
  requestRemapping: z.string().optional(), // Path to remapping config JSON file
  autoProtectCookies: z.array(AutoProtectCookieSchema).optional(), // Auto-protect cookies when stored from matching URLs
  windowPolyfills: z.record(z.string(), z.any()).optional(), // Key-value pairs to set on window before scripts run (e.g., CSP bypass)
}).optional();

// ============================================================================
// Command Schemas
// ============================================================================

export const NavigateCommandSchema = z.object({
  command: z.literal('navigate'),
  url: z.string().min(1, 'url cannot be empty'),
  waitForLoad: z.boolean().optional(),
  timeout: z.number().int().positive('timeout must be a positive integer').optional(),
  description: z.string().optional(),
});

export const FillCommandSchema = z.object({
  command: z.literal('fill'),
  selector: z.string().min(1, 'selector cannot be empty'),
  value: z.string(),
  clearFirst: z.boolean().optional(),
  description: z.string().optional(),
});

export const ClickCommandSchema = z.object({
  command: z.literal('click'),
  selector: z.string().min(1, 'selector cannot be empty'),
  waitBefore: z.number().int().nonnegative('waitBefore must be non-negative').optional(),
  waitAfter: z.number().int().nonnegative('waitAfter must be non-negative').optional(),
  description: z.string().optional(),
});

export const WaitCommandSchema = z.object({
  command: z.literal('wait'),
  timeout: z.number().int().positive('timeout must be a positive integer'),
  description: z.string().optional(),
});

export const SelectCommandSchema = z.object({
  command: z.literal('select'),
  selector: z.string().min(1, 'selector cannot be empty'),
  value: z.string().min(1, 'value cannot be empty'),
  description: z.string().optional(),
});

export const SeeCommandSchema = z.object({
  command: z.literal('see'),
  text: z.string().optional(),
  selector: z.string().optional(),
  assertion: z.boolean().optional(),
  timeout: z.number().int().positive('timeout must be a positive integer').optional(),
  interval: z.number().int().positive('interval must be a positive integer').optional(),
  description: z.string().optional(),
});

export const SubmitCommandSchema = z.object({
  command: z.literal('submit'),
  url: z.string().min(1, 'url cannot be empty'),
  method: z.enum(['POST', 'GET']).optional(),
  data: z.record(z.string(), z.any()).optional(), // Supports nested objects for complex APIs
  headers: z.record(z.string(), z.string()).optional(), // Custom headers (e.g., kbn-xsrf for Kibana)
  collectFrom: z.string().optional(),
  contentType: z.enum(['json', 'form']).optional(),
  waitAfter: z.number().int().nonnegative('waitAfter must be non-negative').optional(),
  description: z.string().optional(),
});

export const ProtectCookieCommandSchema = z.object({
  command: z.literal('protect-cookie'),
  name: z.string().min(1, 'cookie name cannot be empty'),
  domain: z.string().optional(), // Optional: protect across all domains if not specified
  lock: z.boolean().optional(), // If true, cookie value cannot be changed (prevents session rotation)
  description: z.string().optional(),
});

// ============================================================================
// Union and Top-Level Schemas
// ============================================================================

/**
 * Union of all command schemas
 * Uses regular union for compatibility with refined schemas
 */
export const CommandSchema = z.union([
  NavigateCommandSchema,
  FillCommandSchema,
  ClickCommandSchema,
  WaitCommandSchema,
  SelectCommandSchema,
  SeeCommandSchema,
  SubmitCommandSchema,
  ProtectCookieCommandSchema,
]);

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
 * Union type for all commands
 */
export type Command = z.infer<typeof CommandSchema>;

/**
 * Individual command types
 */
export type NavigateCommand = z.infer<typeof NavigateCommandSchema>;
export type FillCommand = z.infer<typeof FillCommandSchema>;
export type ClickCommand = z.infer<typeof ClickCommandSchema>;
export type WaitCommand = z.infer<typeof WaitCommandSchema>;
export type SelectCommand = z.infer<typeof SelectCommandSchema>;
export type SeeCommand = z.infer<typeof SeeCommandSchema>;
export type SubmitCommand = z.infer<typeof SubmitCommandSchema>;
export type ProtectCookieCommand = z.infer<typeof ProtectCookieCommandSchema>;

/**
 * Auto-protect cookie pattern type
 */
export type AutoProtectCookie = z.infer<typeof AutoProtectCookieSchema>;

/**
 * Settings type
 */
export type Settings = z.infer<typeof SettingsSchema>;
