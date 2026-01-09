-- MVT function for synthetic network pipes
-- Migration: 011_synth_mvt.sql

-- Track migration
INSERT INTO schema_migrations (version)
VALUES ('011_synth_mvt')
ON CONFLICT (version) DO NOTHING;

-- MVT function for pipes layer
CREATE OR REPLACE FUNCTION synth_pipes_mvt(z integer, x integer, y integer)
RETURNS bytea
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
    bounds geometry;
    result bytea;
BEGIN
    -- Calculate tile bounds
    bounds := ST_TileEnvelope(z, x, y);

    -- Generate MVT
    SELECT ST_AsMVT(q, 'synth_pipes_mvt', 4096, 'geom') INTO result
    FROM (
        SELECT
            p.id,
            p.class,
            p.diameter_mm,
            p.material,
            p.pressure_class,
            p.install_year,
            ROUND(p.length_m::numeric, 1) AS length_m,
            ST_AsMVTGeom(
                ST_Transform(p.geom, 3857),
                bounds,
                4096,
                256,
                true
            ) AS geom
        FROM synth.pipes p
        WHERE ST_Intersects(ST_Transform(p.geom, 3857), bounds)
    ) q;

    RETURN result;
END;
$$;

-- MVT function for services (building connections)
CREATE OR REPLACE FUNCTION synth_services_mvt(z integer, x integer, y integer)
RETURNS bytea
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
    bounds geometry;
    result bytea;
BEGIN
    -- Calculate tile bounds
    bounds := ST_TileEnvelope(z, x, y);

    -- Generate MVT (only visible at higher zoom levels)
    IF z < 15 THEN
        RETURN NULL;
    END IF;

    SELECT ST_AsMVT(q, 'synth_services_mvt', 4096, 'geom') INTO result
    FROM (
        SELECT
            s.id,
            ROUND(s.length_m::numeric, 1) AS length_m,
            ST_AsMVTGeom(
                ST_Transform(s.geom, 3857),
                bounds,
                4096,
                256,
                true
            ) AS geom
        FROM synth.services s
        WHERE ST_Intersects(ST_Transform(s.geom, 3857), bounds)
    ) q;

    RETURN result;
END;
$$;

-- MVT function for OSM buildings
CREATE OR REPLACE FUNCTION osm_buildings_mvt(z integer, x integer, y integer)
RETURNS bytea
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
    bounds geometry;
    result bytea;
BEGIN
    -- Calculate tile bounds
    bounds := ST_TileEnvelope(z, x, y);

    -- Only show buildings at higher zoom levels
    IF z < 13 THEN
        RETURN NULL;
    END IF;

    SELECT ST_AsMVT(q, 'osm_buildings_mvt', 4096, 'geom') INTO result
    FROM (
        SELECT
            b.id,
            b.osm_id,
            b.name,
            b.building AS building_type,
            b.amenity,
            b.shop,
            ST_AsMVTGeom(
                ST_Transform(b.geom, 3857),
                bounds,
                4096,
                256,
                true
            ) AS geom
        FROM osm.buildings b
        WHERE ST_Intersects(ST_Transform(b.geom, 3857), bounds)
    ) q;

    RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION synth_pipes_mvt(integer, integer, integer) TO PUBLIC;
GRANT EXECUTE ON FUNCTION synth_services_mvt(integer, integer, integer) TO PUBLIC;
GRANT EXECUTE ON FUNCTION osm_buildings_mvt(integer, integer, integer) TO PUBLIC;
