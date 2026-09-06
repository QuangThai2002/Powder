export type Combat2BattleMode = 'pve' | 'pvp' | 'boss' | 'daily_boss' | 'dungeon' | 'event';
export type Combat2BattleResultKind = 'victory' | 'defeat' | 'draw' | 'cancel';

export type Combat2BattleRequest = Readonly<{
  version: number;
  battleId: string;
  battleMode: Combat2BattleMode;
  sourceContext: Record<string, unknown>;
  returnContext: Record<string, unknown>;
  playerTeam: string[];
  formation: { active: string[]; reserve: string[] };
  enemyTeam: string[];
  enemyConfig: Record<string, unknown>;
  battleRules: Record<string, unknown>;
  bossContext: Record<string, unknown>;
  academicContext: Record<string, unknown>;
  rewardContext: Record<string, unknown>;
  seed: string | null;
  createdAt: number;
}>;

export type Combat2BattleResult = Readonly<{
  version: number;
  battleId: string;
  battleMode: Combat2BattleMode;
  result: Combat2BattleResultKind;
  survivingState: Record<string, unknown>;
  rewardOutcome: Record<string, unknown>;
  academicOutcome: Record<string, unknown>;
  progressionOutcome: Record<string, unknown>;
  bossOutcome: Record<string, unknown>;
  returnContext: Record<string, unknown>;
  finishedAt: number;
}>;

export type Combat2AcademicQuestion = Readonly<{
  id: string;
  lessonId: string;
  conceptId: string;
  language: string;
  prompt: string;
  answer: string;
  options: string[];
  explain: string;
}>;

export type Combat2AcademicResponse = Readonly<{
  question: Combat2AcademicQuestion;
  correct: boolean;
  powId: string;
}>;

type HandoffResult<T> = { ok: true; value: T } | { ok: false; errors?: string[]; reason?: string };

type Combat2HandoffApi = {
  readBattleRequest: () => HandoffResult<Combat2BattleRequest>;
  publishBattleResult: (result: Partial<Combat2BattleResult>) => HandoffResult<Combat2BattleResult>;
  returnToMain: (result: Partial<Combat2BattleResult>) => HandoffResult<Combat2BattleResult>;
};

declare global {
  interface Window {
    POWDER_COMBAT2_HANDOFF?: Combat2HandoffApi;
  }
}

/** Accept only the Main-owned questions that Combat2 can present for an action. */
export function academicQuestionsFromContext(context: Record<string, unknown>): Combat2AcademicQuestion[] {
  const allowedLessons = new Set(Array.isArray(context.requiredLessonIds) ? context.requiredLessonIds.map(String) : []);
  const allowedConcepts = new Set(Array.isArray(context.requiredConceptIds) ? context.requiredConceptIds.map(String) : []);
  const rawQuestions = Array.isArray(context.allowedQuestionPool) ? context.allowedQuestionPool : [];
  const seen = new Set<string>();
  const questions: Combat2AcademicQuestion[] = [];

  for (const value of rawQuestions) {
    if (!value || typeof value !== 'object') continue;
    const row = value as Record<string, unknown>;
    const id = String(row.id || '').trim();
    const lessonId = String(row.lessonId || '').trim();
    const conceptId = String(row.conceptId || '').trim();
    const prompt = String(row.prompt || '').trim();
    const answer = String(row.answer || '').trim();
    const options = Array.isArray(row.options)
      ? Array.from(new Set(row.options.map((option) => String(option || '').trim()).filter(Boolean))).slice(0, 4)
      : [];
    if (!id || seen.has(id) || !lessonId || !conceptId || !prompt || !answer || options.length < 2 || !options.includes(answer)) continue;
    if (allowedLessons.size > 0 && !allowedLessons.has(lessonId)) continue;
    if (allowedConcepts.size > 0 && !allowedConcepts.has(conceptId)) continue;
    seen.add(id);
    questions.push({
      id,
      lessonId,
      conceptId,
      language: String(row.language || 'ZH').toUpperCase(),
      prompt,
      answer,
      options,
      explain: String(row.explain || '').trim()
    });
  }
  return questions;
}

export function createCombat2BattleResult(
  request: Combat2BattleRequest,
  input: Readonly<{
    result: Combat2BattleResultKind;
    survivingState: Record<string, unknown>;
    academicResponses: Combat2AcademicResponse[];
    bossOutcome?: Record<string, unknown>;
  }>
): Partial<Combat2BattleResult> {
  const responses = input.academicResponses.map(({ question, correct, powId }) => ({ question, correct, powId }));
  const answered = responses.length;
  const correct = responses.filter((response) => response.correct).length;

  return {
    battleId: request.battleId,
    battleMode: request.battleMode,
    result: input.result,
    survivingState: input.survivingState,
    rewardOutcome: { rewardId: request.rewardContext.rewardId ?? null, eligible: input.result === 'victory', applied: false },
    academicOutcome: {
      authority: request.academicContext.authority ?? null,
      responses,
      summary: { players: answered > 0 ? [{ knowledgeActions: answered, knowledgeSum: correct }] : [], answered, correct }
    },
    progressionOutcome: { stageId: request.sourceContext.stageId ?? null, bossChallengeId: request.bossContext.bossChallengeId ?? null },
    bossOutcome: input.bossOutcome ?? {},
    returnContext: request.returnContext
  };
}

function api(): Combat2HandoffApi | null {
  return typeof window === 'undefined' ? null : window.POWDER_COMBAT2_HANDOFF ?? null;
}

/** Reads the small cross-page payload; Combat2 never reaches into Main's save object. */
export function loadCombat2BattleRequest(): HandoffResult<Combat2BattleRequest> {
  const handoff = api();
  return handoff ? handoff.readBattleRequest() : { ok: false, errors: ['BattleRequest handoff is unavailable'] };
}

export function publishCombat2BattleResult(result: Partial<Combat2BattleResult>): HandoffResult<Combat2BattleResult> {
  const handoff = api();
  return handoff ? handoff.publishBattleResult(result) : { ok: false, errors: ['BattleResult handoff is unavailable'] };
}

export function returnCombat2ResultToMain(result: Partial<Combat2BattleResult>): HandoffResult<Combat2BattleResult> {
  const handoff = api();
  return handoff ? handoff.returnToMain(result) : { ok: false, errors: ['BattleResult handoff is unavailable'] };
}
