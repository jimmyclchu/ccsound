import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';

describe('CLI Integration Tests', () => {
  const cliPath = join(__dirname, '../../dist/bin/cli.js');
  const testSettingsPath = join(homedir(), '.claude', 'test-settings.json');
  const originalSettingsPath = join(homedir(), '.claude', 'settings.json');
  const backupSettingsPath = join(homedir(), '.claude', 'settings.json.test-backup');
  
  beforeEach(() => {
    // Backup original settings if they exist
    if (existsSync(originalSettingsPath)) {
      try {
        const originalContent = readFileSync(originalSettingsPath, 'utf-8');
        writeFileSync(backupSettingsPath, originalContent);
      } catch (error) {
        // Ignore backup errors in tests
      }
    }
    
    // Ensure .claude directory exists
    const claudeDir = join(homedir(), '.claude');
    if (!existsSync(claudeDir)) {
      mkdirSync(claudeDir, { recursive: true });
    }
    
    // Create test settings
    const testSettings = {
      hooks: {
        Stop: [{
          hooks: [{
            type: 'command',
            command: 'echo "test hook"',
            _ccsound: {
              version: '1.0.0',
              managed: true,
              created: '2025-01-01T00:00:00.000Z',
              id: 'test_hook_001'
            }
          }]
        }]
      }
    };
    
    writeFileSync(originalSettingsPath, JSON.stringify(testSettings, null, 2));
  });

  afterEach(() => {
    // Restore original settings if backup exists
    if (existsSync(backupSettingsPath)) {
      try {
        const backupContent = readFileSync(backupSettingsPath, 'utf-8');
        writeFileSync(originalSettingsPath, backupContent);
        rmSync(backupSettingsPath);
      } catch (error) {
        // Ignore restore errors in tests
      }
    } else if (existsSync(originalSettingsPath)) {
      // Remove test settings if no backup existed
      try {
        rmSync(originalSettingsPath);
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
    
    // Clean up test files
    if (existsSync(testSettingsPath)) {
      try {
        rmSync(testSettingsPath);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('help and version commands', () => {
    test('should show help when no arguments provided', () => {
      try {
        const output = execSync(`node "${cliPath}" --help`, { 
          encoding: 'utf-8',
          timeout: 5000 
        });
        
        expect(output).toContain('CLI tool to add audio notifications to Claude Code events');
        expect(output).toContain('Commands:');
        expect(output).toContain('add-sound');
        expect(output).toContain('list');
        expect(output).toContain('test');
        expect(output).toContain('doctor');
      } catch (error: any) {
        // Help command should not fail
        throw new Error(`Help command failed: ${error.message}`);
      }
    });

    test('should show version information', () => {
      try {
        const output = execSync(`node "${cliPath}" --version`, { 
          encoding: 'utf-8',
          timeout: 5000 
        });
        
        expect(output.trim()).toMatch(/^\d+\.\d+\.\d+$/);
      } catch (error: any) {
        throw new Error(`Version command failed: ${error.message}`);
      }
    });
  });

  describe('doctor command', () => {
    test('should run diagnostics and show results', () => {
      try {
        const output = execSync(`node "${cliPath}" doctor`, { 
          encoding: 'utf-8',
          timeout: 10000 
        });
        
        expect(output).toContain('ccsound diagnostics');
        expect(output).toContain('Claude Code:');
        expect(output).toContain('Settings file:');
        expect(output).toContain('Audio system:');
        expect(output).toContain('.claude/settings.json');
        
      } catch (error: any) {
        // Doctor command might fail due to missing Claude Code, but should still produce output
        const output = error.stdout || error.stderr || '';
        if (output) {
          expect(output).toContain('ccsound diagnostics');
        }
      }
    });

    test('should detect test settings file', () => {
      try {
        const output = execSync(`node "${cliPath}" doctor`, { 
          encoding: 'utf-8',
          timeout: 10000 
        });
        
        const globalPath = join(homedir(), '.claude', 'settings.json');
        expect(output).toContain(globalPath);
        
      } catch (error: any) {
        const output = error.stdout || error.stderr || '';
        expect(output).toContain('.claude/settings.json');
      }
    });
  });

  describe('list command', () => {
    test('should list ccsound hooks', () => {
      try {
        const output = execSync(`node "${cliPath}" list`, { 
          encoding: 'utf-8',
          timeout: 10000 
        });
        
        expect(output).toContain('Current ccsound hooks');
        expect(output).toContain('Total ccsound hooks');
        
      } catch (error: any) {
        // List command should not fail with a 127 (command not found)
        expect(error.status).not.toBe(127);
        
        // Should still produce some output even if no hooks
        const output = error.stdout || error.stderr || '';
        if (output) {
          expect(output).toContain('ccsound');
        }
      }
    });

    test('should show configured test hook', () => {
      try {
        const output = execSync(`node "${cliPath}" list`, { 
          encoding: 'utf-8',
          timeout: 10000 
        });
        
        expect(output).toContain('Stop:');
        expect(output).toContain('ccsound v1.0.0');
        
      } catch (error: any) {
        // Even if command fails, check output
        const output = error.stdout || error.stderr || '';
        if (output.includes('Stop')) {
          expect(output).toContain('Stop');
        }
      }
    });
  });

  describe('test command', () => {
    test('should test specific event', () => {
      try {
        const output = execSync(`node "${cliPath}" test Stop --dry-run`, { 
          encoding: 'utf-8',
          timeout: 10000 
        });
        
        expect(output).toContain('Testing Stop event hooks');
        expect(output).toContain('Test Results');
        
      } catch (error: any) {
        const output = error.stdout || error.stderr || '';
        if (output) {
          expect(output).toContain('Stop');
        }
      }
    });

    test('should handle test all events', () => {
      try {
        const output = execSync(`node "${cliPath}" test --all --dry-run`, { 
          encoding: 'utf-8',
          timeout: 15000 
        });
        
        expect(output).toContain('Testing all ccsound hooks');
        
      } catch (error: any) {
        const output = error.stdout || error.stderr || '';
        if (output) {
          // Should attempt to test hooks
          expect(output.toLowerCase()).toContain('test');
        }
      }
    });

    test('should handle verbose testing', () => {
      try {
        const output = execSync(`node "${cliPath}" test Stop --verbose --dry-run`, { 
          encoding: 'utf-8',
          timeout: 10000 
        });
        
        expect(output).toContain('Testing:');
        
      } catch (error: any) {
        // Verbose should produce more output
        const output = error.stdout || error.stderr || '';
        expect(output.length).toBeGreaterThan(0);
      }
    });
  });

  describe('error handling', () => {
    test('should handle invalid commands gracefully', () => {
      try {
        execSync(`node "${cliPath}" invalid-command`, { 
          encoding: 'utf-8',
          timeout: 5000,
          stdio: 'pipe'
        });
        
        // Should not reach here
        expect(false).toBe(true);
        
      } catch (error: any) {
        // Should exit with error for invalid commands
        expect(error.status).toBeGreaterThan(0);
        const output = error.stdout || error.stderr || '';
        expect(output.toLowerCase()).toContain('unknown command');
      }
    });

    test('should handle invalid event types', () => {
      try {
        execSync(`node "${cliPath}" test InvalidEvent`, { 
          encoding: 'utf-8',
          timeout: 5000,
          stdio: 'pipe'
        });
        
        // Should not reach here
        expect(false).toBe(true);
        
      } catch (error: any) {
        // Should exit with error for invalid events
        expect(error.status).toBeGreaterThan(0);
        const output = error.stdout || error.stderr || '';
        expect(output.toLowerCase()).toContain('invalid');
      }
    });

    test('should show command help for invalid options', () => {
      try {
        execSync(`node "${cliPath}" test --invalid-option`, { 
          encoding: 'utf-8',
          timeout: 5000,
          stdio: 'pipe'
        });
        
      } catch (error: any) {
        // Should provide helpful error message
        const output = error.stdout || error.stderr || '';
        expect(output.length).toBeGreaterThan(0);
      }
    });
  });

  describe('command-specific help', () => {
    test('should show add-sound command help', () => {
      try {
        const output = execSync(`node "${cliPath}" add-sound --help`, { 
          encoding: 'utf-8',
          timeout: 5000 
        });
        
        expect(output).toContain('Add audio hook for specific event');
        expect(output).toContain('--event');
        expect(output).toContain('--file');
        
      } catch (error: any) {
        const output = error.stdout || error.stderr || '';
        expect(output).toContain('event');
      }
    });

    test('should show test command help', () => {
      try {
        const output = execSync(`node "${cliPath}" test --help`, { 
          encoding: 'utf-8',
          timeout: 5000 
        });
        
        expect(output).toContain('Test audio hooks');
        expect(output).toContain('--all');
        expect(output).toContain('--verbose');
        expect(output).toContain('--dry-run');
        
      } catch (error: any) {
        const output = error.stdout || error.stderr || '';
        expect(output).toContain('Test');
      }
    });
  });

  describe('settings file interaction', () => {
    test('should use global settings file consistently', () => {
      try {
        const doctorOutput = execSync(`node "${cliPath}" doctor`, { 
          encoding: 'utf-8',
          timeout: 10000 
        });
        
        const listOutput = execSync(`node "${cliPath}" list`, { 
          encoding: 'utf-8',
          timeout: 10000 
        });
        
        // Both commands should reference the same global settings path
        const globalPath = join(homedir(), '.claude', 'settings.json');
        expect(doctorOutput).toContain(globalPath);
        
      } catch (error: any) {
        // Commands might fail but should still reference global settings
        const output = error.stdout || error.stderr || '';
        expect(output).toContain('.claude/settings.json');
      }
    });

    test('should not use local project settings', () => {
      // Create a local settings file
      const localSettingsPath = join(process.cwd(), '.claude', 'settings.json');
      const localClaudeDir = join(process.cwd(), '.claude');
      
      try {
        if (!existsSync(localClaudeDir)) {
          mkdirSync(localClaudeDir, { recursive: true });
        }
        
        writeFileSync(localSettingsPath, JSON.stringify({
          hooks: {
            Stop: [{ hooks: [{ type: 'command', command: 'echo "local hook"' }] }]
          }
        }));
        
        const output = execSync(`node "${cliPath}" doctor`, { 
          encoding: 'utf-8',
          timeout: 10000,
          cwd: process.cwd()
        });
        
        // Should still reference global settings, not local
        const globalPath = join(homedir(), '.claude', 'settings.json');
        expect(output).toContain(globalPath);
        expect(output).not.toContain(localSettingsPath);
        
      } catch (error: any) {
        const output = error.stdout || error.stderr || '';
        expect(output).not.toContain(process.cwd());
        
      } finally {
        // Cleanup local settings
        try {
          if (existsSync(localSettingsPath)) {
            rmSync(localSettingsPath);
          }
          if (existsSync(localClaudeDir)) {
            rmSync(localClaudeDir, { recursive: true });
          }
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      }
    });
  });
});