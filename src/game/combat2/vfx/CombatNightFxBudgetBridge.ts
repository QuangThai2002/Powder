import {
  DirectionalElementProjectileVfx,
  type DirectionalProjectileOptions
} from './DirectionalElementProjectileVfx';

const FLAG = '__powderCombatNightFxBudgetInstalled';
const BALANCED_BURST_THRESHOLD = 2;

type FxTier = 'full' | 'balanced' | 'lite';

let activeProjectiles = 0;

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
    const concurrency = activeProjectiles + 1;
    const burstReducedMotion = current === 'balanced' && concurrency >= BALANCED_BURST_THRESHOLD;
    const requested = Number(options.durationMs || 0);
    const durationMs = current === 'lite'
      ? Math.min(requested > 0 ? requested : 170, 190)
      : current === 'balanced'
        ? Math.min(
            requested > 0 ? requested : burstReducedMotion ? 205 : 245,
            burstReducedMotion ? 230 : 280
          )
        : options.durationMs;

    activeProjectiles += 1;
    try {
      await previousPlay({
        ...options,
        reducedMotion: Boolean(options.reducedMotion) || current === 'lite' || burstReducedMotion,
        durationMs
      });
    } finally {
      activeProjectiles = Math.max(0, activeProjectiles - 1);
    }
  };

  root.POWDER_COMBAT2_NIGHT_FX_BUDGET = {
    version: 'night-23',
    source: 'POWDER_COMBAT2_FX_TIER',
    full: 'native-night-vfx',
    balanced: 'capped-duration-with-burst-reduced-motion',
    lite: 'reduced-motion-shards-and-short-travel',
    balancedBurstThreshold: BALANCED_BURST_THRESHOLD,
    burstGuard: true,
    fullTierPreserved: true,
    counterFinallySafe: true,
    combatLogicChanged: false
  };
}

installCombatNightFxBudgetBridge();
