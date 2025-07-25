import chalk from 'chalk';
import { resolve, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import inquirer from 'inquirer';
import { readFileSync } from 'fs';
import {
  readSettingsFile,
  writeSettingsFile,
  getEventHooks,
  setEventHooks
} from './config';
import { validateAudioFile, getAudioPlayer, getSystemSoundPath } from './utils';
import { 
  ClaudeCodeEvent, 
  HookGroup, 
  Hook, 
  ccsoundWatermark,
  AddSoundOptions,
  PresetName
} from '../types';

const packageJsonPath = join(__dirname, '..', '..', 'package.json');
const { version } = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

const VALID_EVENTS: ClaudeCodeEvent[] = ['Stop', 'Notification', 'PreToolUse', 'PostToolUse', 'SubagentStop'];

function createWatermark(): ccsoundWatermark {
  return {
    version,
    managed: true,
    created: new Date().toISOString(),
    id: `ccsound_${uuidv4().slice(0, 8)}`
  };
}

function createAudioHook(event: ClaudeCodeEvent, audioFile: string, options: AddSoundOptions = {}): HookGroup {
  const player = getAudioPlayer();
  const expandedPath = audioFile.replace(/^~/, process.env.HOME || '');
  
  const hook: Hook = {
    type: 'command',
    command: `${player} "${expandedPath}"`,
    _ccsound: createWatermark()
  };
  
  if (options.matcher && (event === 'PreToolUse' || event === 'PostToolUse')) {
    return {
      matchers: [options.matcher],
      hooks: [hook]
    };
  }
  
  return {
    hooks: [hook]
  };
}

export function isccsoundManaged(hookGroup: HookGroup): boolean {
  return hookGroup.hooks.some(h => h._ccsound && h._ccsound.managed);
}

export function findExistingAudioHook(eventHooks: HookGroup[], audioFile: string): HookGroup | null {
  const expandedPath = resolve(audioFile.replace(/^~/, process.env.HOME || ''));
  
  for (const hookGroup of eventHooks) {
    if (!isccsoundManaged(hookGroup)) continue;
    
    for (const hook of hookGroup.hooks) {
      if (hook.type === 'command' && hook.command) {
        const commandParts = hook.command.match(/^(\S+)\s+"?([^"]+)"?$/);
        if (commandParts) {
          const hookPath = resolve(commandParts[2].replace(/^~/, process.env.HOME || ''));
          if (hookPath === expandedPath) {
            return hookGroup;
          }
        }
      }
    }
  }
  
  return null;
}

export function findExistingccsoundHooks(eventHooks: HookGroup[]): HookGroup[] {
  return eventHooks.filter(hookGroup => isccsoundManaged(hookGroup));
}

export async function addSoundHook(event: ClaudeCodeEvent, audioFile: string, options: AddSoundOptions = {}): Promise<void> {
  if (!VALID_EVENTS.includes(event)) {
    console.error(chalk.red(`Error: Invalid event '${event}'. Valid events: ${VALID_EVENTS.join(', ')}`));
    process.exit(1);
  }
  
  const validation = await validateAudioFile(audioFile);
  if (!validation.exists) {
    console.error(chalk.red(`Error: Audio file not found: ${audioFile}`));
    console.error(chalk.yellow('Please provide a valid audio file path.'));
    process.exit(1);
  }
  
  const config = await readSettingsFile();
  const eventHooks = getEventHooks(config, event);
  
  // Check if this exact audio file already exists for this event
  const exactMatch = findExistingAudioHook(eventHooks, audioFile);
  if (exactMatch) {
    console.log(chalk.yellow(`Audio hook already exists for ${event} event with file: ${audioFile}`));
    return;
  }
  
  // Find any existing ccsound hooks for this event (to replace them)
  const existingccsoundHooks = findExistingccsoundHooks(eventHooks);
  const nonccsoundHooks = eventHooks.filter(hookGroup => !isccsoundManaged(hookGroup));
  
  const newHook = createAudioHook(event, audioFile, options);
  
  // Replace existing ccsound hooks with the new one
  const updatedHooks = [...nonccsoundHooks, newHook];
  
  setEventHooks(config, event, updatedHooks);
  await writeSettingsFile(config);
  
  if (existingccsoundHooks.length > 0) {
    console.log(chalk.green(`Replaced existing audio hook for ${event} event: ${audioFile}`));
  } else {
    console.log(chalk.green(`Added audio hook for ${event} event: ${audioFile}`));
  }
}

