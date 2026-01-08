-- Properties table with PostGIS geometry (idempotent)
CREATE TABLE IF NOT EXISTS properties (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    address VARCHAR(500),
    property_type_id INTEGER NOT NULL REFERENCES property_types(id),
    value DECIMAL(15, 2),
    geometry GEOMETRY(Point, 4326) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create spatial index for fast geo queries (idempotent)
CREATE INDEX IF NOT EXISTS idx_properties_geometry
ON properties USING GIST (geometry);

-- Create index on property_type_id for filtering (idempotent)
CREATE INDEX IF NOT EXISTS idx_properties_type_id
ON properties (property_type_id);

-- Track migration
INSERT INTO schema_migrations (version)
VALUES ('003_properties')
ON CONFLICT (version) DO NOTHING;
