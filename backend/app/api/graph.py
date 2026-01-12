"""Graph API endpoints for pgRouting-based network analysis.

These endpoints demonstrate GeoJSON from API (computed graph traversal)
vs static MVT tiles.
"""
import random

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db import get_db

router = APIRouter(prefix="/graph", tags=["graph"])


@router.get("/status")
def get_graph_status(db: Session = Depends(get_db)):
    """Check if pgRouting extension is available."""
    result = db.execute(
        text("SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pgrouting')")
    )
    pgrouting_available = result.scalar()

    result = db.execute(text("SELECT COUNT(*) FROM synth.graph_edges"))
    edge_count = result.scalar()

    return {
        "pgrouting_available": pgrouting_available,
        "edge_count": edge_count,
    }


@router.get("/nearest_edge")
def get_nearest_edge(
    lon: float = Query(..., description="Longitude"),
    lat: float = Query(..., description="Latitude"),
    db: Session = Depends(get_db),
):
    """Find the nearest network edge to a given point.

    Returns a GeoJSON Feature with the edge geometry and properties.
    """
    result = db.execute(
        text("SELECT edge_id, distance_meters, geom_json FROM find_nearest_edge(:lon, :lat)"),
        {"lon": lon, "lat": lat},
    )
    row = result.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="No edge found near coordinates")

    return {
        "type": "Feature",
        "geometry": row.geom_json,
        "properties": {
            "edge_id": row.edge_id,
            "distance_meters": row.distance_meters,
        },
    }


@router.get("/nearby_edges/{edge_id}")
def get_nearby_edges(
    edge_id: int,
    hops: int = Query(default=1, ge=1, le=10, description="Number of hops from source edge"),
    db: Session = Depends(get_db),
):
    """Find all edges within N hops of a starting edge.

    Returns a GeoJSON FeatureCollection with all reachable edges.
    """
    # First check if edge exists
    exists = db.execute(
        text("SELECT EXISTS(SELECT 1 FROM synth.graph_edges WHERE id = :edge_id)"),
        {"edge_id": edge_id},
    ).scalar()

    if not exists:
        raise HTTPException(status_code=404, detail=f"Edge {edge_id} not found")

    result = db.execute(
        text("SELECT edge_id, hop, geom_json FROM find_nearby_edges(:edge_id, :hops)"),
        {"edge_id": edge_id, "hops": hops},
    )
    rows = result.fetchall()

    features = []
    for row in rows:
        features.append({
            "type": "Feature",
            "geometry": row.geom_json,
            "properties": {
                "edge_id": row.edge_id,
                "hop": row.hop,
            },
        })

    return {
        "type": "FeatureCollection",
        "features": features,
    }


