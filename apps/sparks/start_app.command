#!/usr/bin/env bash
set -euo pipefail

# Get the directory where the script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Change to that directory
cd "$DIR"

if ! command -v npm &>/dev/null; then
    echo "npm is not installed. Install Node.js/npm to run the app with the bundled Activities canvas editor."
    read -n 1 -s -r -p "Press any key to exit..."
    exit 1
fi

if [[ ! -d "node_modules" ]]; then
    echo "Installing app dependencies..."
    npm install
fi

if [[ -x "./planner" ]]; then
    echo "Starting student app with Vite so Excalidraw assets load correctly..."
    ./planner run student
else
    echo "Starting student app with Vite so Excalidraw assets load correctly..."
    npx vite --host 127.0.0.1 --port 8000 --open /student.html
fi
