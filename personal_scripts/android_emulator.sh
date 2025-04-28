#!/usr/bin/env zsh

getRootDirProjectPath() {
    local rootDirectoryPath=$(pwd)
    if [[ $(basename "$rootDirectoryPath") != 'smooth-migration' ]]; then
        rootDirectoryPath="${rootDirectoryPath%%"smooth-migration"*}smooth-migration"
    fi
    echo "$rootDirectoryPath"
}

main() {
    # Get variables and paths
    local rootDirectoryPath=$(getRootDirProjectPath)
    cd "$rootDirectoryPath"

    local -r backendDirPath="$rootDirectoryPath/src/backend"

    local -r backendLogPath="$rootDirectoryPath/personal_scripts/logs/backend.log"

    local -r venvPythonExecutable="$rootDirectoryPath/src/backend/.venv/bin/python3"
    local -r killScriptExecutable="$rootDirectoryPath/personal_scripts/helpers/kill.sh"

    # Start doing work
    osascript -e 'tell application "Ollama" to activate'
    sleep 1

    # Start backend in background
    echo 'Starting backend as background process...'
    cd "$backendDirPath" || {echo "Backend Directory not found at $backendDirPath"; exit 1;}
    date > "$backendLogPath"
    "$venvPythonExecutable" -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 >> "$backendLogPath" 2>&1 &
    cd "$rootAppPath"
    sleep 2

    # Sycn android and open it
    echo 'Syncing and starting android...'
    ionic cap sync android && ionic cap open android

    printf '\nRun in android emulator, then hit enter here to clean up everything...'; read
    exec "$killScriptExecutable"
}

main
