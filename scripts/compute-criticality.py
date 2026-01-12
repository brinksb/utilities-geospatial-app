#!/usr/bin/env python3
"""
Criticality Score Calculator - Pre-computes outage impact for all edges.

For each edge in the network, this script simulates its removal and counts
how many buildings would lose service. The result is stored in the
`affected_building_count` column of `synth.graph_edges`.

This enables the "Critical Pipes" visualization layer and "Homer's Worst Day"
feature without expensive runtime computation.

Usage:
    # From within docker compose
    docker compose exec backend python /app/scripts/compute-criticality.py

    # Or directly with DATABASE_URL set
    DATABASE_URL=postgresql://app:app@localhost:5432/app python scripts/compute-criticality.py
"""

import os
import sys
import psycopg2


def compute_criticality(conn):
    """Compute affected_building_count for each edge."""
    print("Computing criticality scores for all network edges...")
    print("This may take a few minutes depending on network size.\n")

    with conn.cursor() as cur:
        # Get edge count
        cur.execute("SELECT COUNT(*) FROM synth.graph_edges")
        total_edges = cur.fetchone()[0]
        print(f"Total edges to process: {total_edges}")

        # Find the hub node (most connected) as supply source reference
        cur.execute("""
            SELECT node_id FROM (
                SELECT source_id AS node_id, COUNT(*) AS cnt FROM synth.graph_edges GROUP BY source_id
                UNION ALL
                SELECT target_id, COUNT(*) FROM synth.graph_edges GROUP BY target_id
            ) t
            GROUP BY node_id
            ORDER BY SUM(cnt) DESC
            LIMIT 1
        """)
        hub_node = cur.fetchone()[0]
        print(f"Using hub node {hub_node} as main supply reference")

        # Pre-compute reachability from hub with full graph
        cur.execute("""
            SELECT array_agg(DISTINCT node) FROM pgr_drivingDistance(
                'SELECT id, source_id AS source, target_id AS target, 1 AS cost FROM synth.graph_edges',
                %s, 10000, false
            )
        """, (hub_node,))
        full_reachable = set(cur.fetchone()[0] or [])
        print(f"Nodes reachable from hub (full graph): {len(full_reachable)}")

        # Get all edge IDs
        cur.execute("SELECT id FROM synth.graph_edges ORDER BY id")
        edge_ids = [row[0] for row in cur.fetchall()]

        # Process each edge
        processed = 0
        max_affected = 0
        max_edge_id = None

        for edge_id in edge_ids:
            # Get nodes reachable AFTER removing this edge
            cur.execute("""
                SELECT array_agg(DISTINCT node) FROM pgr_drivingDistance(
                    'SELECT id, source_id AS source, target_id AS target, 1 AS cost
                     FROM synth.graph_edges WHERE id != ' || %s::text,
                    %s, 10000, false
                )
            """, (edge_id, hub_node))
            result = cur.fetchone()[0]
            after_reachable = set(result) if result else set()

            # Newly disconnected nodes = reachable before but not after
            disconnected_nodes = full_reachable - after_reachable

            if disconnected_nodes:
                # Find buildings connected to disconnected pipes
                disconnected_list = ','.join(str(n) for n in disconnected_nodes)
                cur.execute(f"""
                    WITH disconnected_pipes AS (
                        SELECT DISTINCT pipe_id FROM synth.graph_edges
                        WHERE source_id IN ({disconnected_list})
                           OR target_id IN ({disconnected_list})
                    )
                    SELECT COUNT(DISTINCT s.building_id)
                    FROM synth.services s
                    WHERE s.pipe_id IN (SELECT pipe_id FROM disconnected_pipes)
                """)
                affected_count = cur.fetchone()[0]
            else:
                affected_count = 0

            # Update the edge
            cur.execute(
                "UPDATE synth.graph_edges SET affected_building_count = %s WHERE id = %s",
                (affected_count, edge_id)
            )

            # Track maximum
            if affected_count > max_affected:
                max_affected = affected_count
                max_edge_id = edge_id

            processed += 1
            if processed % 100 == 0 or processed == total_edges:
                print(f"  Processed {processed}/{total_edges} edges...", end='\r')

        conn.commit()
        print(f"\n\nCriticality computation complete!")
        print(f"Most critical edge: #{max_edge_id} ({max_affected} buildings affected)")

        # Print distribution summary
        cur.execute("""
            SELECT
                synth.criticality_level(affected_building_count) AS level,
                COUNT(*) AS count,
                COALESCE(AVG(affected_building_count), 0)::int AS avg_affected
            FROM synth.graph_edges
            GROUP BY synth.criticality_level(affected_building_count)
            ORDER BY
                CASE synth.criticality_level(affected_building_count)
                    WHEN 'low' THEN 1
                    WHEN 'medium' THEN 2
                    WHEN 'high' THEN 3
                END
        """)
        print("\nCriticality Distribution:")
        print("-" * 40)
        for row in cur.fetchall():
            print(f"  {row[0].upper():8s}: {row[1]:5d} edges (avg {row[2]} buildings)")

        # Top 10 critical edges
        cur.execute("""
            SELECT id, affected_building_count, class, diameter_mm
            FROM synth.graph_edges
            WHERE affected_building_count > 0
            ORDER BY affected_building_count DESC
            LIMIT 10
        """)
        rows = cur.fetchall()
        if rows:
            print("\nTop 10 Critical Edges (Homer's Danger List):")
            print("-" * 50)
            for i, row in enumerate(rows, 1):
                print(f"  {i:2d}. Edge #{row[0]:4d}: {row[1]:4d} buildings ({row[2]}, {row[3]}mm)")


def main():
    db_url = os.environ.get("DATABASE_URL", "postgresql://app:app@postgres:5432/app")

    print("Connecting to database...")
    try:
        conn = psycopg2.connect(db_url)
    except psycopg2.OperationalError as e:
        print(f"Error: Could not connect to database: {e}")
        print("\nMake sure the database is running and DATABASE_URL is set correctly.")
        sys.exit(1)

    try:
        compute_criticality(conn)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
