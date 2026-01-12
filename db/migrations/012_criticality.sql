-- Add criticality scoring to graph edges
-- Migration: 012_criticality.sql
--
-- Tracks affected_building_count for each edge (pre-computed via script)
-- and provides criticality_level function for MVT layer styling.

INSERT INTO schema_migrations (version)
VALUES ('012_criticality')
ON CONFLICT (version) DO NOTHING;

-- Add affected_building_count column to graph_edges
ALTER TABLE synth.graph_edges
ADD COLUMN IF NOT EXISTS affected_building_count INTEGER DEFAULT 0;

-- Create criticality level function for categorical styling
-- Returns: 'low' (0-10 buildings), 'medium' (11-100), 'high' (100+)
CREATE OR REPLACE FUNCTION synth.criticality_level(affected_count INTEGER)
RETURNS TEXT AS $$
BEGIN
    RETURN CASE
        WHEN affected_count IS NULL OR affected_count <= 10 THEN 'low'
        WHEN affected_count <= 100 THEN 'medium'
        ELSE 'high'
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Index for efficient queries on criticality (top N critical pipes)
CREATE INDEX IF NOT EXISTS synth_graph_edges_criticality_idx
ON synth.graph_edges (affected_building_count DESC NULLS LAST);

COMMENT ON COLUMN synth.graph_edges.affected_building_count IS
'Number of buildings that would lose service if this edge is broken. Pre-computed by compute-criticality.py script.';

COMMENT ON FUNCTION synth.criticality_level(INTEGER) IS
'Returns criticality category (low/medium/high) for use in MVT layer categorical styling.';
