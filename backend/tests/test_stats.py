"""
Network Statistics API endpoint tests - TDD for aggregate network data.

These tests verify the /network/stats endpoint that provides
aggregate statistics about the synthetic utility network.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    return TestClient(app)


class TestNetworkStats:
    """TDD tests for /network/stats endpoint."""

    def test_stats_returns_200(self, client):
        """Test that GET /network/stats returns 200."""
        response = client.get("/network/stats")
        assert response.status_code == 200

    def test_stats_has_totals(self, client):
        """Test that stats response includes totals object."""
        response = client.get("/network/stats")
        data = response.json()

        assert "totals" in data
        totals = data["totals"]

        # Required total fields
        assert "pipe_count" in totals
        assert "pipe_length_m" in totals
        assert "service_count" in totals
        assert "service_length_m" in totals
        assert "building_count" in totals

    def test_stats_totals_are_positive(self, client):
        """Test that totals contain positive values (we have data)."""
        response = client.get("/network/stats")
        data = response.json()
        totals = data["totals"]

        # Should have actual data from the synthetic network
        assert totals["pipe_count"] > 0
        assert totals["pipe_length_m"] > 0
        assert totals["service_count"] > 0
        assert totals["building_count"] > 0

    def test_stats_has_material_breakdown(self, client):
        """Test that stats includes breakdown by material."""
        response = client.get("/network/stats")
        data = response.json()

        assert "by_material" in data
        by_material = data["by_material"]

        # Should have at least one material
        assert len(by_material) > 0

        # Each material entry should have required fields
        for entry in by_material:
            assert "material" in entry
            assert "count" in entry
            assert "total_length_m" in entry

    def test_stats_has_class_breakdown(self, client):
        """Test that stats includes breakdown by pipe class."""
        response = client.get("/network/stats")
        data = response.json()

        assert "by_class" in data
        by_class = data["by_class"]

        # Should have main and secondary classes
        assert len(by_class) >= 2

        # Each class entry should have required fields
        for entry in by_class:
            assert "class" in entry
            assert "count" in entry
            assert "total_length_m" in entry
            assert "avg_diameter_mm" in entry

    def test_stats_has_age_breakdown(self, client):
        """Test that stats includes breakdown by installation era."""
        response = client.get("/network/stats")
        data = response.json()

        assert "by_age" in data
        by_age = data["by_age"]

        # Should have some age eras
        assert len(by_age) > 0

        # Each era entry should have required fields
        for entry in by_age:
            assert "era" in entry
            assert "count" in entry
            assert "total_length_m" in entry

    def test_stats_material_counts_sum_to_total(self, client):
        """Test that material breakdown counts sum to total pipe count."""
        response = client.get("/network/stats")
        data = response.json()

        total_from_materials = sum(m["count"] for m in data["by_material"])
        assert total_from_materials == data["totals"]["pipe_count"]

    def test_stats_class_counts_sum_to_total(self, client):
        """Test that class breakdown counts sum to total pipe count."""
        response = client.get("/network/stats")
        data = response.json()

        total_from_classes = sum(c["count"] for c in data["by_class"])
        assert total_from_classes == data["totals"]["pipe_count"]
