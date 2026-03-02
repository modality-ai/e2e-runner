/**
 * Built-in `foreach` command — Ansible-style loop over a registered variable
 *
 * YAML usage:
 *   - command: foreach
 *     var: links
 *     as: url               # optional, defaults to "item"
 *     description: "..."
 *     commands:
 *       - command: open
 *         url: "{{ url }}"
 *       - command: screenshot
 *         path: "screenshots/{{ loop_index1 }}.png"
 *
 * Available interpolation variables per iteration:
 *   {{ item }}         — current item (or whatever `as:` names it)
 *   {{ loop_index }}   — 0-based index
 *   {{ loop_index1 }}  — 1-based index
 *   {{ loop_count }}   — total items
 */

import { registerCommand, getCommandExecutor } from '../registry';

function interpolateVars(obj: any, vars: Record<string, any>): any {
  if (typeof obj === 'string') {
    return obj.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key) => {
      const val = vars[key];
      return val !== undefined ? String(val) : `{{ ${key} }}`;
    });
  }
  if (Array.isArray(obj)) return obj.map((item) => interpolateVars(item, vars));
  if (obj !== null && typeof obj === 'object') {
    const result: any = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = interpolateVars(v, vars);
    }
    return result;
  }
  return obj;
}

registerCommand('foreach', async (_window, cmd, context, commandIndex) => {
  const startTime = Date.now();
  const varName: string = cmd.var;
  const asName: string = cmd.as || 'item';
  const subCommands: any[] = cmd.commands || [];
  const items: any[] = context.variables?.[varName] ?? [];

  if (!Array.isArray(items)) {
    return {
      command: 'foreach',
      commandIndex,
      success: false,
      transparent: true,
      duration: Date.now() - startTime,
      error: {
        type: 'execution_error' as const,
        message: `Variable "${varName}" is not an array (got ${typeof items})`,
        context: { url: context.baseUrl || '', timestamp: Date.now() },
      },
    };
  }

  let allSuccess = true;

  for (let i = 0; i < items.length; i++) {
    const loopVars: Record<string, any> = {
      ...context.variables,
      [asName]: items[i],
      item: items[i],
      loop_index: i,
      loop_index1: i + 1,
      loop_count: items.length,
    };

    for (const subCmd of subCommands) {
      const interpolated = interpolateVars(subCmd, loopVars);
      const executor = getCommandExecutor(interpolated.command);

      if (!executor) {
        const errResult = {
          command: interpolated.command,
          commandIndex: context.results.length,
          success: false,
          duration: 0,
          error: {
            type: 'execution_error' as const,
            message: `Unknown command: ${interpolated.command}`,
            context: { url: context.baseUrl || '', timestamp: Date.now() },
          },
        };
        context.results.push(errResult);
        allSuccess = false;
        if (!context.continueOnError) return { command: 'foreach', commandIndex, success: false, transparent: true, duration: Date.now() - startTime };
        continue;
      }

      const result = await executor(_window ?? null, interpolated, context, context.results.length);
      context.results.push(result);

      if (!result.success) {
        allSuccess = false;
        if (!context.continueOnError) {
          return { command: 'foreach', commandIndex, success: false, transparent: true, duration: Date.now() - startTime };
        }
      }
    }
  }

  return {
    command: 'foreach',
    commandIndex,
    success: allSuccess,
    transparent: true,
    duration: Date.now() - startTime,
  };
});
