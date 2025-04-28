#!/usr/bin/env zsh

getRootDirProjectPath() {
    local rootDirectoryPath=$(pwd)
    if [[ $(basename "$rootDirectoryPath") != 'smooth-migration' ]]; then
        # This command uses ${} to act upon variables, where $() acts upon commands
        #   take the root path, %% then removes the longest following suffix
        #       remove "smooth-migration" and anything after, then add back smooth migration
        #       to just get the path to the root project directory
        rootDirectoryPath="${rootDirectoryPath%%"smooth-migration"*}smooth-migration"
    fi
    
    # Return result
    echo "$rootDirectoryPath"
}

# This is the first file for the scripting work, learnt a lot here, but also means
# I'll have a lot of notes here as comments on certain parts, less in other files (Vova)
main() {
    # Set up local paths needed
    local rootDirectoryPath=$(getRootDirProjectPath)

    # cd's in here only affect the shubshell, not personal terminal directory locations
    cd "$rootDirectoryPath"

    # Create logs folder if it doesn't exist
    mkdir -p "$rootDirectoryPath/personal_scripts/logs"

    local -r backendDirPath="$rootDirectoryPath/src/backend"

    local -r backendLogPath="$rootDirectoryPath/personal_scripts/logs/backend.log"
    local -r ionicLogPath="$rootDirectoryPath/personal_scripts/logs/ionic.log"

    local -r venvPythonExecutable="$rootDirectoryPath/src/backend/.venv/bin/python3"
    local -r killScriptExecutable="$rootDirectoryPath/personal_scripts/helpers/kill.sh"

    # Start Ollama
    osascript -e 'tell application "Ollama" to activate'
    sleep 1

    # Start backend in background
    echo 'Starting backend as background process...'
    cd "$backendDirPath" || {echo "Backend Directory not found at $backendDirPath"; exit 1;}
    date > "$backendLogPath"
    "$venvPythonExecutable" -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 >> "$backendLogPath" 2>&1 &
    cd "$rootAppPath"
    sleep 2

    # Open Ionic
    echo 'Starting ionic as background process, should be redircted to web soon...'
    date > "$ionicLogPath"
    ionic serve >> "$ionicLogPath" 2>&1 &
    sleep 2

    # Wait until all done
    printf 'Press Enter to finish and clean up background processes...'; read
    exec "$killScriptExecutable"

    echo "\nCheck the backend and ionic logs for their data\!\n"
}

main
