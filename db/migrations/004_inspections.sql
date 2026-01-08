-- Inspections table (idempotent)
CREATE TABLE IF NOT EXISTS inspections (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    inspection_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    notes TEXT,
    inspector_name VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on property_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_inspections_property_id
ON inspections (property_id);

-- Create index on inspection_date for date range queries
CREATE INDEX IF NOT EXISTS idx_inspections_date
ON inspections (inspection_date);

-- Add check constraint for valid status values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_inspection_status'
    ) THEN
        ALTER TABLE inspections
        ADD CONSTRAINT chk_inspection_status
        CHECK (status IN ('pending', 'passed', 'failed', 'scheduled'));
    END IF;
END $$;

-- Track migration
INSERT INTO schema_migrations (version)
VALUES ('004_inspections')
ON CONFLICT (version) DO NOTHING;
