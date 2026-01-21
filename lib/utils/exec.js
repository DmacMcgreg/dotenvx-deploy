import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Execute a command and return the result
 * @param {string} command - Command to execute
 * @param {object} options - Options
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
export async function run(command, options = {}) {
  const { cwd = process.cwd(), silent = false } = options;

  try {
    const result = await execAsync(command, { cwd, maxBuffer: 1024 * 1024 * 10 });
    return result;
  } catch (error) {
    if (!silent) {
      throw error;
    }
    return { stdout: '', stderr: error.message };
  }
}

/**
 * Execute a command with live output streaming
 * @param {string} command - Command to execute
 * @param {string[]} args - Command arguments
 * @param {object} options - Options
 * @returns {Promise<number>}
 */
export function runWithOutput(command, args = [], options = {}) {
  const { cwd = process.cwd(), env = process.env } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      resolve(code);
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Execute npm/npx command
 * @param {string} command - npm command (install, run, etc.)
 * @param {string[]} args - Arguments
 * @param {object} options - Options
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
export async function npm(command, args = [], options = {}) {
  const fullCommand = `npm ${command} ${args.join(' ')}`.trim();
  return run(fullCommand, options);
}

/**
 * Execute npx command
 * @param {string} command - npx command
 * @param {string[]} args - Arguments
 * @param {object} options - Options
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
export async function npx(command, args = [], options = {}) {
  const fullCommand = `npx ${command} ${args.join(' ')}`.trim();
  return run(fullCommand, options);
}

/**
 * Run dotenvx command
 * @param {string[]} args - Arguments for dotenvx
 * @param {object} options - Options
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
export async function dotenvx(args = [], options = {}) {
  return npx('@dotenvx/dotenvx', args, options);
}

/**
 * Run Vercel CLI command
 * @param {string[]} args - Arguments for vercel
 * @param {object} options - Options
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
export async function vercel(args = [], options = {}) {
  return npx('vercel@latest', args, options);
}

/**
 * Run Bitwarden CLI command
 * @param {string[]} args - Arguments for bw
 * @param {object} options - Options
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
export async function bw(args = [], options = {}) {
  const fullCommand = `bw ${args.join(' ')}`.trim();
  return run(fullCommand, options);
}
