# Property Viewer - TDD Full-Stack Demo

A property/asset viewer demonstrating Test-Driven Development across a full stack.

## Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Database | PostgreSQL + PostGIS | Spatial data storage |
| MVT Server | Martin | Vector tile serving |
| Backend | FastAPI | REST API |
| Frontend | Next.js | React UI with MapLibre |
| Proxy | nginx | Routing & caching |

## Quick Start

```bash
./deploy.sh    # Start all services (idempotent)
./test.sh      # Run all tests
```

Stack available at http://localhost:8080

## Project Structure

```
├── deploy.sh / test.sh     # Entry scripts
├── docker-compose.yml      # Service orchestration
├── nginx/                  # Reverse proxy config
├── martin/                 # MVT tile server config
├── backend/                # FastAPI application
│   ├── app/               # Application code
│   └── tests/             # pytest tests
├── frontend/              # Next.js application
│   ├── src/               # Application code
│   ├── __tests__/         # Vitest component tests
│   └── e2e/               # Playwright E2E tests
└── db/migrations/         # SQL migrations (run on container init)
```

## Endpoints

| Path | Service | Description |
|------|---------|-------------|
| `/` | frontend | Next.js UI |
| `/api/*` | backend | FastAPI (docs at `/api/docs`) |
| `/tiles/*` | martin | Vector tiles (catalog at `/tiles/catalog`) |

## Testing Strategy

This project demonstrates TDD across all layers:

### Backend (pytest)
```bash
docker compose exec backend pytest -v
```

### Frontend Components (Vitest + React Testing Library)
```bash
docker compose exec frontend npm run test
```

### E2E (Playwright)
```bash
docker compose exec frontend npm run test:e2e
```

## Domain Model

- **PropertyType** - Categories (residential, commercial, etc.)
- **Property** - Assets with geometry, linked to a type
- **Inspection** - Related inspection records

## Features

- **MVT Tiles** - Static vector tiles via Martin for efficient map rendering
- **pgRouting** - Network graph analysis (nearest edge, connected edges within N hops)
- **Feature Flags** - JSON-based flags for trunk-based development (`config/features.json`)
- **LayerManager** - Config-driven layer visibility with localStorage persistence

## Development Workflow

1. Write a failing test
2. Write minimal code to pass
3. Refactor
4. Repeat

All services hot-reload in development mode.

## Useful Commands

```bash
# View logs
docker compose logs -f [service]

# Rebuild a service
docker compose up -d --build [service]

# Access database
docker compose exec postgres psql -U app -d app

# Stop everything
docker compose down

# Reset database (delete volume)
docker compose down -v
```
