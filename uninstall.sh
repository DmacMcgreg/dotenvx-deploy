#!/bin/bash

# dotenvx-deploy uninstaller
# Usage: curl -fsSL https://raw.githubusercontent.com/DmacMcgreg/dotenvx-deploy/main/uninstall.sh | bash

set -e

INSTALL_DIR="${HOME}/.dotenvx-deploy"
BIN_DIR="${HOME}/.local/bin"

echo "🗑️  Uninstalling dotenvx-deploy..."

# Remove symlinks
if [ -L "$BIN_DIR/dotenvx-deploy" ]; then
  rm "$BIN_DIR/dotenvx-deploy"
  echo "✓ Removed $BIN_DIR/dotenvx-deploy"
fi

if [ -L "$BIN_DIR/dxd" ]; then
  rm "$BIN_DIR/dxd"
  echo "✓ Removed $BIN_DIR/dxd"
fi

# Remove installation directory
if [ -d "$INSTALL_DIR" ]; then
  rm -rf "$INSTALL_DIR"
  echo "✓ Removed $INSTALL_DIR"
fi

# Check for global npm install
if command -v npm &> /dev/null; then
  if npm list -g dotenvx-deploy &> /dev/null; then
    echo ""
    echo "⚠️  Found global npm installation. Remove with:"
    echo "   npm uninstall -g dotenvx-deploy"
  fi
fi

echo ""
echo "✅ dotenvx-deploy uninstalled successfully!"
echo ""
