import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'fs';
import { join } from 'path';
import { detectProjectType, isDotenvxInstalled, getProjectName, findAllEnvFiles } from '../utils/detect.js';
import { npm, dotenvx } from '../utils/exec.js';

/**
 * Initialize dotenvx in a project
 * @param {object} options - Command options
 */
export async function initCommand(options) {
  const cwd = process.cwd();
  const spinner = ora();

  console.log(chalk.bold('\n🔐 dotenvx-deploy init\n'));

  // Detect project type
  spinner.start('Detecting project type...');
  const project = detectProjectType(cwd);

  if (project.type === 'unknown') {
    spinner.fail('Could not detect project type');
    console.log(chalk.yellow('\nSupported project types: Next.js, Vite'));
    console.log(chalk.gray('Make sure you have a package.json with next or vite as a dependency'));
    process.exit(1);
  }

  spinner.succeed(`Detected ${chalk.cyan(project.framework)} project`);

  const projectName = getProjectName(cwd);
  if (projectName) {
    console.log(chalk.gray(`  Project name: ${projectName}`));
  }

  // Check if dotenvx is already installed
  const dotenvxInstalled = isDotenvxInstalled(cwd);
  const autoConfirm = options.yes || false;

  if (dotenvxInstalled && !options.force && !autoConfirm) {
    console.log(chalk.yellow('\n⚠️  @dotenvx/dotenvx is already installed'));
    const { proceed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'proceed',
      message: 'Continue with setup anyway?',
      default: true
    }]);

    if (!proceed) {
      console.log(chalk.gray('Aborted'));
      process.exit(0);
    }
  }

  // Install dotenvx if needed
  if (!dotenvxInstalled && options.install !== false) {
    spinner.start('Installing @dotenvx/dotenvx...');
    try {
      await npm('install', ['@dotenvx/dotenvx', '--save'], { cwd });
      spinner.succeed('Installed @dotenvx/dotenvx');
    } catch (error) {
      spinner.fail('Failed to install @dotenvx/dotenvx');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  }

  // Find all existing .env files
  spinner.start('Scanning for .env files...');
  const envFiles = findAllEnvFiles(cwd);
  spinner.succeed(`Found ${envFiles.length} .env file(s)`);

  let filesToEncrypt = [];

  if (envFiles.length > 0) {
    // Show found files
    console.log(chalk.white('\nFound environment files:'));

    envFiles.forEach(f => {
      const status = f.isEncrypted
        ? chalk.green('✓ encrypted')
        : chalk.yellow('○ not encrypted');
      const vars = f.variables.length > 0
        ? chalk.gray(` (${f.variables.slice(0, 3).join(', ')}${f.variables.length > 3 ? '...' : ''})`)
        : chalk.gray(' (empty)');
      console.log(chalk.gray(`  ${f.file} ${status}${vars}`));
    });

    if (autoConfirm) {
      // Auto-select all unencrypted files
      filesToEncrypt = envFiles.filter(f => !f.isEncrypted);
      if (filesToEncrypt.length > 0) {
        console.log(chalk.cyan(`\n  Auto-selecting ${filesToEncrypt.length} unencrypted file(s) for encryption`));
      }
    } else {
      // Let user select which to encrypt
      const choices = envFiles.map(f => {
        const status = f.isEncrypted
          ? chalk.green('✓ encrypted')
          : chalk.yellow('○ not encrypted');
        const vars = f.variables.length > 0
          ? chalk.gray(` (${f.variables.slice(0, 3).join(', ')}${f.variables.length > 3 ? '...' : ''})`)
          : chalk.gray(' (empty)');

        return {
          name: `${f.file} ${status}${vars}`,
          value: f,
          checked: !f.isEncrypted // Pre-select unencrypted files
        };
      });

      const { selectedFiles } = await inquirer.prompt([{
        type: 'checkbox',
        name: 'selectedFiles',
        message: 'Select files to encrypt:',
        choices,
        validate: (input) => true // Allow empty selection
      }]);

      filesToEncrypt = selectedFiles.filter(f => !f.isEncrypted);
    }

    if (filesToEncrypt.length === 0) {
      console.log(chalk.gray('\n  All files are already encrypted'));
    }
  }

  // Ask if user wants to create new environment files (skip in auto mode)
  let createNew = false;
  if (!autoConfirm) {
    const response = await inquirer.prompt([{
      type: 'confirm',
      name: 'createNew',
      message: 'Create any new environment files?',
      default: envFiles.length === 0
    }]);
    createNew = response.createNew;
  }

  if (createNew) {
    const existingNames = envFiles.map(f => f.name);
    const availableEnvs = ['production', 'preview', 'development', 'staging', 'local']
      .filter(e => !existingNames.includes(e));

    if (availableEnvs.length > 0) {
      const { newEnvs } = await inquirer.prompt([{
        type: 'checkbox',
        name: 'newEnvs',
        message: 'Select new environments to create:',
        choices: availableEnvs.map(e => ({
          name: e,
          checked: e === 'production' && !existingNames.includes('production')
        }))
      }]);

      // Create new env files
      for (const env of newEnvs) {
        const envFile = `.env.${env}`;
        const envPath = join(cwd, envFile);

        // Ask for initial variables
        const { vars } = await inquirer.prompt([{
          type: 'editor',
          name: 'vars',
          message: `Enter variables for ${envFile} (KEY=value format):`,
          default: `# ${env} environment variables\nHELLO="${env}"\n`
        }]);

        writeFileSync(envPath, vars);
        console.log(chalk.green(`  ✓ Created ${envFile}`));

        // Add to encryption list
        filesToEncrypt.push({
          file: envFile,
          name: env,
          path: envPath,
          isEncrypted: false
        });
      }
    } else {
      console.log(chalk.gray('  All standard environments already exist'));
    }
  }

  // Encrypt selected files
  if (filesToEncrypt.length > 0) {
    console.log(chalk.cyan(`\nEncrypting ${filesToEncrypt.length} file(s)...\n`));

    for (const envFile of filesToEncrypt) {
      spinner.start(`Encrypting ${envFile.file}...`);
      try {
        await dotenvx(['encrypt', '-f', envFile.file], { cwd });
        spinner.succeed(`Encrypted ${envFile.file}`);
      } catch (error) {
        spinner.fail(`Failed to encrypt ${envFile.file}`);
        console.error(chalk.red(`  ${error.message}`));
      }
    }
  }

  // Collect all environment names for gitignore
  const allEnvNames = [
    ...envFiles.map(f => f.name),
    ...filesToEncrypt.map(f => f.name)
  ].filter((v, i, a) => a.indexOf(v) === i); // unique

  // Update package.json scripts
  spinner.start('Updating package.json scripts...');
  try {
    const packageJsonPath = join(cwd, 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

    const scriptsToAdd = {
      'dotenvx': 'dotenvx'
    };

    if (project.type === 'nextjs') {
      if (packageJson.scripts?.dev && !packageJson.scripts.dev.includes('dotenvx')) {
        scriptsToAdd['dev'] = 'dotenvx run -- ' + packageJson.scripts.dev;
      } else if (!packageJson.scripts?.dev) {
        scriptsToAdd['dev'] = 'dotenvx run -- next dev';
      }

      if (packageJson.scripts?.build && !packageJson.scripts.build.includes('dotenvx')) {
        scriptsToAdd['build'] = 'dotenvx run -- ' + packageJson.scripts.build;
      } else if (!packageJson.scripts?.build) {
        scriptsToAdd['build'] = 'dotenvx run -- next build';
      }

      if (packageJson.scripts?.start && !packageJson.scripts.start.includes('dotenvx')) {
        scriptsToAdd['start'] = 'dotenvx run -- ' + packageJson.scripts.start;
      } else if (!packageJson.scripts?.start) {
        scriptsToAdd['start'] = 'dotenvx run -- next start';
      }
    } else if (project.type === 'vite') {
      if (packageJson.scripts?.dev && !packageJson.scripts.dev.includes('dotenvx')) {
        scriptsToAdd['dev'] = 'dotenvx run -- ' + packageJson.scripts.dev;
      } else if (!packageJson.scripts?.dev) {
        scriptsToAdd['dev'] = 'dotenvx run -- vite';
      }

      if (packageJson.scripts?.build && !packageJson.scripts.build.includes('dotenvx')) {
        scriptsToAdd['build'] = 'dotenvx run -- ' + packageJson.scripts.build;
      } else if (!packageJson.scripts?.build) {
        scriptsToAdd['build'] = 'dotenvx run -- vite build';
      }

      if (packageJson.scripts?.preview && !packageJson.scripts.preview.includes('dotenvx')) {
        scriptsToAdd['preview'] = 'dotenvx run -- ' + packageJson.scripts.preview;
      } else if (!packageJson.scripts?.preview) {
        scriptsToAdd['preview'] = 'dotenvx run -- vite preview';
      }
    }

    // Only update if there are changes
    const hasChanges = Object.keys(scriptsToAdd).some(key =>
      packageJson.scripts?.[key] !== scriptsToAdd[key]
    );

    if (hasChanges) {
      packageJson.scripts = { ...packageJson.scripts, ...scriptsToAdd };
      writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
      spinner.succeed('Updated package.json scripts');
    } else {
      spinner.succeed('package.json scripts already configured');
    }
  } catch (error) {
    spinner.fail('Failed to update package.json');
    console.error(chalk.red(error.message));
  }

  // Create/update .gitignore
  spinner.start('Updating .gitignore...');
  try {
    const gitignorePath = join(cwd, '.gitignore');
    let gitignore = existsSync(gitignorePath) ? readFileSync(gitignorePath, 'utf-8') : '';

    const linesToAdd = [];

    // Add .env.keys if not present
    if (!gitignore.includes('.env.keys')) {
      linesToAdd.push('.env.keys');
    }

    // Ensure encrypted env files are NOT ignored (we want to commit them)
    for (const envName of allEnvNames) {
      if (envName === 'root') continue; // Skip .env root file
      const negation = `!.env.${envName}`;
      if (!gitignore.includes(negation)) {
        linesToAdd.push(negation);
      }
    }

    if (linesToAdd.length > 0) {
      const addition = '\n# dotenvx\n' + linesToAdd.join('\n') + '\n';
      appendFileSync(gitignorePath, addition);
      spinner.succeed('Updated .gitignore');
    } else {
      spinner.succeed('.gitignore already configured');
    }
  } catch (error) {
    spinner.fail('Failed to update .gitignore');
    console.error(chalk.red(error.message));
  }

  // Create .vercelignore if it doesn't exist
  const vercelignorePath = join(cwd, '.vercelignore');
  if (!existsSync(vercelignorePath)) {
    spinner.start('Creating .vercelignore...');
    try {
      writeFileSync(vercelignorePath, '# Prevent .env.keys from being deployed\n.env.keys\n');
      spinner.succeed('Created .vercelignore');
    } catch (error) {
      spinner.fail('Failed to create .vercelignore');
    }
  }

  // Update source code for Next.js (optional)
  if (project.type === 'nextjs') {
    console.log(chalk.yellow('\n📝 Next.js Setup Note:'));
    console.log(chalk.gray('  For server components, swap process.env for dotenvx.get():'));
    console.log(chalk.cyan(`
    import * as dotenvx from '@dotenvx/dotenvx';
    export default function Page() {
      return <h1>Hello {dotenvx.get('HELLO')}</h1>;
    }
  `));
  }

  // Summary
  console.log(chalk.bold.green('\n✅ dotenvx initialized successfully!\n'));
  console.log(chalk.white('Next steps:'));
  console.log(chalk.gray('  1. Review and commit your encrypted .env files'));
  console.log(chalk.gray('  2. Store your .env.keys securely (Bitwarden, 1Password, etc.)'));
  console.log(chalk.gray('  3. Run: dotenvx-deploy bw-save    # Save keys to Bitwarden'));
  console.log(chalk.gray('  4. Run: dotenvx-deploy deploy     # Deploy to Vercel'));

  // Show .env.keys location
  const envKeysPath = join(cwd, '.env.keys');
  if (existsSync(envKeysPath)) {
    console.log(chalk.yellow(`\n⚠️  IMPORTANT: Back up your .env.keys file!`));
    console.log(chalk.gray(`   Location: ${envKeysPath}`));
  }
}
