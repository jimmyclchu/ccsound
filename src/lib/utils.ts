import { execSync } from 'child_process';
import { access, constants } from 'fs/promises';
import { resolve } from 'path';
import { platform } from 'os';
import chalk from 'chalk';
import { checkClaudeCodeInstallation } from './installer';
import { readSettingsFile, getSettingsPath, getEventHooks } from './config';
import { AudioValidation, ClaudeCodeEvent } from '../types';

const VALID_EVENTS: ClaudeCodeEvent[] = ['Stop', 'Notification', 'PreToolUse', 'PostToolUse', 'SubagentStop'];

export function getAudioPlayer(): string {
  const currentPlatform = platform();
  
  switch (currentPlatform) {
    case 'darwin':
      return 'afplay';
    case 'linux':
      return 'aplay';
    case 'win32':
      return 'powershell -c "(New-Object Media.SoundPlayer \'%s\').PlaySync();"';
    default:
      return 'afplay';
  }
}

export function getSystemSounds(): string[] {
  const currentPlatform = platform();
  
  switch (currentPlatform) {
    case 'darwin':
      try {
        const { execSync } = require('child_process');
        const soundsDir = '/System/Library/Sounds/';
        const files = execSync(`ls "${soundsDir}"*.aiff 2>/dev/null || echo ""`, { encoding: 'utf-8' });
        return files.trim().split('\n').filter((f: string) => f).map((f: string) => f.replace(soundsDir, '').replace('.aiff', ''));
      } catch {
        // Fallback list of common macOS sounds
        return ['Basso', 'Blow', 'Bottle', 'Frog', 'Funk', 'Glass', 'Hero', 'Morse', 'Ping', 'Pop', 'Purr', 'Sosumi', 'Submarine', 'Tink'];
      }
    case 'linux':
      // Linux systems vary, but these are common
      return ['bell', 'beep', 'click'];
    case 'win32':
      // Windows system sounds
      return ['SystemAsterisk', 'SystemExclamation', 'SystemNotification', 'SystemQuestion'];
    default:
      return ['Tink', 'Glass', 'Ping'];
  }
}

export function getSystemSoundPath(soundName: string): string {
  const currentPlatform = platform();
  
  switch (currentPlatform) {
    case 'darwin':
      return `/System/Library/Sounds/${soundName}.aiff`;
    case 'linux':
      return `/usr/share/sounds/alsa/${soundName}.wav`;
    case 'win32':
      return soundName; // Windows uses sound names, not file paths
    default:
      return `/System/Library/Sounds/${soundName}.aiff`;
  }
}

// Alternative audio methods for macOS if afplay doesn't work
export function getAlternativeAudioCommand(audioFile: string): string {
  const currentPlatform = platform();
  
  if (currentPlatform === 'darwin') {
    // Alternative 1: Using osascript to play system sounds
    return `osascript -e 'set volume output volume 50' -e 'do shell script "afplay \\"${audioFile}\\""'`;
  }
  
  return `afplay "${audioFile}"`;
}

export async function validateAudioFile(audioFile: string): Promise<AudioValidation> {
  try {
    const expandedPath = resolve(audioFile.replace(/^~/, process.env.HOME || ''));
    await access(expandedPath, constants.F_OK);
    return { exists: true, path: expandedPath };
  } catch (error: any) {
    return { 
      exists: false, 
      path: audioFile,
      error: error.message 
    };
  }
}

