#!/usr/bin/env zsh

# This file is for killing the running processes involved in running this project.
# Specifically, the background processes opened like the database and ionic, as
# well as the ollama application
main() {
    echo 'killing pid'\''s for uvicorn'
    for pid in $(pgrep -f uvicorn); do kill "$pid"; done

    echo 'killing pid'\''s for ionic'
    for pid in $(pgrep -f ionic); do kill "$pid"; done

    echo 'killing Ollama Application'
    osascript -e 'tell application "Ollama" to quit'
}

main
