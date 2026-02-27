/**
 * Command registry for the operator package.
 * Commands outside the operator register themselves here so the executor
 * can dispatch to them without knowing their concrete implementations.
 */

import type { ExecutionContext, CommandResult } from './types';

/**
 * A command executor function — the interface every command must implement.
 * Receives the window (any backend), the parsed command config, the execution
 * context, and its index in the sequence. Returns a CommandResult.
 */
export type CommandExecutorFn = (
  window: any,
  cmd: any,
  context: ExecutionContext,
  commandIndex: number,
) => Promise<CommandResult>;

const registry = new Map<string, CommandExecutorFn>();

export function registerCommand(name: string, executor: CommandExecutorFn): void {
  registry.set(name, executor);
}

export function getCommandExecutor(name: string): CommandExecutorFn | undefined {
  return registry.get(name);
}

export function getRegisteredCommands(): string[] {
  return Array.from(registry.keys());
}
