import '../../../js/combat-feature-flags-v1.js';

export interface CombatFeatureFlags {
  readonly PVP_ENABLED: boolean;
  readonly DOMAIN_EXPANSION_ENABLED: boolean;
  readonly SIMPLE_DOMAIN_ENABLED: boolean;
}

const runtimeFlags = (globalThis as typeof globalThis & {
  POWDER_COMBAT_FEATURE_FLAGS_V1?: CombatFeatureFlags;
}).POWDER_COMBAT_FEATURE_FLAGS_V1;

if (!runtimeFlags) throw new Error('POWDER_COMBAT_FEATURE_FLAGS_V1 is unavailable');

export const COMBAT_FEATURE_FLAGS: CombatFeatureFlags = runtimeFlags;
