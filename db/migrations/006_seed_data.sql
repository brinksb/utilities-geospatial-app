-- Seed data: Placeholder for synthetic data from OSM
-- Property data is now generated from OSM buildings via scripts/load-osm.py
-- This migration is intentionally empty to support the single-city focus

-- Note for future projects:
-- 1. Run ./scripts/load-osm.sh to load OSM buildings into osm.buildings
-- 2. Run ./scripts/generate-network.sh to create synthetic utility network
-- 3. Buildings are displayed via osm_buildings_mvt layer, not properties table
-- 4. The properties table exists for legacy compatibility but is empty by default

-- Track migration
INSERT INTO schema_migrations (version)
VALUES ('006_seed_data')
ON CONFLICT (version) DO NOTHING;
