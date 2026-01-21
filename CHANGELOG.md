# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2026-01-21

### Fixed

- Fix GitHub Actions workflow using deprecated `macos-13` runner
- Update to `macos-15-large` for x64 builds

### Added

- Manual workflow dispatch trigger for releases

## [1.0.1] - 2026-01-21

### Fixed

- Fix ES module compatibility issue with `require('fs')` in `findAllEnvFiles`
- Use proper ES module imports for `readdirSync`

### Changed

- Add standalone binary builds using Bun compiler
- Binaries now include runtime - no Node.js/Bun installation required
- Updated install script to download pre-compiled binaries from GitHub Releases
- Support for macOS (x64, ARM64), Linux (x64), and Windows (x64)

### Added

- Build scripts for cross-platform compilation (`bun run build:all`)
- Platform-specific binary naming convention

## [1.0.0] - 2026-01-21

### Added

- **`init` command**: Initialize dotenvx encryption in Next.js and Vite projects
  - Auto-detects project type from package.json
  - Scans and displays all existing `.env*` files with encryption status
  - Shows variable preview for each environment file
  - Pre-selects unencrypted files for encryption
  - Installs `@dotenvx/dotenvx` package automatically
  - Updates `package.json` scripts with `dotenvx run --` wrapper
  - Configures `.gitignore` and `.vercelignore` for security
  - Supports `--yes` flag for non-interactive mode (CI/CD)

- **`deploy` command**: Deploy encrypted environments to Vercel
  - Sets `DOTENV_PRIVATE_KEY_<ENV>` in Vercel environment variables
  - Supports production, preview, and development environments
  - Optional deployment trigger after key setup

- **`encrypt` command**: Encrypt environment variables
  - Encrypt entire `.env.<environment>` files
  - Add or update specific variables with `-k` and `-v` flags
  - Supports all environment types

- **`rotate` command**: Rotate encryption keys
  - Generates new encryption keys for selected environments
  - Re-encrypts all variables with new keys
  - Creates backup of existing keys before rotation
  - Supports `--all` flag to rotate all environments at once

- **`bw-save` command**: Save private keys to Bitwarden
  - Stores keys as secure notes in Bitwarden vault
  - Uses `{package.json name}/{environment}` naming pattern
  - Creates dedicated folder for organization
  - Updates existing entries on subsequent saves

- **`bw-pull` command**: Pull private keys from Bitwarden
  - Retrieves keys from Bitwarden vault
  - Supports filtering by environment
  - Merges with existing `.env.keys` file
  - Enables team onboarding and machine setup

- **`status` command**: Show encryption and deployment status
  - Displays project type and name
  - Lists all environment files with encryption status
  - Shows available private keys
  - Checks external tool availability (Vercel CLI, Bitwarden CLI)
  - Validates security configuration
  - Provides actionable recommendations

- **Installation options**:
  - Install from GitHub: `npm install -g github:DmacMcgreg/dotenvx-deploy`
  - Install via script: `curl -fsSL .../install.sh | bash`
  - Short alias: `dxd`

### Security

- Private keys (`.env.keys`) are never committed to version control
- Encrypted environment files are safe to commit
- Bitwarden integration for secure key backup and sharing
- Key rotation support for security best practices

[1.0.2]: https://github.com/DmacMcgreg/dotenvx-deploy/releases/tag/v1.0.2
[1.0.1]: https://github.com/DmacMcgreg/dotenvx-deploy/releases/tag/v1.0.1
[1.0.0]: https://github.com/DmacMcgreg/dotenvx-deploy/releases/tag/v1.0.0
