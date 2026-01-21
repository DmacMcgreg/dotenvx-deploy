import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Detect the project type (Next.js, Vite, or unknown)
 * @param {string} cwd - Current working directory
 * @returns {{ type: 'nextjs' | 'vite' | 'unknown', version?: string, framework?: string }}
 */
export function detectProjectType(cwd = process.cwd()) {
  const packageJsonPath = join(cwd, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return { type: 'unknown' };
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    // Check for Next.js
    if (deps.next) {
      return {
        type: 'nextjs',
        version: deps.next,
        framework: 'Next.js'
      };
    }

    // Check for Vite
    if (deps.vite) {
      // Detect Vite framework variant
      let framework = 'Vite';
      if (deps['@vitejs/plugin-react'] || deps['@vitejs/plugin-react-swc']) {
        framework = 'Vite + React';
      } else if (deps['@vitejs/plugin-vue']) {
        framework = 'Vite + Vue';
      } else if (deps['@sveltejs/vite-plugin-svelte']) {
        framework = 'Vite + Svelte';
      }

      return {
        type: 'vite',
        version: deps.vite,
        framework
      };
    }

    return { type: 'unknown' };
  } catch (error) {
    return { type: 'unknown' };
  }
}

/**
 * Get the project name from package.json
 * @param {string} cwd - Current working directory
 * @returns {string | null}
 */
export function getProjectName(cwd = process.cwd()) {
  const packageJsonPath = join(cwd, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return null;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.name || null;
  } catch {
    return null;
  }
}

/**
 * Check if dotenvx is installed
 * @param {string} cwd - Current working directory
 * @returns {boolean}
 */
export function isDotenvxInstalled(cwd = process.cwd()) {
  const packageJsonPath = join(cwd, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    return !!deps['@dotenvx/dotenvx'];
  } catch {
    return false;
  }
}

/**
 * Check if Vercel CLI is available
 * @returns {Promise<boolean>}
 */
export async function isVercelCliAvailable() {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  try {
    await execAsync('vercel --version');
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if Bitwarden CLI is available and logged in
 * @returns {Promise<{ available: boolean, loggedIn: boolean, status?: string }>}
 */
export async function checkBitwardenCli() {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  try {
    await execAsync('bw --version');
  } catch {
    return { available: false, loggedIn: false };
  }

  try {
    const { stdout } = await execAsync('bw status');
    const status = JSON.parse(stdout);
    return {
      available: true,
      loggedIn: status.status === 'unlocked',
      status: status.status
    };
  } catch {
    return { available: true, loggedIn: false };
  }
}

/**
 * Get existing environments from .env files
 * @param {string} cwd - Current working directory
 * @returns {string[]}
 */
export function getExistingEnvironments(cwd = process.cwd()) {
  const envFiles = [
    '.env.production',
    '.env.preview',
    '.env.development',
    '.env.local',
    '.env.staging',
    '.env.test'
  ];

  return envFiles
    .filter(file => existsSync(join(cwd, file)))
    .map(file => file.replace('.env.', ''));
}

/**
 * Find all .env* files in the directory
 * @param {string} cwd - Current working directory
 * @returns {Array<{ file: string, name: string, path: string, isEncrypted: boolean, varCount: number, variables: string[] }>}
 */
export function findAllEnvFiles(cwd = process.cwd()) {
  try {
    const files = readdirSync(cwd);
    const envFiles = files.filter(f =>
      f.startsWith('.env') &&
      !f.endsWith('.keys') &&
      !f.includes('.backup') &&
      !f.endsWith('.example') &&
      !f.endsWith('.sample')
    );

    return envFiles.map(file => {
      const filePath = join(cwd, file);
      const content = readFileSync(filePath, 'utf-8');

      // Check if encrypted
      const isEncrypted = content.includes('encrypted:') || content.includes('DOTENV_PUBLIC_KEY');

      // Parse variables (excluding DOTENV_* keys)
      const variables = [];
      for (const line of content.split('\n')) {
        const match = line.match(/^([A-Z_][A-Z0-9_]*)=/i);
        if (match && !match[1].startsWith('DOTENV_')) {
          variables.push(match[1]);
        }
      }

      // Determine environment name
      let name = file.replace('.env.', '').replace('.env', 'root');
      if (file === '.env') {
        name = 'root';
      }

      return {
        file,
        name,
        path: filePath,
        isEncrypted,
        varCount: variables.length,
        variables
      };
    });
  } catch {
    return [];
  }
}

/**
 * Check if .env.keys file exists and parse it
 * @param {string} cwd - Current working directory
 * @returns {{ exists: boolean, keys: Record<string, string> }}
 */
export function getEnvKeys(cwd = process.cwd()) {
  const keysPath = join(cwd, '.env.keys');

  if (!existsSync(keysPath)) {
    return { exists: false, keys: {} };
  }

  try {
    const content = readFileSync(keysPath, 'utf-8');
    const keys = {};

    for (const line of content.split('\n')) {
      const match = line.match(/^(DOTENV_PRIVATE_KEY_\w+)="?([^"]+)"?$/);
      if (match) {
        keys[match[1]] = match[2];
      }
    }

    return { exists: true, keys };
  } catch {
    return { exists: false, keys: {} };
  }
}
