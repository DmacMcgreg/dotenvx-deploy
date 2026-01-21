#!/bin/bash

# dotenvx-deploy installer
# Usage: curl -fsSL https://raw.githubusercontent.com/DmacMcgreg/dotenvx-deploy/main/install.sh | bash

set -e

REPO="DmacMcgreg/dotenvx-deploy"
VERSION="${VERSION:-latest}"
INSTALL_DIR="${HOME}/.local/bin"

# Detect OS and architecture
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin)
    case "$ARCH" in
      x86_64) BINARY="dotenvx-deploy-macos-x64" ;;
      arm64)  BINARY="dotenvx-deploy-macos-arm64" ;;
      *)      echo "Unsupported architecture: $ARCH"; exit 1 ;;
    esac
    ;;
  Linux)
    case "$ARCH" in
      x86_64) BINARY="dotenvx-deploy-linux-x64" ;;
      *)      echo "Unsupported architecture: $ARCH"; exit 1 ;;
    esac
    ;;
  MINGW*|MSYS*|CYGWIN*)
    BINARY="dotenvx-deploy-windows-x64.exe"
    INSTALL_DIR="${HOME}/bin"
    ;;
  *)
    echo "Unsupported OS: $OS"
    exit 1
    ;;
esac

echo "🔐 Installing dotenvx-deploy..."
echo "   OS: $OS ($ARCH)"

# Create install directory
mkdir -p "$INSTALL_DIR"

# Get download URL
if [ "$VERSION" = "latest" ]; then
  DOWNLOAD_URL="https://github.com/${REPO}/releases/latest/download/${BINARY}"
else
  DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${VERSION}/${BINARY}"
fi

echo "📦 Downloading from: $DOWNLOAD_URL"

# Download binary
if command -v curl &> /dev/null; then
  curl -fsSL "$DOWNLOAD_URL" -o "${INSTALL_DIR}/dotenvx-deploy"
elif command -v wget &> /dev/null; then
  wget -q "$DOWNLOAD_URL" -O "${INSTALL_DIR}/dotenvx-deploy"
else
  echo "Error: curl or wget required"
  exit 1
fi

# Make executable
chmod +x "${INSTALL_DIR}/dotenvx-deploy"

# Create short alias
ln -sf "${INSTALL_DIR}/dotenvx-deploy" "${INSTALL_DIR}/dxd"

# Check if INSTALL_DIR is in PATH
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
  echo ""
  echo "⚠️  Add this to your shell profile (.bashrc, .zshrc, etc.):"
  echo ""
  echo "    export PATH=\"$INSTALL_DIR:\$PATH\""
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
