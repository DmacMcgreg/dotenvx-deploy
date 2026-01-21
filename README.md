# dotenvx-deploy

CLI for managing dotenvx encryption with Vercel deployment and Bitwarden integration.

Automates the setup process for encrypted environment variables in Next.js and Vite projects, with secure key storage in Bitwarden.

## Installation

**Requires Node.js 18+**

### Quick Install (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/DmacMcgreg/dotenvx-deploy/main/install.sh | bash
```

### From npm/GitHub

```bash
# Install globally
npm install -g github:DmacMcgreg/dotenvx-deploy

# Or use npx for one-off usage
npx github:DmacMcgreg/dotenvx-deploy <command>
```

### From source

```bash
git clone https://github.com/DmacMcgreg/dotenvx-deploy.git
cd dotenvx-deploy
npm install
npm link
```

### Uninstall

```bash
curl -fsSL https://raw.githubusercontent.com/DmacMcgreg/dotenvx-deploy/main/uninstall.sh | bash
```

## Quick Start

```bash
# 1. Initialize dotenvx in your project
dotenvx-deploy init

# 2. Save keys to Bitwarden
dotenvx-deploy bw-save

# 3. Deploy to Vercel
dotenvx-deploy deploy
```

## Commands

### `init`

Initialize dotenvx encryption in a Next.js or Vite project.

```bash
dotenvx-deploy init [options]

Options:
  -e, --env <environments...>  Environments to set up (default: production)
  --no-install                 Skip installing dotenvx package
  --force                      Overwrite existing configuration
```

**What it does:**
- Auto-detects project type (Next.js or Vite)
- Installs `@dotenvx/dotenvx`
- Creates and encrypts `.env.<environment>` files
- Updates `package.json` scripts with `dotenvx run --`
- Configures `.gitignore` and `.vercelignore`

### `deploy`

Deploy encrypted environment to Vercel.

```bash
dotenvx-deploy deploy [options]

Options:
  -e, --env <environment>  Environment to deploy (default: production)
  --prod                   Deploy to production
  --preview                Deploy to preview only
```

**What it does:**
- Sets `DOTENV_PRIVATE_KEY_<ENV>` in Vercel environment variables
- Optionally triggers a deployment

### `encrypt`

Encrypt environment variables or add new variables to encrypted files.

```bash
dotenvx-deploy encrypt [options]

Options:
  -e, --env <environment>  Environment to encrypt (default: production)
  -k, --key <key>          Specific key to encrypt
  -v, --value <value>      Value for the key (use with --key)
```

**Examples:**
```bash
# Encrypt entire .env.production
dotenvx-deploy encrypt

# Add/update a specific variable
dotenvx-deploy encrypt -k API_KEY -v "my-secret-key"

# Encrypt .env.staging
dotenvx-deploy encrypt -e staging
```

### `rotate`

Rotate encryption keys for one or more environments.

```bash
dotenvx-deploy rotate [options]

Options:
  -e, --env <environment>  Environment to rotate (default: production)
  --all                    Rotate keys for all environments
```

**What it does:**
- Decrypts current values
- Generates new encryption keys
- Re-encrypts all variables
- Updates `.env.keys` file

**⚠️ Important:** After rotating, you must:
1. Update Bitwarden: `dotenvx-deploy bw-save`
2. Update Vercel: `dotenvx-deploy deploy`

### `bw-save`

Save private keys to Bitwarden. See [Bitwarden CLI Setup](#bitwarden-cli-setup) below.

```bash
dotenvx-deploy bw-save [options]

Options:
  -e, --env <environment>  Environment to save (default: all)
  -n, --name <name>        Version name (e.g., "client-a", "v2", "backup")
  --note <note>            Add a note/description to the saved key
  --folder <folder>        Bitwarden folder name (default: dotenvx-keys)
```

**Key naming:**
Keys are stored using the pattern `{package.json name}/{environment}`:
- `my-app/production`
- `my-app/staging`
- `my-app/development`

With versioning (`--name`), keys are stored as:
- `my-app/production/client-a`
- `my-app/production/v2`

**Examples:**
```bash
# Save default version
dotenvx-deploy bw-save

# Save as a named version with a note
dotenvx-deploy bw-save --name client-a --note "Keys for Client A project"

# Save backup before rotation
dotenvx-deploy bw-save --name backup-2024-01 --note "Pre-rotation backup"
```

### `bw-pull`

Pull private keys from Bitwarden. See [Bitwarden CLI Setup](#bitwarden-cli-setup) below.

```bash
dotenvx-deploy bw-pull [options]

Options:
  -e, --env <environment>  Environment to pull (default: all)
  -n, --name <name>        Pull a specific version by name
  --folder <folder>        Bitwarden folder name (default: dotenvx-keys)
```

**Use cases:**
- Setting up a new development machine
- Restoring keys after accidental deletion
- Team onboarding
- Switching between different key versions

**Examples:**
```bash
# Pull default/latest keys
dotenvx-deploy bw-pull

