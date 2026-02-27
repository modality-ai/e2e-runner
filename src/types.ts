/**
 * Type definitions for operation executor
 * Generic runtime types — no backend-specific or command-specific types
 */

// ============================================================================
// Re-export schema-inferred types
// ============================================================================

export type {
  OperationConfig,
  Command,
  Settings,
} from './schema';

import type { OperationConfig, Command } from './schema';

/**
 * Flexible input type for executeOperation
 * Accepts a full config object, a Command[] array, or a file path string
 */
export type OperatorInput = OperationConfig | Command[] | string;

// ============================================================================
// Execution Backend Types
// ============================================================================

/**
 * Backend type identifier
 * - 'happy-dom': In-process DOM via happy-dom Window
 * - 'cdp': Chrome DevTools Protocol via MCP/CDP client
 */
export type BackendType = 'happy-dom' | 'cdp';

/**
 * CDP-specific backend configuration
 */
export interface CdpBackendConfig {
  /** Chrome user data directory */
  userDataDir?: string;

  /** MCP transport type */
  mcpType?: 'stdio' | 'http';

  /** The aiTool.execute function for CDP command execution */
  execute?: (props: any) => Promise<any>;
}

// ============================================================================
// Runtime-Only Types (not part of configuration schema)
// ============================================================================

/**
 * Execution context passed to commands
 * Carries backend info so commands can work with any backend
 */
export interface ExecutionContext {
  /** Execution backend type */
  backend: BackendType;

  /** The window instance (present when backend is 'happy-dom') */
  window?: any;

  /** CDP backend configuration (present when backend is 'cdp') */
  cdp?: CdpBackendConfig;

  /** Base URL for relative URLs */
  baseUrl: string;

  /** Default timeout in milliseconds */
  timeout: number;

  /** Whether to continue on error or stop on first failure */
  continueOnError: boolean;

  /** Results of all executed commands so far */
  results: CommandResult[];

  /** Timestamp when execution started */
  startTime?: number;

  /** RequestResult from the initial page fetch (for session reuse in navigate commands) */
  requestResult?: any;

  /** Backend-specific settings passed through from config */
  settings?: Record<string, any>;
}

/**
 * Result of executing a single command
 */
export interface CommandResult {
  /** Name of the command that was executed */
  command: string;

  /** Index of the command in the sequence (0-based) */
  commandIndex: number;

  /** Whether the command executed successfully */
  success: boolean;

  /** Time taken to execute this command in milliseconds */
  duration: number;

  /** Error information if the command failed */
  error?: CommandError;

  /** Data returned by the command (e.g., extracted values) */
  data?: any;
}

/**
 * Error information from command execution
 */
export interface CommandError {
  /** Type of error that occurred */
  type: 'selector_not_found' | 'timeout' | 'validation_error' | 'execution_error' | 'env_interpolation_error';

  /** Human-readable error message */
  message: string;

  /** CSS selector that failed (if applicable) */
  selector?: string;

  /** Context information about where the error occurred */
  context: {
    /** URL of the page where the error occurred */
    url: string;

    /** Timestamp when the error occurred */
    timestamp: number;
  };

  /** Optional suggested selectors that might work instead */
  suggestions?: string[];
}

/**
 * Final result of executing an entire operation configuration
 */
export interface ExecutionResult {
  /** Whether all commands executed successfully */
  success: boolean;

  /** Name of the operation that was executed */
  configName?: string;

  /** Total number of commands in the configuration */
  totalCommands: number;

  /** Number of commands that executed successfully */
  successCount: number;

  /** Number of commands that failed */
  errorCount: number;

  /** Total time taken to execute all commands in milliseconds */
  duration: number;

  /** Results of each command in sequence */
  results: CommandResult[];
}

/**
 * Progress update during execution
 * Can be used for callbacks to track execution progress
 */
export interface ExecutionProgress {
  /** Total number of commands to execute */
  totalCommands: number;

  /** Index of the currently executing command (0-based) */
  currentCommand: number;

  /** Name of the currently executing command */
  currentCommandName: string;

  /** Current status of execution */
  status: 'running' | 'success' | 'error';

  /** Time elapsed so far in milliseconds */
  elapsedMs: number;
}

/**
 * Configuration loader options
 */
export interface LoaderOptions {
  /** Timeout for file reading in milliseconds */
  timeout?: number;

  /** Whether to validate the configuration after loading */
  validate?: boolean;
}
