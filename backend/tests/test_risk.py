"""Tests for risk scoring functionality."""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.features import features


client = TestClient(app)


class TestRiskScoring:
    """Test risk score and risk band in property responses."""

    def test_properties_list_includes_risk_fields(self):
        """Risk fields should be present in property list response."""
        response = client.get("/properties")
        assert response.status_code == 200
        properties = response.json()
        assert len(properties) > 0

        # Check first property has risk fields (may be null if migration not run)
        prop = properties[0]
        assert "risk_score" in prop
        assert "risk_band" in prop

    def test_property_detail_includes_risk_fields(self):
        """Risk fields should be present in property detail response."""
        # First get a property ID
        list_response = client.get("/properties")
        properties = list_response.json()
        assert len(properties) > 0
        property_id = properties[0]["id"]

        # Get detail
        response = client.get(f"/properties/{property_id}")
        assert response.status_code == 200
        prop = response.json()
        assert "risk_score" in prop
        assert "risk_band" in prop

    def test_risk_band_values_are_valid(self):
        """Risk band should be one of the valid values or null."""
        valid_bands = {"very_high", "high", "medium", "low", None}

        response = client.get("/properties")
        properties = response.json()

        for prop in properties:
            assert prop["risk_band"] in valid_bands, f"Invalid risk_band: {prop['risk_band']}"

    def test_risk_score_in_valid_range(self):
        """Risk score should be between 0 and 100 or null."""
        response = client.get("/properties")
        properties = response.json()

        for prop in properties:
            score = prop["risk_score"]
            if score is not None:
                score_float = float(score)
                assert 0 <= score_float <= 100, f"Invalid risk_score: {score}"


class TestRiskFeatureFlag:
    """Test that RISK_SCORING feature flag exists."""

    def test_risk_scoring_flag_exists(self):
        """RISK_SCORING should be a valid feature flag."""
        # Just verify the flag can be checked
        is_enabled = features.is_enabled("RISK_SCORING")
        assert isinstance(is_enabled, bool)

    def test_risk_scoring_flag_default_disabled(self):
        """RISK_SCORING should be disabled by default."""
        # Clear any overrides first
        features.clear_overrides()
        # Check default value (from config)
        is_enabled = features.is_enabled("RISK_SCORING")
        assert is_enabled is False
