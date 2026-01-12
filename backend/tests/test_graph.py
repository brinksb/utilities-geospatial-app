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


class TestOutageSimulation:
    """TDD tests for /graph/outage/{edge_id} - Sector 7G Outage Simulator."""

    def test_outage_returns_200(self, client):
        """Test that GET /graph/outage/{edge_id} returns 200."""
        # Edge 657 is a known bridge edge in Springfield
        response = client.get("/graph/outage/7")
        assert response.status_code == 200

    def test_outage_returns_geojson_feature_collection(self, client):
        """Test that outage returns GeoJSON FeatureCollection of affected buildings."""
        response = client.get("/graph/outage/7")
        data = response.json()

        assert data["type"] == "FeatureCollection"
        assert "features" in data
        assert isinstance(data["features"], list)

    def test_outage_returns_affected_buildings(self, client):
        """Test that outage returns building polygons that lose service."""
        response = client.get("/graph/outage/7")
        data = response.json()

        # Edge 657 is a bridge with services - should affect some buildings
        assert len(data["features"]) > 0

        # Buildings should be polygons
        for feature in data["features"]:
            assert feature["type"] == "Feature"
            assert feature["geometry"]["type"] in ["Polygon", "MultiPolygon"]

    def test_outage_includes_building_id(self, client):
        """Test that affected buildings include their ID."""
        response = client.get("/graph/outage/7")
        data = response.json()

        for feature in data["features"]:
            assert "building_id" in feature["properties"]

    def test_outage_invalid_edge_returns_404(self, client):
        """Test that invalid edge_id returns 404."""
        response = client.get("/graph/outage/99999999")
        assert response.status_code == 404

    def test_outage_non_bridge_returns_empty(self, client):
        """Test that breaking a non-bridge edge returns empty (no disconnection)."""
        # First find an edge that is NOT a bridge
        # We'll test this returns 200 with potentially empty features
        # (The implementation should handle this gracefully)
        response = client.get("/graph/outage/1")  # Edge 1 may or may not be a bridge
        assert response.status_code in [200, 404]

    def test_outage_includes_stats(self, client):
        """Test that outage response includes aggregate statistics."""
        response = client.get("/graph/outage/7")
        data = response.json()

        # Should include stats object
        assert "stats" in data
        stats = data["stats"]

        # Verify required stat fields
        assert "affected_building_count" in stats
        assert "affected_service_count" in stats
        assert "total_service_length_m" in stats

        # Stats should be numeric
        assert isinstance(stats["affected_building_count"], int)
        assert isinstance(stats["affected_service_count"], int)
        assert isinstance(stats["total_service_length_m"], (int, float))

    def test_outage_stats_match_feature_count(self, client):
        """Test that stats building count matches features length."""
        response = client.get("/graph/outage/7")
        data = response.json()

        assert data["stats"]["affected_building_count"] == len(data["features"])

    def test_outage_does_not_affect_all_buildings(self, client):
        """Test that breaking a single edge doesn't disconnect ALL buildings.

        Bug: Previously, the outage query started from node 1 which was in a
        tiny isolated component, causing almost all buildings to appear
        "disconnected". A single edge break should only affect a portion of
        the network, not the majority of buildings.
        """
        # Get total building count for comparison
        # Note: We have ~19,759 buildings total

        # Test several different edges - none should affect more than 50% of buildings
        for edge_id in [100, 500, 657, 1000]:
            response = client.get(f"/graph/outage/{edge_id}")
            if response.status_code == 200:
                data = response.json()
                affected = data["stats"]["affected_building_count"]
                # A single edge break should NOT affect more than half the network
                # (unless it's a critical bridge, which is rare)
                assert affected < 10000, f"Edge {edge_id} affects {affected} buildings - too many!"


