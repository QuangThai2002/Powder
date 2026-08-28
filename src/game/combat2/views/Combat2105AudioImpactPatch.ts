import type Phaser from 'phaser';
import { COMBAT_DISPLAY_FONT } from './CombatTheme';

const PATCH_FLAG = '__powderCombat2105AudioImpactInstalled';
const AUDIO_STATE_KEY = '__powderCombat2105AudioState';

type Cue = 'cast' | 'travel' | 'hit' | 'crit' | 'support' | 'control' | 'enter' | 'defeat';

type AudioState = {
  context: AudioContext | null;
  master: GainNode | null;
  armed: boolean;
  enabled: boolean;
  volume: number;
};

function rootState(): AudioState {
  const root = globalThis as any;
  if (!root[AUDIO_STATE_KEY]) {
    root[AUDIO_STATE_KEY] = { context: null, master: null, armed: false, enabled: true, volume: 0.055 } as AudioState;
  }
  return root[AUDIO_STATE_KEY] as AudioState;
}

function norm(value: unknown): string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

function elementPitch(element: unknown): number {
  const key = norm(element);
  if (key.includes('fire') || key.includes('lua') || key.includes('lava')) return 185;
  if (key.includes('water') || key.includes('nuoc')) return 238;
  if (key.includes('ice') || key.includes('bang')) return 330;
  if (key.includes('lightning') || key.includes('set') || key.includes('storm') || key.includes('bao')) return 420;
  if (key.includes('leaf') || key.includes('la')) return 285;
  if (key.includes('poison') || key.includes('doc')) return 155;
  if (key.includes('earth') || key.includes('dat')) return 110;
  if (key.includes('steel') || key.includes('thep')) return 145;
  if (key.includes('wind') || key.includes('gio')) return 360;
  if (key.includes('light') || key.includes('anh sang')) return 520;
  if (key.includes('dark') || key.includes('bong toi')) return 92;
  return 250;
}

function ensureAudio(): AudioState {
  const state = rootState();
  if (!state.enabled || typeof window === 'undefined') return state;
  if (!state.context) {
    const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtor) return state;
    try {
      state.context = new AudioCtor();
      state.master = state.context.createGain();
      state.master.gain.value = state.volume;
      state.master.connect(state.context.destination);
    } catch {
      state.context = null;
      state.master = null;
    }
  }
  return state;
}

function armAudio(): void {
  const state = ensureAudio();
  if (state.armed) return;
  state.armed = true;
  const resume = (): void => {
    const current = ensureAudio();
    if (current.context?.state === 'suspended') void current.context.resume().catch(() => undefined);
  };
  window.addEventListener('pointerdown', resume, { passive: true });
  window.addEventListener('keydown', resume, { passive: true });
}

