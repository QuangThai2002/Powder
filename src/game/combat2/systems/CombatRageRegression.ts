import {
  RAGE_MAX_POINTS,
  applyRageEvent,
  applyRawRageGain,
  canUseUltimate,
  rageMarkerStates,
  spendUltimate
} from './CombatRageEngine';

export interface CombatRageRegressionReport {
  rageEconomyChecked: boolean;
  markerMappingChecked: boolean;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[Combat2 Rage Regression] ${message}`);
}

export function runCombatRageRegression(): CombatRageRegressionReport {
  assert(applyRawRageGain(0, 2).next === 2, '0 + raw2 must equal 2');
  assert(applyRawRageGain(0, 3).next === 3, '0 + raw3 must equal 3');
  assert(applyRawRageGain(0, 6).next === 6, 'an event starting below 4 receives its full gain');
  assert(applyRawRageGain(0, 8).next === 8, '0 + raw8 must equal 8');
  assert(applyRawRageGain(0, 9).next === 8, '0 + raw9 must clamp to 8');
  assert(applyRawRageGain(3, [2, 1, 1]).next === 7, 'crossing 4 within one event must not reduce gain');
  assert(applyRawRageGain(4, [2, 1, 1]).next === 6, 'aggregate action + passive + artifact before halving');
  assert(applyRawRageGain(4, [1, 1]).next === 5, 'two +1 sources must not be rounded separately');
  assert(applyRawRageGain(4, [0.5, 0.5, 1]).next === 5, 'sum valid fractional modifiers before rounding');
  for (let raw = 1; raw <= 8; raw += 1) {
    assert(applyRawRageGain(4, raw).next === 4 + Math.floor(raw * 0.5), `ready + raw${raw}`);
  }
  for (let rage = 4; rage <= 8; rage += 1) {
    assert(spendUltimate(rage) === rage - 4, `Ultimate must preserve surplus from ${rage}`);
  }
  assert(applyRageEvent(4, [1, 1], 4).next === 1, 'Ultimate gain uses pre-event balance, not post-spend balance');
  assert(applyRawRageGain(4, 3).next === 5, 'gain above threshold must be halved and floored');
  assert(applyRawRageGain(8, 99).next === RAGE_MAX_POINTS, 'rage must cap at 8');
  assert(!canUseUltimate(3), '3 rage must not enable Ultimate');
  assert(canUseUltimate(4), '4 rage must enable Ultimate');
  assert(spendUltimate(6) === 2, 'Ultimate from 6 rage must leave 2');
  for (let rage = 0; rage <= 8; rage += 1) {
    const markers = rageMarkerStates(rage);
    assert(markers.length === 4, 'UI must retain four markers');
    assert(markers.filter((marker) => marker === 'red').length === Math.max(0, rage - 4), 'overflow must be red');
    assert(canUseUltimate(rage) === (rage >= 4), 'readiness must follow canonical threshold');
  }

  const six = rageMarkerStates(6);
  assert(six.join(',') === 'blue,blue,red,red', '6 rage must render 2 blue + 2 red markers');
  const eight = rageMarkerStates(8);
  assert(eight.every((marker) => marker === 'red'), '8 rage must render four red markers');

  return { rageEconomyChecked: true, markerMappingChecked: true };
}