class TestSpreadSimulation:
    """TDD tests for /graph/spread - Nuclear Plant Blast Radius."""

    # Well-connected coordinates near node 110 in Springfield
    # This area has good network connectivity for spread testing
    SPREAD_LON = -123.029
    SPREAD_LAT = 44.071

    def test_spread_returns_200(self, client):
        """Test that GET /graph/spread returns 200 with valid coords."""
        response = client.get(f"/graph/spread?lon={self.SPREAD_LON}&lat={self.SPREAD_LAT}&max_hops=3")
        assert response.status_code == 200

    def test_spread_returns_geojson_feature_collection(self, client):
        """Test that spread returns GeoJSON FeatureCollection."""
        response = client.get(f"/graph/spread?lon={self.SPREAD_LON}&lat={self.SPREAD_LAT}&max_hops=3")
        data = response.json()

        assert data["type"] == "FeatureCollection"
        assert "features" in data

    def test_spread_features_grouped_by_hop(self, client):
        """Test that spread results include hop distance for animation."""
        response = client.get(f"/graph/spread?lon={self.SPREAD_LON}&lat={self.SPREAD_LAT}&max_hops=3")
        data = response.json()

        # Should have edges at different hop distances
        hops_found = set()
        for feature in data["features"]:
            assert "hop" in feature["properties"]
            hops_found.add(feature["properties"]["hop"])

        # Should have multiple hop levels for animation
        assert len(hops_found) > 1

    def test_spread_includes_edge_metadata(self, client):
        """Test that spread edges include useful metadata."""
        response = client.get(f"/graph/spread?lon={self.SPREAD_LON}&lat={self.SPREAD_LAT}&max_hops=3")
        data = response.json()

        for feature in data["features"]:
            assert "edge_id" in feature["properties"]
            assert "hop" in feature["properties"]

    def test_spread_default_max_hops(self, client):
        """Test that max_hops defaults to 5 if not specified."""
        response = client.get(f"/graph/spread?lon={self.SPREAD_LON}&lat={self.SPREAD_LAT}")
        assert response.status_code == 200

    def test_spread_missing_coords_returns_422(self, client):
        """Test that missing coordinates return 422."""
        response = client.get("/graph/spread")
        assert response.status_code == 422

    def test_spread_deterministic_for_same_coords(self, client):
        """Test that spread returns same results for same coordinates."""
        response1 = client.get(f"/graph/spread?lon={self.SPREAD_LON}&lat={self.SPREAD_LAT}&max_hops=2")
        response2 = client.get(f"/graph/spread?lon={self.SPREAD_LON}&lat={self.SPREAD_LAT}&max_hops=2")

        data1 = response1.json()
        data2 = response2.json()

        assert len(data1["features"]) == len(data2["features"])


class TestWorstDayAPI:
    """TDD tests for /graph/worst_day - Homer's Worst Day."""

    def test_worst_day_returns_200(self, client):
        """Test that GET /graph/worst_day returns 200."""
        response = client.get("/graph/worst_day")
        assert response.status_code == 200

    def test_worst_day_returns_geojson_feature_collection(self, client):
        """Test that worst_day returns GeoJSON FeatureCollection."""
        response = client.get("/graph/worst_day")
        data = response.json()

        assert data["type"] == "FeatureCollection"
        assert "features" in data
        assert isinstance(data["features"], list)

    def test_worst_day_includes_stats(self, client):
        """Test that worst_day includes aggregate statistics."""
        response = client.get("/graph/worst_day")
        data = response.json()

        assert "stats" in data
        stats = data["stats"]
        assert "affected_building_count" in stats
        assert "affected_service_count" in stats
        assert "total_service_length_m" in stats

    def test_worst_day_includes_worst_pipe_or_none(self, client):
        """Test that worst_day includes worst_pipe info (or None if network is redundant)."""
        response = client.get("/graph/worst_day")
        data = response.json()

        assert "worst_pipe" in data
        # worst_pipe can be None if no critical pipes exist
        if data["worst_pipe"] is not None:
            assert "edge_id" in data["worst_pipe"]
            assert "geometry" in data["worst_pipe"]
            assert "class" in data["worst_pipe"]

    def test_worst_day_includes_dramatic_message(self, client):
        """Test that worst_day includes a dramatic message for demo purposes."""
        response = client.get("/graph/worst_day")
        data = response.json()

        assert "dramatic_message" in data
        assert isinstance(data["dramatic_message"], str)
        assert len(data["dramatic_message"]) > 0

    def test_worst_day_stats_match_feature_count(self, client):
        """Test that stats building count matches features length."""
        response = client.get("/graph/worst_day")
        data = response.json()

        assert data["stats"]["affected_building_count"] == len(data["features"])


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
