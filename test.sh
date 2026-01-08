#!/usr/bin/env bash
set -euo pipefail

# Ensure stack is running first
./deploy.sh

echo ""
echo "=========================================="
echo "Running backend tests..."
echo "=========================================="
docker compose exec -T backend pytest -v

echo ""
echo "=========================================="
echo "Running frontend unit tests..."
echo "=========================================="
docker compose exec -T frontend npm run test

echo ""
echo "=========================================="
echo "Running E2E tests..."
echo "=========================================="
docker compose exec -T frontend npm run test:e2e

echo ""
echo "=========================================="
echo "All tests passed!"
echo "=========================================="
