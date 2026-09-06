import type Phaser from 'phaser';

declare global {
  /**
   * VFX helpers provide their target internally, so callers should only define
   * animation properties. Completion handlers are owned by the helper too.
   */
  type CombatTweenConfig = Omit<
    Phaser.Types.Tweens.TweenBuilderConfig,
    'targets' | 'onComplete' | 'onStop'
  >;
}

export {};
