-- MVT tile function for Martin (idempotent via CREATE OR REPLACE)
-- Returns vector tiles for properties layer
-- Martin auto-discovers functions with signature (z int, x int, y int) -> bytea

CREATE OR REPLACE FUNCTION properties_mvt(z integer, x integer, y integer)
RETURNS bytea
LANGUAGE plpgsql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
DECLARE
    bounds geometry;
    tile bytea;
BEGIN
    -- Calculate tile bounds from ZXY
    bounds := ST_TileEnvelope(z, x, y);

    -- Generate MVT tile
    SELECT ST_AsMVT(tile_data, 'properties', 4096, 'geom')
    INTO tile
    FROM (
        SELECT
            p.id,
            p.name,
            p.address,
            p.value,
            pt.name AS property_type,
            pt.color AS property_color,
            pt.icon AS property_icon,
            ST_AsMVTGeom(
                ST_Transform(p.geometry, 3857),
                bounds,
                4096,
                256,
                true
            ) AS geom
        FROM properties p
        JOIN property_types pt ON p.property_type_id = pt.id
        WHERE ST_Intersects(
            ST_Transform(p.geometry, 3857),
            bounds
        )
    ) AS tile_data;

    RETURN COALESCE(tile, '');
END;
$$;

-- Add function comment for Martin metadata
COMMENT ON FUNCTION properties_mvt(integer, integer, integer) IS
'Properties vector tiles with type information. Returns MVT tiles for rendering properties on a map.';

-- Track migration
INSERT INTO schema_migrations (version)
VALUES ('005_mvt_functions')
ON CONFLICT (version) DO NOTHING;
