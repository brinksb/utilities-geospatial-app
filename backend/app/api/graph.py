"""Graph API endpoints for pgRouting-based network analysis.

These endpoints demonstrate GeoJSON from API (computed graph traversal)
vs static MVT tiles.
"""
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
