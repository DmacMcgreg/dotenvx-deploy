import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getExistingEnvironments } from '../utils/detect.js';
import { dotenvx } from '../utils/exec.js';

/**
 * Encrypt environment variables
 * @param {object} options - Command options
 */
export async function encryptCommand(options) {
  const cwd = process.cwd();
  const spinner = ora();

  console.log(chalk.bold('\n🔐 dotenvx-deploy encrypt\n'));

  const envName = options.env || 'production';
  const envFile = `.env.${envName}`;
  const envPath = join(cwd, envFile);

  // If specific key and value provided, set it
  if (options.key && options.value) {
    spinner.start(`Setting ${options.key} in ${envFile}...`);

    try {
      await dotenvx(['set', options.key, options.value, '-f', envFile], { cwd });
      spinner.succeed(`Set ${options.key} in ${envFile}`);

      console.log(chalk.green(`\n✅ Variable encrypted and saved to ${envFile}`));
      return;
    } catch (error) {
      spinner.fail(`Failed to set ${options.key}`);
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  }

  // Check if env file exists
  if (!existsSync(envPath)) {
    console.log(chalk.yellow(`${envFile} doesn't exist yet`));

    const { createNew } = await inquirer.prompt([{
      type: 'confirm',
      name: 'createNew',
      message: `Create ${envFile}?`,
      default: true
    }]);

    if (!createNew) {
      console.log(chalk.gray('Aborted'));
      process.exit(0);
    }

    // Create new env file
    const { vars } = await inquirer.prompt([{
      type: 'editor',
      name: 'vars',
      message: `Enter environment variables for ${envName} (KEY=value format):`,
      default: `# ${envName} environment\nHELLO="${envName}"\n`
    }]);

    writeFileSync(envPath, vars);
    console.log(chalk.green(`Created ${envFile}`));
  }

  // Check if already encrypted
  const content = readFileSync(envPath, 'utf-8');
  const isEncrypted = content.includes('DOTENV_PUBLIC_KEY') || content.includes('encrypted:');

  if (isEncrypted) {
    console.log(chalk.yellow(`\n⚠️  ${envFile} appears to already be encrypted`));

    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: 'Add/update a specific variable', value: 'set' },
        { name: 'Re-encrypt entire file', value: 'reencrypt' },
        { name: 'Cancel', value: 'cancel' }
      ]
    }]);

    if (action === 'cancel') {
      console.log(chalk.gray('Aborted'));
      process.exit(0);
    }

    if (action === 'set') {
      const { key, value } = await inquirer.prompt([
        {
          type: 'input',
          name: 'key',
          message: 'Variable name:',
          validate: (input) => input.length > 0 || 'Key is required'
        },
        {
          type: 'input',
          name: 'value',
          message: 'Variable value:',
          validate: (input) => input.length > 0 || 'Value is required'
        }
      ]);

      spinner.start(`Setting ${key}...`);
      try {
        await dotenvx(['set', key, value, '-f', envFile], { cwd });
        spinner.succeed(`Set ${key} in ${envFile}`);
      } catch (error) {
        spinner.fail(`Failed to set ${key}`);
        console.error(chalk.red(error.message));
        process.exit(1);
      }
      return;
    }
  }

  // Encrypt the file
  spinner.start(`Encrypting ${envFile}...`);

  try {
    await dotenvx(['encrypt', '-f', envFile], { cwd });
    spinner.succeed(`Encrypted ${envFile}`);

    // Show the public key
    const updatedContent = readFileSync(envPath, 'utf-8');
    const publicKeyMatch = updatedContent.match(/DOTENV_PUBLIC_KEY_\w+="([^"]+)"/);

    if (publicKeyMatch) {
      console.log(chalk.gray(`\nPublic key: ${publicKeyMatch[1].substring(0, 20)}...`));
    }

    console.log(chalk.green(`\n✅ ${envFile} is now encrypted`));
    console.log(chalk.gray('\nYou can safely commit this file to version control'));
    console.log(chalk.yellow('\n⚠️  Remember to backup your .env.keys file!'));
  } catch (error) {
    spinner.fail(`Failed to encrypt ${envFile}`);
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

/**
 * Encrypt all environment files
 * @param {string} cwd - Current working directory
 */
export async function encryptAll(cwd = process.cwd()) {
  const spinner = ora();
  const environments = getExistingEnvironments(cwd);

  if (environments.length === 0) {
    console.log(chalk.yellow('No .env files found'));
    return;
  }

  console.log(chalk.cyan(`\nEncrypting ${environments.length} environment(s)...\n`));

  for (const env of environments) {
    const envFile = `.env.${env}`;
    const envPath = join(cwd, envFile);
    const content = readFileSync(envPath, 'utf-8');

    // Skip if already encrypted
    if (content.includes('encrypted:')) {
      console.log(chalk.gray(`  ${envFile} - already encrypted, skipping`));
      continue;
    }

    spinner.start(`Encrypting ${envFile}...`);
    try {
      await dotenvx(['encrypt', '-f', envFile], { cwd });
      spinner.succeed(`Encrypted ${envFile}`);
    } catch (error) {
      spinner.fail(`Failed to encrypt ${envFile}`);
      console.error(chalk.red(`    ${error.message}`));
    }
  }
}
