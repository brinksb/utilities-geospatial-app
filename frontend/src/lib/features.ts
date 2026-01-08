/**
 * Feature flag utility using JSON config.
 *
 * Designed as precursor to database-backed flags - same structure.
 *
 * Usage:
 *   import { features } from '@/lib/features';
 *
 *   if (features.isEnabled('NETWORK_OVERLAY')) {
 *     return <NetworkOverlay />;
 *   }
 */

type FlagConfig = {
  enabled: boolean;
  description?: string;
};

type FlagsData = {
  flags: Record<string, FlagConfig>;
};

export class FeatureFlags {
  private flags: Record<string, FlagConfig>;
  private overrides: Map<string, boolean> = new Map();

  constructor(config?: FlagsData) {
    this.flags = config?.flags ?? {};
  }

  /**
   * Check if a feature flag is enabled.
   * @param flag Flag name (case-insensitive)
   * @returns True if flag is enabled, false otherwise
   */
  isEnabled(flag: string): boolean {
    const upperFlag = flag.toUpperCase();

    // Check test overrides first
    if (this.overrides.has(upperFlag)) {
      return this.overrides.get(upperFlag)!;
    }

    // Check config
    return this.flags[upperFlag]?.enabled ?? false;
  }

  /**
   * Override a flag value for testing.
   * @param flag Flag name (case-insensitive)
   * @param enabled Value to set
   */
  override(flag: string, enabled: boolean): void {
    this.overrides.set(flag.toUpperCase(), enabled);
  }

  /**
   * Clear all test overrides.
   */
  clearOverrides(): void {
    this.overrides.clear();
  }

  /**
   * Get all flags and their status.
   * @returns Object mapping flag names to their enabled status
   */
  getAll(): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    for (const name of Object.keys(this.flags)) {
      result[name] = this.isEnabled(name);
    }
    return result;
  }

  /**
   * Initialize/update flags from config data.
   * Useful for loading config dynamically.
   */
  loadConfig(config: FlagsData): void {
    this.flags = config.flags ?? {};
  }
}

// Singleton instance - starts empty, can be initialized with loadConfig()
// Or import config statically if available at build time
export const features = new FeatureFlags();
