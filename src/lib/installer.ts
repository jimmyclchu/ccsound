import { execSync } from 'child_process';
import chalk from 'chalk';
import inquirer from 'inquirer';

export async function checkClaudeCodeInstallation(): Promise<{ installed: boolean; version: string | null }> {
  try {
    const version = execSync('claude --version', { encoding: 'utf-8' }).trim();
    return { installed: true, version };
  } catch (error) {
    return { installed: false, version: null };
  }
}

export async function runAutoInstallation(): Promise<boolean> {
  console.log(chalk.cyan('\nInstalling Claude Code...'));
  
  try {
    console.log(chalk.gray('Running: npm install -g @anthropic-ai/claude-code'));
    execSync('npm install -g @anthropic-ai/claude-code', { 
      stdio: 'inherit',
      encoding: 'utf-8' 
    });
    
    const { installed, version } = await checkClaudeCodeInstallation();
    
    if (installed) {
      console.log(chalk.green(`\nClaude Code v${version} installed successfully!`));
      return true;
    } else {
      throw new Error('Installation completed but Claude Code command not found');
    }
  } catch (error: any) {
    console.error(chalk.red('\nFailed to install Claude Code automatically.'));
    console.error(chalk.yellow('\nPlease install manually:'));
    console.error(chalk.white('  npm install -g @anthropic-ai/claude-code'));
    console.error(chalk.white('  or'));
    console.error(chalk.white('  sudo npm install -g @anthropic-ai/claude-code'));
    console.error(chalk.gray(`\nError: ${error.message}`));
    
    const { shouldContinue } = await inquirer.prompt<{ shouldContinue: boolean }>([{
      type: 'confirm',
      name: 'shouldContinue',
      message: 'Continue without Claude Code? (ccsound will not work properly)',
      default: false
    }]);
    
    if (!shouldContinue) {
      process.exit(1);
    }
    
    return false;
  }
}