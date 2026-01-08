# ADR 0006: pgRouting for Network Analysis

## Status
Accepted

## Context
The application needs to demonstrate GeoJSON data from API queries, complementing the static MVT tile layer. Options considered:

1. **Simple bbox queries** - Return all geometries in a bounding box
2. **pgRouting graph traversal** - Return connected network edges
3. **PostGIS spatial queries** - Buffer/intersection queries

Requirements:
- Show computed geometry, not just static tiles
- Demonstrate a realistic utility network pattern
- Keep the demo self-contained (no external data)

## Decision
We chose **pgRouting for graph traversal** because:

1. **Realistic pattern**: Utility networks (water, gas, electric) use graph analysis
2. **Demonstrates GeoJSON overlay**: Results displayed via Deck.gl GeoJsonLayer
3. **Self-contained**: Synthetic network generated around seed properties
4. **Educational**: Shows pgRouting integration with PostGIS

### Implementation

**Database schema:**
```sql
CREATE TABLE network_edges (
    id SERIAL PRIMARY KEY,
    source INTEGER,        -- From pgr_createTopology
    target INTEGER,        -- From pgr_createTopology
    cost DOUBLE PRECISION,
    geom GEOMETRY(LineString, 4326)
);
```

**API endpoints:**
```
GET /api/graph/nearest_edge?lon=-73.98&lat=40.74
GET /api/graph/nearby_edges/{edge_id}?hops=3
```

**Frontend integration:**
```typescript
// Click property → fetch nearby network → display as GeoJsonLayer
const network = await fetch(`/api/graph/nearby_edges/${edgeId}?hops=3`)
setNetworkOverlay(await network.json())
```

## Consequences

### Positive
- Demonstrates real-world utility network analysis pattern
- Shows GeoJSON overlay complementing MVT tiles
- 13 new backend tests with TDD approach
- pgRouting extension adds powerful graph algorithms (shortest path, TSP, etc.)

### Negative
- Requires pgrouting/pgrouting Docker image (larger than base postgis)
- Synthetic network is simplified (5x5 grid per property area)
- Graph algorithms can be expensive for large networks

### Trade-offs
- Using synthetic data vs real OSM networks (chose synthetic for simplicity)
- Fixed hop count vs distance-based traversal (chose hops for predictability)
- Direct SQL functions vs ORM queries (chose SQL for performance)

## Related
- [ADR 0001](0001-mvt-server-martin.md) - Martin for static MVT tiles
- [ADR 0002](0002-deckgl-map-rendering.md) - Deck.gl GeoJsonLayer for overlays
