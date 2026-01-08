-- Property types table (idempotent)
CREATE TABLE IF NOT EXISTS property_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(7) NOT NULL DEFAULT '#3B82F6',  -- Hex color code
    icon VARCHAR(50) NOT NULL DEFAULT 'building',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed default property types (idempotent)
INSERT INTO property_types (name, color, icon) VALUES
    ('Residential', '#22C55E', 'home'),
    ('Commercial', '#3B82F6', 'building'),
    ('Industrial', '#F59E0B', 'factory'),
    ('Land', '#8B5CF6', 'map')
ON CONFLICT (name) DO NOTHING;

-- Track migration
INSERT INTO schema_migrations (version)
VALUES ('002_property_types')
ON CONFLICT (version) DO NOTHING;
