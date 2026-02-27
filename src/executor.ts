/**
 * Operation executor - orchestrates command execution
 * Handles sequential execution of commands with error handling and progress tracking
 * Backend-agnostic: receives an ExecutionContext that determines behavior
 */

import { OperationConfig, ExecutionContext, ExecutionResult, CommandResult } from './types';
import { getCommandExecutor } from './registry';
import { logger } from './logger';

/**
 * Operation executor class
 * Executes a configuration against any backend via ExecutionContext
 */
export class OperationExecutor {
  /**
   * Execute a configuration with the given context
   * The context determines the backend (happy-dom, cdp, etc.) and carries all runtime state
   */
  async execute(config: OperationConfig, context: ExecutionContext): Promise<ExecutionResult> {
    const startTime = context.startTime || Date.now();

    logger.debug(
      `[EXECUTOR] Starting execution (${context.backend}): ${config.name || 'Unnamed operation'}`
    );
    logger.debug(`[EXECUTOR] Total commands: ${config.commands.length}`);

    // Execute commands sequentially
    for (let i = 0; i < config.commands.length; i++) {
      const command = config.commands[i];

      logger.debug(
        `[EXECUTOR] Executing command ${i + 1}/${config.commands.length}: ${command.command}`
      );

      const result = await this.executeCommand(context.window, command, context, i);
      context.results.push(result);

      if (!result.success) {
        logger.debug(`[EXECUTOR] Command ${i + 1} failed: ${result.error?.message}`);

        if (!context.continueOnError) {
          logger.debug(`[EXECUTOR] Stopping execution due to error`);
          break;
        }
      }
    }

    // Calculate final statistics
    const duration = Date.now() - startTime;
    const successCount = context.results.filter((r) => r.success).length;
    const errorCount = context.results.filter((r) => !r.success).length;

    logger.debug(
      `[EXECUTOR] Execution complete: ${successCount}/${config.commands.length} succeeded (${duration}ms)`
    );

    return {
      success: errorCount === 0,
      configName: config.name,
      totalCommands: config.commands.length,
      successCount,
      errorCount,
      duration,
      results: context.results,
    };
  }

  /**
   * Execute a single command
   * Dispatches to the appropriate command handler via registry
   */
  private async executeCommand(
    window: any,
    command: any,
    context: ExecutionContext,
    commandIndex: number
  ): Promise<CommandResult> {
    try {
      const executor = getCommandExecutor(command.command);
      if (!executor) {
        return {
          command: command.command,
          commandIndex,
          success: false,
          duration: 0,
          error: {
            type: 'execution_error',
            message: `Unknown command type: ${command.command}`,
            context: {
              url: window?.location?.href || context.baseUrl || '',
              timestamp: Date.now(),
            },
          },
        };
      }

      return await executor(window ?? null, command, context, commandIndex);
    } catch (error: any) {
      logger.debug(`[EXECUTOR] Unexpected error executing command: ${error.message}`);

      return {
        command: command.command || 'unknown',
        commandIndex,
        success: false,
        duration: 0,
        error: {
          type: 'execution_error',
          message: error.message || 'Unknown error',
          context: {
            url: window?.location?.href || context.baseUrl || '',
            timestamp: Date.now(),
          },
        },
      };
    }
  }
}
