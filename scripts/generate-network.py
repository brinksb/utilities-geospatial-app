#!/usr/bin/env python3
"""
Network Generator - Creates synthetic utility network from OSM roads.

Generates pipes/lines by:
1. Filtering OSM roads by highway class
2. Assigning attributes deterministically via MD5 hash
3. Creating service connections to buildings

Usage:
    python scripts/generate-network.py [--config config/synth-params.yaml]
"""

import argparse
import os
import sys

import psycopg2
import yaml


def load_config(config_path: str) -> dict:
    """Load configuration from YAML file."""
    with open(config_path) as f:
        return yaml.safe_load(f)


def generate_pipes(conn, config: dict):
    """Generate pipes from OSM roads."""
    network = config["network"]
    mains_classes = network["mains_classes"]
    secondary_classes = network["secondary_classes"]

    mains = network["mains"]
    secondary = network["secondary"]

    print("Generating pipes from OSM roads...")

    with conn.cursor() as cur:
        # Clear existing pipes
        cur.execute("TRUNCATE synth.pipes RESTART IDENTITY CASCADE")

        # Generate main pipes
        mains_diameters = mains["diameters"]
        mains_materials = list(mains["materials"].keys())
        mains_years = mains["install_years"]

        mains_sql = f"""
        INSERT INTO synth.pipes (osm_road_id, class, diameter_mm, material, pressure_class, install_year, length_m, geom)
        SELECT
            r.id,
            'main',
            (ARRAY{mains_diameters})[1 + ABS(MOD(('x'||substr(md5(r.osm_id::text),1,8))::bit(32)::int, {len(mains_diameters)}))],
            (ARRAY{mains_materials!r})[1 + ABS(MOD(('x'||substr(md5(r.osm_id::text || 'mat'),1,8))::bit(32)::int, {len(mains_materials)}))],
            '{mains.get("pressure_class", "HP")}',
            {mains_years[0]} + ABS(MOD(('x'||substr(md5(r.osm_id::text || 'year'),1,8))::bit(32)::int, {mains_years[1] - mains_years[0] + 1})),
            ST_Length(r.geom::geography),
            r.geom
        FROM osm.roads r
        WHERE r.highway IN ({','.join(f"'{c}'" for c in mains_classes)})
        """
        cur.execute(mains_sql)
        mains_count = cur.rowcount
        print(f"  Generated {mains_count} main pipes")

        # Generate secondary pipes
        sec_diameters = secondary["diameters"]
        sec_materials = list(secondary["materials"].keys())
        sec_years = secondary["install_years"]

        secondary_sql = f"""
        INSERT INTO synth.pipes (osm_road_id, class, diameter_mm, material, pressure_class, install_year, length_m, geom)
        SELECT
            r.id,
            'secondary',
            (ARRAY{sec_diameters})[1 + ABS(MOD(('x'||substr(md5(r.osm_id::text),1,8))::bit(32)::int, {len(sec_diameters)}))],
            (ARRAY{sec_materials!r})[1 + ABS(MOD(('x'||substr(md5(r.osm_id::text || 'mat'),1,8))::bit(32)::int, {len(sec_materials)}))],
            '{secondary.get("pressure_class", "MP")}',
            {sec_years[0]} + ABS(MOD(('x'||substr(md5(r.osm_id::text || 'year'),1,8))::bit(32)::int, {sec_years[1] - sec_years[0] + 1})),
            ST_Length(r.geom::geography),
            r.geom
        FROM osm.roads r
        WHERE r.highway IN ({','.join(f"'{c}'" for c in secondary_classes)})
        """
        cur.execute(secondary_sql)
        secondary_count = cur.rowcount
        print(f"  Generated {secondary_count} secondary pipes")

        conn.commit()
        return mains_count + secondary_count


def generate_nodes(conn):
    """Generate nodes from pipe endpoints."""
    print("Generating nodes from pipe endpoints...")

    with conn.cursor() as cur:
        # Clear existing nodes
        cur.execute("TRUNCATE synth.nodes RESTART IDENTITY CASCADE")

        # Generate junction nodes from pipe endpoints
        cur.execute("""
            INSERT INTO synth.nodes (node_type, geom)
            SELECT DISTINCT 'junction', ST_SnapToGrid(pt, 0.0001) AS geom
            FROM (
                SELECT ST_StartPoint(geom) AS pt FROM synth.pipes
                UNION
                SELECT ST_EndPoint(geom) AS pt FROM synth.pipes
            ) AS endpoints
        """)
        node_count = cur.rowcount
        print(f"  Generated {node_count} junction nodes")

        conn.commit()
        return node_count


