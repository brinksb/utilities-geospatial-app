# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Springfield Utilities** - A geospatial starter template featuring a synthetic utility network visualization for Springfield, Oregon (yes, *that* Springfield - Matt Groening's inspiration). The UI features Simpsons-themed whimsy including rotating quotes, "Sector 7G Controls", and Mr. Burns disclaimers.

**Demo Area**: Springfield, Oregon (bbox: -123.1, 44.0, -122.9, 44.1)
- ~19,759 OSM buildings rendered in Simpsons yellow
- ~1,314 synthetic pipe segments (main + secondary)
- ~17,056 service line connections
- pgRouting graph for network analysis

## Commands

```bash
./deploy.sh              # Start all services (idempotent, creates .env if missing)
./deploy.sh --fast       # Quick restart without rebuild
./test.sh                # Run all tests (backend + frontend unit + E2E)
./test.sh backend        # Backend tests only (faster iteration)
./test.sh frontend       # Frontend unit tests only
./test.sh e2e            # E2E tests only

# Synthetic data tooling
./scripts/load-osm.sh              # Download and load OSM data for configured bbox
python scripts/generate-network.py # Generate synthetic utility network from OSM roads

# Run specific tests
docker compose exec backend pytest tests/test_properties.py -v  # Single test file
docker compose exec backend pytest -k "test_get_property" -v    # Single test by name

# Database access
docker compose exec postgres psql -U app -d app

# Rebuild single service
docker compose up -d --build [service]

# Reset database
docker compose down -v && ./deploy.sh
```

## Architecture

**Request Flow**: Browser → nginx (:8080) → routes to appropriate service:
- `/api/*` → FastAPI backend (:8000)
- `/tiles/*` → Martin MVT server (:3000)
- `/*` → Next.js frontend (:3000)

**Data Flow for Map**:
1. Frontend's `PropertyMap` component uses Deck.gl's `MVTLayer` to request tiles
2. Martin calls PostgreSQL MVT functions which return binary tile data
3. Deck.gl renders the tiles on a MapLibre basemap (CARTO Positron)
4. Clicking features triggers pgRouting analysis displayed as GeoJSON overlay

**MVT Tile Layers** (served by Martin):
- `/tiles/osm_buildings_mvt/{z}/{x}/{y}` - OSM building footprints
- `/tiles/synth_pipes_mvt/{z}/{x}/{y}` - Synthetic utility pipes (main/secondary)
- `/tiles/synth_services_mvt/{z}/{x}/{y}` - Building-to-pipe service connections

**Key Integration Points**:
- `db/migrations/011_synth_mvt.sql` - MVT functions for synthetic network layers
- `martin/config.yaml` - Auto-discovers PostgreSQL functions matching `(z int, x int, y int) -> bytea`
- `frontend/src/components/PropertyMap.tsx` - Deck.gl MVTLayer + GeoJsonLayer for overlays
- `frontend/src/config/layers.json` - Layer definitions, styles, and presets

**Graph Analysis (pgRouting)**:
- `/api/graph/nearest_edge?lon=&lat=` - Find nearest network edge to a point
- `/api/graph/nearby_edges/{edge_id}?hops=` - Get connected edges within N hops
- Uses `synth.graph_edges` table with pgRouting topology
- Results displayed as orange GeoJSON overlay on map

**Synthetic Data Pipeline**:
1. `scripts/load-osm.sh` - Downloads OSM data, loads roads and buildings
2. `scripts/generate-network.py` - Creates pipes from roads, services from KNN to buildings
3. Configuration in `config/synth-params.yaml` - bbox, materials, diameters, road class mappings

**LayerManager Service** (`frontend/src/services/LayerManager.ts`):
- Config-driven layer definitions (`frontend/src/config/layers.json`)
- Visibility toggle with localStorage persistence
- Presets: Default, Network (all layers), Infrastructure Only
- Observer pattern for React integration

**Migrations**: Run automatically on postgres container init via `/docker-entrypoint-initdb.d`. All migrations are idempotent (use `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`).

## Documentation

- `docs/ARCHITECTURE.md` - System overview and data flow
- `docs/AUTH_PATTERNS.md` - Authentication patterns for future reference
- `docs/FEATURE_FLAGS.md` - JSON-based feature flag system
- `docs/TRUNK_BASED_DEVELOPMENT.md` - CI/CD and branching practices
- `docs/adr/` - Architecture Decision Records
- `AGENTS.md` - Team values and working agreements

## Test Coverage

| Layer | Tests | Framework |
|-------|-------|-----------|
| Backend | 79 | pytest |
| Frontend unit | 80 | Vitest |
| E2E | 25 | Playwright |
| **Total** | **184** | |

Run all tests: `./test.sh`

## Changing the Demo Area

To use a different city:

1. Edit `config/synth-params.yaml`:
   ```yaml
   area:
     name: my-city
     bbox: [west, south, east, north]
     srid: <local-projection-epsg>
   ```

2. Reset and regenerate:
   ```bash
   docker compose down -v
   ./scripts/load-osm.sh
   python scripts/generate-network.py
   ./deploy.sh
   ```

3. Update `frontend/src/components/PropertyMap.tsx` initial view coordinates
