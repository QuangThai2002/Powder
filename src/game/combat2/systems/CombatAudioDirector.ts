import Phaser from 'phaser';

export type CombatSfxEvent =
  | 'basic'
  | 'skill'
  | 'ultimate'
  | 'hit'
  | 'crit'
  | 'evade'
  | 'heal'
  | 'shield'
  | 'cleanse'
  | 'revive'
  | 'defeat';

export const COMBAT_BGM_KEY = 'combat2-bgm';
export const COMBAT_BGM_URL = '/assets/audio/combat/user-combat-bgm.mp3';

/**
 * Combat audio stays asset-driven. The canonical user BGM is always used.
 * SFX entries are intentionally optional until matching combat assets exist;
 * missing events are silent and never fall back to Domain voices or unrelated audio.
 */
export class CombatAudioDirector {
  private bgm: Phaser.Sound.BaseSound | null = null;
  private readonly sfxKeys = new Map<CombatSfxEvent, string>();

  constructor(private readonly scene: Phaser.Scene) {}

  static preload(scene: Phaser.Scene): void {
    if (!scene.cache.audio.exists(COMBAT_BGM_KEY)) {
      scene.load.audio(COMBAT_BGM_KEY, COMBAT_BGM_URL);
    }
  }

  bindSfx(event: CombatSfxEvent, cacheKey: string): void {
    const key = String(cacheKey || '').trim();
    if (!key) this.sfxKeys.delete(event);
    else this.sfxKeys.set(event, key);
  }

  startBgm(): void {
    if (this.bgm?.isPlaying || !this.scene.cache.audio.exists(COMBAT_BGM_KEY)) return;
    try {
      if (!this.bgm) this.bgm = this.scene.sound.add(COMBAT_BGM_KEY, { loop: true, volume: 0.32 });
      this.bgm.play();
    } catch (error) {
      console.warn('[Combat2 Audio] BGM will retry after player interaction.', error);
    }
  }

  play(event: CombatSfxEvent, volume = 0.7): boolean {
    const key = this.sfxKeys.get(event);
    if (!key || !this.scene.cache.audio.exists(key)) return false;
    try {
      this.scene.sound.play(key, { volume: Phaser.Math.Clamp(volume, 0, 1) });
      return true;
    } catch (error) {
      console.warn(`[Combat2 Audio] Optional SFX ${event} could not play.`, error);
      return false;
    }
  }

  stop(): void {
    if (!this.bgm) return;
    try {
      this.bgm.stop();
      this.bgm.destroy();
    } catch { /* noop */ }
    this.bgm = null;
  }
}
