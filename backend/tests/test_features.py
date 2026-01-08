"""Tests for feature flag utility (TDD)."""
import json
import tempfile
from pathlib import Path

import pytest

from app.features import FeatureFlags


class TestFeatureFlags:
    """Test feature flag utility with JSON config."""

    @pytest.fixture
    def temp_config(self) -> Path:
        """Create a temporary config file for testing."""
        config_data = {
            "flags": {
                "ENABLED_FLAG": {
                    "enabled": True,
                    "description": "A flag that is enabled"
                },
                "DISABLED_FLAG": {
                    "enabled": False,
                    "description": "A flag that is disabled"
                }
            }
        }
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(config_data, f)
            return Path(f.name)

    @pytest.fixture
    def feature_flags(self, temp_config: Path) -> FeatureFlags:
        """Create a FeatureFlags instance with test config."""
        return FeatureFlags(config_path=temp_config)

    def test_flag_disabled_by_default(self, feature_flags: FeatureFlags):
        """Unknown flags should return False."""
        assert feature_flags.is_enabled("UNKNOWN_FLAG") is False
        assert feature_flags.is_enabled("DOES_NOT_EXIST") is False

    def test_flag_enabled_from_config(self, feature_flags: FeatureFlags):
        """Enabled flag in config should return True."""
        assert feature_flags.is_enabled("ENABLED_FLAG") is True

    def test_flag_disabled_from_config(self, feature_flags: FeatureFlags):
        """Disabled flag in config should return False."""
        assert feature_flags.is_enabled("DISABLED_FLAG") is False

    def test_flag_case_insensitive(self, feature_flags: FeatureFlags):
        """Flag lookup should be case-insensitive."""
        assert feature_flags.is_enabled("enabled_flag") is True
        assert feature_flags.is_enabled("Enabled_Flag") is True
        assert feature_flags.is_enabled("ENABLED_FLAG") is True

    def test_override_for_testing(self, feature_flags: FeatureFlags):
        """Override should take precedence over config."""
        # Disabled flag should be False from config
        assert feature_flags.is_enabled("DISABLED_FLAG") is False

        # Override to True
        feature_flags.override("DISABLED_FLAG", True)
        assert feature_flags.is_enabled("DISABLED_FLAG") is True

        # Override unknown flag
        feature_flags.override("NEW_FLAG", True)
        assert feature_flags.is_enabled("NEW_FLAG") is True

    def test_clear_overrides(self, feature_flags: FeatureFlags):
        """Clear overrides should reset to config values."""
        feature_flags.override("DISABLED_FLAG", True)
        assert feature_flags.is_enabled("DISABLED_FLAG") is True

        feature_flags.clear_overrides()
        assert feature_flags.is_enabled("DISABLED_FLAG") is False

    def test_get_all_flags(self, feature_flags: FeatureFlags):
        """Should return all flags with their status."""
        all_flags = feature_flags.get_all()

        assert "ENABLED_FLAG" in all_flags
        assert "DISABLED_FLAG" in all_flags
        assert all_flags["ENABLED_FLAG"] is True
        assert all_flags["DISABLED_FLAG"] is False

    def test_missing_config_file(self):
        """Missing config file should result in all flags disabled."""
        flags = FeatureFlags(config_path=Path("/nonexistent/path/features.json"))

        assert flags.is_enabled("ANY_FLAG") is False
        assert flags.get_all() == {}

    def test_reload_config(self, temp_config: Path):
        """Reload should pick up config changes."""
        flags = FeatureFlags(config_path=temp_config)
        assert flags.is_enabled("ENABLED_FLAG") is True

        # Modify config file
        new_config = {
            "flags": {
                "ENABLED_FLAG": {"enabled": False, "description": "Now disabled"},
                "NEW_FLAG": {"enabled": True, "description": "New flag"}
            }
        }
        with open(temp_config, 'w') as f:
            json.dump(new_config, f)

        # Before reload, old value
        assert flags.is_enabled("ENABLED_FLAG") is True

        # After reload, new value
        flags.reload()
        assert flags.is_enabled("ENABLED_FLAG") is False
        assert flags.is_enabled("NEW_FLAG") is True


class TestFeatureFlagsIntegration:
    """Integration tests using actual config file."""

    def test_loads_real_config(self):
        """Should load the actual config/features.json file."""
        # Import the singleton which uses real config path
        from app.features import features

        # Should have loaded the config - NETWORK_OVERLAY is enabled
        assert features.is_enabled("NETWORK_OVERLAY") is True
        # NEW_SIDEBAR is disabled
        assert features.is_enabled("NEW_SIDEBAR") is False
