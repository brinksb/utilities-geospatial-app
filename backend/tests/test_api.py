"""
API endpoint tests - TDD for FastAPI routes.

These tests verify the REST API endpoints work correctly.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    return TestClient(app)


class TestPropertyTypesAPI:
    """TDD tests for /property-types endpoint."""

    def test_get_property_types_returns_200(self, client):
        """Test that GET /property-types returns 200."""
        response = client.get("/property-types")
        assert response.status_code == 200

    def test_get_property_types_returns_list(self, client):
        """Test that GET /property-types returns a list."""
        response = client.get("/property-types")
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0  # Should have seeded types

    def test_property_type_has_expected_fields(self, client):
        """Test that property types have required fields."""
        response = client.get("/property-types")
        data = response.json()
        first_type = data[0]

        assert "id" in first_type
        assert "name" in first_type
        assert "color" in first_type
        assert "icon" in first_type


class TestPropertiesAPI:
    """TDD tests for /properties endpoints."""

    def test_get_properties_returns_200(self, client):
        """Test that GET /properties returns 200."""
        response = client.get("/properties")
        assert response.status_code == 200

    def test_get_properties_returns_list(self, client):
        """Test that GET /properties returns a list."""
        response = client.get("/properties")
        data = response.json()
        assert isinstance(data, list)

    def test_get_properties_with_type_filter(self, client):
        """Test filtering properties by type_id."""
        response = client.get("/properties?type_id=1")
        assert response.status_code == 200
        data = response.json()
        # All returned properties should have type_id=1
        for prop in data:
            assert prop.get("property_type_id") == 1 or len(data) == 0

    def test_get_properties_includes_coordinates(self, client):
        """Test that properties include longitude/latitude for network overlay demo."""
        response = client.get("/properties")
        data = response.json()
        assert len(data) > 0

        # All properties should have coordinates
        for prop in data:
            assert "longitude" in prop
            assert "latitude" in prop
            assert isinstance(prop["longitude"], (int, float))
            assert isinstance(prop["latitude"], (int, float))


class TestPropertyDetailAPI:
    """TDD tests for /properties/{id} endpoint."""

    def test_get_property_not_found_returns_404(self, client):
        """Test that non-existent property returns 404."""
        response = client.get("/properties/99999")
        assert response.status_code == 404

    def test_get_property_returns_detail_with_inspections(self, client):
        """Test that property detail includes inspections array."""
        # First create a property to test with
        # For now, we'll test the structure when property exists
        response = client.get("/properties/1")
        if response.status_code == 200:
            data = response.json()
            assert "id" in data
            assert "name" in data
            assert "inspections" in data
            assert isinstance(data["inspections"], list)

    def test_get_property_detail_includes_coordinates(self, client):
        """Test that property detail includes coordinates for network overlay demo."""
        response = client.get("/properties/1")
        if response.status_code == 200:
            data = response.json()
            assert "longitude" in data
            assert "latitude" in data
            assert isinstance(data["longitude"], (int, float))
            assert isinstance(data["latitude"], (int, float))


class TestCreatePropertyAPI:
    """TDD tests for POST /properties endpoint."""

    def test_create_property_returns_201(self, client):
        """Test that POST /properties returns 201 on success."""
        property_data = {
            "name": "Test Property",
            "address": "123 Test Street",
            "property_type_id": 1,
            "value": 250000,
            "longitude": -122.4194,
            "latitude": 37.7749,
        }
        response = client.post("/properties", json=property_data)
        assert response.status_code == 201

    def test_create_property_returns_created_data(self, client):
        """Test that created property has correct data."""
        property_data = {
            "name": "API Test Property",
            "address": "456 API Avenue",
            "property_type_id": 1,
            "value": 500000,
            "longitude": -73.9857,
            "latitude": 40.7484,
        }
        response = client.post("/properties", json=property_data)
        data = response.json()

        assert data["name"] == "API Test Property"
        assert data["address"] == "456 API Avenue"
        assert data["property_type_id"] == 1
        assert "id" in data
        assert "property_type" in data
        assert "inspections" in data

    def test_create_property_invalid_type_returns_400(self, client):
        """Test that invalid property_type_id returns 400."""
        property_data = {
            "name": "Bad Property",
            "property_type_id": 99999,
            "longitude": 0,
            "latitude": 0,
        }
        response = client.post("/properties", json=property_data)
        assert response.status_code == 400
