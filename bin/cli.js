#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from '../lib/commands/init.js';
import { deployCommand } from '../lib/commands/deploy.js';
import { encryptCommand } from '../lib/commands/encrypt.js';
import { rotateCommand } from '../lib/commands/rotate.js';
import { bwSaveCommand } from '../lib/commands/bw-save.js';
import { bwPullCommand } from '../lib/commands/bw-pull.js';
import { statusCommand } from '../lib/commands/status.js';

const program = new Command();

program
  .name('dotenvx-deploy')
  .description('CLI for managing dotenvx encryption with Vercel deployment and Bitwarden integration')
  .version('1.0.2');

program
  .command('init')
  .description('Initialize dotenvx in a Next.js or Vite project')
  .option('-e, --env <environments...>', 'Environments to set up (default: production)', ['production'])
  .option('--no-install', 'Skip installing dotenvx package')
  .option('--force', 'Overwrite existing configuration')
  .option('-y, --yes', 'Auto-confirm all prompts (encrypt all found .env files)')
  .action(initCommand);

program
  .command('deploy')
  .description('Deploy encrypted environment to Vercel')
  .option('-e, --env <environment>', 'Environment to deploy (default: production)', 'production')
  .option('--prod', 'Deploy to production')
  .option('--preview', 'Deploy to preview only')
  .action(deployCommand);

program
  .command('encrypt')
  .description('Encrypt environment variables')
  .option('-e, --env <environment>', 'Environment to encrypt (default: production)', 'production')
  .option('-k, --key <key>', 'Specific key to encrypt')
  .option('-v, --value <value>', 'Value for the key (use with --key)')
  .action(encryptCommand);

program
  .command('rotate')
  .description('Rotate encryption keys for an environment')
  .option('-e, --env <environment>', 'Environment to rotate (default: production)', 'production')
  .option('--all', 'Rotate keys for all environments')
  .action(rotateCommand);

program
  .command('bw-save')
  .description('Save private keys to Bitwarden')
  .option('-e, --env <environment>', 'Environment to save (default: all)')
  .option('--folder <folder>', 'Bitwarden folder name', 'dotenvx-keys')
  .action(bwSaveCommand);

program
  .command('bw-pull')
  .description('Pull private keys from Bitwarden')
  .option('-e, --env <environment>', 'Environment to pull (default: all)')
  .option('--folder <folder>', 'Bitwarden folder name', 'dotenvx-keys')
  .action(bwPullCommand);

program
  .command('status')
  .description('Show current encryption and deployment status')
  .action(statusCommand);

program.parse();
