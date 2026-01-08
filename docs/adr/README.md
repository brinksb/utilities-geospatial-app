# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) documenting key technical decisions made in this project.

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [0001](0001-mvt-server-martin.md) | Martin for MVT Tile Serving | Accepted |
| [0002](0002-deckgl-map-rendering.md) | Deck.gl for Map Rendering | Accepted |
| [0003](0003-docker-first-architecture.md) | Docker-First Architecture | Accepted |
| [0004](0004-idempotent-migrations.md) | Idempotent Database Migrations | Accepted |
| [0005](0005-e2e-testing-geospatial.md) | E2E Testing Strategy for Geospatial Applications | Accepted |
| [0006](0006-pgrouting-network-analysis.md) | pgRouting for Network Analysis | Accepted |

## ADR Format

Each ADR follows this structure:

- **Status**: Proposed, Accepted, Deprecated, Superseded
- **Context**: What is the issue we're facing?
- **Decision**: What did we decide and why?
- **Consequences**: What are the trade-offs?

## Creating New ADRs

When making significant architectural decisions:

1. Create a new file: `NNNN-short-title.md`
2. Use the next sequential number
3. Follow the format above
4. Update this README's index
