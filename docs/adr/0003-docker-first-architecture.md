# ADR 0003: Docker-First Architecture

## Status
Accepted

## Context
We needed to orchestrate multiple services (PostgreSQL/PostGIS, Martin, FastAPI, Next.js, nginx) in a way that:
- Is reproducible across developer machines
- Supports both development and testing
- Has idempotent deployment (safe to run repeatedly)

Options considered:
1. **Local installation** - Install all services natively
2. **Docker Compose** - Containerize everything
3. **Hybrid** - Some local, some containerized

## Decision
We chose **Docker Compose for everything** with idempotent entry scripts:

- `./deploy.sh` - Starts all services, creates `.env` if missing
- `./test.sh` - Runs all test suites inside containers

All tests run inside Docker containers, not on the host.

## Consequences

### Positive
- One command (`./deploy.sh`) gets anyone running
- Consistent PostGIS version and extensions
- Tests run in same environment as production
- No "works on my machine" issues
- Health checks ensure service dependencies are met

### Negative
- Slower feedback loop than native development
- Requires Docker Desktop or equivalent
- Some files not hot-reloaded (config files require rebuild)

### Key Design Decisions

**Volume mounts for hot reload:**
```yaml
frontend:
  volumes:
    - ./frontend/src:/app/src
    - ./frontend/__tests__:/app/__tests__
    - ./frontend/e2e:/app/e2e
```

**Health checks with dependency ordering:**
```yaml
backend:
  depends_on:
    postgres:
      condition: service_healthy
```

**nginx as single entry point:**
- All traffic through port 8080
- Routes `/api/*` to backend, `/tiles/*` to Martin, `/*` to frontend
- E2E tests use `http://nginx:80` inside Docker network
