"""Network statistics API endpoints.

Provides aggregate statistics about the synthetic utility network -
total lengths, counts, breakdowns by material, class, and age.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db import get_db

router = APIRouter(prefix="/network", tags=["network"])


@router.get("/stats")
def get_network_stats(db: Session = Depends(get_db)):
    """Get aggregate network statistics.

    Returns comprehensive statistics about the utility network including:
    - Totals (pipe count, length, service connections, buildings)
    - Breakdown by material
    - Breakdown by pipe class (main/secondary)
    - Breakdown by installation era
    """
    # Pipe statistics by material
    pipe_by_material = db.execute(
        text("""
            SELECT
                material,
                COUNT(*) as count,
                ROUND(SUM(length_m)::numeric, 1) as total_length_m
            FROM synth.pipes
            GROUP BY material
            ORDER BY total_length_m DESC
        """)
    ).fetchall()

    # Pipe statistics by class
    pipe_by_class = db.execute(
        text("""
            SELECT
                class,
                COUNT(*) as count,
                ROUND(SUM(length_m)::numeric, 1) as total_length_m,
                ROUND(AVG(diameter_mm)::numeric, 0) as avg_diameter_mm
            FROM synth.pipes
            GROUP BY class
            ORDER BY class
        """)
    ).fetchall()

    # Overall totals
    totals = db.execute(
        text("""
            SELECT
                (SELECT COUNT(*) FROM synth.pipes) as pipe_count,
                (SELECT ROUND(SUM(length_m)::numeric, 1) FROM synth.pipes) as pipe_length_m,
                (SELECT COUNT(*) FROM synth.services) as service_count,
                (SELECT ROUND(SUM(length_m)::numeric, 1) FROM synth.services) as service_length_m,
                (SELECT COUNT(*) FROM osm.buildings) as building_count
        """)
    ).fetchone()

    # Age distribution by era
    age_distribution = db.execute(
        text("""
            SELECT
                CASE
                    WHEN install_year >= 2010 THEN '2010+'
                    WHEN install_year >= 2000 THEN '2000-2009'
                    WHEN install_year >= 1990 THEN '1990-1999'
                    ELSE 'Pre-1990'
                END as era,
                COUNT(*) as count,
                ROUND(SUM(length_m)::numeric, 1) as total_length_m
            FROM synth.pipes
            GROUP BY era
            ORDER BY era
        """)
    ).fetchall()

    return {
        "totals": {
            "pipe_count": totals.pipe_count,
            "pipe_length_m": float(totals.pipe_length_m or 0),
            "service_count": totals.service_count,
            "service_length_m": float(totals.service_length_m or 0),
            "building_count": totals.building_count,
        },
        "by_material": [
            {
                "material": row.material,
                "count": row.count,
                "total_length_m": float(row.total_length_m),
            }
            for row in pipe_by_material
        ],
        "by_class": [
            {
                "class": row[0],  # 'class' is reserved, use index
                "count": row.count,
                "total_length_m": float(row.total_length_m),
                "avg_diameter_mm": int(row.avg_diameter_mm),
            }
            for row in pipe_by_class
        ],
        "by_age": [
            {
                "era": row.era,
                "count": row.count,
                "total_length_m": float(row.total_length_m),
            }
            for row in age_distribution
        ],
    }
