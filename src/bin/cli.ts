#!/usr/bin/env node

/// <reference types="node" />

import { program } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { join } from 'path';
import { readFileSync } from 'fs';

import { 
  checkClaudeCodeInstallation,
  runAutoInstallation
} from '../lib/installer';
import {
  addSoundHook,
  listHooks,
  removeHooks,
  clearAllHooks,
  applyPreset
} from '../lib/hooks';
import {
  testSpecificEvent,
  testAllEvents
} from '../lib/test';
import {
  runDiagnostics,
  getSystemSounds,
  getSystemSoundPath,
  getAudioPlayer
} from '../lib/utils';
import { ClaudeCodeEvent, PresetName } from '../types';

const packageJsonPath = join(__dirname, '..', '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const { version } = packageJson;

async function quickstart() {
  console.log(chalk.cyan.bold('\nccsound - Claude Code Audio Hooks\n'));
  
  const { installed, version: claudeVersion } = await checkClaudeCodeInstallation();
  
  if (!installed) {
    console.log(chalk.red('Claude Code not found'));
    const { shouldInstall } = await inquirer.prompt<{ shouldInstall: boolean }>([{
      type: 'confirm',
      name: 'shouldInstall',
      message: 'Would you like to install Claude Code now?',
      default: true
    }]);
    
    if (shouldInstall) {
      await runAutoInstallation();
    } else {
      console.log(chalk.yellow('Claude Code is required for ccsound to work.'));
      process.exit(1);
    }
  } else {
    console.log(chalk.green(`Claude Code v${claudeVersion} detected`));
  }
  
  const { events } = await inquirer.prompt<{ events: ClaudeCodeEvent[] }>([{
    type: 'checkbox',
    name: 'events',
    message: 'Which events would you like audio notifications for?',
    choices: [
      { name: 'Stop (when Claude finishes responding)', value: 'Stop', checked: true },
      { name: 'Notification (when Claude needs input)', value: 'Notification' },
      { name: 'PreToolUse (before Claude runs tools)', value: 'PreToolUse' },
      { name: 'PostToolUse (after Claude runs tools)', value: 'PostToolUse' },
      { name: 'SubagentStop (when subagent finishes)', value: 'SubagentStop' }
    ]
  }]);
  
  if (events.length === 0) {
    console.log(chalk.yellow('No events selected. Exiting.'));
    return;
  }
  
  const soundChoice = await selectSoundWithPreview();
  
  let audioFile: string;
  if (soundChoice === 'custom') {
    const { customFile } = await inquirer.prompt<{ customFile: string }>([{
      type: 'input',
      name: 'customFile',
      message: 'Enter path to your audio file:',
      validate: (input) => {
        return input.trim() !== '' || 'Please enter a valid file path';
      }
    }]);
    audioFile = customFile;
  } else if (soundChoice.startsWith('system:')) {
    const soundName = soundChoice.replace('system:', '');
    audioFile = getSystemSoundPath(soundName);
  } else {
    // Fallback
    audioFile = getSystemSoundPath('Tink');
  }
  
  for (const event of events) {
    await addSoundHook(event, audioFile, {});
  }
  
  console.log(chalk.green('\nAudio hooks configured successfully!'));
  
  const { shouldTest } = await inquirer.prompt<{ shouldTest: boolean }>([{
    type: 'confirm',
    name: 'shouldTest',
    message: 'Would you like to test the audio notifications?',
    default: true
  }]);
  
  if (shouldTest) {
    console.log(chalk.cyan('\nTesting audio notifications...'));
    await testAllEvents({ events });
  }
  
  console.log(chalk.cyan('\nSetup complete! Audio notifications are now active.'));
  console.log(chalk.gray('Run "ccsound --help" to see all available commands.'));
}

async function selectSoundWithPreview(): Promise<string> {
  
  const systemSounds = getSystemSounds();
  const soundChoices = [
    { name: 'Custom audio file', value: 'custom', file: null },
    ...systemSounds.map(sound => ({ 
      name: `System: ${sound}`, 
      value: `system:${sound}`,
      file: getSystemSoundPath(sound)
    }))
  ];

  // Always try custom scroll interface first, fallback only if it fails
  try {
    return await useCustomSoundSelector(soundChoices);
  } catch (error) {
    // If custom interface fails, fall back to inquirer
    console.log(chalk.yellow('\nUsing standard interface (custom scroll not available)\n'));
    
    const { soundChoice } = await inquirer.prompt<{ soundChoice: string }>([{
      type: 'list',
      name: 'soundChoice',
      message: 'Choose your notification sound:',
      choices: soundChoices.map(choice => choice.name)
    }]);
    
    const selectedChoice = soundChoices.find(choice => choice.name === soundChoice);
    return selectedChoice?.value || 'custom';
  }
}

async function useCustomSoundSelector(soundChoices: Array<{name: string, value: string, file: string | null}>): Promise<string> {
  const { spawn } = require('child_process');

  console.log(chalk.cyan('\nChoose your notification sound:'));
  console.log(chalk.gray('Use arrow keys to navigate, Enter to select\n'));

  let currentIndex = 0;
  let audioProcess: any = null;
  let audioTimeout: NodeJS.Timeout | null = null;
  
  const renderChoices = () => {
    // Clear previous choices
    process.stdout.write('\x1b[2K'); // Clear current line
    for (let i = 0; i < soundChoices.length; i++) {
      process.stdout.write('\x1b[1A\x1b[2K'); // Move up and clear line
    }
    
    // Render all choices
    soundChoices.forEach((choice, index) => {
      const prefix = index === currentIndex ? chalk.cyan('❯') : ' ';
      const name = index === currentIndex ? chalk.cyan(choice.name) : choice.name;
      console.log(`${prefix} ${name}`);
    });
  };

  const stopCurrentAudio = () => {
    if (audioProcess && !audioProcess.killed) {
      audioProcess.kill('SIGTERM');
      audioProcess = null;
    }
    if (audioTimeout) {
      clearTimeout(audioTimeout);
      audioTimeout = null;
    }
  };

  const playCurrentSound = () => {
    // Stop any currently playing audio
    stopCurrentAudio();
    
    const currentChoice = soundChoices[currentIndex];
    if (currentChoice.file) {
      try {
        const player = getAudioPlayer();
        const args = player === 'afplay' ? [currentChoice.file] : ['-c', `${player} "${currentChoice.file}"`];
        const command = player === 'afplay' ? player : 'sh';
        
        audioProcess = spawn(command, args, { 
          stdio: 'ignore',
          detached: false
        });
        
        // Auto-kill after 3 seconds to prevent long sounds from blocking
        audioTimeout = setTimeout(() => {
          stopCurrentAudio();
        }, 3000);
        
        audioProcess.on('exit', () => {
          audioProcess = null;
          if (audioTimeout) {
            clearTimeout(audioTimeout);
            audioTimeout = null;
          }
        });
        
        audioProcess.on('error', () => {
          // Silently ignore audio playback errors
          audioProcess = null;
        });
      } catch (error) {
        // Silently ignore audio playback errors
      }
    }
  };

  const debouncedPlaySound = (() => {
    let debounceTimeout: NodeJS.Timeout | null = null;
    return () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      debounceTimeout = setTimeout(() => {
        playCurrentSound();
      }, 150); // 150ms debounce delay
    };
  })();

  // Initial render
  renderChoices();
  
  return new Promise((resolve, reject) => {
    // Try to set up raw mode, but be more permissive
    let hasRawMode = false;
    
    try {
      if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
        process.stdin.setRawMode(true);
        hasRawMode = true;
      }
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
    } catch (error) {
      // If we can't set raw mode, still try to work
      try {
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
      } catch (fallbackError) {
        reject(fallbackError);
        return;
      }
    }

    const cleanup = () => {
      stopCurrentAudio();
      try {
        if (hasRawMode && typeof process.stdin.setRawMode === 'function') {
          process.stdin.setRawMode(false);
        }
        process.stdin.pause();
      } catch (error) {
        // Ignore cleanup errors
      }
    };

    const onKeyPress = (key: string) => {
      if (key === '\u0003') { // Ctrl+C
        cleanup();
        process.exit();
      } else if (key === '\u001b[A' || key === 'k' || key === 'w') { // Up arrow or k or w
        const previousIndex = currentIndex;
        currentIndex = Math.max(0, currentIndex - 1);
        if (currentIndex !== previousIndex) {
          renderChoices();
          debouncedPlaySound();
        }
      } else if (key === '\u001b[B' || key === 'j' || key === 's') { // Down arrow or j or s
        const previousIndex = currentIndex;
        currentIndex = Math.min(soundChoices.length - 1, currentIndex + 1);
        if (currentIndex !== previousIndex) {
          renderChoices();
          debouncedPlaySound();
        }
      } else if (key === '\r' || key === '\n' || key === ' ') { // Enter, newline, or space
        cleanup();
        process.stdin.removeListener('data', onKeyPress);
        console.log(); // New line
        resolve(soundChoices[currentIndex].value);
      }
    };

    process.stdin.on('data', onKeyPress);
    
    // Play initial sound (skip custom audio file option) with delay
    if (soundChoices[currentIndex].file) {
      setTimeout(() => playCurrentSound(), 200);
    }
  });
}

