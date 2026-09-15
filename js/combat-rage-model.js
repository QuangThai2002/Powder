(function () {
  'use strict';

  const rules = Object.freeze({
    version: 'rage-points-v1', gainRule: 'event-start-v2',
    ready: 4, max: 8, start: 0, actionGain: 2,
    ultimateCost: 4, exclusiveCost: 4, overflowRate: 0.5
  });
  const playerScale = Object.freeze({ pointsPerInternal: 25, ready: 100, max: 200, ultimateCost: 100 });

  function sanitizeRagePoints(value) {
    return Number.isFinite(value) ? Math.min(rules.max, Math.max(0, Math.floor(value))) : 0;
  }

  // Contributions must already be in canonical Rage points, never legacy Mana.
  function totalRawGain(contributions) {
    const sources = Array.isArray(contributions) ? contributions : [contributions];
    return sources.reduce((sum, value) => {
      if (!Number.isFinite(value) || value <= 0) return sum;
      return Math.min(Number.MAX_SAFE_INTEGER, sum + value);
    }, 0);
  }

  function applyRageEvent(current, contributions, spent = 0) {
    const previous = sanitizeRagePoints(current);
    if (!Number.isInteger(spent) || spent < 0 || spent > previous) {
      throw new Error('[Powder Rage] Invalid resource spend.');
    }
    const rawGain = totalRawGain(contributions);
    // Decide once from the event's starting balance, before spend or any gain.
    const reduced = previous >= rules.ready;
    const normalRaw = reduced ? 0 : rawGain;
    const overflowRaw = reduced ? rawGain : 0;
    const overflowEffective = Math.floor(overflowRaw * rules.overflowRate);
    const next = sanitizeRagePoints(previous - spent + normalRaw + overflowEffective);
    return {
      previous, rawGain, normalRaw, overflowRaw, overflowEffective,
      effectiveGain: next - (previous - spent), next
    };
  }

  function applyRawRageGain(current, contributions) {
    return applyRageEvent(current, contributions);
  }

  function canUseUltimate(value) {
    return sanitizeRagePoints(value) >= rules.ready;
  }

  function spendUltimate(value) {
    return applyRageEvent(value, 0, rules.ultimateCost).next;
  }

  function rageMarkerStates(value) {
    const points = sanitizeRagePoints(value);
    const red = Math.max(0, points - rules.ready);
    const blue = points - red * 2;
    return [...Array(blue).fill('blue'), ...Array(red).fill('red'), ...Array(4 - blue - red).fill('empty')];
  }

  function toPlayerRagePoints(value) {
    return sanitizeRagePoints(value) * playerScale.pointsPerInternal;
  }

  function formatPlayerRageBalance(value, maximum = rules.max) {
    return `NỘ ${toPlayerRagePoints(value)}/${toPlayerRagePoints(maximum)}`;
  }

  function formatPlayerRageCost(value) {
    return `${toPlayerRagePoints(value)} Nộ`;
  }

  function formatPlayerRageGain(value) {
    return `NỘ +${toPlayerRagePoints(value)}`;
  }

  function formatPlayerRageSpend(spent, remaining) {
    return `NỘ -${toPlayerRagePoints(spent)} · CÒN ${toPlayerRagePoints(remaining)}`;
  }

  globalThis.POWDER_COMBAT_RAGE_MODEL = Object.freeze({
    rules, playerScale, sanitizeRagePoints, totalRawGain, applyRageEvent,
    applyRawRageGain, canUseUltimate, spendUltimate, rageMarkerStates,
    toPlayerRagePoints, formatPlayerRageBalance, formatPlayerRageCost,
    formatPlayerRageGain, formatPlayerRageSpend
  });
})();
