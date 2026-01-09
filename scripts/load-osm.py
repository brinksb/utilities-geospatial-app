#!/usr/bin/env python3
"""
OSM Data Loader - Downloads and loads OpenStreetMap data for a bounding box.

Uses Overpass API to fetch roads and buildings, then inserts into PostgreSQL.

Usage:
    python scripts/load-osm.py [--config config/synth-params.yaml]
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

import psycopg2
import requests
import yaml


OVERPASS_URL = "https://overpass-api.de/api/interpreter"


def load_config(config_path: str) -> dict:
    """Load configuration from YAML file."""
    with open(config_path) as f:
        return yaml.safe_load(f)


def query_overpass(query: str, max_retries: int = 3) -> dict:
    """Execute Overpass API query with retries."""
    for attempt in range(max_retries):
        try:
            print(f"  Querying Overpass API (attempt {attempt + 1})...")
            response = requests.post(
                OVERPASS_URL,
                data={"data": query},
                timeout=120
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            if attempt < max_retries - 1:
                wait = 10 * (attempt + 1)
                print(f"  Request failed, retrying in {wait}s: {e}")
                time.sleep(wait)
            else:
                raise


def fetch_roads(bbox: list) -> list:
    """Fetch road geometries from Overpass API."""
    south, west, north, east = bbox[1], bbox[0], bbox[3], bbox[2]

    query = f"""
    [out:json][timeout:90];
    (
      way["highway"~"^(trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|residential|unclassified|living_street)$"]({south},{west},{north},{east});
    );
    out body geom;
    """

    print("Fetching roads...")
    data = query_overpass(query)

    roads = []
    for element in data.get("elements", []):
        if element.get("type") == "way" and "geometry" in element:
            coords = [(p["lon"], p["lat"]) for p in element["geometry"]]
            if len(coords) >= 2:
                roads.append({
                    "osm_id": element["id"],
                    "name": element.get("tags", {}).get("name"),
                    "highway": element.get("tags", {}).get("highway"),
                    "oneway": element.get("tags", {}).get("oneway"),
                    "surface": element.get("tags", {}).get("surface"),
                    "lanes": element.get("tags", {}).get("lanes"),
                    "coords": coords
                })

    print(f"  Found {len(roads)} roads")
    return roads


def fetch_buildings(bbox: list) -> list:
    """Fetch building footprints from Overpass API."""
    south, west, north, east = bbox[1], bbox[0], bbox[3], bbox[2]

    query = f"""
    [out:json][timeout:90];
    (
      way["building"]({south},{west},{north},{east});
    );
    out body geom;
    """

    print("Fetching buildings...")
    data = query_overpass(query)

    buildings = []
    for element in data.get("elements", []):
        if element.get("type") == "way" and "geometry" in element:
            coords = [(p["lon"], p["lat"]) for p in element["geometry"]]
            # Ensure polygon is closed
            if len(coords) >= 4 and coords[0] != coords[-1]:
                coords.append(coords[0])
            if len(coords) >= 4:
                tags = element.get("tags", {})
                buildings.append({
                    "osm_id": element["id"],
                    "name": tags.get("name"),
                    "building": tags.get("building", "yes"),
                    "amenity": tags.get("amenity"),
                    "shop": tags.get("shop"),
                    "office": tags.get("office"),
                    "addr_street": tags.get("addr:street"),
                    "addr_housenumber": tags.get("addr:housenumber"),
                    "coords": coords
                })

    print(f"  Found {len(buildings)} buildings")
    return buildings


def coords_to_linestring_wkt(coords: list) -> str:
    """Convert coordinate list to WKT LineString."""
    points = ", ".join(f"{lon} {lat}" for lon, lat in coords)
    return f"SRID=4326;LINESTRING({points})"


def coords_to_polygon_wkt(coords: list) -> str:
    """Convert coordinate list to WKT Polygon."""
    points = ", ".join(f"{lon} {lat}" for lon, lat in coords)
    return f"SRID=4326;POLYGON(({points}))"


def insert_roads(conn, roads: list):
    """Insert roads into database."""
    print(f"Inserting {len(roads)} roads...")

    with conn.cursor() as cur:
        # Clear existing data
        cur.execute("TRUNCATE osm.roads RESTART IDENTITY CASCADE")

        for road in roads:
            cur.execute("""
                INSERT INTO osm.roads (osm_id, name, highway, oneway, surface, lanes, geom)
                VALUES (%s, %s, %s, %s, %s, %s, ST_GeomFromEWKT(%s))
            """, (
                road["osm_id"],
                road["name"],
                road["highway"],
                road["oneway"],
                road["surface"],
                int(road["lanes"]) if road["lanes"] and road["lanes"].isdigit() else None,
                coords_to_linestring_wkt(road["coords"])
            ))

        conn.commit()
    print("  Roads inserted")


def insert_buildings(conn, buildings: list):
    """Insert buildings into database."""
    print(f"Inserting {len(buildings)} buildings...")

    with conn.cursor() as cur:
        # Clear existing data
        cur.execute("TRUNCATE osm.buildings RESTART IDENTITY CASCADE")

        for bldg in buildings:
            try:
                cur.execute("""
                    INSERT INTO osm.buildings
                    (osm_id, name, building, amenity, shop, office, addr_street, addr_housenumber, geom)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, ST_GeomFromEWKT(%s))
                """, (
                    bldg["osm_id"],
                    bldg["name"],
                    bldg["building"],
                    bldg["amenity"],
                    bldg["shop"],
                    bldg["office"],
                    bldg["addr_street"],
                    bldg["addr_housenumber"],
                    coords_to_polygon_wkt(bldg["coords"])
                ))
            except Exception as e:
                # Skip invalid geometries
                print(f"  Skipping building {bldg['osm_id']}: {e}")
                conn.rollback()
                continue

        conn.commit()
    print("  Buildings inserted")


def main():
    parser = argparse.ArgumentParser(description="Load OSM data for synthetic network generation")
    parser.add_argument(
        "--config",
        default="config/synth-params.yaml",
        help="Path to configuration file"
    )
    args = parser.parse_args()

    # Load config
    print(f"Loading config from {args.config}...")
    config = load_config(args.config)
    area = config["area"]
    bbox = area["bbox"]

    print(f"Area: {area['name']}")
    print(f"Bounding box: {bbox}")

    # Connect to database
    db_url = os.environ.get("DATABASE_URL", "postgresql://app:app@postgres:5432/app")
    print(f"Connecting to database...")
    conn = psycopg2.connect(db_url)

    try:
        # Fetch and insert data
        roads = fetch_roads(bbox)
        buildings = fetch_buildings(bbox)

        insert_roads(conn, roads)
        insert_buildings(conn, buildings)

        # Print summary
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM osm.roads")
            road_count = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM osm.buildings")
            building_count = cur.fetchone()[0]

        print("")
        print("=" * 50)
        print(f"OSM data loaded for {area['name']}:")
        print(f"  Roads:     {road_count:,}")
        print(f"  Buildings: {building_count:,}")
        print("=" * 50)

    finally:
        conn.close()


if __name__ == "__main__":
    main()
