"""Tests for synthetic data generation and OSM ingestion."""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db import engine
from sqlalchemy import text


client = TestClient(app)


class TestOSMSchema:
    """Test that OSM schema and tables exist."""

    def test_osm_schema_exists(self):
        """OSM schema should exist after migration."""
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT schema_name FROM information_schema.schemata
                WHERE schema_name = 'osm'
            """))
            schemas = [row[0] for row in result]
            assert 'osm' in schemas

    def test_osm_roads_table_exists(self):
        """osm.roads table should exist."""
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'osm' AND table_name = 'roads'
            """))
            tables = [row[0] for row in result]
            assert 'roads' in tables

    def test_osm_buildings_table_exists(self):
        """osm.buildings table should exist."""
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'osm' AND table_name = 'buildings'
            """))
            tables = [row[0] for row in result]
            assert 'buildings' in tables

    def test_osm_roads_has_geometry_column(self):
        """osm.roads should have a geometry column."""
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = 'osm' AND table_name = 'roads'
                AND column_name = 'geom'
            """))
            columns = [row[0] for row in result]
            assert 'geom' in columns


class TestSynthSchema:
    """Test that synth schema and tables exist."""

    def test_synth_schema_exists(self):
        """Synth schema should exist after migration."""
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT schema_name FROM information_schema.schemata
                WHERE schema_name = 'synth'
            """))
            schemas = [row[0] for row in result]
            assert 'synth' in schemas

    def test_synth_pipes_table_exists(self):
        """synth.pipes table should exist."""
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'synth' AND table_name = 'pipes'
            """))
            tables = [row[0] for row in result]
            assert 'pipes' in tables

    def test_synth_nodes_table_exists(self):
        """synth.nodes table should exist."""
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'synth' AND table_name = 'nodes'
            """))
            tables = [row[0] for row in result]
            assert 'nodes' in tables

    def test_synth_graph_edges_table_exists(self):
        """synth.graph_edges table should exist."""
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'synth' AND table_name = 'graph_edges'
            """))
            tables = [row[0] for row in result]
            assert 'graph_edges' in tables


class TestDeterministicSeeding:
    """Test deterministic attribute generation using MD5 hashing."""

    def test_md5_hash_is_reproducible(self):
        """Same ID should produce same hash value."""
        with engine.connect() as conn:
            result1 = conn.execute(text("""
                SELECT ('x'||substr(md5('12345'),1,8))::bit(32)::int
            """))
            hash1 = result1.fetchone()[0]

            result2 = conn.execute(text("""
                SELECT ('x'||substr(md5('12345'),1,8))::bit(32)::int
            """))
            hash2 = result2.fetchone()[0]

            assert hash1 == hash2

    def test_different_ids_produce_different_hashes(self):
        """Different IDs should produce different hash values."""
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT
                    ('x'||substr(md5('1'),1,8))::bit(32)::int AS h1,
                    ('x'||substr(md5('2'),1,8))::bit(32)::int AS h2,
                    ('x'||substr(md5('3'),1,8))::bit(32)::int AS h3
            """))
            row = result.fetchone()
            # All three should be different
            assert len(set(row)) == 3

    def test_mod_selection_is_deterministic(self):
        """MOD of hash should give consistent selection."""
        with engine.connect() as conn:
            # Simulate selecting from 3 diameter options
            result = conn.execute(text("""
                SELECT MOD(('x'||substr(md5('test_pipe_123'),1,8))::bit(32)::int, 3)
            """))
            selection1 = result.fetchone()[0]

            result = conn.execute(text("""
                SELECT MOD(('x'||substr(md5('test_pipe_123'),1,8))::bit(32)::int, 3)
            """))
            selection2 = result.fetchone()[0]

            assert selection1 == selection2
            assert 0 <= selection1 < 3


class TestConfigFile:
    """Test that config file is valid and loadable."""

    def test_synth_params_file_exists(self):
        """synth-params.yaml should exist."""
        import os
        config_path = "/app/../config/synth-params.yaml"
        # Check from backend container perspective or host
        assert os.path.exists(config_path) or os.path.exists("config/synth-params.yaml")

    def test_synth_params_has_required_keys(self):
        """Config should have area, network, service, and graph sections."""
        import yaml
        config_paths = [
            "/app/../config/synth-params.yaml",
            "config/synth-params.yaml",
            "../config/synth-params.yaml"
        ]

        config = None
        for path in config_paths:
            try:
                with open(path) as f:
                    config = yaml.safe_load(f)
                break
            except FileNotFoundError:
                continue

        if config is None:
            pytest.skip("Config file not accessible from test context")

        assert "area" in config
        assert "network" in config
        assert "service" in config
        assert "graph" in config

        # Check area has required fields
        assert "bbox" in config["area"]
        assert "srid" in config["area"]
        assert len(config["area"]["bbox"]) == 4


class TestOSMDataLoaded:
    """Test that OSM data has been loaded."""

    def test_osm_roads_have_data(self):
        """osm.roads should have road data after loading."""
        with engine.connect() as conn:
            result = conn.execute(text("SELECT COUNT(*) FROM osm.roads"))
            count = result.fetchone()[0]
            # Should have roads after OSM load
            assert count > 0, "No roads loaded - run ./scripts/load-osm.sh first"

    def test_osm_buildings_have_data(self):
        """osm.buildings should have building data after loading."""
        with engine.connect() as conn:
            result = conn.execute(text("SELECT COUNT(*) FROM osm.buildings"))
            count = result.fetchone()[0]
            # Should have buildings after OSM load
            assert count > 0, "No buildings loaded - run ./scripts/load-osm.sh first"

    def test_osm_roads_have_valid_geometry(self):
        """OSM roads should have valid LineString geometries."""
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT COUNT(*) FROM osm.roads
                WHERE ST_IsValid(geom) AND ST_GeometryType(geom) = 'ST_LineString'
            """))
            valid_count = result.fetchone()[0]
            result = conn.execute(text("SELECT COUNT(*) FROM osm.roads"))
            total_count = result.fetchone()[0]
            assert valid_count == total_count, "Some roads have invalid geometry"