# Pull a specific version
dotenvx-deploy bw-pull --name client-a

# Pull specific environment and version
dotenvx-deploy bw-pull -e production --name v2
```

When multiple versions exist for an environment, you'll be prompted to select which one to use.

### `bw-list`

List all saved keys in Bitwarden.

```bash
dotenvx-deploy bw-list [options]

Options:
  --all                    Show all projects (not just current)
  --folder <folder>        Bitwarden folder name (default: dotenvx-keys)
```

**Example output:**
```
my-app/
  root - "Main development keys" (1/15/2026)
  production [2 versions]
    └─ client-a - "Keys for Client A" (1/10/2026)
    └─ client-b - "Keys for Client B" (1/12/2026)
  staging (1/14/2026)

2 key(s) in 1 project(s)
```

### `status`

Show current encryption and deployment status.

```bash
dotenvx-deploy status
```

**Shows:**
- Project type and name
- Environment files and encryption status
- Available private keys
- External tool availability (Vercel CLI, Bitwarden CLI)
- Security checks (gitignore configuration)
- Recommendations

## Bitwarden CLI Setup

The `bw-save` and `bw-pull` commands require the Bitwarden CLI to be installed and authenticated. Follow these steps:

### 1. Install Bitwarden CLI

```bash
# Using npm
npm install -g @bitwarden/cli

# Or using Homebrew (macOS/Linux)
brew install bitwarden-cli
```

### 2. Login to Bitwarden

```bash
bw login
```

This will prompt for your email and master password. If you use 2FA, you'll be prompted for that as well.

### 3. Unlock Your Vault

After logging in, your vault is still locked. You need to unlock it and set the session token:

```bash
# This unlocks your vault and exports the session token
export BW_SESSION=$(bw unlock --raw)
```

**Note:** The `export` command only works in bash/zsh. For other shells:
- **Fish:** `set -x BW_SESSION (bw unlock --raw)`
- **PowerShell:** `$env:BW_SESSION = (bw unlock --raw)`
- **Windows CMD:** Run `bw unlock` and manually set `BW_SESSION` with the output

### 4. Verify Setup

```bash
bw status
```

You should see `"status": "unlocked"`.

### Session Expiration

The `BW_SESSION` token expires when you close your terminal. You'll need to unlock again:

```bash
export BW_SESSION=$(bw unlock --raw)
```

**Tip:** Add this alias to your shell config for convenience:
```bash
alias bwunlock='export BW_SESSION=$(bw unlock --raw)'
```

## Workflows

### New Project Setup

```bash
# 1. Create your project
npx create-next-app@latest my-app
cd my-app

# 2. Initialize dotenvx
dotenvx-deploy init

# 3. Add your environment variables when prompted

# 4. Backup keys to Bitwarden
dotenvx-deploy bw-save

# 5. Commit encrypted files
git add .env.production .vercelignore
git commit -m "Add encrypted environment"

# 6. Deploy
dotenvx-deploy deploy
```

### Team Member Onboarding

```bash
# 1. Clone the repo
git clone <repo-url>
cd my-app

# 2. Install dependencies
npm install

# 3. Pull keys from Bitwarden
export BW_SESSION=$(bw unlock --raw)
dotenvx-deploy bw-pull

# 4. Start developing
npm run dev
```

### Rotating Keys (Security Best Practice)

```bash
# 1. Rotate keys
dotenvx-deploy rotate --all

# 2. Update Bitwarden
dotenvx-deploy bw-save

# 3. Update Vercel
dotenvx-deploy deploy -e production
dotenvx-deploy deploy -e preview

# 4. Commit updated encrypted files
git add .env.*
git commit -m "Rotate encryption keys"
git push
```

### Adding a New Environment Variable

```bash
# Add to production
dotenvx-deploy encrypt -k NEW_API_KEY -v "secret-value"

# Commit the change
git add .env.production
git commit -m "Add NEW_API_KEY"

# Redeploy (no key update needed, same encryption keys)
npx vercel --prod
```

## Security Notes

1. **Never commit `.env.keys`** - This file contains private decryption keys
2. **Always backup keys** - Use Bitwarden or another secure password manager
3. **Rotate keys regularly** - Especially after team member departures
4. **Use separate keys per environment** - Production keys should be different from staging

## Troubleshooting

### "Bitwarden CLI not unlocked"

```bash
# If locked
export BW_SESSION=$(bw unlock --raw)

# If not logged in
bw login
export BW_SESSION=$(bw unlock --raw)
```

### "No .env.keys file found"

Run `dotenvx-deploy init` first, or pull keys from Bitwarden:
```bash
dotenvx-deploy bw-pull
```

### "Vercel deployment failed"

1. Make sure you're logged in: `npx vercel login`
2. Check if the project is linked: `npx vercel link`
3. Verify the private key is set: `npx vercel env ls`

## License

MIT
