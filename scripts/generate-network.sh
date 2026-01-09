#!/usr/bin/env bash
set -euo pipefail

# Network Generator - wrapper script
# Generates synthetic utility network from OSM roads
#
# Usage:
#   ./scripts/generate-network.sh [--config path/to/config.yaml]

CONFIG="${1:-config/synth-params.yaml}"

echo "Generating network using config: $CONFIG"
echo ""

# Run the Python generator inside the backend container
docker compose exec -T backend python /scripts/generate-network.py --config "/$CONFIG"

echo ""
echo "Network generation complete!"
