-- OSM data schema for ingested OpenStreetMap data
-- Migration: 010_osm_schema.sql

-- Track migration
INSERT INTO schema_migrations (version)
VALUES ('010_osm_schema')
ON CONFLICT (version) DO NOTHING;

-- Create OSM schema
CREATE SCHEMA IF NOT EXISTS osm;

-- Roads table (from OSM highways)
CREATE TABLE IF NOT EXISTS osm.roads (
    id SERIAL PRIMARY KEY,
    osm_id BIGINT NOT NULL,
    name TEXT,
    highway TEXT NOT NULL,
    oneway TEXT,
    surface TEXT,
    lanes INTEGER,
    geom GEOMETRY(LineString, 4326) NOT NULL
);

-- Buildings table (from OSM buildings)
CREATE TABLE IF NOT EXISTS osm.buildings (
    id SERIAL PRIMARY KEY,
    osm_id BIGINT NOT NULL,
    name TEXT,
    building TEXT NOT NULL,
    amenity TEXT,
    shop TEXT,
    office TEXT,
    addr_street TEXT,
    addr_housenumber TEXT,
    geom GEOMETRY(Polygon, 4326) NOT NULL
);

-- Indexes for spatial queries
CREATE INDEX IF NOT EXISTS osm_roads_geom_idx ON osm.roads USING GIST (geom);
CREATE INDEX IF NOT EXISTS osm_roads_highway_idx ON osm.roads (highway);
CREATE INDEX IF NOT EXISTS osm_roads_osm_id_idx ON osm.roads (osm_id);

CREATE INDEX IF NOT EXISTS osm_buildings_geom_idx ON osm.buildings USING GIST (geom);
CREATE INDEX IF NOT EXISTS osm_buildings_building_idx ON osm.buildings (building);
CREATE INDEX IF NOT EXISTS osm_buildings_osm_id_idx ON osm.buildings (osm_id);

-- Create synth schema for generated network
CREATE SCHEMA IF NOT EXISTS synth;

-- Pipes/lines table (generated from roads)
CREATE TABLE IF NOT EXISTS synth.pipes (
    id SERIAL PRIMARY KEY,
    osm_road_id INTEGER REFERENCES osm.roads(id),
    class TEXT NOT NULL,  -- 'main' or 'secondary'
    diameter_mm INTEGER NOT NULL,
    material TEXT NOT NULL,
    pressure_class TEXT NOT NULL,
    install_year INTEGER NOT NULL,
    length_m DOUBLE PRECISION,
    geom GEOMETRY(LineString, 4326) NOT NULL
);

-- Nodes table (pipe junctions and connection points)
CREATE TABLE IF NOT EXISTS synth.nodes (
    id SERIAL PRIMARY KEY,
    node_type TEXT NOT NULL,  -- 'junction', 'demand', 'source'
    demand_kw DOUBLE PRECISION,
    geom GEOMETRY(Point, 4326) NOT NULL
);

-- Service connections (building to pipe)
CREATE TABLE IF NOT EXISTS synth.services (
    id SERIAL PRIMARY KEY,
    building_id INTEGER,
    pipe_id INTEGER REFERENCES synth.pipes(id),
    length_m DOUBLE PRECISION NOT NULL,
    geom GEOMETRY(LineString, 4326) NOT NULL
);

-- Graph edges (for pgRouting)
CREATE TABLE IF NOT EXISTS synth.graph_edges (
    id SERIAL PRIMARY KEY,
    source_id INTEGER,
    target_id INTEGER,
    pipe_id INTEGER REFERENCES synth.pipes(id),
    class TEXT,
    diameter_mm INTEGER,
    length_m DOUBLE PRECISION,
    cost DOUBLE PRECISION,
    reverse_cost DOUBLE PRECISION,
    geom GEOMETRY(LineString, 4326)
);

-- Graph nodes
CREATE TABLE IF NOT EXISTS synth.graph_nodes (
    id SERIAL PRIMARY KEY,
    geom GEOMETRY(Point, 4326) NOT NULL
);

-- Indexes for synth schema
CREATE INDEX IF NOT EXISTS synth_pipes_geom_idx ON synth.pipes USING GIST (geom);
CREATE INDEX IF NOT EXISTS synth_pipes_class_idx ON synth.pipes (class);
CREATE INDEX IF NOT EXISTS synth_nodes_geom_idx ON synth.nodes USING GIST (geom);
CREATE INDEX IF NOT EXISTS synth_services_geom_idx ON synth.services USING GIST (geom);
CREATE INDEX IF NOT EXISTS synth_graph_edges_geom_idx ON synth.graph_edges USING GIST (geom);
CREATE INDEX IF NOT EXISTS synth_graph_edges_source_idx ON synth.graph_edges (source_id);
CREATE INDEX IF NOT EXISTS synth_graph_edges_target_idx ON synth.graph_edges (target_id);
CREATE INDEX IF NOT EXISTS synth_graph_nodes_geom_idx ON synth.graph_nodes USING GIST (geom);
