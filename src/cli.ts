/**
 * Operator CLI handlers and formatters
 * Reusable logic for verify, test, and execute operations
 */

import { ConfigLoader } from './config-loader';
import { executeOperation } from './index';
import type { OperationConfig, ExecutionResult, Command, BackendType } from './types';

// ============================================================================
// Context Interface
// ============================================================================

export interface OperatorCliContext {
  configPath: string;
  url?: string;
  json?: boolean;
  verbose?: boolean;
  fetchOptions?: Record<string, any>;
  backend?: BackendType;
}

// ============================================================================
// Result Interfaces
// ============================================================================

export interface VerifyResult {
  valid: boolean;
  config?: OperationConfig;
  error?: string;
}

export interface TestResult {
  success: boolean;
  config?: OperationConfig;
  result?: ExecutionResult;
  error?: string;
}

// ============================================================================
// Handlers
// ============================================================================

/**
 * Verify (validate) an operator config file
 */
export async function handleVerify(ctx: OperatorCliContext): Promise<VerifyResult> {
  try {
    const config = ConfigLoader.load(ctx.configPath);
    return { valid: true, config };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { valid: false, error: msg };
  }
}

/**
 * Test: load config, fetch page, execute commands, return result
 * @param fetchFn - Dependency-injected fetch function to avoid coupling to browser module
 */
export async function handleTest(
  ctx: OperatorCliContext,
  fetchFn: (url: string, options?: any) => Promise<any>
): Promise<TestResult> {
  try {
    const config = ConfigLoader.load(ctx.configPath);
    const testUrl = ctx.url || config.settings?.baseUrl;

    if (!testUrl) {
      return {
        success: false,
        error: 'URL is required for test command (provide via CLI or baseUrl in config)',
      };
    }

    // Build fetch options from context
    const fetchOptions = { ...ctx.fetchOptions };

    const window = await fetchFn(testUrl, fetchOptions);

    // Extract requestResult from window for session reuse
    const requestResult = (window as any).requestResult;

    const backend = ctx.backend || 'happy-dom';

    const result = await executeOperation(
      { backend, window, requestResult },
      ctx.configPath,
    );

    return { success: result.success, config, result };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}

/**
 * Execute commands against an existing window
 */
export async function handleExecute(
  window: any,
  configOrCommands: any,
  requestResult?: any,
  backend?: BackendType,
): Promise<TestResult> {
  try {
    const result = await executeOperation(
      { backend: backend || 'happy-dom', window, requestResult },
      configOrCommands,
    );
    return { success: result.success, result };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}

// ============================================================================
// Formatters
// ============================================================================

/**
 * Format verify output for display
 */
export function formatVerifyOutput(result: VerifyResult, json: boolean): string {
  if (json) {
    if (result.valid && result.config) {
      return JSON.stringify({
        valid: true,
        config: {
          name: result.config.name,
          version: result.config.version,
          totalCommands: result.config.commands.length,
          commandTypes: result.config.commands.map((c: Command) => c.command),
        }
      }, null, 2);
    }
    return JSON.stringify({
      valid: false,
      error: result.error,
    }, null, 2);
  }

  if (result.valid && result.config) {
    const lines: string[] = [];
    lines.push(`\u2713 Configuration is valid`);
    lines.push(`  File: (validated)`);
    if (result.config.name) lines.push(`  Name: ${result.config.name}`);
    lines.push(`  Version: ${result.config.version}`);
    lines.push(`  Commands: ${result.config.commands.length}`);
    lines.push(`\nCommand breakdown:`);

    const commandCounts: Record<string, number> = {};
    result.config.commands.forEach((cmd: any) => {
      commandCounts[cmd.command] = (commandCounts[cmd.command] || 0) + 1;
    });

    Object.entries(commandCounts).forEach(([cmd, count]: [string, number]) => {
      lines.push(`  - ${cmd}: ${count}`);
    });

    return lines.join('\n');
  }

  return `\u2717 Configuration is invalid\n\nError: ${result.error}`;
}

/**
 * Format test output for display — Mocha-style layout
 */
export function formatTestOutput(result: TestResult, verbose: boolean, json: boolean): string {
  if (json) {
    if (result.result) {
      return JSON.stringify(result.result, null, 2);
    }
    return JSON.stringify({ success: false, error: result.error }, null, 2);
  }

  if (!result.result) {
    return `Error: ${result.error}`;
  }

  const r = result.result;

  // ANSI codes
  const B = '\x1b[1m';   // bold
  const R = '\x1b[0m';   // reset
  const D = '\x1b[2m';   // dim
  const G = '\x1b[32m';  // green
  const Re = '\x1b[31m'; // red

  const lines: string[] = [];

  // Suite header — config name or fallback
  const suiteName = result.config?.name || result.config?.description || 'E2E Test';
  lines.push('');
  lines.push(`  ${B}${suiteName}${R}`);
  lines.push('');

  // Per-step lines
  let failIndex = 0;
  const failures: Array<{ index: number; desc: string; error: string }> = [];

  r.results.forEach((res) => {
    const desc = (res.data as any)?.description || res.command;
    const dur = res.duration !== undefined ? `${D}(${res.duration}ms)${R}` : '';

    if (res.success) {
      lines.push(`    ${G}\u2713${R} ${desc} ${dur}`);
    } else {
      failIndex++;
      lines.push(`    ${Re}${failIndex}) ${desc}${R}`);
      failures.push({
        index: failIndex,
        desc,
        error: res.error?.message || 'Unknown error',
      });
    }

    // Render step output after the ✓ line — Ansible debug style
    // Only data.output is shown; set explicitly by the debug command
    const stepOutput = (res.data as any)?.output;
    if (stepOutput !== undefined && stepOutput !== null) {
      const varName: string | undefined = (res.data as any)?.varName;
      const raw = typeof stepOutput === 'string' ? stepOutput : JSON.stringify(stepOutput, null, 2);
      if (varName) {
        lines.push(`      ${D}${varName} =>${R}`);
      }
      const formatted = raw
        .split('\n')
        .map((line: string) => `        ${D}${line}${R}`)
        .join('\n');
      lines.push(formatted);
    }
  });

  lines.push('');

  // Summary
  if (r.successCount > 0) {
    lines.push(`  ${G}${r.successCount} passing${R} ${D}(${r.duration}ms)${R}`);
  }
  if (r.errorCount > 0) {
    lines.push(`  ${Re}${r.errorCount} failing${R}`);
  }

  // Failure details
  if (failures.length > 0) {
    lines.push('');
    failures.forEach(({ index, desc, error }) => {
      lines.push(`  ${index}) ${suiteName}`);
      lines.push(`       ${desc}:`);
      lines.push(`       ${Re}${error}${R}`);
      lines.push('');
    });
  }

  return lines.join('\n');
}