def generate_services(conn, config: dict):
    """Generate service connections from buildings to nearest pipes."""
    max_distance = config["service"]["max_distance_m"]
    print(f"Generating service connections (max {max_distance}m)...")

    with conn.cursor() as cur:
        # Clear existing services
        cur.execute("TRUNCATE synth.services RESTART IDENTITY CASCADE")

        # Generate service connections using KNN
        # Connect each building to nearest secondary pipe within max distance
        cur.execute(f"""
            INSERT INTO synth.services (building_id, pipe_id, length_m, geom)
            SELECT
                b.id,
                nearest.pipe_id,
                nearest.distance_m,
                ST_MakeLine(
                    ST_Centroid(b.geom),
                    ST_ClosestPoint(nearest.geom, ST_Centroid(b.geom))
                )
            FROM osm.buildings b
            CROSS JOIN LATERAL (
                SELECT
                    p.id AS pipe_id,
                    p.geom,
                    ST_Distance(ST_Centroid(b.geom)::geography, p.geom::geography) AS distance_m
                FROM synth.pipes p
                WHERE p.class = 'secondary'
                ORDER BY p.geom <-> ST_Centroid(b.geom)
                LIMIT 1
            ) AS nearest
            WHERE nearest.distance_m <= {max_distance}
        """)
        service_count = cur.rowcount
        print(f"  Generated {service_count} service connections")

        conn.commit()
        return service_count


def build_graph(conn, config: dict):
    """Build pgRouting graph from pipes."""
    snap_tolerance = config["graph"]["snap_tolerance_m"]
    print("Building pgRouting graph...")

    with conn.cursor() as cur:
        # Clear existing graph
        cur.execute("TRUNCATE synth.graph_edges RESTART IDENTITY CASCADE")
        cur.execute("TRUNCATE synth.graph_nodes RESTART IDENTITY CASCADE")

        # Create graph nodes from pipe endpoints (snapped)
        cur.execute(f"""
            INSERT INTO synth.graph_nodes (geom)
            SELECT DISTINCT ST_SnapToGrid(pt, {snap_tolerance / 111000}) AS geom
            FROM (
                SELECT ST_StartPoint(geom) AS pt FROM synth.pipes
                UNION
                SELECT ST_EndPoint(geom) AS pt FROM synth.pipes
            ) AS endpoints
        """)
        node_count = cur.rowcount
        print(f"  Created {node_count} graph nodes")

        # Create graph edges with source/target references
        cur.execute(f"""
            INSERT INTO synth.graph_edges (source_id, target_id, pipe_id, class, diameter_mm, length_m, cost, reverse_cost, geom)
            SELECT
                n1.id AS source_id,
                n2.id AS target_id,
                p.id AS pipe_id,
                p.class,
                p.diameter_mm,
                p.length_m,
                p.length_m AS cost,
                p.length_m AS reverse_cost,
                p.geom
            FROM synth.pipes p
            JOIN synth.graph_nodes n1
                ON ST_DWithin(ST_StartPoint(p.geom), n1.geom, {snap_tolerance / 111000})
            JOIN synth.graph_nodes n2
                ON ST_DWithin(ST_EndPoint(p.geom), n2.geom, {snap_tolerance / 111000})
        """)
        edge_count = cur.rowcount
        print(f"  Created {edge_count} graph edges")

        conn.commit()
        return node_count, edge_count


def main():
    parser = argparse.ArgumentParser(description="Generate synthetic utility network from OSM roads")
    parser.add_argument(
        "--config",
        default="config/synth-params.yaml",
        help="Path to configuration file"
    )
    args = parser.parse_args()

    # Load config
    print(f"Loading config from {args.config}...")
    config = load_config(args.config)

    # Connect to database
    db_url = os.environ.get("DATABASE_URL", "postgresql://app:app@postgres:5432/app")
    print("Connecting to database...")
    conn = psycopg2.connect(db_url)

    try:
        # Generate network
        pipe_count = generate_pipes(conn, config)
        node_count = generate_nodes(conn)
        service_count = generate_services(conn, config)
        graph_nodes, graph_edges = build_graph(conn, config)

        # Print summary
        print("")
        print("=" * 50)
        print("Network generation complete:")
        print(f"  Pipes:            {pipe_count:,}")
        print(f"  Junction nodes:   {node_count:,}")
        print(f"  Service lines:    {service_count:,}")
        print(f"  Graph nodes:      {graph_nodes:,}")
        print(f"  Graph edges:      {graph_edges:,}")
        print("=" * 50)

    finally:
        conn.close()


if __name__ == "__main__":
    main()