@router.get("/outage/{edge_id}")
def get_outage_impact(
    edge_id: int,
    db: Session = Depends(get_db),
):
    """Simulate breaking an edge and return affected buildings with stats.

    "Sector 7G Outage Simulator" - Shows which buildings lose service
    when Homer breaks a pipe.

    Returns a GeoJSON FeatureCollection of building polygons that would
    be disconnected from the main network if this edge fails, plus
    aggregate statistics about the impact.
    """
    # Check if edge exists
    exists = db.execute(
        text("SELECT EXISTS(SELECT 1 FROM synth.graph_edges WHERE id = :edge_id)"),
        {"edge_id": edge_id},
    ).scalar()

    if not exists:
        raise HTTPException(status_code=404, detail=f"Edge {edge_id} not found")

    # Find buildings that would be disconnected if this edge is removed
    # Strategy:
    # 1. Find the most connected node (hub) as the "supply source"
    # 2. Compare reachability BEFORE vs AFTER the break
    # 3. NEWLY disconnected = reachable before but not after
    # 4. Find buildings connected to newly disconnected nodes
    result = db.execute(
        text("""
            WITH broken_edge AS (
                SELECT id, source_id, target_id FROM synth.graph_edges WHERE id = :edge_id
            ),
            -- Find the most connected node to use as our "main supply" reference
            hub_node AS (
                SELECT source_id as node_id, COUNT(*) as edge_count
                FROM synth.graph_edges
                GROUP BY source_id
                UNION ALL
                SELECT target_id, COUNT(*)
                FROM synth.graph_edges
                GROUP BY target_id
            ),
            main_hub AS (
                SELECT node_id FROM hub_node
                GROUP BY node_id
                ORDER BY SUM(edge_count) DESC
                LIMIT 1
            ),
            -- Nodes reachable BEFORE the break (full graph)
            reachable_before AS (
                SELECT DISTINCT node
                FROM pgr_drivingDistance(
                    'SELECT id, source_id AS source, target_id AS target, 1 AS cost
                     FROM synth.graph_edges',
                    (SELECT node_id FROM main_hub),
                    10000,
                    false
                )
            ),
            -- Nodes reachable AFTER the break (edge removed)
            reachable_after AS (
                SELECT DISTINCT node
                FROM pgr_drivingDistance(
                    'SELECT id, source_id AS source, target_id AS target, 1 AS cost
                     FROM synth.graph_edges WHERE id != ' || :edge_id,
                    (SELECT node_id FROM main_hub),
                    10000,
                    false
                )
            ),
            -- NEWLY disconnected = was reachable before, not reachable after
            disconnected_nodes AS (
                SELECT node as id FROM reachable_before
                WHERE node NOT IN (SELECT node FROM reachable_after)
            ),
            -- Find pipes connected to disconnected nodes
            disconnected_pipes AS (
                SELECT DISTINCT e.pipe_id
                FROM synth.graph_edges e
                WHERE e.source_id IN (SELECT id FROM disconnected_nodes)
                   OR e.target_id IN (SELECT id FROM disconnected_nodes)
            ),
            -- Find services affected by disconnected pipes
            affected_services AS (
                SELECT s.id, s.building_id, s.length_m
                FROM synth.services s
                WHERE s.pipe_id IN (SELECT pipe_id FROM disconnected_pipes)
            ),
            -- Aggregate stats for affected services
            service_stats AS (
                SELECT
                    COUNT(*) AS service_count,
                    COALESCE(SUM(length_m), 0) AS total_length_m
                FROM affected_services
            ),
            -- Find buildings served by disconnected pipes
            affected_buildings AS (
                SELECT DISTINCT building_id
                FROM affected_services
            )
            SELECT
                b.id AS building_id,
                ST_AsGeoJSON(b.geom)::json AS geom_json,
                (SELECT service_count FROM service_stats) AS service_count,
                (SELECT total_length_m FROM service_stats) AS total_service_length_m
            FROM osm.buildings b
            WHERE b.id IN (SELECT building_id FROM affected_buildings)
        """),
        {"edge_id": edge_id},
    )
    rows = result.fetchall()

    # Extract stats from first row (same for all rows)
    service_count = rows[0].service_count if rows else 0
    total_service_length = round(rows[0].total_service_length_m, 1) if rows else 0.0

    features = []
    for row in rows:
        features.append({
            "type": "Feature",
            "geometry": row.geom_json,
            "properties": {
                "building_id": row.building_id,
            },
        })

    return {
        "type": "FeatureCollection",
        "features": features,
        "stats": {
            "affected_building_count": len(features),
            "affected_service_count": service_count,
            "total_service_length_m": total_service_length,
        },
    }


