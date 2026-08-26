import {
  RAGE_MAX_POINTS,
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
  assert(applyRawRageGain(0, 6).next === 5, '0 + raw6 must equal 5');
  assert(applyRawRageGain(0, 8).next === 6, '0 + raw8 must equal 6');
  assert(applyRawRageGain(0, 9).next === 6, '0 + raw9 must floor overflow to 6');
  assert(applyRawRageGain(4, 3).next === 5, 'gain above threshold must be halved and floored');
  assert(applyRawRageGain(8, 99).next === RAGE_MAX_POINTS, 'rage must cap at 8');
  assert(!canUseUltimate(3), '3 rage must not enable Ultimate');
  assert(canUseUltimate(4), '4 rage must enable Ultimate');
  assert(spendUltimate(6) === 2, 'Ultimate from 6 rage must leave 2');

  const six = rageMarkerStates(6);
  assert(six.join(',') === 'blue,blue,red,red', '6 rage must render 2 blue + 2 red markers');
  const eight = rageMarkerStates(8);
  assert(eight.every((marker) => marker === 'red'), '8 rage must render four red markers');

  return { rageEconomyChecked: true, markerMappingChecked: true };
}
