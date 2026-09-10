#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
. "$script_dir/common.sh"
cd "$frontend_dir"

action="${1:?action is required}"

case "$action" in
    install)
        npm ci
        mkdir -p node_modules
        touch node_modules/.self-contained-npm-ci
        ;;
    test)
        ensure_frontend_deps
        npm test -- --watchAll=false
        ;;
    test-watch)
        ensure_frontend_deps
        npm run test:watch
        ;;
    test-coverage)
        ensure_frontend_deps
        npm run test:coverage
        ;;
    tests-coverage)
        ensure_frontend_deps
        npm test -- --watchAll=false --coverage
        ;;
    format)
        ensure_frontend_deps
        npx prettier --write src
        ;;
    format-check)
        ensure_frontend_deps
        npx prettier --check src
        ;;
    lint)
        ensure_frontend_deps
        npm run lint
        ;;
    security)
        ensure_frontend_deps
        npm audit --omit=dev --audit-level=high
        ;;
    typecheck)
        ensure_frontend_deps
        npx tsc --noEmit -p tsconfig.app.json
        ;;
    build)
        ensure_frontend_deps
        npm run build
        ;;
    ssr-smoke)
        ensure_frontend_deps
        npm run build
        node scripts/ssr_smoke.mjs
        ;;
    lighthouse)
        ensure_frontend_deps
        npm run build
        npm run lhci -- autorun --config=./lighthouserc.cjs
        ;;
    quality)
        bash "$script_dir/npm_task.sh" format
        bash "$script_dir/npm_task.sh" lint
        bash "$script_dir/npm_task.sh" typecheck
        bash "$script_dir/npm_task.sh" build
        bash "$script_dir/npm_task.sh" test
        ;;
    *)
        echo "Unknown frontend action: $action" >&2
        exit 2
        ;;
esac