@router.get("/spread")
def get_spread(
    lon: float = Query(..., description="Longitude of spread origin"),
    lat: float = Query(..., description="Latitude of spread origin"),
    max_hops: int = Query(default=5, ge=1, le=20, description="Maximum spread distance in hops"),
    db: Session = Depends(get_db),
):
    """Simulate spread/propagation from a point through the network.

    "Nuclear Plant Blast Radius" - Shows how contamination/effects
    spread through the utility network from a source point.

    Returns a GeoJSON FeatureCollection of edges grouped by hop distance
    for animated visualization.
    """
    # First find the nearest edge to the click point
    nearest = db.execute(
        text("SELECT edge_id FROM find_nearest_edge(:lon, :lat)"),
        {"lon": lon, "lat": lat},
    ).fetchone()

    if not nearest:
        raise HTTPException(status_code=404, detail="No edge found near coordinates")

    edge_id = nearest.edge_id

    # Get the source node of this edge
    source_node = db.execute(
        text("SELECT source_id FROM synth.graph_edges WHERE id = :edge_id"),
        {"edge_id": edge_id},
    ).scalar()

    # Use pgr_drivingDistance to find all reachable edges with their hop distances
    result = db.execute(
        text("""
            WITH reachable_nodes AS (
                SELECT node, agg_cost::integer AS hop
                FROM pgr_drivingDistance(
                    'SELECT id, source_id AS source, target_id AS target, 1 AS cost
                     FROM synth.graph_edges',
                    :source_node,
                    :max_hops,
                    false
                )
            ),
            edges_with_hops AS (
                SELECT DISTINCT ON (e.id)
                    e.id AS edge_id,
                    LEAST(
                        COALESCE(r1.hop, :max_hops + 1),
                        COALESCE(r2.hop, :max_hops + 1)
                    ) AS hop,
                    ST_AsGeoJSON(e.geom)::json AS geom_json
                FROM synth.graph_edges e
                LEFT JOIN reachable_nodes r1 ON e.source_id = r1.node
                LEFT JOIN reachable_nodes r2 ON e.target_id = r2.node
                WHERE r1.node IS NOT NULL OR r2.node IS NOT NULL
                ORDER BY e.id, LEAST(
                    COALESCE(r1.hop, :max_hops + 1),
                    COALESCE(r2.hop, :max_hops + 1)
                )
            )
            SELECT edge_id, hop, geom_json
            FROM edges_with_hops
            WHERE hop <= :max_hops
            ORDER BY hop, edge_id
        """),
        {"source_node": source_node, "max_hops": max_hops},
    )
    rows = result.fetchall()

    features = []
    for row in rows:
        features.append({
            "type": "Feature",
            "geometry": row.geom_json,
            "properties": {
                "edge_id": row.edge_id,
                "hop": row.hop,
            },
        })

    return {
        "type": "FeatureCollection",
        "features": features,
    }


