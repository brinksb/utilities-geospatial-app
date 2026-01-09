# Architecture Overview

This document describes the system architecture for **Springfield Utilities** - a geospatial starter template featuring synthetic utility network visualization.

## Demo Area

**Springfield, Oregon** - Matt Groening's inspiration for *The Simpsons*.

| Dataset | Count | Source |
|---------|-------|--------|
| Buildings | ~19,759 | OpenStreetMap |
| Pipes | ~1,314 | Synthesized from OSM roads |
| Service Lines | ~17,056 | KNN to nearest pipe |
| Graph Edges | ~1,317 | pgRouting topology |

## System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        nginx (:8080)                            │
│              (reverse proxy, tile caching)                       │
├─────────┬──────────────────┬──────────────────────────────────────┤
│         │                  │                                      │
│   /api/*│           /tiles/*│                               /*    │
│         ▼                  ▼                                ▼     │
│   ┌─────────┐       ┌──────────┐                      ┌──────────┐│
│   │ FastAPI │       │  Martin  │                      │ Next.js  ││
│   │ (:8000) │       │ (:3000)  │                      │ (:3000)  ││
│   └────┬────┘       └────┬─────┘                      └──────────┘│
│        │                 │                                        │
│        └────────┬────────┘                                        │
│                 ▼                                                 │
│         ┌──────────────┐                                          │
│         │  PostgreSQL  │                                          │
│         │   PostGIS    │                                          │
│         │  pgRouting   │                                          │
│         │   (:5432)    │                                          │
│         └──────────────┘                                          │
└───────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. MVT Tile Flow (Static Map Data)
```
Browser → nginx → Martin → PostgreSQL (MVT functions)
                            ↓
                    MVT binary tile
                            ↓
                    Deck.gl MVTLayer

Tile Layers:
- /tiles/osm_buildings_mvt/{z}/{x}/{y}  → Buildings (Simpsons yellow)
- /tiles/synth_pipes_mvt/{z}/{x}/{y}    → Utility pipes (blue/green)
- /tiles/synth_services_mvt/{z}/{x}/{y} → Service connections (gray)
```

### 2. API Flow (Dynamic Data)
```
Browser → nginx → FastAPI → PostgreSQL (SQLAlchemy)
                            ↓
                    JSON response
                            ↓
                    React state
```

### 3. Graph Analysis Flow (pgRouting)
```
User clicks map → Frontend fetches /api/graph/nearest_edge
                            ↓
                  FastAPI → pgRouting SQL functions
                            ↓
                    GeoJSON Feature/FeatureCollection
                            ↓
                    Deck.gl GeoJsonLayer (orange overlay)
```

## Synthetic Data Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    config/synth-params.yaml                      │
│         (bbox, road class mappings, materials, diameters)        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    scripts/load-osm.sh                           │
│    1. Download OSM PBF for bbox via Overpass API                │
│    2. Load roads → osm.roads                                     │
│    3. Load buildings → osm.buildings                             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                scripts/generate-network.py                       │
│    1. Roads → synth.pipes (main/secondary based on road class)  │
│    2. KNN: buildings → nearest pipe = synth.services            │
│    3. Build pgRouting topology → synth.graph_edges              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                db/migrations/011_synth_mvt.sql                   │
│         MVT functions for Martin auto-discovery                  │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Choices

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Database | PostgreSQL 16 + PostGIS 3.5 + pgRouting 3.6 | Industry standard for geospatial |
| Tile Server | Martin | Fast, auto-discovers PostgreSQL functions |
| Backend API | FastAPI | Modern Python, async, OpenAPI docs |
| Frontend | Next.js 14 + React | SSR, App Router, TypeScript |
| Map Rendering | Deck.gl + MapLibre GL | WebGL performance, MVT + GeoJSON layers |
| Reverse Proxy | nginx | Routing, caching, single entry point |

## Directory Structure

```
utilities-geospatial-app/
├── backend/                 # FastAPI application
│   ├── app/
│   │   ├── api/            # API endpoints (properties, graph)
│   │   ├── db/             # Database configuration
│   │   ├── models.py       # SQLAlchemy models
│   │   └── schemas/        # Pydantic schemas
│   └── tests/              # Backend tests (pytest)
├── frontend/               # Next.js application
│   ├── src/
│   │   ├── app/           # App Router pages
│   │   ├── components/    # React components (PropertyMap)
│   │   ├── services/      # Business logic (LayerManager)
│   │   └── config/        # Layer configuration (layers.json)
│   ├── __tests__/         # Unit tests (Vitest)
│   └── e2e/               # E2E tests (Playwright)
├── db/
│   └── migrations/        # SQL migrations (idempotent)
├── scripts/               # Synthetic data tooling
│   ├── load-osm.sh       # OSM data ingestion
│   └── generate-network.py # Network synthesis
├── config/
│   └── synth-params.yaml  # Synthesis parameters
├── martin/
│   └── config.yaml        # Martin tile server config
├── nginx/
│   └── nginx.conf         # Reverse proxy config
├── docs/
│   └── adr/               # Architecture Decision Records
└── docker-compose.yml
```

## Key Patterns

### Idempotent Migrations
All SQL migrations use idempotent patterns:
- `CREATE TABLE IF NOT EXISTS`
- `CREATE OR REPLACE FUNCTION`
- `INSERT ... ON CONFLICT DO NOTHING`

See [ADR 0004](adr/0004-idempotent-migrations.md).

### Config-Driven Layers
Layer definitions are externalized to `frontend/src/config/layers.json`:
- UI changes without code changes
- LayerManager service handles state, visibility, persistence
- Presets: Default, Network, Infrastructure Only

### GeoJSON from API
The graph endpoints demonstrate computed geometry from PostgreSQL:
- `/api/graph/nearest_edge` - Find closest network edge to a point
- `/api/graph/nearby_edges/{id}` - Graph traversal within N hops

This complements static MVT tiles with dynamic, query-driven overlays.

### Deterministic Synthesis
Network attributes are assigned using MD5 hash of source IDs:
- Reproducible across database resets
- Realistic distribution without randomness

### TDD Throughout
All components are developed test-first:
- Backend: pytest (79 tests)
- Frontend: Vitest (80 unit tests)
- E2E: Playwright (25 tests)
