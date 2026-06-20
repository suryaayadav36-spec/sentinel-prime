#!/bin/zsh

set -e

cd "$(dirname "$0")"

echo "Starting Sentinel Prime..."

if ! command -v npm >/dev/null 2>&1; then
  echo "npm was not found. Please install Node.js first: https://nodejs.org/"
  read -k 1 "?Press any key to close..."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

open "http://localhost:5173"
npm run dev -- --host 127.0.0.1

