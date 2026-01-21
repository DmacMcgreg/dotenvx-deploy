import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { checkBitwardenCli, getEnvKeys, getProjectName } from '../utils/detect.js';
import { bw, run } from '../utils/exec.js';

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
    console.log(chalk.cyan('   dotenvx-deploy bw-save\n'));
  } else if (status.status === 'unauthenticated') {
    console.log(chalk.white('1. Login to your Bitwarden account:\n'));
    console.log(chalk.cyan('   bw login\n'));
    console.log(chalk.white('2. Unlock your vault and set the session:\n'));
    console.log(chalk.cyan('   export BW_SESSION=$(bw unlock --raw)\n'));
    console.log(chalk.white('3. Run this command again:\n'));
    console.log(chalk.cyan('   dotenvx-deploy bw-save\n'));
  } else if (status.status === 'locked') {
    console.log(chalk.white('Your vault is locked. Unlock it:\n'));
    console.log(chalk.cyan('   export BW_SESSION=$(bw unlock --raw)\n'));
    console.log(chalk.white('Then run this command again:\n'));
    console.log(chalk.cyan('   dotenvx-deploy bw-save\n'));
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
 * Save private keys to Bitwarden
 * @param {object} options - Command options
 */
export async function bwSaveCommand(options) {
  const cwd = process.cwd();
  const spinner = ora();

  console.log(chalk.bold('\n🔑 dotenvx-deploy bw-save\n'));

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

  // Get project name for item naming
  const projectName = getProjectName(cwd);

  if (!projectName) {
    console.log(chalk.yellow('\n⚠️  No project name found in package.json'));
    console.log(chalk.gray('    Keys will be saved with generic names'));
  }

  // Get existing keys
  const { exists: keysExist, keys } = getEnvKeys(cwd);

  if (!keysExist || Object.keys(keys).length === 0) {
    console.log(chalk.red('\n❌ No .env.keys file found or no keys present'));
    console.log(chalk.yellow('\nRun `dotenvx-deploy init` first'));
    process.exit(1);
  }

  // Filter keys if specific environment requested
  let keysToSave = keys;

  if (options.env) {
    const keyName = `DOTENV_PRIVATE_KEY_${options.env.toUpperCase()}`;
    if (!keys[keyName]) {
      console.log(chalk.red(`\n❌ No key found for environment: ${options.env}`));
      console.log(chalk.gray('\nAvailable keys:'));
      Object.keys(keys).forEach(k => console.log(chalk.gray(`  - ${k}`)));
      process.exit(1);
    }
    keysToSave = { [keyName]: keys[keyName] };
  }

  console.log(chalk.cyan(`\nSaving ${Object.keys(keysToSave).length} key(s) to Bitwarden...\n`));

  // Get or create folder
  const folderName = options.folder || 'dotenvx-keys';
  let folderId = null;

  spinner.start(`Finding folder "${folderName}"...`);
  try {
    const { stdout } = await bw(['list', 'folders', '--search', folderName]);
    const folders = JSON.parse(stdout);
    const existingFolder = folders.find(f => f.name === folderName);

    if (existingFolder) {
      folderId = existingFolder.id;
      spinner.succeed(`Found folder "${folderName}"`);
    } else {
      spinner.text = `Creating folder "${folderName}"...`;
      const folderData = Buffer.from(JSON.stringify({ name: folderName })).toString('base64');
      const { stdout: createOutput } = await bw(['create', 'folder', folderData]);
      const newFolder = JSON.parse(createOutput);
      folderId = newFolder.id;
      spinner.succeed(`Created folder "${folderName}"`);
    }
  } catch (error) {
    spinner.fail('Failed to access Bitwarden folders');
    console.error(chalk.red(error.message));
    process.exit(1);
  }

  // Save each key
  for (const [keyName, keyValue] of Object.entries(keysToSave)) {
    const envName = keyName.replace('DOTENV_PRIVATE_KEY_', '').toLowerCase();
    const itemName = projectName ? `${projectName}/${envName}` : `dotenvx/${envName}`;

    spinner.start(`Saving ${keyName}...`);

    try {
      // Check if item already exists
      const { stdout: searchOutput } = await bw(['list', 'items', '--search', itemName, '--folderid', folderId], { silent: true });
      const existingItems = JSON.parse(searchOutput || '[]');
      const existingItem = existingItems.find(i => i.name === itemName);

      if (existingItem) {
        // Update existing item
        const itemData = {
          ...existingItem,
          notes: keyValue,
          fields: [
            {
              name: 'DOTENV_PRIVATE_KEY',
              value: keyValue,
              type: 0 // Text field
            },
            {
              name: 'environment',
              value: envName,
              type: 0
            },
            {
              name: 'project',
              value: projectName || 'unknown',
              type: 0
            },
            {
              name: 'updated',
              value: new Date().toISOString(),
              type: 0
            }
          ]
        };

        const encodedItem = Buffer.from(JSON.stringify(itemData)).toString('base64');
        await bw(['edit', 'item', existingItem.id, encodedItem]);
        spinner.succeed(`Updated ${keyName} (${itemName})`);
      } else {
        // Create new item
        const itemData = {
          organizationId: null,
          folderId: folderId,
          type: 2, // Secure Note
          name: itemName,
          notes: keyValue,
          secureNote: {
            type: 0
          },
          fields: [
            {
              name: 'DOTENV_PRIVATE_KEY',
              value: keyValue,
              type: 0
            },
            {
              name: 'environment',
              value: envName,
              type: 0
            },
            {
              name: 'project',
              value: projectName || 'unknown',
              type: 0
            },
            {
              name: 'created',
              value: new Date().toISOString(),
              type: 0
            }
          ]
        };

        const encodedItem = Buffer.from(JSON.stringify(itemData)).toString('base64');
        await bw(['create', 'item', encodedItem]);
        spinner.succeed(`Created ${keyName} (${itemName})`);
      }
    } catch (error) {
      spinner.fail(`Failed to save ${keyName}`);
      console.error(chalk.red(`  ${error.message}`));
    }
  }

  // Sync to server
  spinner.start('Syncing with Bitwarden server...');
  try {
    await bw(['sync']);
    spinner.succeed('Synced with Bitwarden server');
  } catch (error) {
    spinner.warn('Sync may have failed, but keys were saved locally');
  }

  // Summary
  console.log(chalk.bold.green('\n✅ Keys saved to Bitwarden!\n'));
  console.log(chalk.white('Keys are stored in:'));
  console.log(chalk.gray(`  Folder: ${folderName}`));
  Object.keys(keysToSave).forEach(keyName => {
    const envName = keyName.replace('DOTENV_PRIVATE_KEY_', '').toLowerCase();
    const itemName = projectName ? `${projectName}/${envName}` : `dotenvx/${envName}`;
    console.log(chalk.gray(`  Item: ${itemName}`));
  });

  console.log(chalk.yellow('\n💡 Tip: Use `dotenvx-deploy bw-pull` to restore keys on another machine'));
}
