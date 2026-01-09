-- pgRouting extension and network graph tables (idempotent)
-- Enables graph traversal queries for network analysis

-- Enable pgRouting extension
CREATE EXTENSION IF NOT EXISTS pgrouting;

-- Network edges table for graph analysis
-- Each edge represents a connection (road segment, pipe, wire, etc.)
CREATE TABLE IF NOT EXISTS network_edges (
    id SERIAL PRIMARY KEY,
    source INTEGER,           -- Source node ID (auto-populated by pgr_createTopology)
    target INTEGER,           -- Target node ID (auto-populated by pgr_createTopology)
    cost DOUBLE PRECISION,    -- Cost to traverse (length in meters)
    reverse_cost DOUBLE PRECISION,  -- Reverse cost (-1 for one-way)
    geom GEOMETRY(LineString, 4326)
);

-- Index for spatial queries
CREATE INDEX IF NOT EXISTS idx_network_edges_geom ON network_edges USING GIST (geom);

-- Network vertices table (nodes where edges connect)
-- This is created by pgr_createTopology, but we create it first if needed
CREATE TABLE IF NOT EXISTS network_edges_vertices_pgr (
    id SERIAL PRIMARY KEY,
    cnt INTEGER,
    chk INTEGER,
    ein INTEGER,
    eout INTEGER,
    the_geom GEOMETRY(Point, 4326)
);

CREATE INDEX IF NOT EXISTS idx_network_edges_vertices_geom
    ON network_edges_vertices_pgr USING GIST (the_geom);

-- Seed synthetic network edges around property locations
-- Creates a simple grid network around each city's properties
DO $$
DECLARE
    property_rec RECORD;
    base_lon DOUBLE PRECISION;
    base_lat DOUBLE PRECISION;
    edge_count INTEGER;
    i INTEGER;
    j INTEGER;
    grid_size DOUBLE PRECISION := 0.005;  -- ~500m grid cells
BEGIN
    -- Check if we already have edges
    SELECT COUNT(*) INTO edge_count FROM network_edges;

    IF edge_count = 0 THEN
        -- For each property, create a small network grid around it
        FOR property_rec IN
            SELECT DISTINCT
                ROUND(ST_X(geometry)::numeric, 2) as lon,
                ROUND(ST_Y(geometry)::numeric, 2) as lat
            FROM properties
        LOOP
            base_lon := property_rec.lon;
            base_lat := property_rec.lat;

            -- Create horizontal edges (5x5 grid)
            FOR i IN 0..4 LOOP
                FOR j IN 0..3 LOOP
                    INSERT INTO network_edges (cost, reverse_cost, geom)
                    VALUES (
                        500,  -- 500m cost
                        500,  -- bidirectional
                        ST_SetSRID(ST_MakeLine(
                            ST_MakePoint(base_lon + j * grid_size, base_lat + i * grid_size),
                            ST_MakePoint(base_lon + (j + 1) * grid_size, base_lat + i * grid_size)
                        ), 4326)
                    );
                END LOOP;
            END LOOP;

            -- Create vertical edges
            FOR i IN 0..3 LOOP
                FOR j IN 0..4 LOOP
                    INSERT INTO network_edges (cost, reverse_cost, geom)
                    VALUES (
                        500,
                        500,
                        ST_SetSRID(ST_MakeLine(
                            ST_MakePoint(base_lon + j * grid_size, base_lat + i * grid_size),
                            ST_MakePoint(base_lon + j * grid_size, base_lat + (i + 1) * grid_size)
                        ), 4326)
                    );
                END LOOP;
            END LOOP;
        END LOOP;

        -- Build topology (create source/target node IDs)
        PERFORM pgr_createTopology('network_edges', 0.0001, 'geom', 'id');
    END IF;
END $$;

-- Function to find nearest edge to a point
-- Uses synth.graph_edges table (Springfield synthetic network)
CREATE OR REPLACE FUNCTION find_nearest_edge(
    p_lon DOUBLE PRECISION,
    p_lat DOUBLE PRECISION
)
RETURNS TABLE (
    edge_id INTEGER,
    distance_meters DOUBLE PRECISION,
    geom_json JSON
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id::INTEGER as edge_id,
        ST_Distance(
            e.geom::geography,
            ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography
        ) as distance_meters,
        ST_AsGeoJSON(e.geom)::json as geom_json
    FROM synth.graph_edges e
    ORDER BY e.geom <-> ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to find edges within N hops of a starting edge
-- Uses synth.graph_edges table (Springfield synthetic network)
CREATE OR REPLACE FUNCTION find_nearby_edges(
    p_edge_id INTEGER,
    p_hops INTEGER DEFAULT 1
)
RETURNS TABLE (
    edge_id INTEGER,
    hop INTEGER,
    geom_json JSON
) AS $$
DECLARE
    start_vertex INTEGER;
BEGIN
    -- Get the source vertex of the starting edge
    SELECT source_id INTO start_vertex FROM synth.graph_edges WHERE id = p_edge_id;

    IF start_vertex IS NULL THEN
        RETURN;
    END IF;

    -- Use pgr_drivingDistance to find all reachable edges within N hops
    RETURN QUERY
    WITH reachable AS (
        SELECT
            dd.node,
            dd.agg_cost::INTEGER as hop
        FROM pgr_drivingDistance(
            'SELECT id, source_id as source, target_id as target, 1 as cost FROM synth.graph_edges',
            start_vertex,
            p_hops,
            false  -- undirected
        ) dd
    ),
    edges_in_range AS (
        SELECT DISTINCT ON (e.id)
            e.id,
            LEAST(r1.hop, COALESCE(r2.hop, r1.hop)) as hop
        FROM synth.graph_edges e
        JOIN reachable r1 ON e.source_id = r1.node
        LEFT JOIN reachable r2 ON e.target_id = r2.node
        ORDER BY e.id, LEAST(r1.hop, COALESCE(r2.hop, r1.hop))
    )
    SELECT
        eir.id::INTEGER as edge_id,
        eir.hop::INTEGER,
        ST_AsGeoJSON(e.geom)::json as geom_json
    FROM edges_in_range eir
    JOIN synth.graph_edges e ON e.id = eir.id
    ORDER BY eir.hop, eir.id;
END;
$$ LANGUAGE plpgsql;

-- Track migration
INSERT INTO schema_migrations (version)
VALUES ('007_pgrouting')
ON CONFLICT (version) DO NOTHING;
