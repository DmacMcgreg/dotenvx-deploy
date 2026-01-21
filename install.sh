#!/bin/bash

# dotenvx-deploy installer
# Usage: curl -fsSL https://raw.githubusercontent.com/DmacMcgreg/dotenvx-deploy/main/install.sh | bash

set -e

REPO="DmacMcgreg/dotenvx-deploy"
INSTALL_DIR="${HOME}/.dotenvx-deploy"
BIN_DIR="${HOME}/.local/bin"

echo "🔐 Installing dotenvx-deploy..."

# Create directories
mkdir -p "$INSTALL_DIR"
mkdir -p "$BIN_DIR"

# Clone or update repository
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "📦 Updating existing installation..."
  cd "$INSTALL_DIR"
  git pull origin main
else
  echo "📦 Cloning repository..."
  git clone "https://github.com/${REPO}.git" "$INSTALL_DIR"
fi

# Install dependencies
cd "$INSTALL_DIR"
echo "📦 Installing dependencies..."
npm install --production

# Create symlink
echo "🔗 Creating symlink..."
ln -sf "$INSTALL_DIR/bin/cli.js" "$BIN_DIR/dotenvx-deploy"
ln -sf "$INSTALL_DIR/bin/cli.js" "$BIN_DIR/dxd"

# Make executable
chmod +x "$INSTALL_DIR/bin/cli.js"

# Check if BIN_DIR is in PATH
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
  echo ""
  echo "⚠️  Add this to your shell profile (.bashrc, .zshrc, etc.):"
  echo ""
  echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
  echo ""
fi

echo ""
echo "✅ dotenvx-deploy installed successfully!"
echo ""
echo "Commands:"
echo "  dotenvx-deploy init      # Initialize encryption"
echo "  dotenvx-deploy deploy    # Deploy to Vercel"
echo "  dotenvx-deploy status    # Check status"
echo "  dxd --help               # Short alias"
echo ""
