import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'fs';
import { join } from 'path';
import { checkBitwardenCli, getProjectName } from '../utils/detect.js';
import { bw } from '../utils/exec.js';

/**
 * Print Bitwarden setup instructions based on current status
 */
function printBitwardenSetupInstructions(status) {
  console.log(chalk.yellow('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.yellow.bold('  Bitwarden CLI Setup Required'));
  console.log(chalk.yellow('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  if (!status.available) {
    console.log(chalk.white('1. Install Bitwarden CLI:\n'));
    console.log(chalk.cyan('   npm install -g @bitwarden/cli'));
    console.log(chalk.gray('   # or'));
    console.log(chalk.cyan('   brew install bitwarden-cli\n'));
    console.log(chalk.white('2. Login to your Bitwarden account:\n'));
    console.log(chalk.cyan('   bw login\n'));
    console.log(chalk.white('3. Unlock your vault and set the session:\n'));
    console.log(chalk.cyan('   export BW_SESSION=$(bw unlock --raw)\n'));
    console.log(chalk.white('4. Run this command again:\n'));
    console.log(chalk.cyan('   dotenvx-deploy bw-pull\n'));
  } else if (status.status === 'unauthenticated') {
    console.log(chalk.white('1. Login to your Bitwarden account:\n'));
    console.log(chalk.cyan('   bw login\n'));
    console.log(chalk.white('2. Unlock your vault and set the session:\n'));
    console.log(chalk.cyan('   export BW_SESSION=$(bw unlock --raw)\n'));
    console.log(chalk.white('3. Run this command again:\n'));
    console.log(chalk.cyan('   dotenvx-deploy bw-pull\n'));
  } else if (status.status === 'locked') {
    console.log(chalk.white('Your vault is locked. Unlock it:\n'));
    console.log(chalk.cyan('   export BW_SESSION=$(bw unlock --raw)\n'));
    console.log(chalk.white('Then run this command again:\n'));
    console.log(chalk.cyan('   dotenvx-deploy bw-pull\n'));
  } else {
    console.log(chalk.white(`Current status: ${status.status}\n`));
    console.log(chalk.white('Try logging in again:\n'));
    console.log(chalk.cyan('   bw logout'));
    console.log(chalk.cyan('   bw login'));
    console.log(chalk.cyan('   export BW_SESSION=$(bw unlock --raw)\n'));
  }

  console.log(chalk.gray('For more info: https://bitwarden.com/help/cli/\n'));
}

/**
 * Pull private keys from Bitwarden
 * @param {object} options - Command options
 */
export async function bwPullCommand(options) {
  const cwd = process.cwd();
  const spinner = ora();

  console.log(chalk.bold('\n🔑 dotenvx-deploy bw-pull\n'));

  // Check Bitwarden CLI
  spinner.start('Checking Bitwarden CLI...');
  const bwStatus = await checkBitwardenCli();

  if (!bwStatus.available) {
    spinner.fail('Bitwarden CLI not installed');
    printBitwardenSetupInstructions(bwStatus);
    process.exit(1);
  }

  if (!bwStatus.loggedIn) {
    spinner.fail(`Bitwarden vault not accessible (${bwStatus.status})`);
    printBitwardenSetupInstructions(bwStatus);
    process.exit(1);
  }

  spinner.succeed('Bitwarden CLI ready');

  // Sync with server first
  spinner.start('Syncing with Bitwarden server...');
  try {
    await bw(['sync']);
    spinner.succeed('Synced with Bitwarden server');
  } catch (error) {
    spinner.warn('Sync may have failed, using local cache');
  }

  // Get project name
  const projectName = getProjectName(cwd);
  const folderName = options.folder || 'dotenvx-keys';

  // Find the folder
  spinner.start(`Finding folder "${folderName}"...`);
  let folderId = null;

  try {
    const { stdout } = await bw(['list', 'folders', '--search', folderName]);
    const folders = JSON.parse(stdout);
    const folder = folders.find(f => f.name === folderName);

    if (!folder) {
      spinner.fail(`Folder "${folderName}" not found`);
      console.log(chalk.yellow('\nMake sure you have saved keys first:'));
      console.log(chalk.cyan('  dotenvx-deploy bw-save'));
      process.exit(1);
    }

    folderId = folder.id;
    spinner.succeed(`Found folder "${folderName}"`);
  } catch (error) {
    spinner.fail('Failed to list folders');
    console.error(chalk.red(error.message));
    process.exit(1);
  }

  // Find items in folder
  spinner.start('Searching for keys...');

  try {
    const { stdout } = await bw(['list', 'items', '--folderid', folderId]);
    const items = JSON.parse(stdout);

    if (items.length === 0) {
      spinner.fail('No keys found in folder');
      process.exit(1);
    }

    spinner.succeed(`Found ${items.length} item(s)`);

    // Filter items by project name or environment
    let matchingItems = items;

    if (projectName) {
      matchingItems = items.filter(i => i.name.startsWith(`${projectName}/`));

      if (matchingItems.length === 0) {
        console.log(chalk.yellow(`\nNo keys found for project "${projectName}"`));
        console.log(chalk.gray('\nAvailable items:'));
        items.forEach(i => console.log(chalk.gray(`  - ${i.name}`)));

        const { useAll } = await inquirer.prompt([{
          type: 'confirm',
          name: 'useAll',
          message: 'Show all items?',
          default: true
        }]);

        if (useAll) {
          matchingItems = items;
        } else {
          process.exit(0);
        }
      }
    }

    // Filter by specific environment if requested
    if (options.env) {
      matchingItems = matchingItems.filter(i =>
        i.name.includes(`/${options.env}`) ||
        i.fields?.some(f => f.name === 'environment' && f.value === options.env)
      );

      if (matchingItems.length === 0) {
        console.log(chalk.red(`\nNo keys found for environment: ${options.env}`));
        process.exit(1);
      }
    }

    // Let user select which keys to pull
    const { selectedItems } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'selectedItems',
      message: 'Select keys to pull:',
      choices: matchingItems.map(i => ({
        name: i.name,
        value: i,
        checked: true
      })),
      validate: (input) => input.length > 0 || 'Select at least one key'
    }]);

    // Extract keys
    const keysToWrite = {};

    for (const item of selectedItems) {
      // Get environment name from item name or fields
      let envName = item.name.split('/').pop();
      const envField = item.fields?.find(f => f.name === 'environment');
      if (envField) {
        envName = envField.value;
      }

      // Get the key value from notes or fields
      let keyValue = item.notes;
      const keyField = item.fields?.find(f => f.name === 'DOTENV_PRIVATE_KEY');
      if (keyField) {
        keyValue = keyField.value;
      }

      if (!keyValue) {
        console.log(chalk.yellow(`  ⚠️  No key value found in ${item.name}`));
        continue;
      }

      const keyName = `DOTENV_PRIVATE_KEY_${envName.toUpperCase()}`;
      keysToWrite[keyName] = keyValue;

      console.log(chalk.gray(`  Found ${keyName}`));
    }

    if (Object.keys(keysToWrite).length === 0) {
      console.log(chalk.red('\n❌ No valid keys to write'));
      process.exit(1);
    }

    // Check if .env.keys exists
    const keysPath = join(cwd, '.env.keys');
    const keysExist = existsSync(keysPath);

    if (keysExist) {
      const { overwrite } = await inquirer.prompt([{
        type: 'confirm',
        name: 'overwrite',
        message: '.env.keys already exists. Merge/overwrite?',
        default: true
      }]);

      if (!overwrite) {
        console.log(chalk.gray('Aborted'));
        process.exit(0);
      }
    }

    // Write keys
    spinner.start('Writing .env.keys...');

    let keysContent = '';

    if (keysExist) {
      // Read existing content
      keysContent = readFileSync(keysPath, 'utf-8');

      // Update or add each key
      for (const [keyName, keyValue] of Object.entries(keysToWrite)) {
        const regex = new RegExp(`^${keyName}=.*$`, 'm');

        if (keysContent.match(regex)) {
          // Update existing key
          keysContent = keysContent.replace(regex, `${keyName}="${keyValue}"`);
        } else {
          // Add new key
          keysContent += `\n# ${keyName.replace('DOTENV_PRIVATE_KEY_', '.env.')}\n${keyName}="${keyValue}"\n`;
        }
      }
    } else {
      // Create new file
      keysContent = `#/------------------!DOTENV_PRIVATE_KEYS!-------------------/
#/ private decryption keys. DO NOT commit to source control /
#/     [how it works](https://dotenvx.com/encryption)       /
#/----------------------------------------------------------/
`;

      for (const [keyName, keyValue] of Object.entries(keysToWrite)) {
        const envName = keyName.replace('DOTENV_PRIVATE_KEY_', '').toLowerCase();
        keysContent += `\n# .env.${envName}\n${keyName}="${keyValue}"\n`;
      }
    }

    writeFileSync(keysPath, keysContent);
    spinner.succeed('Written .env.keys');

    // Summary
    console.log(chalk.bold.green('\n✅ Keys pulled from Bitwarden!\n'));
    console.log(chalk.white('Restored keys:'));
    Object.keys(keysToWrite).forEach(k => console.log(chalk.gray(`  - ${k}`)));

    console.log(chalk.yellow('\n⚠️  Remember: .env.keys should NOT be committed to version control'));

  } catch (error) {
    spinner.fail('Failed to retrieve keys');
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}
