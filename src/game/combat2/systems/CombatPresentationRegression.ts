type PresentationRegressionReport = {
  playerCount: number;
  enemyCount: number;
  uniquePowCount: number;
  layers: Record<string, string>;
  fxTier: string;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[Combat2 RC Regression] ${message}`);
}

function versionOf(value: any): string {
  return String(value?.version || 'missing');
}

export function runCombatPresentationRegression(roster?: { player?: string[]; enemy?: string[] }): PresentationRegressionReport {
  const root = globalThis as any;
  const player = Array.isArray(roster?.player) ? roster!.player! : [];
  const enemy = Array.isArray(roster?.enemy) ? roster!.enemy! : [];
  const all = [...player, ...enemy];
  const unique = new Set(all);

  assert(player.length === 5, `player roster must contain 5 Pow, got ${player.length}`);
  assert(enemy.length === 5, `enemy roster must contain 5 Pow, got ${enemy.length}`);
  assert(unique.size === 10, `standalone test roster must contain 10 unique Pow, got ${unique.size}`);

  const layers: Record<string, string> = {
    actionFx: versionOf(root.POWDER_COMBAT2_ACTION_FX),
    statusFx: versionOf(root.POWDER_COMBAT2_STATUS_FX),
    reserveFx: versionOf(root.POWDER_COMBAT2_RESERVE_FX),
    ultimateFx: versionOf(root.POWDER_COMBAT2_ULTIMATE_FX),
    arenaFocus: versionOf(root.POWDER_COMBAT2_ARENA_FOCUS),
    domainStage: versionOf(root.POWDER_COMBAT2_DOMAIN_STAGE),
    powSignature: versionOf(root.POWDER_COMBAT2_POW_SIGNATURE),
    audioImpact: versionOf(root.POWDER_COMBAT2_AUDIO_IMPACT),
    performance: versionOf(root.POWDER_COMBAT2_PERFORMANCE),
    battleEnd: versionOf(root.POWDER_COMBAT2_BATTLE_END)
  };

  for (const [name, version] of Object.entries(layers)) {
    assert(version !== 'missing', `${name} is not installed`);
  }

  const tier = String(root.POWDER_COMBAT2_FX_TIER || 'missing');
  assert(['full', 'balanced', 'lite'].includes(tier), `invalid adaptive FX tier: ${tier}`);

  return {
    playerCount: player.length,
    enemyCount: enemy.length,
    uniquePowCount: unique.size,
    layers,
    fxTier: tier
  };
}
