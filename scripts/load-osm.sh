#!/usr/bin/env bash
set -euo pipefail

# OSM Data Loader - wrapper script
# Downloads and loads OpenStreetMap data for the configured bounding box
#
# Usage:
#   ./scripts/load-osm.sh [--config path/to/config.yaml]

CONFIG="${1:-config/synth-params.yaml}"

echo "Loading OSM data using config: $CONFIG"
echo ""

# Run the Python loader inside the backend container
docker compose exec -T backend python /scripts/load-osm.py --config "/$CONFIG"

echo ""
echo "OSM data loaded successfully!"
