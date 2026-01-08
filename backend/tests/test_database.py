"""
Database schema tests - TDD for migrations.

These tests verify that the database schema is correctly set up.
Run these against the actual database to ensure migrations work.
"""
import os
import pytest
from sqlalchemy import create_engine, text

# Fix postgres:// to postgresql:// for SQLAlchemy compatibility
_db_url = os.getenv("DATABASE_URL", "postgresql://app:app@localhost:5432/app")
DATABASE_URL = _db_url.replace("postgres://", "postgresql://", 1)


@pytest.fixture
def db_engine():
    """Create a database engine for testing."""
    engine = create_engine(DATABASE_URL)
    yield engine
    engine.dispose()


class TestPropertyTypesTable:
    """TDD tests for property_types table."""

    def test_property_types_table_exists(self, db_engine):
        """Test that property_types table exists."""
        with db_engine.connect() as conn:
            result = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_name = 'property_types'
                )
            """))
            assert result.scalar() is True, "property_types table should exist"

    def test_property_types_has_required_columns(self, db_engine):
        """Test that property_types has all required columns."""
        with db_engine.connect() as conn:
            result = conn.execute(text("""
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = 'property_types'
                ORDER BY ordinal_position
            """))
            columns = {row[0]: row[1] for row in result}

            assert "id" in columns, "Should have id column"
            assert "name" in columns, "Should have name column"
            assert "color" in columns, "Should have color column"
            assert "icon" in columns, "Should have icon column"

    def test_property_types_can_insert_and_query(self, db_engine):
        """Test that we can insert and query property types."""
        with db_engine.connect() as conn:
            # Clean up first (idempotent)
            conn.execute(text("DELETE FROM property_types WHERE name = 'Test Type'"))
            conn.commit()

            # Insert
            conn.execute(text("""
                INSERT INTO property_types (name, color, icon)
                VALUES ('Test Type', '#FF0000', 'building')
            """))
            conn.commit()

            # Query
            result = conn.execute(text(
                "SELECT name, color, icon FROM property_types WHERE name = 'Test Type'"
            ))
            row = result.fetchone()

            assert row is not None, "Should find inserted row"
            assert row[0] == "Test Type"
            assert row[1] == "#FF0000"
            assert row[2] == "building"

            # Clean up
            conn.execute(text("DELETE FROM property_types WHERE name = 'Test Type'"))
            conn.commit()


class TestPropertiesTable:
    """TDD tests for properties table with geometry."""

    def test_properties_table_exists(self, db_engine):
        """Test that properties table exists."""
        with db_engine.connect() as conn:
            result = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_name = 'properties'
                )
            """))
            assert result.scalar() is True, "properties table should exist"

    def test_properties_has_geometry_column(self, db_engine):
        """Test that properties has a PostGIS geometry column."""
        with db_engine.connect() as conn:
            result = conn.execute(text("""
                SELECT type, srid
                FROM geometry_columns
                WHERE f_table_name = 'properties'
                AND f_geometry_column = 'geometry'
            """))
            row = result.fetchone()
            assert row is not None, "Should have geometry column registered"
            assert row[1] == 4326, "Geometry should use SRID 4326 (WGS84)"

    def test_properties_has_required_columns(self, db_engine):
        """Test that properties has all required columns."""
        with db_engine.connect() as conn:
            result = conn.execute(text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'properties'
            """))
            columns = {row[0] for row in result}

            assert "id" in columns
            assert "name" in columns
            assert "address" in columns
            assert "property_type_id" in columns
            assert "value" in columns
            assert "geometry" in columns

    def test_properties_foreign_key_to_property_types(self, db_engine):
        """Test that properties has FK to property_types."""
        with db_engine.connect() as conn:
            result = conn.execute(text("""
                SELECT COUNT(*)
                FROM information_schema.table_constraints tc
                JOIN information_schema.constraint_column_usage ccu
                    ON tc.constraint_name = ccu.constraint_name
                WHERE tc.table_name = 'properties'
                AND tc.constraint_type = 'FOREIGN KEY'
                AND ccu.table_name = 'property_types'
            """))
            assert result.scalar() > 0, "Should have FK to property_types"

    def test_can_insert_property_with_geometry(self, db_engine):
        """Test that we can insert a property with point geometry."""
        with db_engine.connect() as conn:
            # Get a property type ID
            result = conn.execute(text(
                "SELECT id FROM property_types LIMIT 1"
            ))
            type_id = result.scalar()

            # Clean up
            conn.execute(text("DELETE FROM properties WHERE name = 'Test Property'"))
            conn.commit()

            # Insert with geometry (point in San Francisco)
            conn.execute(text("""
                INSERT INTO properties (name, address, property_type_id, value, geometry)
                VALUES (
                    'Test Property',
                    '123 Test St',
                    :type_id,
                    500000,
                    ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326)
                )
            """), {"type_id": type_id})
            conn.commit()

            # Query and verify geometry
            result = conn.execute(text("""
                SELECT name, ST_X(geometry), ST_Y(geometry)
                FROM properties
                WHERE name = 'Test Property'
            """))
            row = result.fetchone()

            assert row is not None
            assert row[0] == "Test Property"
            assert abs(row[1] - (-122.4194)) < 0.0001  # Longitude
            assert abs(row[2] - 37.7749) < 0.0001     # Latitude

            # Clean up
            conn.execute(text("DELETE FROM properties WHERE name = 'Test Property'"))
            conn.commit()


class TestInspectionsTable:
    """TDD tests for inspections table."""

    def test_inspections_table_exists(self, db_engine):
        """Test that inspections table exists."""
        with db_engine.connect() as conn:
            result = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_name = 'inspections'
                )
            """))
            assert result.scalar() is True, "inspections table should exist"

    def test_inspections_has_required_columns(self, db_engine):
        """Test that inspections has all required columns."""
        with db_engine.connect() as conn:
            result = conn.execute(text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'inspections'
            """))
            columns = {row[0] for row in result}

            assert "id" in columns
            assert "property_id" in columns
            assert "inspection_date" in columns
            assert "status" in columns
            assert "notes" in columns

    def test_inspections_foreign_key_to_properties(self, db_engine):
        """Test that inspections has FK to properties with CASCADE delete."""
        with db_engine.connect() as conn:
            result = conn.execute(text("""
                SELECT rc.delete_rule
                FROM information_schema.referential_constraints rc
                JOIN information_schema.table_constraints tc
                    ON rc.constraint_name = tc.constraint_name
                WHERE tc.table_name = 'inspections'
            """))
            row = result.fetchone()
            assert row is not None, "Should have FK constraint"
            assert row[0] == "CASCADE", "Should cascade on delete"


class TestMVTFunction:
    """TDD tests for Martin MVT tile function."""

    def test_mvt_function_exists(self, db_engine):
        """Test that the properties_mvt function exists."""
        with db_engine.connect() as conn:
            result = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM pg_proc p
                    JOIN pg_namespace n ON p.pronamespace = n.oid
                    WHERE p.proname = 'properties_mvt'
                    AND n.nspname = 'public'
                )
            """))
            assert result.scalar() is True, "properties_mvt function should exist"

    def test_mvt_function_returns_bytea(self, db_engine):
        """Test that MVT function returns bytea (binary tile data)."""
        with db_engine.connect() as conn:
            result = conn.execute(text("""
                SELECT pg_typeof(properties_mvt(0, 0, 0))::text
            """))
            assert result.scalar() == "bytea", "Function should return bytea"

    def test_mvt_function_returns_valid_tile(self, db_engine):
        """Test that MVT function returns data (even if empty)."""
        with db_engine.connect() as conn:
            # Insert a test property first
            result = conn.execute(text("SELECT id FROM property_types LIMIT 1"))
            type_id = result.scalar()

            conn.execute(text("DELETE FROM properties WHERE name = 'MVT Test'"))
            conn.execute(text("""
                INSERT INTO properties (name, address, property_type_id, value, geometry)
                VALUES ('MVT Test', '123 MVT St', :type_id, 100000,
                        ST_SetSRID(ST_MakePoint(0, 0), 4326))
            """), {"type_id": type_id})
            conn.commit()

            # Call function at zoom level 0 (whole world)
            result = conn.execute(text("SELECT properties_mvt(0, 0, 0)"))
            tile_data = result.scalar()

            assert tile_data is not None, "Should return tile data"
            assert len(tile_data) > 0, "Tile should have content"

            # Clean up
            conn.execute(text("DELETE FROM properties WHERE name = 'MVT Test'"))
            conn.commit()
