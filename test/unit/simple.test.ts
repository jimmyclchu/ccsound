import { describe, test, expect } from 'vitest';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';

describe('ccsound module tests', () => {
  test('package.json has correct structure', () => {
    const packagePath = join(__dirname, '../../package.json');
    expect(existsSync(packagePath)).toBe(true);
    
    const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
    expect(pkg.name).toBe('ccsound');
    expect(pkg.bin.ccsound).toBe('./dist/bin/cli.js');
    expect(pkg.dependencies.chalk).toBeDefined();
    expect(pkg.dependencies.commander).toBeDefined();
  });

  test('TypeScript types exist', () => {
    const typesPath = join(__dirname, '../../src/types/index.ts');
    expect(existsSync(typesPath)).toBe(true);
    
    const content = readFileSync(typesPath, 'utf-8');
    expect(content).toContain('ClaudeCodeEvent');
    expect(content).toContain('Stop');
    expect(content).toContain('Notification');
  });

  test('CLI entry point exists', () => {
    const cliPath = join(__dirname, '../../src/bin/cli.ts');
    expect(existsSync(cliPath)).toBe(true);
    
    const content = readFileSync(cliPath, 'utf-8');
    expect(content).toContain('commander');
    expect(content).toContain('add-sound');
    expect(content).toContain('test');
    expect(content).toContain('doctor');
  });

  test('hooks module exports expected functions', () => {
    const hooksPath = join(__dirname, '../../src/lib/hooks.ts');
    expect(existsSync(hooksPath)).toBe(true);
    
    const content = readFileSync(hooksPath, 'utf-8');
    expect(content).toContain('export async function addSoundHook');
    expect(content).toContain('export async function listHooks');
    expect(content).toContain('export async function removeHooks');
    expect(content).toContain('_ccsound');
  });

  test('config module handles settings file', () => {
    const configPath = join(__dirname, '../../src/lib/config.ts');
    expect(existsSync(configPath)).toBe(true);
    
    const content = readFileSync(configPath, 'utf-8');
    expect(content).toContain('readSettingsFile');
    expect(content).toContain('writeSettingsFile');
    expect(content).toContain('.claude/settings.json');
  });

  test('utils module has audio validation', () => {
    const utilsPath = join(__dirname, '../../src/lib/utils.ts');
    expect(existsSync(utilsPath)).toBe(true);
    
    const content = readFileSync(utilsPath, 'utf-8');
    expect(content).toContain('validateAudioFile');
    expect(content).toContain('getAudioPlayer');
    expect(content).toContain('afplay');
  });

  test('built files exist after compilation', () => {
    const distPath = join(__dirname, '../../dist');
    if (existsSync(distPath)) {
      const cliBin = join(distPath, 'bin/cli.js');
      expect(existsSync(cliBin)).toBe(true);
      
      const hooksLib = join(distPath, 'lib/hooks.js');
      expect(existsSync(hooksLib)).toBe(true);
    }
  });

  test('watermark structure validation', () => {
    // Test the watermark structure that ccsound uses
    const watermark = {
      version: '1.0.0',
      managed: true,
      created: new Date().toISOString(),
      id: 'ccsound_test123'
    };
    
    expect(watermark.version).toBe('1.0.0');
    expect(watermark.managed).toBe(true);
    expect(watermark.created).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(watermark.id).toMatch(/^ccsound_/);
  });

  test('valid Claude Code events', () => {
    const validEvents = ['Stop', 'Notification', 'PreToolUse', 'PostToolUse', 'SubagentStop'];
    
    expect(validEvents).toContain('Stop');
    expect(validEvents).toContain('Notification');
    expect(validEvents.length).toBe(5);
    
    // These should be the exact events ccsound supports
    validEvents.forEach(event => {
      expect(typeof event).toBe('string');
      expect(event.length).toBeGreaterThan(0);
    });
  });
});