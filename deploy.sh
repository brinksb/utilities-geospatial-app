#!/usr/bin/env bash
set -euo pipefail

# Idempotent deploy - safe to run multiple times
# Usage:
#   ./deploy.sh         - Full deploy with image rebuild
#   ./deploy.sh --fast  - Quick restart without rebuild

FAST_MODE=false

for arg in "$@"; do
    case $arg in
        --fast|-f)
            FAST_MODE=true
            shift
            ;;
    esac
done

# Creates .env from example if it doesn't exist
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env from .env.example"
fi

echo "Starting services..."
if [ "$FAST_MODE" = true ]; then
    echo "(Fast mode: skipping rebuild)"
    docker compose up -d --wait
else
    docker compose up -d --build --wait
fi

echo ""
echo "Stack ready at http://localhost:8080"
echo "  - Frontend: http://localhost:8080/"
echo "  - API docs: http://localhost:8080/api/docs"
echo "  - Tiles:    http://localhost:8080/tiles/catalog"
