/**
 * Tests for config-loader module
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { ConfigLoader } from '../config-loader';
import { writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const testDir = join(tmpdir(), 'operator-tests');

describe('ConfigLoader', () => {
  beforeEach(() => {
    try {
      mkdirSync(testDir, { recursive: true });
    } catch (e) {
      // Directory might already exist
    }
  });

  describe('parseYaml', () => {
    it('should parse valid YAML configuration', () => {
      const yaml = `
version: "1.0"
name: "Test Operation"
commands:
  - command: fill
    selector: "#email"
    value: "test@example.com"
`;

      const config = ConfigLoader.parseYaml(yaml);

      expect(config.version).toBe('1.0');
      expect(config.name).toBe('Test Operation');
      expect(config.commands.length).toBe(1);
      expect(config.commands[0].command).toBe('fill');
    });

    it('should parse configuration with multiple commands', () => {
      const yaml = `
version: "1.0"
commands:
  - command: navigate
    url: "/login"
  - command: fill
    selector: "#email"
    value: "test@example.com"
  - command: click
    selector: "button[type=submit]"
`;

      const config = ConfigLoader.parseYaml(yaml);

      expect(config.commands.length).toBe(3);
      expect(config.commands[0].command).toBe('navigate');
      expect(config.commands[1].command).toBe('fill');
      expect(config.commands[2].command).toBe('click');
    });

    it('should parse configuration with settings', () => {
      const yaml = `
version: "1.0"
settings:
  timeout: 10000
  waitForCompletion: true
  continueOnError: false
commands:
  - command: click
    selector: "#button"
`;

      const config = ConfigLoader.parseYaml(yaml);

      expect(config.settings?.timeout).toBe(10000);
      expect(config.settings?.waitForCompletion).toBe(true);
      expect(config.settings?.continueOnError).toBe(false);
    });

    it('should parse performance benchmark - check <100ms for 50 commands', () => {
      const commands = Array.from({ length: 50 }, (_, i) => `  - command: click\n    selector: "#button${i}"`).join('\n');
      const yaml = `
version: "1.0"
commands:
${commands}`;

      const startTime = Date.now();
      const config = ConfigLoader.parseYaml(yaml);
      const duration = Date.now() - startTime;

      expect(config.commands.length).toBe(50);
      expect(duration).toBeLessThan(100); // Must parse in under 100ms
    });

    it('should throw error on invalid YAML', () => {
      const invalidYaml = `
version: "1.0
commands: [
  broken syntax
`;

      expect(() => ConfigLoader.parseYaml(invalidYaml)).toThrow();
    });

    it('should throw error on missing required fields', () => {
      const yaml = `
version: "1.0"
# Missing commands array
`;

      expect(() => ConfigLoader.parseYaml(yaml)).toThrow();
    });

    it('should accept any command type (generic schema)', () => {
      const yaml = `
version: "1.0"
commands:
  - command: custom_command
    selector: "#test"
    customField: "some-value"
`;

      // Generic schema should accept any command name
      const config = ConfigLoader.parseYaml(yaml);
      expect(config.commands[0].command).toBe('custom_command');
    });

    it('should throw error on empty commands array', () => {
      const yaml = `
version: "1.0"
commands: []
`;

      expect(() => ConfigLoader.parseYaml(yaml)).toThrow();
    });

    it('should preserve additional fields via passthrough', () => {
      const yaml = `
version: "1.0"
commands:
  - command: fill
    selector: "#email"
    value: "test@example.com"
    clearFirst: true
`;

      const config = ConfigLoader.parseYaml(yaml);
      const cmd = config.commands[0] as any;
      expect(cmd.selector).toBe('#email');
      expect(cmd.value).toBe('test@example.com');
      expect(cmd.clearFirst).toBe(true);
    });

    it('should require command name on every command', () => {
      const yaml = `
version: "1.0"
commands:
  - selector: "#email"
    value: "test"
`;

      expect(() => ConfigLoader.parseYaml(yaml)).toThrow();
    });
  });

  describe('loadFromFile', () => {
    it('should load configuration from file', () => {
      const filePath = join(testDir, 'test-config.yaml');
      const yaml = `
version: "1.0"
name: "File Test"
commands:
  - command: click
    selector: "#button"
`;

      writeFileSync(filePath, yaml);

      try {
        const config = ConfigLoader.loadFromFile(filePath);

        expect(config.version).toBe('1.0');
        expect(config.name).toBe('File Test');
        expect(config.commands.length).toBe(1);
      } finally {
        unlinkSync(filePath);
      }
    });

    it('should throw error if file does not exist', () => {
      const filePath = join(testDir, 'nonexistent.yaml');

      expect(() => ConfigLoader.loadFromFile(filePath)).toThrow();
    });

    it('should handle file with invalid YAML', () => {
      const filePath = join(testDir, 'invalid.yaml');
      const invalidYaml = 'invalid: yaml: content:';

      writeFileSync(filePath, invalidYaml);

      try {
        expect(() => ConfigLoader.loadFromFile(filePath)).toThrow();
      } finally {
        unlinkSync(filePath);
      }
    });
  });

  describe('load', () => {
    it('should load from object', () => {
      const config = {
        version: '1.0',
        commands: [
          {
            command: 'fill',
            selector: '#email',
            value: 'test@example.com',
          },
        ],
      };

      const result = ConfigLoader.load(config);

      expect(result.version).toBe('1.0');
      expect(result.commands.length).toBe(1);
    });

    it('should load from file path', () => {
      const filePath = join(testDir, 'test-load.yaml');
      const yaml = `
version: "1.0"
commands:
  - command: click
    selector: "#btn"
`;

      writeFileSync(filePath, yaml);

      try {
        const result = ConfigLoader.load(filePath);

        expect(result.version).toBe('1.0');
        expect(result.commands.length).toBe(1);
      } finally {
        unlinkSync(filePath);
      }
    });

    it('should throw error for invalid object', () => {
      const invalidConfig = {
        // Missing required fields
        version: '1.0',
      } as any;

      expect(() => ConfigLoader.load(invalidConfig)).toThrow();
    });
  });

  describe('validate', () => {
    it('should validate a valid config object', () => {
      const config = {
        version: '1.0',
        commands: [
          {
            command: 'fill',
            selector: '#email',
            value: 'test@example.com',
          },
        ],
      };

      const result = ConfigLoader.validate(config);

      expect(result.version).toBe('1.0');
      expect(result.commands.length).toBe(1);
    });

    it('should validate a config with settings', () => {
      const config = {
        version: '1',
        commands: [
          { command: 'wait', timeout: 100 },
        ],
        settings: { timeout: 10000 },
      };

      const result = ConfigLoader.validate(config);
      expect(result.settings?.timeout).toBe(10000);
    });

    it('should throw error for invalid config', () => {
      expect(() => ConfigLoader.validate({ version: '1.0' })).toThrow();
    });
  });
});
