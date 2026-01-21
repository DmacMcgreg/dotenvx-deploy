import chalk from 'chalk';
import ora from 'ora';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  detectProjectType,
  getProjectName,
  isDotenvxInstalled,
  isVercelCliAvailable,
  checkBitwardenCli,
  getExistingEnvironments,
  getEnvKeys
} from '../utils/detect.js';

/**
 * Show current encryption and deployment status
 */
export async function statusCommand() {
  const cwd = process.cwd();
  const spinner = ora();

  console.log(chalk.bold('\n📊 dotenvx-deploy status\n'));

  // Project info
  const project = detectProjectType(cwd);
  const projectName = getProjectName(cwd);

  console.log(chalk.white('Project:'));
  if (project.type !== 'unknown') {
    console.log(chalk.gray(`  Type: ${chalk.cyan(project.framework)}`));
  } else {
    console.log(chalk.yellow('  Type: Unknown (not a Next.js or Vite project)'));
  }

  if (projectName) {
    console.log(chalk.gray(`  Name: ${chalk.cyan(projectName)}`));
  }

  // dotenvx installation
  const dotenvxInstalled = isDotenvxInstalled(cwd);
  console.log(chalk.gray(`  dotenvx: ${dotenvxInstalled ? chalk.green('✓ installed') : chalk.yellow('✗ not installed')}`));

  // Environment files
  console.log(chalk.white('\nEnvironments:'));
  const environments = getExistingEnvironments(cwd);

  if (environments.length === 0) {
    console.log(chalk.yellow('  No .env files found'));
  } else {
    for (const env of environments) {
      const envFile = `.env.${env}`;
      const envPath = join(cwd, envFile);
      const content = readFileSync(envPath, 'utf-8');

      const hasPublicKey = content.includes('DOTENV_PUBLIC_KEY');
      const hasEncrypted = content.includes('encrypted:');
      const isEncrypted = hasPublicKey || hasEncrypted;

      // Count variables (excluding DOTENV_* keys)
      const varCount = content.split('\n')
        .filter(line => line.match(/^\w+=/))
        .filter(line => !line.startsWith('DOTENV_'))
        .length;

      const status = isEncrypted
        ? chalk.green('✓ encrypted')
        : chalk.yellow('✗ not encrypted');

      console.log(chalk.gray(`  ${envFile}: ${status} (${varCount} variables)`));
    }
  }

  // Keys
  console.log(chalk.white('\nEncryption Keys:'));
  const { exists: keysExist, keys } = getEnvKeys(cwd);

  if (!keysExist) {
    console.log(chalk.yellow('  No .env.keys file found'));
  } else {
    const keyCount = Object.keys(keys).length;
    console.log(chalk.gray(`  .env.keys: ${chalk.green('✓ exists')} (${keyCount} private key(s))`));

    // Check if keys match environments
    for (const env of environments) {
      const keyName = `DOTENV_PRIVATE_KEY_${env.toUpperCase()}`;
      const hasKey = !!keys[keyName];

      if (!hasKey) {
        console.log(chalk.yellow(`    ⚠️  Missing key for ${env} environment`));
      }
    }
  }

  // External tools
  console.log(chalk.white('\nExternal Tools:'));

  // Vercel CLI
  spinner.start('Checking Vercel CLI...');
  const vercelAvailable = await isVercelCliAvailable();
  spinner.stop();
  console.log(chalk.gray(`  Vercel CLI: ${vercelAvailable ? chalk.green('✓ available') : chalk.yellow('✗ not available')}`));

  // Bitwarden CLI
  spinner.start('Checking Bitwarden CLI...');
  const bwStatus = await checkBitwardenCli();
  spinner.stop();

  if (!bwStatus.available) {
    console.log(chalk.gray(`  Bitwarden CLI: ${chalk.yellow('✗ not installed')}`));
  } else if (!bwStatus.loggedIn) {
    console.log(chalk.gray(`  Bitwarden CLI: ${chalk.yellow(`✓ installed (${bwStatus.status})`)}`));
  } else {
    console.log(chalk.gray(`  Bitwarden CLI: ${chalk.green('✓ unlocked')}`));
  }

  // Git ignore status
  console.log(chalk.white('\nSecurity:'));

  const gitignorePath = join(cwd, '.gitignore');
  if (existsSync(gitignorePath)) {
    const gitignore = readFileSync(gitignorePath, 'utf-8');
    const ignoresKeys = gitignore.includes('.env.keys');
    console.log(chalk.gray(`  .gitignore protects .env.keys: ${ignoresKeys ? chalk.green('✓ yes') : chalk.red('✗ NO - ADD IT!')}`));
  } else {
    console.log(chalk.yellow('  No .gitignore file found'));
  }

  const vercelignorePath = join(cwd, '.vercelignore');
  if (existsSync(vercelignorePath)) {
    const vercelignore = readFileSync(vercelignorePath, 'utf-8');
    const ignoresKeys = vercelignore.includes('.env.keys');
    console.log(chalk.gray(`  .vercelignore protects .env.keys: ${ignoresKeys ? chalk.green('✓ yes') : chalk.red('✗ NO - ADD IT!')}`));
  } else {
    console.log(chalk.yellow('  No .vercelignore file found'));
  }

  // Recommendations
  console.log(chalk.white('\nRecommendations:'));

  const recommendations = [];

  if (!dotenvxInstalled) {
    recommendations.push('Run `dotenvx-deploy init` to set up encryption');
  }

  if (environments.length > 0) {
    const unencrypted = environments.filter(env => {
      const content = readFileSync(join(cwd, `.env.${env}`), 'utf-8');
      return !content.includes('encrypted:') && !content.includes('DOTENV_PUBLIC_KEY');
    });

    if (unencrypted.length > 0) {
      recommendations.push(`Encrypt: ${unencrypted.map(e => `.env.${e}`).join(', ')}`);
    }
  }

  if (keysExist && !bwStatus.available) {
    recommendations.push('Install Bitwarden CLI to backup your keys');
  }

  if (keysExist && bwStatus.available && bwStatus.loggedIn) {
    recommendations.push('Run `dotenvx-deploy bw-save` to backup keys to Bitwarden');
  }

  if (recommendations.length === 0) {
    console.log(chalk.green('  ✓ Everything looks good!'));
  } else {
    recommendations.forEach(r => console.log(chalk.yellow(`  • ${r}`)));
  }

  console.log('');
}
