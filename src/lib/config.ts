import { ensureDir, pathExists, readFile, writeFile, copy, move, chmod, remove } from 'fs-extra';
import { join, dirname } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';
import { SettingsConfig, ClaudeCodeEvent, HookGroup } from '../types';

/**
 * Get the Claude Code settings file path for ccsound hooks.
 * 
 * ccsound always uses the global settings file because audio notifications
 * are user preferences that should work across all projects. Local settings
 * files (.claude/settings.local.json) are preserved for project-specific 
 * configurations like permissions.
 * 
 * @returns Promise<string> Path to ~/.claude/settings.json
 */
export async function getSettingsPath(): Promise<string> {
  const globalPath = join(homedir(), '.claude', 'settings.json');
  return globalPath;
}

export async function readSettingsFile(): Promise<SettingsConfig> {
  const settingsPath = await getSettingsPath();
  
  try {
    await ensureDir(dirname(settingsPath));
    
    if (!await pathExists(settingsPath)) {
      const defaultSettings: SettingsConfig = {
        hooks: {}
      };
      await writeSettingsFile(defaultSettings);
      return defaultSettings;
    }
    
    const content = await readFile(settingsPath, 'utf-8');
    return JSON.parse(content);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      const defaultSettings: SettingsConfig = {
        hooks: {}
      };
      await writeSettingsFile(defaultSettings);
      return defaultSettings;
    }
    
    if (error instanceof SyntaxError) {
      console.error(chalk.red(`Error parsing settings file: ${error.message}`));
      console.error(chalk.yellow('Please fix the JSON syntax or backup and delete the file.'));
      process.exit(1);
    }
    
    throw error;
  }
}

export async function writeSettingsFile(config: SettingsConfig): Promise<void> {
  const settingsPath = await getSettingsPath();
  
  try {
    await ensureDir(dirname(settingsPath));
    
    const backupPath = `${settingsPath}.backup`;
    if (await pathExists(settingsPath)) {
      await copy(settingsPath, backupPath);
    }
    
    const tempPath = `${settingsPath}.tmp`;
    await writeFile(tempPath, JSON.stringify(config, null, 2) + '\n');
    
    await move(tempPath, settingsPath, { overwrite: true });
    
    await chmod(settingsPath, 0o644);
    
    if (await pathExists(backupPath)) {
      await remove(backupPath);
    }
  } catch (error: any) {
    console.error(chalk.red(`Error writing settings file: ${error.message}`));
    throw error;
  }
}

export function ensureHooksStructure(config: SettingsConfig): SettingsConfig {
  if (!config.hooks) {
    config.hooks = {};
  }
  
  return config;
}

export function getEventHooks(config: SettingsConfig, event: ClaudeCodeEvent): HookGroup[] {
  ensureHooksStructure(config);
  
  const eventHooks = config.hooks[event];
  if (!eventHooks) {
    return [];
  }
  
  return eventHooks;
}

export function setEventHooks(config: SettingsConfig, event: ClaudeCodeEvent, hooks: HookGroup[]): void {
  ensureHooksStructure(config);
  config.hooks[event] = hooks;
}