async function interactiveRemove() {
  const { readSettingsFile, getEventHooks } = await import('../lib/config');
  const { findExistingccsoundHooks } = await import('../lib/hooks');
  
  console.log(chalk.cyan('\nRemove ccsound hooks\n'));
  
  const config = await readSettingsFile();
  const eventsWithHooks: ClaudeCodeEvent[] = [];
  
  // Find events that have ccsound hooks
  const allEvents: ClaudeCodeEvent[] = ['Stop', 'Notification', 'PreToolUse', 'PostToolUse', 'SubagentStop'];
  for (const event of allEvents) {
    const eventHooks = getEventHooks(config, event);
    const ccsoundHooks = findExistingccsoundHooks(eventHooks);
    if (ccsoundHooks.length > 0) {
      eventsWithHooks.push(event);
    }
  }
  
  if (eventsWithHooks.length === 0) {
    console.log(chalk.yellow('No ccsound-managed hooks found to remove.'));
    console.log(chalk.gray('Run "ccsound" to set up audio notifications.'));
    return;
  }
  
  const { selectedEvent } = await inquirer.prompt<{ selectedEvent: ClaudeCodeEvent }>([{
    type: 'list',
    name: 'selectedEvent',
    message: 'Which event would you like to remove hooks for?',
    choices: eventsWithHooks.map(event => ({
      name: `${event} (${getEventDescription(event)})`,
      value: event
    }))
  }]);
  
  const { removeHooks } = await import('../lib/hooks');
  await removeHooks(selectedEvent);
}

