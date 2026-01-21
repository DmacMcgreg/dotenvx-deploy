import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { isVercelCliAvailable, getEnvKeys, getProjectName } from '../utils/detect.js';
import { vercel, run } from '../utils/exec.js';

/**
 * Deploy encrypted environment to Vercel
 * @param {object} options - Command options
 */
export async function deployCommand(options) {
  const cwd = process.cwd();
  const spinner = ora();

  console.log(chalk.bold('\n🚀 dotenvx-deploy deploy\n'));

  // Check if Vercel CLI is available
  spinner.start('Checking Vercel CLI...');
  const vercelAvailable = await isVercelCliAvailable();

  if (!vercelAvailable) {
    spinner.fail('Vercel CLI not found');
    console.log(chalk.yellow('\nInstall Vercel CLI:'));
    console.log(chalk.cyan('  npm install -g vercel'));
    process.exit(1);
  }
  spinner.succeed('Vercel CLI available');

  // Check for .env.keys
  const { exists: keysExist, keys } = getEnvKeys(cwd);

  if (!keysExist) {
    spinner.fail('No .env.keys file found');
    console.log(chalk.yellow('\nRun `dotenvx-deploy init` first to set up encryption'));
    process.exit(1);
  }

  // Determine which environment to deploy
  const envName = options.env || 'production';
  const privateKeyName = `DOTENV_PRIVATE_KEY_${envName.toUpperCase()}`;
  const privateKey = keys[privateKeyName];

  if (!privateKey) {
    console.log(chalk.red(`\n❌ No private key found for ${envName} environment`));
    console.log(chalk.gray(`   Expected key: ${privateKeyName}`));
    console.log(chalk.yellow('\nAvailable keys:'));
    Object.keys(keys).forEach(k => console.log(chalk.gray(`   - ${k}`)));
    process.exit(1);
  }

  // Check if encrypted env file exists
  const envFile = `.env.${envName}`;
  const envPath = join(cwd, envFile);

  if (!existsSync(envPath)) {
    console.log(chalk.red(`\n❌ ${envFile} not found`));
    console.log(chalk.yellow('\nRun `dotenvx-deploy encrypt` first'));
    process.exit(1);
  }

  // Check if encrypted
  const envContent = readFileSync(envPath, 'utf-8');
  if (!envContent.includes('encrypted:')) {
    console.log(chalk.yellow(`\n⚠️  ${envFile} doesn't appear to be encrypted`));
    const { proceed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'proceed',
      message: 'Continue anyway?',
      default: false
    }]);

    if (!proceed) {
      console.log(chalk.gray('Aborted'));
      process.exit(0);
    }
  }

  console.log(chalk.cyan(`\nDeploying ${envName} environment to Vercel...\n`));

  // Set the private key in Vercel
  spinner.start(`Setting ${privateKeyName} in Vercel...`);

  try {
    // Determine Vercel environment scope
    let vercelEnvScope = 'production';
    if (envName === 'preview' || envName === 'staging') {
      vercelEnvScope = 'preview';
    } else if (envName === 'development') {
      vercelEnvScope = 'development';
    }

    // Check if key already exists
    const { stdout: existingEnvs } = await vercel(['env', 'ls'], { cwd, silent: true });

    if (existingEnvs.includes(privateKeyName)) {
      spinner.text = `Removing existing ${privateKeyName}...`;
      await vercel(['env', 'rm', privateKeyName, vercelEnvScope, '-y'], { cwd, silent: true });
    }

    // Add the new key
    spinner.text = `Adding ${privateKeyName} to Vercel...`;

    // Use echo to pipe the key value
    await run(`echo "${privateKey}" | npx vercel@latest env add ${privateKeyName} ${vercelEnvScope}`, { cwd });

    spinner.succeed(`Set ${privateKeyName} for ${vercelEnvScope} environment`);
  } catch (error) {
    spinner.fail(`Failed to set ${privateKeyName}`);
    console.error(chalk.red(error.message));

    // Offer manual instructions
    console.log(chalk.yellow('\nManual setup:'));
    console.log(chalk.gray(`  1. Go to your Vercel project settings`));
    console.log(chalk.gray(`  2. Navigate to Environment Variables`));
    console.log(chalk.gray(`  3. Add ${privateKeyName} with value:`));
    console.log(chalk.cyan(`     ${privateKey}`));
    process.exit(1);
  }

  // Deploy to Vercel
  const { shouldDeploy } = await inquirer.prompt([{
    type: 'confirm',
    name: 'shouldDeploy',
    message: 'Deploy to Vercel now?',
    default: true
  }]);

  if (shouldDeploy) {
    spinner.start('Deploying to Vercel...');

    try {
      const deployArgs = ['deploy'];

      if (options.prod || envName === 'production') {
        deployArgs.push('--prod');
      }

      const { stdout } = await vercel(deployArgs, { cwd });
      spinner.succeed('Deployed to Vercel');

      // Extract URL from output
      const urlMatch = stdout.match(/https:\/\/[^\s]+\.vercel\.app/);
      if (urlMatch) {
        console.log(chalk.green(`\n🌐 Deployment URL: ${chalk.cyan(urlMatch[0])}`));
      }

      console.log(chalk.gray('\nView full output:'));
      console.log(stdout);
    } catch (error) {
      spinner.fail('Deployment failed');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  }

  // Summary
  console.log(chalk.bold.green('\n✅ Environment deployed successfully!\n'));
  console.log(chalk.white('Your app will now:'));
  console.log(chalk.gray(`  1. Read encrypted values from ${envFile}`));
  console.log(chalk.gray(`  2. Decrypt them using ${privateKeyName}`));
  console.log(chalk.gray(`  3. Inject variables at runtime`));
}
