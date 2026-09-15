import type { PyroonMechanicDamageEvent } from './CombatPyroonEngine';

export type PyroonPresentationCue =
  | { kind: 'source'; unitId: string; label: string; color: string }
  | { kind: 'damage'; unitId: string; hpDamage: number; shieldDamage: number; defeated: boolean }
  | { kind: 'status' | 'focus' | 'end'; unitId: string; label: string; color: string };

/** Maps resolved state into display-only cues. It never receives mutable combat units. */
export function buildPyroonMechanicPresentation(
  event: PyroonMechanicDamageEvent,
  sourceName: string,
  targetName: string
): readonly PyroonPresentationCue[] {
  const source = String(sourceName || 'Pyroon').trim().toUpperCase();
  const target = String(targetName || 'mục tiêu').trim().toUpperCase();
  const cues: PyroonPresentationCue[] = [
    { kind: 'source', unitId: event.sourceId, label: `${source} · MỒI LỬA → ${target}`, color: '#ffbe78' },
    {
      kind: 'damage',
      unitId: event.targetId,
      hpDamage: event.hpDamage,
      shieldDamage: event.shieldDamage,
      defeated: event.defeated
    },
    {
      kind: 'status',
      unitId: event.targetId,
      label: event.burnRefreshed ? 'THIÊU ĐỐT · LÀM MỚI' : 'THIÊU ĐỐT · ÁP DỤNG',
      color: '#ff8d5c'
    }
  ];
  if (event.focusGained > 0) {
    cues.push({
      kind: 'focus',
      unitId: event.sourceId,
      label: `TẬP TRUNG +${event.focusGained} · ${event.focusAfter}/3`,
      color: '#ffd36a'
    });
  }
  if (event.markEnded) {
    cues.push({ kind: 'end', unitId: event.targetId, label: 'MỒI LỬA · KẾT THÚC', color: '#d8b39a' });
  }
  return cues;
}
