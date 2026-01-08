/**
 * Tests for feature flag utility (TDD)
 */
import { FeatureFlags } from '@/lib/features';

describe('FeatureFlags', () => {
  const testConfig = {
    flags: {
      ENABLED_FLAG: {
        enabled: true,
        description: 'A flag that is enabled',
      },
      DISABLED_FLAG: {
        enabled: false,
        description: 'A flag that is disabled',
      },
    },
  };

  let features: FeatureFlags;

  beforeEach(() => {
    features = new FeatureFlags(testConfig);
  });

  afterEach(() => {
    features.clearOverrides();
  });

  describe('isEnabled', () => {
    it('returns false for unknown flags', () => {
      expect(features.isEnabled('UNKNOWN_FLAG')).toBe(false);
      expect(features.isEnabled('DOES_NOT_EXIST')).toBe(false);
    });

    it('returns true for enabled flags in config', () => {
      expect(features.isEnabled('ENABLED_FLAG')).toBe(true);
    });

    it('returns false for disabled flags in config', () => {
      expect(features.isEnabled('DISABLED_FLAG')).toBe(false);
    });

    it('is case-insensitive', () => {
      expect(features.isEnabled('enabled_flag')).toBe(true);
      expect(features.isEnabled('Enabled_Flag')).toBe(true);
      expect(features.isEnabled('ENABLED_FLAG')).toBe(true);
    });
  });

  describe('override', () => {
    it('takes precedence over config values', () => {
      // Disabled flag should be false from config
      expect(features.isEnabled('DISABLED_FLAG')).toBe(false);

      // Override to true
      features.override('DISABLED_FLAG', true);
      expect(features.isEnabled('DISABLED_FLAG')).toBe(true);
    });

    it('works for unknown flags', () => {
      features.override('NEW_FLAG', true);
      expect(features.isEnabled('NEW_FLAG')).toBe(true);
    });

    it('is case-insensitive', () => {
      features.override('disabled_flag', true);
      expect(features.isEnabled('DISABLED_FLAG')).toBe(true);
    });
  });

  describe('clearOverrides', () => {
    it('resets to config values', () => {
      features.override('DISABLED_FLAG', true);
      expect(features.isEnabled('DISABLED_FLAG')).toBe(true);

      features.clearOverrides();
      expect(features.isEnabled('DISABLED_FLAG')).toBe(false);
    });
  });

  describe('getAll', () => {
    it('returns all flags with their status', () => {
      const allFlags = features.getAll();

      expect(allFlags).toHaveProperty('ENABLED_FLAG');
      expect(allFlags).toHaveProperty('DISABLED_FLAG');
      expect(allFlags.ENABLED_FLAG).toBe(true);
      expect(allFlags.DISABLED_FLAG).toBe(false);
    });

    it('includes overrides in results', () => {
      features.override('DISABLED_FLAG', true);
      const allFlags = features.getAll();

      expect(allFlags.DISABLED_FLAG).toBe(true);
    });
  });

  describe('empty config', () => {
    it('handles undefined config gracefully', () => {
      const emptyFeatures = new FeatureFlags();
      expect(emptyFeatures.isEnabled('ANY_FLAG')).toBe(false);
    });

    it('handles empty flags object', () => {
      const emptyFeatures = new FeatureFlags({ flags: {} });
      expect(emptyFeatures.isEnabled('ANY_FLAG')).toBe(false);
      expect(emptyFeatures.getAll()).toEqual({});
    });
  });
});
