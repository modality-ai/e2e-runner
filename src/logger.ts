/**
 * Self-contained logger for the operator package.
 * Writes to stderr so it never pollutes stdout output.
 * Respects the DEBUG environment variable.
 */

const debugEnabled = !!process.env.DEBUG;

export const logger = {
  debug: (message: string) => {
    if (debugEnabled) process.stderr.write(`[DEBUG] ${message}\n`);
  },
  warn: (message: string) => {
    process.stderr.write(`[WARN] ${message}\n`);
  },
  error: (message: string) => {
    process.stderr.write(`[ERROR] ${message}\n`);
  },
};