export async function runDiagnostics(): Promise<void> {
  console.log(chalk.cyan('\nccsound diagnostics\n'));
  
  // Check Claude Code installation
  const { installed: claudeInstalled, version: claudeVersion } = await checkClaudeCodeInstallation();
  const claudeStatus = claudeInstalled 
    ? chalk.green(`Claude Code: v${claudeVersion} installed`)
    : chalk.red('Claude Code: not found');
  console.log(claudeStatus);
  
  // Check settings file
  const settingsPath = await getSettingsPath();
  let settingsWritable = false;
  try {
    await access(settingsPath, constants.W_OK);
    settingsWritable = true;
  } catch {
    // File might not exist yet, that's okay
    settingsWritable = true;
  }
  
  const settingsStatus = settingsWritable
    ? chalk.green(`Settings file: ${settingsPath} (writable)`)
    : chalk.red(`Settings file: ${settingsPath} (not writable)`);
  console.log(settingsStatus);
  
  // Check audio system
  const audioPlayer = getAudioPlayer();
  let audioAvailable = false;
  try {
    if (platform() === 'darwin') {
      execSync('which afplay', { stdio: 'ignore' });
      audioAvailable = true;
    } else if (platform() === 'linux') {
      execSync('which aplay', { stdio: 'ignore' });
      audioAvailable = true;
    } else {
      audioAvailable = true; // Assume PowerShell is available on Windows
    }
  } catch {
    audioAvailable = false;
  }
  
  const audioStatus = audioAvailable
    ? chalk.green(`Audio system: ${audioPlayer} available`)
    : chalk.red(`Audio system: ${audioPlayer} not available`);
  console.log(audioStatus);
  
  // Check ccsound hooks
  const config = await readSettingsFile();
  let ccsoundHooks = 0;
  const invalidHooks: Array<{ event: string; error: string }> = [];
  
  // Helper function to check if a hook group is managed by ccsound
  const isccsoundManaged = (hookGroup: any) => {
    return hookGroup.hooks && hookGroup.hooks.some((h: any) => h._ccsound && h._ccsound.managed);
  };
  
  for (const event of VALID_EVENTS) {
    const eventHooks = getEventHooks(config, event);
    
    for (const hookGroup of eventHooks) {
      if (isccsoundManaged(hookGroup)) {
        ccsoundHooks++;
        
        for (const hook of hookGroup.hooks) {
          if (hook.type === 'command' && hook.command) {
            const audioFile = hook.command.match(/"([^"]+)"/)?.[1] || hook.command.split(' ')[1];
            if (audioFile) {
              const validation = await validateAudioFile(audioFile);
              if (!validation.exists) {
                invalidHooks.push({
                  event,
                  error: `file not found: ${audioFile}`
                });
              }
            }
          }
        }
      }
    }
  }
  
  const hooksStatus = ccsoundHooks > 0
    ? chalk.green(`ccsound hooks: ${ccsoundHooks} configured, ${ccsoundHooks - invalidHooks.length} valid`)
    : chalk.yellow('ccsound hooks: none configured');
  console.log(hooksStatus);
  
  // Display managed hooks details
  if (ccsoundHooks > 0) {
    console.log(chalk.cyan('\nManaged hooks:'));
    
    for (const event of VALID_EVENTS) {
      const eventHooks = getEventHooks(config, event);
      
      for (const hookGroup of eventHooks) {
        if (isccsoundManaged(hookGroup)) {
          for (const hook of hookGroup.hooks) {
            if (hook.type === 'command' && hook._ccsound) {
              const audioFile = hook.command.match(/"([^"]+)"/)?.[1] || hook.command.split(' ')[1];
              const isInvalid = invalidHooks.some(ih => ih.event === event && ih.error.includes(audioFile || ''));
              const status = isInvalid ? chalk.red('FAIL') : chalk.green('PASS');
              const version = hook._ccsound.version;
              
              console.log(`${status} ${event}: ${audioFile} (ccsound v${version})`);
              
              if (isInvalid) {
                const error = invalidHooks.find(ih => ih.event === event && ih.error.includes(audioFile || ''));
                console.log(chalk.gray(`     ${error?.error}`));
              }
            }
          }
        }
      }
    }
  }
  
  // Recommendations
  const recommendations: string[] = [];
  
  if (!claudeInstalled) {
    recommendations.push('Install Claude Code: npm install -g @anthropic-ai/claude-code');
  }
  
  if (!audioAvailable) {
    recommendations.push(`Install audio player: ${audioPlayer}`);
  }
  
  if (invalidHooks.length > 0) {
    recommendations.push('Replace missing audio files or reconfigure hooks');
  }
  
  if (ccsoundHooks === 0) {
    recommendations.push('Configure audio hooks with: ccsound');
  } else if (ccsoundHooks === 1 && !invalidHooks.length) {
    recommendations.push('Consider adding more events for better workflow feedback');
  }
  
  if (recommendations.length > 0) {
    console.log(chalk.cyan('\nRecommendations:'));
    recommendations.forEach(rec => {
      console.log(chalk.gray(`  ${rec}`));
    });
  }
  
  console.log('');
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}