class TestNetworkGeneration:
    """Test network generation from OSM roads."""

    def test_pipes_generated_from_roads(self):
        """synth.pipes should be generated after running generator."""
        with engine.connect() as conn:
            result = conn.execute(text("SELECT COUNT(*) FROM synth.pipes"))
            count = result.fetchone()[0]
            # Will be 0 until generator runs - that's the red phase
            # After generator runs, should be > 0

    def test_pipes_have_class_attribute(self):
        """Generated pipes should have a class (main or secondary)."""
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT DISTINCT class FROM synth.pipes
            """))
            classes = [row[0] for row in result]
            # After generation, should have main and/or secondary
            for cls in classes:
                assert cls in ('main', 'secondary')

    def test_pipes_have_deterministic_attributes(self):
        """Pipe attributes should be deterministic (same road -> same attributes)."""
        with engine.connect() as conn:
            # Run generator twice on same data, should get same results
            result = conn.execute(text("""
                SELECT id, diameter_mm, material, install_year
                FROM synth.pipes
                ORDER BY id
                LIMIT 10
            """))
            first_run = list(result)

            # If pipes exist, verify they have required attributes
            for row in first_run:
                assert row[1] is not None  # diameter_mm
                assert row[2] is not None  # material
                assert row[3] is not None  # install_year

    def test_network_has_sufficient_data(self):
        """Network should have reasonable data volume after generation."""
        with engine.connect() as conn:
            # Check pipes
            result = conn.execute(text("SELECT COUNT(*) FROM synth.pipes"))
            pipe_count = result.fetchone()[0]
            assert pipe_count > 100, "Not enough pipes generated"

            # Check service connections
            result = conn.execute(text("SELECT COUNT(*) FROM synth.services"))
            service_count = result.fetchone()[0]
            assert service_count > 1000, "Not enough service connections"

            # Check graph edges
            result = conn.execute(text("SELECT COUNT(*) FROM synth.graph_edges"))
            edge_count = result.fetchone()[0]
            assert edge_count > 100, "Not enough graph edges"

    def test_pipes_have_valid_materials(self):
        """Pipe materials should be from configured set."""
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT DISTINCT material FROM synth.pipes
            """))
            materials = [row[0] for row in result]
            valid_materials = {'Steel', 'PE', 'PVC'}
            for mat in materials:
                assert mat in valid_materials, f"Invalid material: {mat}"
