import chalk from 'chalk';
import ora from 'ora';
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
    console.log(chalk.cyan('   dotenvx-deploy bw-list\n'));
  } else if (status.status === 'unauthenticated') {
    console.log(chalk.white('1. Login to your Bitwarden account:\n'));
    console.log(chalk.cyan('   bw login\n'));
    console.log(chalk.white('2. Unlock your vault and set the session:\n'));
    console.log(chalk.cyan('   export BW_SESSION=$(bw unlock --raw)\n'));
    console.log(chalk.white('3. Run this command again:\n'));
    console.log(chalk.cyan('   dotenvx-deploy bw-list\n'));
  } else if (status.status === 'locked') {
    console.log(chalk.white('Your vault is locked. Unlock it:\n'));
    console.log(chalk.cyan('   export BW_SESSION=$(bw unlock --raw)\n'));
    console.log(chalk.white('Then run this command again:\n'));
    console.log(chalk.cyan('   dotenvx-deploy bw-list\n'));
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
 * List all saved keys in Bitwarden
 * @param {object} options - Command options
 */
export async function bwListCommand(options) {
  const cwd = process.cwd();
  const spinner = ora();

  console.log(chalk.bold('\n📋 dotenvx-deploy bw-list\n'));

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
      console.log(chalk.yellow('\nNo keys have been saved yet.'));
      console.log(chalk.cyan('  dotenvx-deploy bw-save'));
      process.exit(0);
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
      spinner.succeed('No keys found');
      console.log(chalk.yellow('\nNo keys have been saved yet.'));
      console.log(chalk.cyan('  dotenvx-deploy bw-save'));
      process.exit(0);
    }

    spinner.succeed(`Found ${items.length} item(s)`);

    // Filter by project if in a project directory
    let displayItems = items;
    if (projectName && !options.all) {
      const projectItems = items.filter(i => i.name.startsWith(`${projectName}/`));
      if (projectItems.length > 0) {
        displayItems = projectItems;
        console.log(chalk.gray(`\nShowing keys for project: ${projectName}`));
        console.log(chalk.gray('Use --all to show all projects\n'));
      }
    }

    // Group by project
    const projectGroups = {};
    for (const item of displayItems) {
      const parts = item.name.split('/');
      const project = parts[0];

      if (!projectGroups[project]) {
        projectGroups[project] = [];
      }
      projectGroups[project].push(item);
    }

    // Display grouped items
    for (const [project, projectItems] of Object.entries(projectGroups)) {
      console.log(chalk.bold.cyan(`\n${project}/`));

      // Group by environment within project
      const envGroups = {};
      for (const item of projectItems) {
        const envField = item.fields?.find(f => f.name === 'environment');
        const envName = envField?.value || item.name.split('/')[1] || 'unknown';

        if (!envGroups[envName]) {
          envGroups[envName] = [];
        }
        envGroups[envName].push(item);
      }

      for (const [env, envItems] of Object.entries(envGroups)) {
        if (envItems.length === 1) {
          // Single version for this environment
          const item = envItems[0];
          const noteField = item.fields?.find(f => f.name === 'note');
          const updatedField = item.fields?.find(f => f.name === 'updated');
          const createdField = item.fields?.find(f => f.name === 'created');

          let line = `  ${chalk.white(env)}`;

          if (noteField) {
            line += chalk.gray(` - "${noteField.value}"`);
          }

          const timestamp = updatedField?.value || createdField?.value;
          if (timestamp) {
            const date = new Date(timestamp).toLocaleDateString();
            line += chalk.dim(` (${date})`);
          }

          console.log(line);
        } else {
          // Multiple versions for this environment
          console.log(`  ${chalk.white(env)} ${chalk.yellow(`[${envItems.length} versions]`)}`);

          for (const item of envItems) {
            const versionField = item.fields?.find(f => f.name === 'version');
            const noteField = item.fields?.find(f => f.name === 'note');
            const updatedField = item.fields?.find(f => f.name === 'updated');
            const createdField = item.fields?.find(f => f.name === 'created');

            let line = `    └─ ${chalk.gray(versionField?.value || item.name.split('/').pop())}`;

            if (noteField) {
              line += chalk.gray(` - "${noteField.value}"`);
            }

            const timestamp = updatedField?.value || createdField?.value;
            if (timestamp) {
              const date = new Date(timestamp).toLocaleDateString();
              line += chalk.dim(` (${date})`);
            }

            console.log(line);
          }
        }
      }
    }

    // Summary
    console.log(chalk.gray(`\n${displayItems.length} key(s) in ${Object.keys(projectGroups).length} project(s)`));

    console.log(chalk.yellow('\n💡 Commands:'));
    console.log(chalk.gray('  bw-save --name <version>   Save as a new version'));
    console.log(chalk.gray('  bw-pull --name <version>   Pull a specific version'));

  } catch (error) {
    spinner.fail('Failed to retrieve keys');
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}
