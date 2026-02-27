/**
 * Public API for the operator module
 * Single entry point: executeOperation({ backend, window, ... }, config)
 */

import { OperationConfig, ExecutionContext, ExecutionResult, OperatorInput } from './types';
import { ConfigLoader } from './config-loader';
import { OperationExecutor } from './executor';
import { logger } from './logger';

// ============================================================================
// Type Exports
// ============================================================================

export type {
  OperationConfig,
  Command,
  NavigateCommand,
  FillCommand,
  ClickCommand,
  WaitCommand,
  SelectCommand,
  SeeCommand,
  ProtectCookieCommand,
  Settings,
  ExecutionContext,
  CommandResult,
  CommandError,
  ExecutionResult,
  ExecutionProgress,
  OperatorInput,
  LoaderOptions,
  BackendType,
  CdpBackendConfig,
} from './types';

export { ConfigLoader } from './config-loader';
export { registerCommand, getCommandExecutor, getRegisteredCommands } from './registry';
export type { CommandExecutorFn } from './registry';

// Re-export operator CLI handlers
export { handleVerify, handleTest, formatVerifyOutput, formatTestOutput } from './cli';
export type { OperatorCliContext, VerifyResult, TestResult } from './cli';

// ============================================================================
// Default command execution timeout (milliseconds)
// ============================================================================

const DEFAULT_COMMAND_TIMEOUT = 5000;

// ============================================================================
// Execute Operation
// ============================================================================

/**
 * Execute browser operations with a consistent context-based API
 *
 * @param context - Partial ExecutionContext specifying backend and runtime state
 * @param input - OperationConfig object, Command[] array, or file path string
 * @returns Execution result with success status and command results
 *
 * @example happy-dom backend
 * executeOperation({ backend: 'happy-dom', window, requestResult }, config)
 *
 * @example CDP backend (when ready)
 * executeOperation({ backend: 'cdp', cdp: { userDataDir, mcpType, execute } }, config)
 */
export async function executeOperation(
  context: Partial<ExecutionContext>,
  input: OperatorInput,
): Promise<ExecutionResult> {
  // Load config from input
  let config: OperationConfig;
  if (Array.isArray(input)) {
    config = ConfigLoader.validate({
      version: '1',
      commands: input,
    });
  } else {
    config = ConfigLoader.load(input);
  }

  logger.debug(`[OPERATOR] Executing ${config.commands.length} commands (backend: ${context.backend || 'happy-dom'})`);

  // Set auto-protect patterns on cookie jar if configured
  if (context.requestResult?.cookieJar && config.settings?.autoProtectCookies) {
    context.requestResult.cookieJar.setAutoProtectPatterns(config.settings.autoProtectCookies);
    logger.debug(`[OPERATOR] Auto-protect cookies configured: ${config.settings.autoProtectCookies.length} patterns`);
  }

  // Build full ExecutionContext with defaults from config
  const fullContext: ExecutionContext = {
    backend: context.backend || 'happy-dom',
    window: context.window,
    cdp: context.cdp,
    baseUrl: context.baseUrl || config.settings?.baseUrl || context.window?.location?.href || '',
    timeout: context.timeout || config.settings?.timeout || DEFAULT_COMMAND_TIMEOUT,
    continueOnError: context.continueOnError ?? config.settings?.continueOnError ?? false,
    results: [],
    startTime: Date.now(),
    requestResult: context.requestResult,
    windowPolyfills: context.windowPolyfills || config.settings?.windowPolyfills,
  };

  const executor = new OperationExecutor();
  return executor.execute(config, fullContext);
}
