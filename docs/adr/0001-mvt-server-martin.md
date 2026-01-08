# ADR 0001: Martin for MVT Tile Serving

## Status
Accepted

## Context
We needed a Mapbox Vector Tile (MVT) server to serve property data as vector tiles for efficient map rendering. Options considered:

1. **Tegola** - Go-based, mature, good documentation
2. **Martin** - Rust-based, newer, auto-discovers PostgreSQL functions
3. **pg_tileserv** - PostgreSQL extension approach

Key requirements:
- Custom queries with property type joins
- Zoom-level appropriate data
- Integration with PostGIS spatial functions

## Decision
We chose **Martin** because:

1. **Function auto-discovery**: Martin automatically discovers PostgreSQL functions with signature `(z int, x int, y int) -> bytea`, requiring no external configuration when queries change
2. **Performance**: Rust-based with good performance characteristics
3. **Learning opportunity**: Team wanted exposure to Martin as an alternative to Tegola
4. **Simpler config**: Minimal configuration required - just connection string and auto-publish settings

## Consequences

### Positive
- Adding new tile layers is as simple as creating a new PostgreSQL function
- No need to restart Martin when query logic changes (function updates are immediate)
- Clean separation: tile logic lives in the database alongside the data

### Negative
- Distroless Docker image has no shell utilities (complicates health checks)
- Newer project with smaller community than Tegola
- Debugging requires PostgreSQL function debugging skills

### Neutral
- Tile function `properties_mvt(z,x,y)` lives in `db/migrations/005_mvt_functions.sql`
- Martin config is minimal: `martin/config.yaml` with `auto_publish.functions: true`
