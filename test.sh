#!/usr/bin/env bash
set -euo pipefail

# Smart test runner - run specific suites or all tests
# Usage:
#   ./test.sh           # Run all tests
#   ./test.sh backend   # Backend tests only
#   ./test.sh frontend  # Frontend unit tests only
#   ./test.sh e2e       # E2E tests only

SUITE="${1:-all}"

# Ensure stack is running first (use --fast if already up)
if docker compose ps --status running | grep -q "nginx"; then
    echo "Stack already running, skipping deploy..."
else
    ./deploy.sh
fi

run_backend() {
    echo ""
    echo "=========================================="
    echo "Running backend tests..."
    echo "=========================================="
    docker compose exec -T backend pytest -v
}

run_frontend() {
    echo ""
    echo "=========================================="
    echo "Running frontend unit tests..."
    echo "=========================================="
    docker compose exec -T frontend npm run test
}

run_e2e() {
    echo ""
    echo "=========================================="
    echo "Running E2E tests..."
    echo "=========================================="
    docker compose exec -T frontend npm run test:e2e
}

case "$SUITE" in
    backend)
        run_backend
        ;;
    frontend)
        run_frontend
        ;;
    e2e)
        run_e2e
        ;;
    all)
        run_backend
        run_frontend
        run_e2e
        ;;
    *)
        echo "Unknown suite: $SUITE"
        echo "Usage: ./test.sh [backend|frontend|e2e|all]"
        exit 1
        ;;
esac

echo ""
echo "=========================================="
echo "Tests passed!"
echo "=========================================="