function tone(cue: Cue, element: unknown, strength = 1): void {
  const state = ensureAudio();
  const ctx = state.context;
  const master = state.master;
  if (!state.enabled || !ctx || !master || ctx.state !== 'running' || document.hidden) return;

  const now = ctx.currentTime;
  const base = elementPitch(element);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const safeStrength = Math.max(0.55, Math.min(1.6, strength));

  let startHz = base;
  let endHz = base * 0.76;
  let duration = 0.095;
  let peak = 0.16 * safeStrength;
  let waveform: OscillatorType = 'sine';

  if (cue === 'cast') { startHz = base * 0.72; endHz = base * 1.22; duration = 0.11; peak = 0.09 * safeStrength; waveform = 'triangle'; }
  if (cue === 'travel') { startHz = base * 1.15; endHz = base * 0.84; duration = 0.075; peak = 0.07 * safeStrength; waveform = 'sine'; }
  if (cue === 'hit') { startHz = Math.max(70, base * 0.62); endHz = Math.max(48, base * 0.34); duration = 0.085; peak = 0.18 * safeStrength; waveform = 'square'; }
  if (cue === 'crit') { startHz = base * 1.55; endHz = base * 0.6; duration = 0.13; peak = 0.2 * safeStrength; waveform = 'sawtooth'; }
  if (cue === 'support') { startHz = base * 0.9; endHz = base * 1.35; duration = 0.14; peak = 0.08 * safeStrength; waveform = 'sine'; }
  if (cue === 'control') { startHz = base * 0.55; endHz = base * 0.48; duration = 0.16; peak = 0.08 * safeStrength; waveform = 'triangle'; }
  if (cue === 'enter') { startHz = base * 0.78; endHz = base * 1.18; duration = 0.12; peak = 0.1 * safeStrength; waveform = 'triangle'; }
  if (cue === 'defeat') { startHz = base * 0.72; endHz = Math.max(45, base * 0.26); duration = 0.18; peak = 0.11 * safeStrength; waveform = 'sawtooth'; }

  osc.type = waveform;
  osc.frequency.setValueAtTime(startHz, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(35, endHz), now + duration);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(cue === 'hit' || cue === 'defeat' ? 1300 : 2600, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function noiseHit(element: unknown, strength = 1): void {
  const state = ensureAudio();
  const ctx = state.context;
  const master = state.master;
  if (!state.enabled || !ctx || !master || ctx.state !== 'running' || document.hidden) return;
  const duration = reducedMotion() ? 0.025 : 0.045;
  const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  filter.type = 'bandpass';
  filter.frequency.value = Math.max(260, elementPitch(element) * 3.2);
  filter.Q.value = 0.7;
  gain.gain.value = 0.11 * Math.max(0.5, Math.min(1.5, strength));
  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start();
}

function powElement(view: any): unknown {
  return view?.pow?.elementKey ?? view?.pow?.element ?? '';
}

function installPowViewAudio(PowViewClass: any): void {
  const proto = PowViewClass.prototype as any;
  const originalAttack = proto.playAttackLunge;
  const originalTravel = proto.playElementTravel;
  const originalHit = proto.playHit;
  const originalStatus = proto.playStatusPulse;
  const originalEnter = proto.enterField;
  const originalRetire = proto.retireFromField;

  if (typeof originalAttack === 'function') {
    proto.playAttackLunge = async function combat2125Attack(this: any, targetX: number, targetY: number): Promise<void> {
      // Cast audio belongs to action start. Travel audio is bound separately to the real projectile start below.
      tone('cast', powElement(this), 0.9);
      await originalAttack.call(this, targetX, targetY);
    };
  }

  if (typeof originalTravel === 'function') {
    proto.playElementTravel = async function combat2125Travel(this: any, targetX: number, targetY: number): Promise<void> {
      // Bind audio to the actual visual travel phase instead of guessing with a fixed timeout.
      tone('travel', powElement(this), 0.9);
      await originalTravel.call(this, targetX, targetY);
    };
  }

  if (typeof originalHit === 'function') {
    proto.playHit = async function combat2125Hit(this: any): Promise<void> {
      // Fire exactly when the target's hit reaction starts so sound and motion read as one impact.
      tone('hit', powElement(this), 1.05);
      noiseHit(powElement(this), 0.85);
      await originalHit.call(this);
    };
  }

  if (typeof originalStatus === 'function') {
    proto.playStatusPulse = async function combat2125Status(this: any): Promise<void> {
      const status = norm(this.runtimeVisualStatus);
      const support = !['dong bang', 'choang', 'te liet', 'cam lang', 'freeze', 'stun', 'paralysis', 'silence'].some((key) => status.includes(key));
      tone(support ? 'support' : 'control', powElement(this), 0.72);
      await originalStatus.call(this);
    };
  }

  if (typeof originalEnter === 'function') {
    proto.enterField = async function combat2125Enter(this: any, x: number, y: number): Promise<void> {
      tone('enter', powElement(this), 0.8);
      await originalEnter.call(this, x, y);
    };
  }

  if (typeof originalRetire === 'function') {
    proto.retireFromField = async function combat2125Retire(this: any, x: number, y: number): Promise<void> {
      tone('defeat', powElement(this), 0.95);
      await originalRetire.call(this, x, y);
    };
  }
}

function installVersionIntro(BattleSceneClass: any): void {
  const proto = BattleSceneClass.prototype as any;
  proto.showPreBattleIntro = function combat2125Intro(this: Phaser.Scene & { startCombatFlow?: () => void }): void {
    const { width, height } = this.scale;
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x02080e, 0.42);
    const plate = this.add.rectangle(width / 2, height / 2, Math.min(820, width * 0.84), 144, 0x081d2a, 0.96).setStrokeStyle(2, 0xd7b86c, 0.78);
    const title = this.add.text(width / 2, height / 2 - 22, 'POWDER COMBAT 2.12.5', {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: height > width ? '31px' : '36px', color: '#fff6df', fontStyle: 'bold'
    }).setOrigin(0.5);
    const sub = this.add.text(width / 2, height / 2 + 24, 'CONTACT-TIMED AUDIO · CAST → TRAVEL → HIT', {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: '13px', color: '#bfefff', fontStyle: 'bold'
    }).setOrigin(0.5);
    const intro = this.add.container(0, 0, [shade, plate, title, sub]).setDepth(108);
    this.tweens.add({ targets: intro, alpha: 0, delay: 650, duration: 220, ease: 'Quad.easeOut', onComplete: () => { intro.destroy(true); this.startCombatFlow?.(); } });
    if (['localhost', '127.0.0.1'].includes(location.hostname)) {
      this.add.text(width - 18, height - 58, '2.12.5 · CONTACT AUDIO SYNC', {
        fontFamily: COMBAT_DISPLAY_FONT, fontSize: '11px', color: '#dff8ff', fontStyle: 'bold', backgroundColor: '#04101899', padding: { x: 7, y: 4 }
      }).setOrigin(1, 1).setDepth(99).setAlpha(0.72);
    }
  };
}

export function installCombat2105AudioImpactPatch(BattleSceneClass: any, PowViewClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;
  armAudio();
  installPowViewAudio(PowViewClass);
  installVersionIntro(BattleSceneClass);

  const state = rootState();
  root.POWDER_COMBAT2_AUDIO_IMPACT = {
    version: '2.12.5',
    mode: 'event-bound-cast-travel-hit-sync',
    timing: {
      cast: 'attack-start',
      travel: 'projectile-start',
      hit: 'target-reaction-start'
    },
    performance: ['no-fixed-travel-timer', 'one-shot-web-audio', 'no-frame-loop'],
    get enabled(): boolean { return state.enabled; },
    set enabled(value: boolean) { state.enabled = Boolean(value); },
    get volume(): number { return state.volume; },
    set volume(value: number) {
      state.volume = Math.max(0, Math.min(0.12, Number(value) || 0));
      if (state.master) state.master.gain.value = state.volume;
    }
  };
}
