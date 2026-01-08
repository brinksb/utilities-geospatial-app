-- Enable PostGIS extension (idempotent)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create schema migrations tracking table (idempotent)
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mark this migration as applied
INSERT INTO schema_migrations (version)
VALUES ('001_extensions')
ON CONFLICT (version) DO NOTHING;
