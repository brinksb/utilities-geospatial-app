"""
Graph API endpoint tests - TDD for pgRouting-based network analysis.

These tests verify the graph analysis endpoints that demonstrate
GeoJSON from API (computed routes) vs static MVT tiles.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    return TestClient(app)


class TestGraphExtension:
    """TDD tests for pgRouting extension availability."""

    def test_pgrouting_extension_exists(self, client):
        """Test that pgRouting extension is installed in database."""
        # The /graph/status endpoint should verify pgRouting is available
        response = client.get("/graph/status")
        assert response.status_code == 200
        data = response.json()
        assert data["pgrouting_available"] is True


class TestNearestEdgeAPI:
    """TDD tests for /graph/nearest_edge endpoint."""

    def test_nearest_edge_returns_200(self, client):
        """Test that GET /graph/nearest_edge returns 200 with valid coords."""
        # Using coordinates near Empire State Building (NYC)
        response = client.get("/graph/nearest_edge?lon=-73.9857&lat=40.7484")
        assert response.status_code == 200

    def test_nearest_edge_returns_geojson(self, client):
        """Test that nearest_edge returns valid GeoJSON Feature."""
        response = client.get("/graph/nearest_edge?lon=-73.9857&lat=40.7484")
        data = response.json()

        # Should be a GeoJSON Feature
        assert data["type"] == "Feature"
        assert "geometry" in data
        assert "properties" in data
        assert data["geometry"]["type"] == "LineString"

    def test_nearest_edge_has_edge_id(self, client):
        """Test that nearest_edge result includes edge_id property."""
        response = client.get("/graph/nearest_edge?lon=-73.9857&lat=40.7484")
        data = response.json()

        assert "edge_id" in data["properties"]
        assert isinstance(data["properties"]["edge_id"], int)

    def test_nearest_edge_missing_params_returns_422(self, client):
        """Test that missing parameters return 422."""
        response = client.get("/graph/nearest_edge")
        assert response.status_code == 422

    def test_nearest_edge_includes_distance(self, client):
        """Test that nearest_edge includes distance to the edge."""
        response = client.get("/graph/nearest_edge?lon=-73.9857&lat=40.7484")
        data = response.json()

        assert "distance_meters" in data["properties"]
        assert isinstance(data["properties"]["distance_meters"], (int, float))


class TestNearbyEdgesAPI:
    """TDD tests for /graph/nearby_edges/{edge_id} endpoint."""

    def test_nearby_edges_returns_200(self, client):
        """Test that GET /graph/nearby_edges/{edge_id} returns 200."""
        # First get a valid edge_id
        nearest = client.get("/graph/nearest_edge?lon=-73.9857&lat=40.7484")
        edge_id = nearest.json()["properties"]["edge_id"]

        response = client.get(f"/graph/nearby_edges/{edge_id}?hops=2")
        assert response.status_code == 200

    def test_nearby_edges_returns_geojson_feature_collection(self, client):
        """Test that nearby_edges returns GeoJSON FeatureCollection."""
        nearest = client.get("/graph/nearest_edge?lon=-73.9857&lat=40.7484")
        edge_id = nearest.json()["properties"]["edge_id"]

        response = client.get(f"/graph/nearby_edges/{edge_id}?hops=2")
        data = response.json()

        assert data["type"] == "FeatureCollection"
        assert "features" in data
        assert isinstance(data["features"], list)

    def test_nearby_edges_features_are_linestrings(self, client):
        """Test that all features in nearby_edges are LineStrings."""
        nearest = client.get("/graph/nearest_edge?lon=-73.9857&lat=40.7484")
        edge_id = nearest.json()["properties"]["edge_id"]

        response = client.get(f"/graph/nearby_edges/{edge_id}?hops=2")
        data = response.json()

        for feature in data["features"]:
            assert feature["type"] == "Feature"
            assert feature["geometry"]["type"] == "LineString"

    def test_nearby_edges_default_hops(self, client):
        """Test that hops defaults to 1 if not specified."""
        nearest = client.get("/graph/nearest_edge?lon=-73.9857&lat=40.7484")
        edge_id = nearest.json()["properties"]["edge_id"]

        response = client.get(f"/graph/nearby_edges/{edge_id}")
        assert response.status_code == 200

    def test_nearby_edges_includes_hop_distance(self, client):
        """Test that each edge includes its hop distance from source."""
        nearest = client.get("/graph/nearest_edge?lon=-73.9857&lat=40.7484")
        edge_id = nearest.json()["properties"]["edge_id"]

        response = client.get(f"/graph/nearby_edges/{edge_id}?hops=2")
        data = response.json()

        for feature in data["features"]:
            assert "hop" in feature["properties"]
            assert feature["properties"]["hop"] >= 0

    def test_nearby_edges_invalid_edge_id_returns_404(self, client):
        """Test that invalid edge_id returns 404."""
        response = client.get("/graph/nearby_edges/99999999")
        assert response.status_code == 404


class TestGraphIntegration:
    """Integration tests for graph workflow."""

    def test_click_to_network_workflow(self, client):
        """Test the full workflow: click coords -> nearest edge -> nearby network.

        This simulates what happens when a user clicks on the map:
        1. Click coordinates are sent to nearest_edge
        2. The returned edge_id is used to fetch nearby network
        3. The GeoJSON result is displayed on the map
        """
        # Step 1: User clicks near Willis Tower in Chicago
        lon, lat = -87.6359, 41.8789
        nearest_response = client.get(f"/graph/nearest_edge?lon={lon}&lat={lat}")
        assert nearest_response.status_code == 200

        nearest = nearest_response.json()
        edge_id = nearest["properties"]["edge_id"]

        # Step 2: Fetch nearby network (3 hops)
        network_response = client.get(f"/graph/nearby_edges/{edge_id}?hops=3")
        assert network_response.status_code == 200

        network = network_response.json()

        # Step 3: Verify we have a usable GeoJSON FeatureCollection
        assert network["type"] == "FeatureCollection"
        assert len(network["features"]) > 0

        # All features should be displayable LineStrings
        for feature in network["features"]:
            assert len(feature["geometry"]["coordinates"]) >= 2
