"""Feature flag utility using JSON config.

Designed as precursor to database-backed flags - same structure.

Usage:
    from app.features import features

    if features.is_enabled("NETWORK_OVERLAY"):
        return network_overlay_response()
"""
import json
from pathlib import Path
from typing import Optional


class FeatureFlags:
    """Feature flag utility using JSON config."""

    def __init__(self, config_path: Optional[Path] = None):
        """Initialize feature flags from config file.

        Args:
            config_path: Path to JSON config file. Defaults to config/features.json
                        relative to project root.
        """
        if config_path is None:
            # In Docker: /config/features.json (mounted from project root)
            # Locally: resolve relative to __file__ (backend/app/features.py)
            docker_path = Path("/config/features.json")
            local_path = Path(__file__).parent.parent.parent / "config" / "features.json"
            self._config_path = docker_path if docker_path.exists() else local_path
        else:
            self._config_path = config_path

        self._flags: dict[str, dict] = {}
        self._overrides: dict[str, bool] = {}  # For testing
        self.reload()

    def reload(self) -> None:
        """Reload flags from config file."""
        if self._config_path.exists():
            with open(self._config_path) as f:
                data = json.load(f)
                self._flags = data.get("flags", {})
        else:
            self._flags = {}

    def is_enabled(self, flag: str) -> bool:
        """Check if a feature flag is enabled.

        Args:
            flag: Flag name (case-insensitive)

        Returns:
            True if flag is enabled, False otherwise
        """
        upper_flag = flag.upper()

        # Check test overrides first
        if upper_flag in self._overrides:
            return self._overrides[upper_flag]

        # Check config
        flag_config = self._flags.get(upper_flag, {})
        return flag_config.get("enabled", False)

    def override(self, flag: str, enabled: bool) -> None:
        """Override a flag value for testing.

        Args:
            flag: Flag name (case-insensitive)
            enabled: Value to set
        """
        self._overrides[flag.upper()] = enabled

    def clear_overrides(self) -> None:
        """Clear all test overrides."""
        self._overrides.clear()

    def get_all(self) -> dict[str, bool]:
        """Get all flags and their status.

        Returns:
            Dict mapping flag names to their enabled status
        """
        return {
            name: self.is_enabled(name)
            for name in self._flags.keys()
        }


# Singleton instance using default config path
features = FeatureFlags()