@router.get("/worst_day")
def get_worst_day(db: Session = Depends(get_db)):
    """Find Homer's Worst Day - the single most critical pipe to break.

    Returns the edge with highest affected_building_count (pre-computed)
    and its full outage impact in the same format as /outage/{edge_id}.

    This is the one-click "maximum drama" demo feature.
    """
    # Find most critical edge (pre-computed affected_building_count)
    result = db.execute(
        text("""
            SELECT
                ge.id AS edge_id,
                ge.affected_building_count,
                p.class,
                p.diameter_mm,
                p.material,
                ROUND(ge.length_m::numeric, 1) AS length_m,
                ST_AsGeoJSON(ge.geom)::json AS geom_json
            FROM synth.graph_edges ge
            JOIN synth.pipes p ON p.id = ge.pipe_id
            WHERE ge.affected_building_count > 0
            ORDER BY ge.affected_building_count DESC
            LIMIT 1
        """)
    )
    worst = result.fetchone()

    # If no critical edges found (all have 0 impact), return empty result
    if not worst:
        return {
            "type": "FeatureCollection",
            "features": [],
            "stats": {
                "affected_building_count": 0,
                "affected_service_count": 0,
                "total_service_length_m": 0,
            },
            "worst_pipe": None,
            "dramatic_message": "The network is perfectly redundant! Mr. Burns would be proud... or disappointed?",
        }

    edge_id = worst.edge_id

    # Get full outage details for this edge (same logic as /outage/{edge_id})
    outage_result = db.execute(
        text("""
            WITH broken_edge AS (
                SELECT id, source_id, target_id FROM synth.graph_edges WHERE id = :edge_id
            ),
            hub_node AS (
                SELECT source_id as node_id, COUNT(*) as edge_count
                FROM synth.graph_edges
                GROUP BY source_id
                UNION ALL
                SELECT target_id, COUNT(*)
                FROM synth.graph_edges
                GROUP BY target_id
            ),
            main_hub AS (
                SELECT node_id FROM hub_node
                GROUP BY node_id
                ORDER BY SUM(edge_count) DESC
                LIMIT 1
            ),
            reachable_before AS (
                SELECT DISTINCT node
                FROM pgr_drivingDistance(
                    'SELECT id, source_id AS source, target_id AS target, 1 AS cost
                     FROM synth.graph_edges',
                    (SELECT node_id FROM main_hub),
                    10000,
                    false
                )
            ),
            reachable_after AS (
                SELECT DISTINCT node
                FROM pgr_drivingDistance(
                    'SELECT id, source_id AS source, target_id AS target, 1 AS cost
                     FROM synth.graph_edges WHERE id != ' || :edge_id,
                    (SELECT node_id FROM main_hub),
                    10000,
                    false
                )
            ),
            disconnected_nodes AS (
                SELECT node as id FROM reachable_before
                WHERE node NOT IN (SELECT node FROM reachable_after)
            ),
            disconnected_pipes AS (
                SELECT DISTINCT e.pipe_id
                FROM synth.graph_edges e
                WHERE e.source_id IN (SELECT id FROM disconnected_nodes)
                   OR e.target_id IN (SELECT id FROM disconnected_nodes)
            ),
            affected_services AS (
                SELECT s.id, s.building_id, s.length_m
                FROM synth.services s
                WHERE s.pipe_id IN (SELECT pipe_id FROM disconnected_pipes)
            ),
            service_stats AS (
                SELECT
                    COUNT(*) AS service_count,
                    COALESCE(SUM(length_m), 0) AS total_length_m
                FROM affected_services
            ),
            affected_buildings AS (
                SELECT DISTINCT building_id
                FROM affected_services
            )
            SELECT
                b.id AS building_id,
                ST_AsGeoJSON(b.geom)::json AS geom_json,
                (SELECT service_count FROM service_stats) AS service_count,
                (SELECT total_length_m FROM service_stats) AS total_service_length_m
            FROM osm.buildings b
            WHERE b.id IN (SELECT building_id FROM affected_buildings)
        """),
        {"edge_id": edge_id},
    )
    rows = outage_result.fetchall()

    # Extract stats from first row (same for all rows)
    service_count = rows[0].service_count if rows else 0
    total_service_length = round(rows[0].total_service_length_m, 1) if rows else 0.0

    features = []
    for row in rows:
        features.append({
            "type": "Feature",
            "geometry": row.geom_json,
            "properties": {
                "building_id": row.building_id,
            },
        })

    # Dramatic messaging options
    messages = [
        f"D'OH! Breaking pipe #{edge_id} would cut off {worst.affected_building_count} buildings!",
        f"Homer's finger slipped on pipe #{edge_id}... {worst.affected_building_count} buildings in the dark!",
        f"Sector 7G ALERT: Pipe #{edge_id} is CRITICAL to {worst.affected_building_count} buildings!",
        f"Mr. Burns memo: DO NOT let Homer near pipe #{edge_id} ({worst.affected_building_count} customers at risk)",
        f"Nuclear-level crisis: One pipe failure = {worst.affected_building_count} angry Springfield residents!",
    ]

    return {
        "type": "FeatureCollection",
        "features": features,
        "stats": {
            "affected_building_count": len(features),
            "affected_service_count": service_count,
            "total_service_length_m": total_service_length,
        },
        "worst_pipe": {
            "edge_id": worst.edge_id,
            "class": worst[2],  # p.class
            "diameter_mm": worst.diameter_mm,
            "material": worst.material,
            "length_m": float(worst.length_m),
            "geometry": worst.geom_json,
        },
        "dramatic_message": random.choice(messages),
    }