export async function listHooks(): Promise<void> {
  const config = await readSettingsFile();
  console.log(chalk.cyan('\nCurrent ccsound hooks:'));
  
  let ccsoundCount = 0;
  let otherCount = 0;
  
  for (const event of VALID_EVENTS) {
    const eventHooks = getEventHooks(config, event);
    
    for (const hookGroup of eventHooks) {
      if (isccsoundManaged(hookGroup)) {
        ccsoundCount++;
        for (const hook of hookGroup.hooks) {
          if (hook.type === 'command' && hook._ccsound) {
            const audioFile = hook.command.match(/"([^"]+)"/)?.[1] || hook.command.split(' ')[1];
            console.log(chalk.white(`• ${event}: ${audioFile} (ccsound v${hook._ccsound.version})`));
          }
        }
      } else {
        otherCount++;
      }
    }
  }
  
  if (ccsoundCount === 0) {
    console.log(chalk.gray('No ccsound-managed hooks found.'));
  }
  
  if (otherCount > 0) {
    console.log(chalk.gray(`\nFound ${otherCount} other non-ccsound hooks (preserved)`));
  }
  
  console.log(chalk.cyan(`\nTotal ccsound hooks: ${ccsoundCount}`));
}

export async function removeHooks(event: ClaudeCodeEvent): Promise<void> {
  if (!VALID_EVENTS.includes(event)) {
    console.error(chalk.red(`Error: Invalid event '${event}'. Valid events: ${VALID_EVENTS.join(', ')}`));
    process.exit(1);
  }
  
  const config = await readSettingsFile();
  const eventHooks = getEventHooks(config, event);
  
  const filteredHooks = eventHooks.filter(hookGroup => !isccsoundManaged(hookGroup));
  const removedCount = eventHooks.length - filteredHooks.length;
  
  if (removedCount === 0) {
    console.log(chalk.yellow(`No ccsound-managed hooks found for ${event} event.`));
    return;
  }
  
  setEventHooks(config, event, filteredHooks);
  await writeSettingsFile(config);
  
  console.log(chalk.green(`Removed ${removedCount} ccsound hook(s) for ${event} event.`));
}

export async function clearAllHooks(): Promise<void> {
  const { confirm } = await inquirer.prompt<{ confirm: boolean }>([{
    type: 'confirm',
    name: 'confirm',
    message: 'Are you sure you want to remove ALL ccsound-managed hooks?',
    default: false
  }]);
  
  if (!confirm) {
    console.log(chalk.yellow('Operation cancelled.'));
    return;
  }
  
  const config = await readSettingsFile();
  let totalRemoved = 0;
  
  for (const event of VALID_EVENTS) {
    const eventHooks = getEventHooks(config, event);
    const filteredHooks = eventHooks.filter(hookGroup => !isccsoundManaged(hookGroup));
    const removedCount = eventHooks.length - filteredHooks.length;
    
    if (removedCount > 0) {
      totalRemoved += removedCount;
      setEventHooks(config, event, filteredHooks);
    }
  }
  
  if (totalRemoved === 0) {
    console.log(chalk.yellow('No ccsound-managed hooks found.'));
    return;
  }
  
  await writeSettingsFile(config);
  console.log(chalk.green(`Removed ${totalRemoved} ccsound-managed hook(s).`));
}

export async function applyPreset(presetName: PresetName): Promise<void> {
  const presets: Record<PresetName, Record<ClaudeCodeEvent, string>> = {
    minimal: {
      Stop: getSystemSoundPath('Tink')
    } as Record<ClaudeCodeEvent, string>,
    complete: {
      Stop: getSystemSoundPath('Tink'),
      Notification: getSystemSoundPath('Glass'),
      PreToolUse: getSystemSoundPath('Ping'),
      PostToolUse: getSystemSoundPath('Pop'),
      SubagentStop: getSystemSoundPath('Tink')
    },
    development: {
      PreToolUse: getSystemSoundPath('Ping'),
      PostToolUse: getSystemSoundPath('Pop'),
      Stop: getSystemSoundPath('Tink')
    } as Record<ClaudeCodeEvent, string>
  };
  
  const preset = presets[presetName];
  if (!preset) {
    console.error(chalk.red(`Error: Unknown preset '${presetName}'`));
    process.exit(1);
  }
  
  console.log(chalk.cyan(`\nApplying '${presetName}' preset...`));
  
  for (const [event, audioFile] of Object.entries(preset)) {
    await addSoundHook(event as ClaudeCodeEvent, audioFile, {});
  }
  
  console.log(chalk.green(`\nPreset '${presetName}' applied successfully!`));
}

export {
  createWatermark
};