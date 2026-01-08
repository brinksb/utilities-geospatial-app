# ADR 0004: Idempotent Database Migrations

## Status
Accepted

## Context
Database schema needs to evolve over time while supporting:
- Repeatable deployments (`./deploy.sh` run multiple times)
- Fresh database initialization
- Migration tracking to prevent re-running

Options considered:
1. **Alembic/migration tool** - Full migration framework
2. **Raw SQL with idempotent patterns** - Simpler, PostgreSQL-native
3. **Schema dump restore** - Reset to known state

## Decision
We chose **raw SQL migrations with idempotent patterns** because:

1. Simpler for a demo project
2. Teaches PostgreSQL idioms directly
3. Files run automatically via `docker-entrypoint-initdb.d`

## Consequences

### Idempotent Patterns Used

**Tables:**
```sql
CREATE TABLE IF NOT EXISTS properties (...);
```

**Functions:**
```sql
CREATE OR REPLACE FUNCTION properties_mvt(...);
```

**Seed data:**
```sql
INSERT INTO properties (...) VALUES (...)
ON CONFLICT DO NOTHING;
```

**Migration tracking:**
```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO schema_migrations (version)
VALUES ('005_mvt_functions')
ON CONFLICT (version) DO NOTHING;
```

### File Organization
```
db/migrations/
├── 001_extensions.sql      # PostGIS extension
├── 002_property_types.sql  # Lookup table
├── 003_properties.sql      # Main entity with geometry
├── 004_inspections.sql     # Related records
├── 005_mvt_functions.sql   # Martin tile function
└── 006_seed_data.sql       # Sample data
```

### Trade-offs
- No down migrations (acceptable for demo)
- No automatic schema diffing
- Manual tracking of what's applied
- Works well for additive changes, harder for destructive ones
