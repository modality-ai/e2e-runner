/**
 * Built-in `debug` command — Ansible-style variable dump
 *
 * YAML usage:
 *   - command: debug
 *     var: links
 *     description: "Dump links"
 *
 *   - command: debug          # dumps all variables
 *     description: "Dump all vars"
 */

import { registerCommand } from '../registry';

registerCommand('debug', async (_window, cmd, context, commandIndex) => {
  const startTime = Date.now();
  const varName: string | undefined = cmd.var || cmd.variable;
  const value = varName !== undefined
    ? context.variables?.[varName]
    : context.variables;

  return {
    command: 'debug',
    commandIndex,
    success: true,
    duration: Date.now() - startTime,
    data: {
      description: cmd.description || (varName ? `Debug: ${varName}` : 'Debug: vars'),
      output: value,
      varName,
    },
  };
});
