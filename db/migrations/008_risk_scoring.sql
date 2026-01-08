-- Risk scoring for properties
-- Adds risk_score and risk_band columns with demo values

-- Add columns if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'properties' AND column_name = 'risk_score') THEN
        ALTER TABLE properties ADD COLUMN risk_score NUMERIC(5,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'properties' AND column_name = 'risk_band') THEN
        ALTER TABLE properties ADD COLUMN risk_band TEXT;
    END IF;
END
$$;

-- Compute demo risk scores based on property type
-- Industrial = high risk, Commercial = medium, Residential/Land = low
UPDATE properties SET
  risk_score = CASE
    WHEN property_type_id = 3 THEN 75 + (random() * 25)  -- Industrial = very_high
    WHEN property_type_id = 2 THEN 40 + (random() * 35)  -- Commercial = medium/high
    WHEN property_type_id = 1 THEN 10 + (random() * 30)  -- Residential = low/medium
    ELSE 5 + (random() * 20)                             -- Land = low
  END
WHERE risk_score IS NULL;

-- Set risk band based on score
UPDATE properties SET risk_band = CASE
  WHEN risk_score >= 75 THEN 'very_high'
  WHEN risk_score >= 50 THEN 'high'
  WHEN risk_score >= 25 THEN 'medium'
  ELSE 'low'
END
WHERE risk_band IS NULL;

-- Create index for risk queries
CREATE INDEX IF NOT EXISTS idx_properties_risk_band ON properties(risk_band);
