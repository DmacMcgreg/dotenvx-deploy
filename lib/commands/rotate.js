import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { getExistingEnvironments, getEnvKeys } from '../utils/detect.js';
import { dotenvx } from '../utils/exec.js';

/**
 * Rotate encryption keys for an environment
 * @param {object} options - Command options
 */
export async function rotateCommand(options) {
  const cwd = process.cwd();
  const spinner = ora();

  console.log(chalk.bold('\n🔄 dotenvx-deploy rotate\n'));

  // Get existing environments and keys
  const environments = getExistingEnvironments(cwd);
  const { exists: keysExist, keys } = getEnvKeys(cwd);

  if (environments.length === 0) {
    console.log(chalk.yellow('No encrypted environments found'));
    console.log(chalk.gray('\nRun `dotenvx-deploy init` to set up encryption'));
    process.exit(1);
  }

  // Determine which environments to rotate
  let envsToRotate = [];

  if (options.all) {
    envsToRotate = environments;
  } else if (options.env) {
    if (!environments.includes(options.env)) {
      console.log(chalk.red(`Environment "${options.env}" not found`));
      console.log(chalk.gray('\nAvailable environments:'));
      environments.forEach(e => console.log(chalk.gray(`  - ${e}`)));
      process.exit(1);
    }
    envsToRotate = [options.env];
  } else {
    // Prompt user to select environments
    const { selected } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'selected',
      message: 'Select environments to rotate:',
      choices: environments.map(e => ({
        name: e,
        checked: e === 'production'
      })),
      validate: (input) => input.length > 0 || 'Select at least one environment'
    }]);

    envsToRotate = selected;
  }

  // Confirm rotation
  console.log(chalk.yellow('\n⚠️  Key rotation will:'));
  console.log(chalk.gray('  1. Generate new encryption keys'));
  console.log(chalk.gray('  2. Re-encrypt all variables with new keys'));
  console.log(chalk.gray('  3. Update .env.keys file'));
  console.log(chalk.red('\n  Old keys will no longer work!'));

  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: `Rotate keys for ${envsToRotate.join(', ')}?`,
    default: false
  }]);

  if (!confirm) {
    console.log(chalk.gray('Aborted'));
    process.exit(0);
  }

  // Backup current keys
  if (keysExist) {
    const keysPath = join(cwd, '.env.keys');
    const backupPath = join(cwd, `.env.keys.backup.${Date.now()}`);
    const keysContent = readFileSync(keysPath, 'utf-8');
    writeFileSync(backupPath, keysContent);
    console.log(chalk.gray(`\nBacked up current keys to ${backupPath}`));
  }

  // Rotate each environment
  for (const env of envsToRotate) {
    const envFile = `.env.${env}`;
    const envPath = join(cwd, envFile);

    console.log(chalk.cyan(`\nRotating ${envFile}...`));

    // Step 1: Decrypt the file first
    spinner.start('Decrypting current values...');
    try {
      // Get current decrypted values
      const { stdout } = await dotenvx(['get', '-f', envFile, '--format', 'shell'], { cwd });

      // Parse the decrypted values
      const decryptedVars = {};
      for (const line of stdout.split('\n')) {
        const match = line.match(/^export\s+(\w+)="(.*)"/);
        if (match && !match[1].startsWith('DOTENV_')) {
          decryptedVars[match[1]] = match[2];
        }
      }
      spinner.succeed('Decrypted current values');

      // Step 2: Remove old encryption
      spinner.start('Removing old encryption...');

      // Create a plain text version
      const plainContent = Object.entries(decryptedVars)
        .map(([key, value]) => `${key}="${value}"`)
        .join('\n');

      writeFileSync(envPath, `# ${env} environment\n${plainContent}\n`);
      spinner.succeed('Removed old encryption');

      // Step 3: Remove old key from .env.keys
      const keysPath = join(cwd, '.env.keys');
      if (existsSync(keysPath)) {
        let keysContent = readFileSync(keysPath, 'utf-8');
        const privateKeyName = `DOTENV_PRIVATE_KEY_${env.toUpperCase()}`;

        // Remove the old key line
        keysContent = keysContent
          .split('\n')
          .filter(line => !line.includes(privateKeyName))
          .join('\n');

        writeFileSync(keysPath, keysContent);
      }

      // Step 4: Re-encrypt with new keys
      spinner.start('Generating new encryption keys...');
      await dotenvx(['encrypt', '-f', envFile], { cwd });
      spinner.succeed('Generated new encryption keys');

      console.log(chalk.green(`✓ Rotated keys for ${env}`));

    } catch (error) {
      spinner.fail(`Failed to rotate ${env}`);
      console.error(chalk.red(error.message));

      // Try to provide recovery instructions
      console.log(chalk.yellow('\nRecovery:'));
      console.log(chalk.gray('  1. Check if .env.keys.backup.* exists'));
      console.log(chalk.gray('  2. Restore from backup if needed'));
      continue;
    }
  }

  // Summary
  console.log(chalk.bold.green('\n✅ Key rotation complete!\n'));
  console.log(chalk.white('Next steps:'));
  console.log(chalk.gray('  1. Backup new .env.keys file'));
  console.log(chalk.gray('  2. Run: dotenvx-deploy bw-save    # Update Bitwarden'));
  console.log(chalk.gray('  3. Run: dotenvx-deploy deploy     # Update Vercel'));
  console.log(chalk.gray('  4. Commit updated .env.* files'));

  // Show warning about old deployments
  console.log(chalk.yellow('\n⚠️  Important:'));
  console.log(chalk.gray('  Existing deployments will fail until you update the private keys'));
  console.log(chalk.gray('  Run `dotenvx-deploy deploy` for each rotated environment'));
}
