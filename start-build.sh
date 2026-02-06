#!/usr/bin/env bash
set -u

echo
echo "========================================"
echo "  BNJMO - Starting Server"
echo "========================================"
echo

# Check if Node.js is installed
if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js is not installed!"
  echo
  echo "Please install Node.js from: https://nodejs.org/"
  echo
  read -r -p "Press Enter to exit..."
  exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "[INFO] Installing dependencies..."
  echo
  npm install
  npm_exit=$?
  echo
  if [ $npm_exit -ne 0 ]; then
    echo "[ERROR] npm install failed."
    exit $npm_exit
  fi
fi

# Prepare Vite base path for export
echo "[INFO] Setting Vite base path for export build..."
node "scripts/updateBuildConfig.cjs" --set-vite-path export --skip-metadata
set_path_exit=$?
if [ $set_path_exit -ne 0 ]; then
  echo "[ERROR] Failed to set export Vite path."
  exit $set_path_exit
fi

echo "[INFO] Starting Vite build..."

# Update build metadata
echo "[INFO] Updating build metadata..."
node "scripts/updateBuildConfig.cjs"
meta_exit=$?
if [ $meta_exit -ne 0 ]; then
  echo "[ERROR] Failed to update build metadata."
  exit $meta_exit
fi

npm run build
buildResult=$?

# Restore local Vite base path after build (run even if build failed)
echo "[INFO] Restoring local Vite base path..."
node "scripts/updateBuildConfig.cjs" --set-vite-path local --skip-metadata
restore_exit=$?
if [ $restore_exit -ne 0 ]; then
  echo "[ERROR] Failed to restore local Vite path."
  exit $restore_exit
fi

if [ $buildResult -ne 0 ]; then
  echo "[ERROR] Build failed."
  exit $buildResult
fi

read -r -p "Press Enter to exit..."
