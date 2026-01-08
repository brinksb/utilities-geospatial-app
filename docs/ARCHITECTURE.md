# Architecture Overview

This document describes the system architecture for the Property Viewer geospatial application.

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
Browser → nginx → Martin → PostgreSQL (properties_mvt function)
                            ↓
                    MVT binary tile
                            ↓
                    Deck.gl MVTLayer
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
                    Deck.gl GeoJsonLayer
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
│   │   ├── components/    # React components
│   │   ├── services/      # Business logic (LayerManager)
│   │   └── config/        # Layer configuration
│   ├── __tests__/         # Unit tests (Vitest)
│   └── e2e/               # E2E tests (Playwright)
├── db/
│   └── migrations/        # SQL migrations (idempotent)
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

### GeoJSON from API
The graph endpoints demonstrate computed geometry from PostgreSQL:
- `/api/graph/nearest_edge` - Find closest network edge to a point
- `/api/graph/nearby_edges/{id}` - Graph traversal within N hops

This complements static MVT tiles with dynamic, query-driven overlays.

### TDD Throughout
All components are developed test-first:
- Backend: pytest with 40+ tests
- Frontend: Vitest with 30+ unit tests
- E2E: Playwright with 14 tests
