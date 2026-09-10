#!/usr/bin/env bash

frontend_script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
frontend_dir="$(cd -- "${frontend_script_dir}/.." && pwd)"

ensure_frontend_deps() {
    local marker="node_modules/.self-contained-npm-ci"

    if [ -d node_modules ] \
        && [ -f "$marker" ] \
        && [ ! package.json -nt "$marker" ] \
        && [ ! package-lock.json -nt "$marker" ]; then
        return
    fi

    npm ci
    mkdir -p node_modules
    touch "$marker"
}
