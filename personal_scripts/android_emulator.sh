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

    local -r envPath="$backendDirPath/.env"
    local -r chatBotPath="$rootDirectoryPath/src/app/tabs/tab_chatbot/tab_chatbot.page.ts"
    local -r checklistPath="$rootDirectoryPath/src/app/tabs/tab_checklist/tab_checklist.page.ts"
    local -r replacementIp=$(ipconfig getifaddr en0)

    #Switch out computer ip address in .env file, as well as chatbot and checklist ts pages
    #   Temporarily mark out the 10.0.2.2 and put it back in after
    sed -E -i '' "s/10\.0\.2\.2/__ANDROID_IP__/g" "$envPath" "$chatBotPath" "$checklistPath"
    sed -E -i '' "s/[0-9]{1,3}(\.[0-9]{1,3}){3}/$replacementIp/g" "$envPath" "$chatBotPath" "$checklistPath"
    sed -E -i '' "s/__ANDROID_IP__/10\.0\.2\.2/g" "$envPath" "$chatBotPath" "$checklistPath"

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