function getEventDescription(event: ClaudeCodeEvent): string {
  switch (event) {
    case 'Stop': return 'when Claude finishes responding';
    case 'Notification': return 'when Claude needs input';
    case 'PreToolUse': return 'before Claude runs tools';
    case 'PostToolUse': return 'after Claude runs tools';
    case 'SubagentStop': return 'when subagent finishes';
    default: return '';
  }
}

program
  .name('ccsound')
  .description('CLI tool to add audio notifications to Claude Code events')
  .version(version);

program
  .command('add-sound')
  .description('Add audio hook for specific event')
  .option('-e, --event <event>', 'Event type (Stop, Notification, PreToolUse, PostToolUse, SubagentStop)')
  .option('-f, --file <path>', 'Path to audio file')
  .option('--events <list>', 'Comma-separated list of events')
  .option('-m, --matcher <pattern>', 'Tool matcher for PreToolUse/PostToolUse')
  .action(async (options) => {
    if (!options.file) {
      console.error(chalk.red('Error: --file option is required'));
      process.exit(1);
    }
    
    const events = options.events 
      ? options.events.split(',').map((e: string) => e.trim()) 
      : [options.event];
    
    if (!events[0]) {
      console.error(chalk.red('Error: --event or --events option is required'));
      process.exit(1);
    }
    
    for (const event of events) {
      await addSoundHook(event as ClaudeCodeEvent, options.file, { matcher: options.matcher });
    }
  });

program
  .command('list')
  .description('Display all ccsound-managed hooks')
  .action(async () => {
    await listHooks();
  });

program
  .command('test [event]')
  .description('Test audio hooks')
  .option('-a, --all', 'Test all events')
  .option('-v, --verbose', 'Show detailed output')
  .option('-d, --dry-run', "Don't actually play sounds")
  .option('-s, --show-command', 'Display executed commands')
  .option('--delay <ms>', 'Delay between sounds', '1000')
  .action(async (event, options) => {
    if (options.all) {
      await testAllEvents(options);
    } else if (event) {
      await testSpecificEvent(event as ClaudeCodeEvent, options);
    } else {
      console.error(chalk.red('Error: Specify an event or use --all'));
      process.exit(1);
    }
  });

program
  .command('remove [event]')
  .description('Remove ccsound hooks for specific event')
  .action(async (event) => {
    if (event) {
      await removeHooks(event as ClaudeCodeEvent);
    } else {
      await interactiveRemove();
    }
  });

program
  .command('clear')
  .description('Remove all ccsound-managed hooks')
  .action(async () => {
    await clearAllHooks();
  });

program
  .command('doctor')
  .description('Run comprehensive diagnostics')
  .action(async () => {
    await runDiagnostics();
  });

program
  .command('preset <name>')
  .description('Apply predefined hook configurations (minimal, complete, development)')
  .action(async (presetName: string) => {
    const validPresets: PresetName[] = ['minimal', 'complete', 'development'];
    if (!validPresets.includes(presetName as PresetName)) {
      console.error(chalk.red(`Error: Invalid preset '${presetName}'. Valid presets: ${validPresets.join(', ')}`));
      process.exit(1);
    }
    await applyPreset(presetName as PresetName);
  });

if (process.argv.length === 2) {
  quickstart().catch(console.error);
} else {
  program.parse(process.argv);
}