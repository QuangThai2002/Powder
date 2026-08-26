import { TurnManager } from './TurnManager';

export class ActionPipeline {
  constructor(private readonly turns: TurnManager) {}

  async execute<T>(actorId: string, action: () => Promise<T> | T): Promise<T | null> {
    if (!this.turns.lockAction(actorId)) {
      return null;
    }

    try {
      return await action();
    } catch (error) {
      console.error('[Combat2 ActionPipeline]', error);
      return null;
    } finally {
      this.turns.completeAction(actorId);
    }
  }
}
