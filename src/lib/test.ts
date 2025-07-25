import { execSync } from 'child_process';
import chalk from 'chalk';
import { readSettingsFile, getEventHooks } from './config';
import { validateAudioFile, delay } from './utils';
import { ClaudeCodeEvent, TestOptions } from '../types';

const VALID_EVENTS: ClaudeCodeEvent[] = ['Stop', 'Notification', 'PreToolUse', 'PostToolUse', 'SubagentStop'];

// Helper function to check if a hook group is managed by ccsound
const isccsoundManaged = (hookGroup: any) => {
  return hookGroup.hooks && hookGroup.hooks.some((h: any) => h._ccsound && h._ccsound.managed);
};

export async function testSpecificEvent(event: ClaudeCodeEvent, options: TestOptions = {}): Promise<void> {
  if (!VALID_EVENTS.includes(event)) {
    console.error(chalk.red(`Error: Invalid event '${event}'. Valid events: ${VALID_EVENTS.join(', ')}`));
    process.exit(1);
  }
  
  console.log(chalk.cyan(`\nTesting ${event} event hooks...\n`));
  
  const config = await readSettingsFile();
  const eventHooks = getEventHooks(config, event);
  
  const ccsoundHooks = eventHooks.filter(hookGroup => isccsoundManaged(hookGroup));
  
  if (ccsoundHooks.length === 0) {
    console.log(chalk.yellow(`No ccsound-managed hooks found for ${event} event.`));
    console.log(chalk.gray(`Run "ccsound add-sound --event ${event} --file <audio-file>" to add one.`));
    return;
  }
  
  let successCount = 0;
  let failureCount = 0;
  
  for (const hookGroup of ccsoundHooks) {
    for (const hook of hookGroup.hooks) {
      if (hook.type === 'command' && hook.command) {
        const audioFile = hook.command.match(/"([^"]+)"/)?.[1] || hook.command.split(' ')[1];
        
        if (options.verbose) {
          console.log(chalk.gray(`Testing: ${audioFile}`));
        }
        
        if (audioFile) {
          const validation = await validateAudioFile(audioFile);
          
          if (!validation.exists) {
            console.log(chalk.red(`FAIL ${audioFile} (file not found)`));
            failureCount++;
            continue;
          }
          
          if (options.showCommand) {
            console.log(chalk.gray(`Command: ${hook.command}`));
          }
          
          if (!options.dryRun) {
            try {
              execSync(hook.command, { stdio: 'ignore' });
              console.log(chalk.green(`PASS ${audioFile}`));
              successCount++;
            } catch (error: any) {
              console.log(chalk.red(`FAIL ${audioFile} (playback failed: ${error.message})`));
              failureCount++;
            }
          } else {
            console.log(chalk.blue(`SKIP ${audioFile} (dry run)`));
            successCount++;
          }
        }
      }
    }
  }
  
  console.log(chalk.cyan(`\nTest Results:`));
  console.log(chalk.green(`  Success: ${successCount}`));
  if (failureCount > 0) {
    console.log(chalk.red(`  Failed: ${failureCount}`));
  }
}

export async function testAllEvents(options: TestOptions = {}): Promise<void> {
  console.log(chalk.cyan('\nTesting all ccsound hooks...\n'));
  
  const config = await readSettingsFile();
  const eventsToTest = options.events || VALID_EVENTS;
  
  let totalSuccess = 0;
  let totalFailure = 0;
  let testedEvents = 0;
  
  for (const event of eventsToTest) {
    const eventHooks = getEventHooks(config, event);
    const ccsoundHooks = eventHooks.filter(hookGroup => isccsoundManaged(hookGroup));
    
    if (ccsoundHooks.length === 0) {
      if (options.verbose) {
        console.log(chalk.gray(`${event}: No hooks configured`));
      }
      continue;
    }
    
    testedEvents++;
    console.log(chalk.cyan(`${event}:`));
    
    for (const hookGroup of ccsoundHooks) {
      for (const hook of hookGroup.hooks) {
        if (hook.type === 'command' && hook.command) {
          const audioFile = hook.command.match(/"([^"]+)"/)?.[1] || hook.command.split(' ')[1];
          
          if (audioFile) {
            const validation = await validateAudioFile(audioFile);
            
            if (!validation.exists) {
              console.log(chalk.red(`  FAIL ${audioFile} (file not found)`));
              totalFailure++;
              continue;
            }
            
            if (options.showCommand) {
              console.log(chalk.gray(`  Command: ${hook.command}`));
            }
            
            if (!options.dryRun) {
              try {
                execSync(hook.command, { stdio: 'ignore' });
                console.log(chalk.green(`  PASS ${audioFile}`));
                totalSuccess++;
              } catch (error: any) {
                console.log(chalk.red(`  FAIL ${audioFile} (playback failed)`));
                if (options.verbose) {
                  console.log(chalk.gray(`     Error: ${error.message}`));
                }
                totalFailure++;
              }
            } else {
              console.log(chalk.blue(`  SKIP ${audioFile} (dry run)`));
              totalSuccess++;
            }
            
            // Add delay between sounds if specified
            if (!options.dryRun && options.delay) {
              const delayMs = parseInt(options.delay, 10);
              if (delayMs > 0) {
                await delay(delayMs);
              }
            }
          }
        }
      }
    }
    
    console.log(); // Empty line between events
  }
  
  if (testedEvents === 0) {
    console.log(chalk.yellow('No ccsound-managed hooks found to test.'));
    console.log(chalk.gray('Run "ccsound" to set up audio notifications.'));
    return;
  }
  
  console.log(chalk.cyan('Overall Test Results:'));
  console.log(chalk.green(`  Success: ${totalSuccess}`));
  if (totalFailure > 0) {
    console.log(chalk.red(`  Failed: ${totalFailure}`));
  }
  console.log(chalk.blue(`  Events tested: ${testedEvents}`));
  
  if (totalFailure > 0) {
    console.log(chalk.yellow('\nRun "ccsound doctor" for detailed diagnostics.'));
  }
}