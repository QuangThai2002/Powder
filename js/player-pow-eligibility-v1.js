(() => {
  "use strict";

  const D = window.POWDER_DATA;
  if (!D || !Array.isArray(D.pows)) {
    throw new Error("POWDER_DATA chưa sẵn sàng cho player eligibility.");
  }

  const normalizeId = (value) => String(value || "").trim().toLowerCase();
  // These IDs are the approved canonical authority; runtime roster attributes are mutable.
  const CANONICAL_HIDDEN_IDS = Object.freeze([
    "noxabyss",
    "frostmaw",
    "magmorax",
    "venomarch",
    "luxarion",
    "tempestrix",
    "starter_fire_flarion",
    "starter_water_aquelion",
    "starter_leaf_sylvion",
  ]);
  const CANONICAL_SPECIAL_STARTER_IDS = Object.freeze([
    "starter_fire_flarion",
    "starter_water_aquelion",
    "starter_leaf_sylvion",
  ]);
  const canonicalHiddenIdSet = new Set(CANONICAL_HIDDEN_IDS);
  const canonicalSpecialStarterIdSet = new Set(CANONICAL_SPECIAL_STARTER_IDS);
  const snapshot = D.pows.map((pow, index) => Object.freeze({
    id: normalizeId(pow?.id),
    element: String(pow?.element || ""),
    maxStars: Number(pow?.maxStars) || 0,
    specialStarter: pow?.specialStarter === true,
    index,
  }));
  const byId = new Map(snapshot.map((pow) => [pow.id, pow]));
  const uniqueIds = byId.size === snapshot.length && snapshot.every((pow) => pow.id);
  const hiddenIds = new Set(snapshot
    .filter((pow) => canonicalHiddenIdSet.has(pow.id))
    .map((pow) => pow.id));
  const playerIds = new Set(snapshot
    .filter((pow) => !canonicalHiddenIdSet.has(pow.id))
    .map((pow) => pow.id));
  const exactHiddenIds = hiddenIds.size === CANONICAL_HIDDEN_IDS.length
    && CANONICAL_HIDDEN_IDS.every((id) => hiddenIds.has(id));

  const invariant = Object.freeze({
    canonicalTotal: snapshot.length,
    playerVisible: playerIds.size,
    hidden: hiddenIds.size,
    canonicalHiddenIds: [...CANONICAL_HIDDEN_IDS],
    exactHiddenIds,
    valid: uniqueIds && snapshot.length === 99 && playerIds.size === 90 && hiddenIds.size === 9 && exactHiddenIds,
  });

  // Player runtime fails closed if this stable pre-mutation catalog invariant drifts.
  function isPlayerEligible(value) {
    if (!invariant.valid) return false;
    const id = normalizeId(typeof value === "object" ? value?.id : value);
    return playerIds.has(id);
  }

  function filterPlayerPows(list) {
    return (Array.isArray(list) ? list : []).filter(isPlayerEligible);
  }

  function isPlayerAcquisitionEligible(value) {
    if (!isPlayerEligible(value)) return false;
    const id = normalizeId(typeof value === "object" ? value?.id : value);
    return !canonicalSpecialStarterIdSet.has(id);
  }

  function filterPlayerAcquisitionPows(list) {
    return (Array.isArray(list) ? list : []).filter(isPlayerAcquisitionEligible);
  }

  const preferredReplacement = Object.freeze({
    noxabyss: "umbrael",
    frostmaw: "glacior",
    magmorax: "calderion",
    venomarch: "vilexis",
    luxarion: "solarion",
    tempestrix: "zephyrion",
    starter_fire_flarion: "pyroon",
    starter_water_aquelion: "aquabub",
    starter_leaf_sylvion: "mosshorn",
  });

  function stableHash(value) {
    let hash = 2166136261;
    for (const char of String(value || "")) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function resolvePlayerPowId(value) {
    const id = normalizeId(value);
    if (isPlayerEligible(id)) return id;
    if (!invariant.valid || !byId.has(id)) return null;
    const preferred = preferredReplacement[id];
    if (preferred && playerIds.has(preferred)) return preferred;
    const source = byId.get(id);
    const sameElement = snapshot.filter((pow) => playerIds.has(pow.id) && pow.element === source.element);
    const candidates = sameElement.length ? sameElement : snapshot.filter((pow) => playerIds.has(pow.id));
    return candidates.length ? candidates[stableHash(id) % candidates.length].id : null;
  }

  function containsHiddenPow(ids) {
    return (Array.isArray(ids) ? ids : []).some((id) => hiddenIds.has(normalizeId(id)));
  }

  function sanitizeEnemyIds(ids) {
    if (!invariant.valid) return [];
    return (Array.isArray(ids) ? ids : []).map(resolvePlayerPowId).filter(Boolean);
  }

  function sanitizeStage(stage) {
    if (!stage || typeof stage !== "object" || !invariant.valid) return null;
    const enemyIds = sanitizeEnemyIds(stage.enemyIds);
    if (!enemyIds.length) return null;
    return {
      ...stage,
      enemyIds,
      enemyCount: Math.max(1, Math.min(enemyIds.length, Number(stage.enemyCount) || enemyIds.length)),
    };
  }

  function filterPlayerHistory(history) {
    return (Array.isArray(history) ? history : []).filter((entry) => isPlayerEligible(entry?.powId));
  }

  if (!invariant.valid) {
    console.error("[Powder player eligibility] canonical snapshot invariant failed", invariant);
  }

  window.POWDER_PLAYER_POW_ELIGIBILITY_V1 = Object.freeze({
    version: "1.0.0",
    diagnostics: () => ({ ...invariant }),
    canonicalHiddenIds: CANONICAL_HIDDEN_IDS,
    canonicalSpecialStarterIds: CANONICAL_SPECIAL_STARTER_IDS,
    isPlayerEligible,
    filterPlayerPows,
    isPlayerAcquisitionEligible,
    filterPlayerAcquisitionPows,
    filterPlayerHistory,
    containsHiddenPow,
    resolvePlayerPowId,
    sanitizeEnemyIds,
    sanitizeStage,
  });
})();
