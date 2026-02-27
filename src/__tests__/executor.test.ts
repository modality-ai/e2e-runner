/**
 * Integration tests for executor module
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { executeOperation, registerCommand } from '../index';

// Minimal mock window — no happy-dom dependency
function createMockWindow() {
  const elements = new Map<string, any>();
  let bodyText = '';

  function parseHtml(html: string) {
    const tagRe = /<(input|button|select|div|p)[^>]*\sid="([^"]+)"[^>]*>/gi;
    let m;
    while ((m = tagRe.exec(html)) !== null) {
      const [, tag, id] = m;
      if (!elements.has(`#${id}`)) elements.set(`#${id}`, { tagName: tag.toUpperCase(), id, value: '' });
    }
    bodyText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  return {
    document: {
      write: (html: string) => parseHtml(html),
      querySelector: (sel: string) => elements.get(sel) ?? null,
      body: {
        set innerHTML(html: string) { parseHtml(html); },
        get textContent() { return bodyText; },
      },
    },
    location: { href: 'http://test' },
  };
}

// Register minimal test command implementations — no outside dependencies
registerCommand('fill', async (window, cmd, _ctx, commandIndex) => {
  const el = window?.document?.querySelector(cmd.selector);
  if (!el) return { command: 'fill', commandIndex, success: false, duration: 0, error: { type: 'selector_not_found' as const, message: `Element not found: ${cmd.selector}`, context: { url: '', timestamp: Date.now() } } };
  (el as any).value = cmd.value;
  return { command: 'fill', commandIndex, success: true, duration: 0 };
});

registerCommand('click', async (window, cmd, _ctx, commandIndex) => {
  const el = window?.document?.querySelector(cmd.selector);
  if (!el) return { command: 'click', commandIndex, success: false, duration: 0, error: { type: 'selector_not_found' as const, message: `Element not found: ${cmd.selector}`, context: { url: '', timestamp: Date.now() } } };
  return { command: 'click', commandIndex, success: true, duration: 0 };
});

registerCommand('wait', async (_window, cmd, _ctx, commandIndex) => {
  await new Promise(r => setTimeout(r, cmd.timeout ?? 0));
  return { command: 'wait', commandIndex, success: true, duration: cmd.timeout ?? 0 };
});

registerCommand('see', async (window, cmd, _ctx, commandIndex) => {
  const found = window?.document?.body?.textContent?.includes(cmd.text) ?? false;
  const ok = cmd.assertion ? found : !found;
  return { command: 'see', commandIndex, success: ok, duration: 0, ...(ok ? {} : { error: { type: 'validation_error' as const, message: `Text "${cmd.text}" ${cmd.assertion ? 'not found' : 'found'}`, context: { url: '', timestamp: Date.now() } } }) };
});

registerCommand('select', async (window, cmd, _ctx, commandIndex) => {
  const el = window?.document?.querySelector(cmd.selector) as any;
  if (!el) return { command: 'select', commandIndex, success: false, duration: 0, error: { type: 'selector_not_found' as const, message: `Element not found: ${cmd.selector}`, context: { url: '', timestamp: Date.now() } } };
  el.value = cmd.value;
  return { command: 'select', commandIndex, success: true, duration: 0 };
});

describe('OperationExecutor Integration', () => {
  let window: ReturnType<typeof createMockWindow>;

  beforeEach(() => {
    window = createMockWindow();
    window.document.write(`
      <html>
        <head><title>Test Page</title></head>
        <body>
          <form>
            <input id="username" type="text" placeholder="Username" />
            <input id="password" type="password" placeholder="Password" />
            <button id="submit-btn" type="button">Login</button>
          </form>
          <div id="result" style="display:none;">Login successful</div>
        </body>
      </html>
    `);
  });

  describe('basic operations', () => {
    it('should execute fill and click commands', async () => {
      const config = {
        version: '1.0',
        commands: [
          {
            command: 'fill' as const,
            selector: '#username',
            value: 'testuser',
          },
          {
            command: 'fill' as const,
            selector: '#password',
            value: 'testpass',
          },
          {
            command: 'click' as const,
            selector: '#submit-btn',
          },
        ],
      };

      const result = await executeOperation({ backend: 'happy-dom', window }, config);

      expect(result.success).toBe(true);
      expect(result.successCount).toBe(3);
      expect(result.errorCount).toBe(0);

      // Verify values were filled
      const username = window.document.querySelector('#username') as any;
      const password = window.document.querySelector('#password') as any;

      expect(username.value).toBe('testuser');
      expect(password.value).toBe('testpass');
    });

    it('should handle missing element gracefully', async () => {
      const config = {
        version: '1.0',
        commands: [
          {
            command: 'fill' as const,
            selector: '#nonexistent',
            value: 'test',
          },
        ],
      };

      const result = await executeOperation({ backend: 'happy-dom', window }, config);

      expect(result.success).toBe(false);
      expect(result.errorCount).toBe(1);
      expect(result.results[0].error?.type).toBe('selector_not_found');
    });

    it('should stop on first error when continueOnError is false', async () => {
      const config = {
        version: '1.0',
        settings: {
          continueOnError: false,
        },
        commands: [
          {
            command: 'fill' as const,
            selector: '#nonexistent',
            value: 'test',
          },
          {
            command: 'click' as const,
            selector: '#submit-btn',
          },
        ],
      };

      const result = await executeOperation({ backend: 'happy-dom', window }, config);

      expect(result.totalCommands).toBe(2);
      expect(result.results.length).toBe(1); // Only first command executed
      expect(result.results[0].success).toBe(false);
    });

    it('should continue on error when continueOnError is true', async () => {
      const config = {
        version: '1.0',
        settings: {
          continueOnError: true,
        },
        commands: [
          {
            command: 'fill' as const,
            selector: '#nonexistent',
            value: 'test',
          },
          {
            command: 'click' as const,
            selector: '#submit-btn',
          },
        ],
      };

      const result = await executeOperation({ backend: 'happy-dom', window }, config);

      expect(result.results.length).toBe(2);
      expect(result.results[0].success).toBe(false);
      expect(result.results[1].success).toBe(true);
    });
  });

  describe('wait commands', () => {
    it('should execute wait with timeout', async () => {
      const config = {
        version: '1.0',
        commands: [
          {
            command: 'wait' as const,
            timeout: 50, // Short wait for testing
          },
        ],
      };

      const startTime = Date.now();
      const result = await executeOperation({ backend: 'happy-dom', window }, config);
      const elapsed = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(elapsed).toBeGreaterThanOrEqual(50);
    });

    it('should handle see assertions', async () => {
      window.document.body.innerHTML = '<p>Success message</p>';

      const config = {
        version: '1.0',
        commands: [
          {
            command: 'see' as const,
            text: 'Success message',
            assertion: true,
          },
        ],
      };

      const result = await executeOperation({ backend: 'happy-dom', window }, config);

      expect(result.success).toBe(true);
      expect(result.results[0].success).toBe(true);
    });
  });

  describe('select commands', () => {
    it('should execute select command', async () => {
      window.document.body.innerHTML = `
        <select id="country">
          <option value="">Select Country</option>
          <option value="us">United States</option>
          <option value="uk">United Kingdom</option>
        </select>
      `;

      const config = {
        version: '1.0',
        commands: [
          {
            command: 'select' as const,
            selector: '#country',
            value: 'uk',
          },
        ],
      };

      const result = await executeOperation({ backend: 'happy-dom', window }, config);

      expect(result.success).toBe(true);

      const select = window.document.querySelector('#country') as any;
      expect(select.value).toBe('uk');
    });
  });

  describe('execution result', () => {
    it('should include command results in order', async () => {
      const config = {
        version: '1.0',
        name: 'Test Operation',
        commands: [
          {
            command: 'fill' as const,
            selector: '#username',
            value: 'user1',
          },
          {
            command: 'fill' as const,
            selector: '#password',
            value: 'pass1',
          },
        ],
      };

      const result = await executeOperation({ backend: 'happy-dom', window }, config);

      expect(result.configName).toBe('Test Operation');
      expect(result.totalCommands).toBe(2);
      expect(result.results.length).toBe(2);
      expect(result.results[0].commandIndex).toBe(0);
      expect(result.results[1].commandIndex).toBe(1);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });
});
