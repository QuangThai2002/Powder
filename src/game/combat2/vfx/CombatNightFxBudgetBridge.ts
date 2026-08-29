import {
  DirectionalElementProjectileVfx,
  type DirectionalProjectileOptions
} from './DirectionalElementProjectileVfx';

const FLAG = '__powderCombatNightFxBudgetInstalled';

type FxTier = 'full' | 'balanced' | 'lite';

function tier(): FxTier {
  const value = String((globalThis as any).POWDER_COMBAT2_FX_TIER || 'full');
  return value === 'lite' || value === 'balanced' ? value : 'full';
}

export function installCombatNightFxBudgetBridge(): void {
  const root = globalThis as any;
  if (root[FLAG]) return;
  root[FLAG] = true;

  const owner = DirectionalElementProjectileVfx as any;
  const previousPlay = owner.play?.bind(DirectionalElementProjectileVfx) as
    | ((options: DirectionalProjectileOptions) => Promise<void>)
    | undefined;
  if (!previousPlay) return;

  owner.play = async (options: DirectionalProjectileOptions): Promise<void> => {
    const current = tier();
    const requested = Number(options.durationMs || 0);
    const durationMs = current === 'lite'
      ? Math.min(requested > 0 ? requested : 170, 190)
      : current === 'balanced'
        ? Math.min(requested > 0 ? requested : 245, 280)
        : options.durationMs;

    await previousPlay({
      ...options,
      reducedMotion: Boolean(options.reducedMotion) || current === 'lite',
      durationMs
    });
  };

  root.POWDER_COMBAT2_NIGHT_FX_BUDGET = {
    version: 'night-12',
    source: 'POWDER_COMBAT2_FX_TIER',
    full: 'native-night-vfx',
    balanced: 'capped-projectile-duration',
    lite: 'reduced-motion-shards-and-short-travel'
  };
}

installCombatNightFxBudgetBridge();
