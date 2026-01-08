# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
./deploy.sh              # Start all services (idempotent, creates .env if missing)
./deploy.sh --fast       # Quick restart without rebuild
./test.sh                # Run all tests (backend + frontend unit + E2E)

# Run tests individually
docker compose exec backend pytest -v                    # All backend tests
docker compose exec backend pytest tests/test_properties.py -v  # Single test file
docker compose exec backend pytest -k "test_get_property" -v    # Single test by name
docker compose exec frontend npm run test                # Vitest component tests
docker compose exec frontend npm run test:e2e            # Playwright E2E tests

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
1. Frontend's `PropertyMap` component uses Deck.gl's `MVTLayer` to request tiles from `/tiles/properties_mvt/{z}/{x}/{y}`
2. Martin calls the PostgreSQL function `properties_mvt(z,x,y)` which returns MVT binary data
3. Deck.gl renders the tiles on a MapLibre basemap
4. Clicking a property fetches full details from `/api/properties/{id}`

**Key Integration Points**:
- `db/migrations/005_mvt_functions.sql` - PostgreSQL function that generates MVT tiles with property data joined to property_types
- `martin/config.yaml` - Auto-discovers PostgreSQL functions matching `(z int, x int, y int) -> bytea` signature
- `frontend/src/components/PropertyMap.tsx` - Deck.gl MVTLayer + optional GeoJsonLayer for dynamic overlays

**Domain Model**: PropertyType → Property → Inspection (one-to-many relationships)

**Graph Analysis (pgRouting)**:
- `/api/graph/nearest_edge?lon=&lat=` - Find nearest network edge to a point
- `/api/graph/nearby_edges/{edge_id}?hops=` - Get connected edges within N hops
- Results displayed as GeoJSON overlay on map (demonstrates computed geometry vs static tiles)

**LayerManager Service** (`frontend/src/services/LayerManager.ts`):
- Config-driven layer definitions (`frontend/src/config/layers.json`)
- Visibility toggle with localStorage persistence
- Observer pattern for React integration

**Migrations**: Run automatically on postgres container init via `/docker-entrypoint-initdb.d`. All migrations are idempotent (use `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`).

## Documentation

- `docs/ARCHITECTURE.md` - System overview and data flow
- `docs/AUTH_PATTERNS.md` - Authentication patterns for future reference
- `docs/FEATURE_FLAGS.md` - JSON-based feature flag system
- `docs/TRUNK_BASED_DEVELOPMENT.md` - CI/CD and branching practices
- `docs/adr/` - Architecture Decision Records (6 ADRs)
- `AGENTS.md` - Team values and working agreements

## Test Coverage

| Layer | Tests | Framework |
|-------|-------|-----------|
| Backend | 52 | pytest |
| Frontend unit | 42 | Vitest |
| E2E | 19 | Playwright |
| **Total** | **113** | |

Run all tests: `./test.sh`
