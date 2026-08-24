# Powder 21.1.2 — Academic Learning Design Direction

This design note is staged on the 21.1.1 branch only to record the next release direction after onboarding is merged.

## Goal
Strengthen Powder as a serious language-learning system, not just add more multiple-choice questions.

## Core learning architecture
- 7 question families: Recognition, Recall, Grammar, Context, Reading, Production, Application.
- 70+ question archetypes available to the engine, while each lesson activates only rank-appropriate archetypes.
- Never generate unseen knowledge: candidates must come from learned/current lesson/current rank/SRS-due data.
- No same learning-unit + same archetype repeat inside a single session unless an explicit remediation loop requires it.
- Track mastery by learning unit and by dimension, e.g. meaning, Hanzi, Pinyin, grammar use, context, production.
- Preserve Chinese 2/3 and English 1/3 curriculum direction; HSK1 beginner material remains explanation-first, while higher ranks unlock richer productive tasks.

## Benchmark principles
- Moodle: reusable question bank + multiple interaction types + immediate/adaptive feedback.
- Open edX: mobile-ready input types, explicit hints/feedback, accepted text variants.
- Anki/FSRS direction: review scheduling should be driven by recall quality/history, not random repetition.

## Release safety
21.1.2 will be additive around the current learning model. It must not silently change rewards, boss costs, rank gates, combat balance, economy, save authority, or introduce unseen curriculum material.
