import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  cloze,
  grade,
  normalize,
  contentKey,
  empty,
  merge,
  parse,
  record,
  validateBackup,
  type Result,
  type StudyTask,
} from "./core";
import {
  attachStudyContexts,
  exerciseWord,
  getUsage,
  inspectUsageEntry,
  usageEntries,
} from "./usage";
import { analyzeLearning } from "./analytics";
import { rebaseState } from "./storage";
import { cloudPayload, mergeCloudState } from "./sync";
import { assessLearningAnswer } from "./assessment";

const corpus = parse(readFileSync("public/data/vocabulary.txt", "utf8"));
const corpusById = new Map(corpus.map((word) => [word.id, word]));
const target = corpus.find((word) => word.word === "suggest")!;
const setup = () => merge(empty(), [target], "default");
const task = (): StudyTask => ({
  id: target.id,
  skill: 4,
  review: "next-review",
});
const DAY = 86_400_000;
function result(overrides: Partial<Result> = {}): Result {
  return {
    id: "previous",
    wordId: target.id,
    time: Date.now() - 8 * DAY,
    skill: 4,
    answer: target.word,
    correct: true,
    hint: false,
    method: "rule",
    elapsed: 1200,
    session: "previous-session",
    review: "previous-review",
    gap: 0,
    first: true,
    independent: true,
    evidenceVersion: 2,
    scheduled: true,
    exposureGap: 8 * DAY,
    contentVersion: contentKey(target, 4),
    ...overrides,
  };
}

describe("source-reviewed usage and contextual recall", () => {
  it("ships 203 distinct, complete, sense-matched supplements with real source receipts", () => {
    // New entries have their own exhaustive review/coverage suite. Check every
    // unversioned entry here rather than revalidating 5,383 modern records just
    // to discard them, and still reject any unrecognized legacy candidate.
    const curated = usageEntries.filter((entry) => entry.review === undefined);
    expect(curated).toHaveLength(203);
    expect(new Set(curated.map((entry) => entry.wordId)).size).toBe(203);
    expect(new Set(curated.map((entry) => entry.example.id)).size).toBe(203);
    for (const entry of curated) {
      const word = corpusById.get(entry.wordId)!;
      expect(word, entry.wordId).toBeDefined();
      expect(inspectUsageEntry(entry, word).legacy, entry.wordId).toBe(true);
      expect(getUsage(word), entry.wordId).toBe(entry);
      expect(entry.patterns.length).toBeGreaterThan(0);
      for (const pattern of entry.patterns) {
        expect(pattern.form.trim()).not.toBe("");
        expect(pattern.explanation.trim()).not.toBe("");
      }
      expect(entry.note?.trim()).not.toBe("");
      expect(entry.mistake).toBeDefined();
      if (entry.mistake) {
        for (const text of Object.values(entry.mistake))
          expect(text.trim()).not.toBe("");
        expect(entry.mistake.incorrect).not.toBe(entry.mistake.correct);
      }
      expect(entry.example.en).not.toBe(word.example_en);
      expect(entry.example.vi.trim()).not.toBe("");
      expect(cloze({ ...word, example_en: entry.example.en })).not.toBe(
        entry.example.en,
      );
      expect(entry.sources.length).toBeGreaterThan(0);
      for (const source of entry.sources) {
        const url = new URL(source.url);
        expect(url.protocol).toBe("https:");
        expect(url.hostname).toBe("www.oxfordlearnersdictionaries.com");
        expect(url.pathname).toMatch(
          /^\/definition\/(?:american_english|english)\//,
        );
        expect(source.title.toLowerCase()).toContain("oxford");
        expect(source.sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(Number.isFinite(Date.parse(source.checkedAt))).toBe(true);
      }
    }
  });

  it("keeps reviewed alternative answers local to their exact example and never credits target recall", () => {
    for (const entry of usageEntries) {
      const word = corpusById.get(entry.wordId)!;
      const alternatives = entry.example.alternatives || [];
      expect(new Set(alternatives.map(normalize)).size, entry.headword).toBe(
        alternatives.length,
      );
      const exercise = {
        ...word,
        example_en: entry.example.en,
        example_vi: entry.example.vi,
      };
      for (const answer of alternatives) {
        expect(answer.trim(), entry.headword).not.toBe("");
        expect(grade(answer, word), `${entry.headword}: ${answer}`).toBe(false);
        expect(
          assessLearningAnswer(answer, exercise, 4, corpus, alternatives)
            .outcome,
          `${entry.headword}: ${answer}`,
        ).toBe("ungraded");
      }
    }
  });

  it("covers the expanded noun groups with explicit sense-scoped countability and accepts the reviewed US form", () => {
    const nouns = [
      "evidence",
      "knowledge",
      "progress",
      "homework",
      "permission",
      "employment",
      "money",
      "traffic",
      "weather",
      "damage",
      "behaviour",
      "opportunity",
      "health",
      "education",
      "transport",
      "clothing",
      "job",
      "task",
      "business",
      "service",
      "room",
      "space",
      "time",
      "paper",
      "glass",
      "chicken",
      "hair",
      "ability",
      "attention",
      "access",
      "effect",
      "success",
    ];
    for (const headword of nouns) {
      const entry = usageEntries.find(
        (candidate) => candidate.headword === headword,
      );
      expect(entry, headword).toBeDefined();
      expect(entry!.countability?.trim(), headword).toBeTruthy();
      const word = corpusById.get(entry!.wordId)!;
      expect(word.part_of_speech).toBe("noun");
      const exercise = { ...word, example_en: entry!.example.en };
      expect(cloze(exercise), headword).not.toBe(exercise.example_en);
    }
    const behavior = corpus.find((word) => word.word === "behaviour")!;
    expect(grade("behavior", behavior)).toBe(true);
    expect(grade("behaviour", behavior)).toBe(true);
  });

  it("does not attach a different sense or POS to a personal edit", () => {
    expect(
      getUsage({ ...target, meaning_vi: "nghĩa do tôi sửa" }),
    ).toBeUndefined();
    expect(getUsage({ ...target, part_of_speech: "noun" })).toBeUndefined();
    expect(getUsage({ ...target, word: "suggestion" })).toBeUndefined();
    expect(getUsage({ ...target, id: "personal-suggest" })).toBeUndefined();
    expect(getUsage({ ...target, note: "ghi chú của tôi" })).toBeDefined();
  });

  it("keeps an unseen word on its original context without mutating the session or state", () => {
    const state = setup();
    const queue = [task(), { ...task(), skill: 3 }];
    const before = structuredClone({ state, queue });
    expect(attachStudyContexts(state, queue)).toEqual(queue);
    expect({ state, queue }).toEqual(before);
  });

  it("alternates deterministically only on a new first attempt and never on a retry", () => {
    const state = setup();
    state.history = [result()];
    const queue = [task()];
    const second = attachStudyContexts(state, queue);
    expect(second[0].context?.en).toBe(getUsage(target)!.example.en);
    expect(attachStudyContexts(state, queue)).toEqual(second);
    expect(queue[0].context).toBeUndefined();
    expect(attachStudyContexts(state, second)).toEqual(second);
    state.history.push(
      result({
        id: "latest",
        time: Date.now() - DAY,
        context: second[0].context,
        session: "latest-session",
        review: "latest-review",
      }),
    );
    // A failed retry on the old base prompt must not change alternation.
    state.history.push(
      result({
        id: "retry",
        time: Date.now(),
        first: false,
        correct: false,
      }),
    );
    expect(attachStudyContexts(state, queue)[0].context).toBeUndefined();
  });

  it("does not reuse prior-sense evidence or alter another skill", () => {
    const state = setup();
    state.history = [result({ contentVersion: "old-sense" })];
    expect(attachStudyContexts(state, [task()])[0].context).toBeUndefined();
    state.history = [result()];
    expect(
      attachStudyContexts(state, [{ ...task(), skill: 3 }])[0].context,
    ).toBeUndefined();
  });

  it("freezes the actual bilingual question and removes the original sentence audio URL", () => {
    const state = setup();
    state.history = [result()];
    const context = attachStudyContexts(state, [task()])[0].context!;
    const word = {
      ...target,
      audio_example: "https://example.org/original.mp3",
    };
    const exercise = exerciseWord(word, context)!;
    expect(exercise.example_en).toBe(context.en);
    expect(exercise.example_vi).toBe(context.vi);
    expect(exercise.audio_example).toBe("");
    expect(exerciseWord(target)).toBe(target);
    expect(
      exerciseWord({ ...target, meaning_vi: "changed" }, context),
    ).toBeUndefined();
    expect(
      exerciseWord(target, { ...context, en: "No target in this sentence." }),
    ).toBeUndefined();
  });

  it("round trips the context in backup, including a legitimately older historical sense", () => {
    let state = setup();
    state.history = [result()];
    const queue = attachStudyContexts(state, [task()]);
    state.session = {
      id: "new-session",
      queue,
      index: 0,
      started: Date.now(),
      scheduled: true,
      count: 1,
      goal: { due: 1, continuing: 0, fresh: 0 },
    };
    state = record(
      state,
      result({
        id: "new-session:0",
        time: Date.now(),
        review: queue[0].review,
        session: "new-session",
        context: queue[0].context,
      }),
      true,
    );
    expect(validateBackup(JSON.parse(JSON.stringify(state)))).toEqual(state);
    const changed = structuredClone(state);
    changed.entries[target.id].word.meaning_vi = "nghĩa mới";
    expect(() => validateBackup(changed)).not.toThrow();
    const broken = structuredClone(state);
    broken.session!.queue[0].context!.vi = "";
    expect(() => validateBackup(broken)).toThrow();
  });

  it("rejects a stale or malformed live context before appending history or changing schedules", () => {
    const state = setup();
    const context = {
      id: "stale",
      en: target.example_en,
      vi: target.example_vi,
      targetVersion: "older-sense",
    };
    const before = structuredClone(state);
    expect(() => record(state, result({ context }), true)).toThrow(/Ngữ cảnh/);
    expect(() =>
      record(
        state,
        result({
          context: { ...context, targetVersion: contentKey(target, 4) },
          skill: 1,
        }),
        true,
      ),
    ).toThrow();
    expect(state).toEqual(before);
  });

  it("cannot turn a same-review repair into first-attempt or delayed evidence even after a long gap", () => {
    let state = setup();
    const first = result({ correct: false });
    state = record(state, first, true);
    const schedule = structuredClone(state.schedules);
    state = record(
      state,
      result({
        id: "repair",
        time: Date.now(),
        session: "different-device-session",
        first: true,
        independent: true,
        correct: true,
      }),
      true,
    );
    expect(state.history.at(-1)).toMatchObject({
      first: false,
      independent: false,
    });
    expect(state.schedules).toEqual(schedule);
    const analysis = analyzeLearning(state);
    expect(analysis.skills[4].objective.total).toBe(1);
    expect(analysis.skills[4].objective.correct).toBe(0);
    expect(analysis.skills[4].delayed.correct).toBe(0);
  });

  it("keeps a session's later repeat non-independent even if it receives a different review ID", () => {
    let state = record(setup(), result(), true);
    state = record(
      state,
      result({
        id: "later-in-same-session",
        review: "different-review",
        time: Date.now(),
      }),
      true,
    );
    expect(state.history.at(-1)).toMatchObject({
      first: false,
      independent: false,
    });
  });

  it("preserves frozen contexts during a stale settings merge and a cloud history union", () => {
    const base = setup();
    base.history = [result()];
    const queue = attachStudyContexts(base, [task()]);
    base.session = {
      id: "current-session",
      queue,
      index: 0,
      started: Date.now(),
      scheduled: true,
      count: 1,
    };
    const learning = record(
      base,
      result({
        id: "current-session:0",
        review: queue[0].review,
        session: "current-session",
        time: Date.now(),
        context: queue[0].context,
      }),
      true,
    );
    const settings = { ...base, rate: 1.1 };
    const merged = rebaseState(base, settings, learning);
    expect(merged.session).toEqual(base.session);
    expect(merged.history).toEqual(learning.history);
    expect(merged.rate).toBe(1.1);
    const cloud = cloudPayload(learning);
    expect(cloud.session).toBeUndefined();
    expect(cloud.history.at(-1)?.context).toEqual(queue[0].context);
    const union = mergeCloudState(base, settings, cloud);
    expect(union.conflicts).toEqual([]);
    expect(union.state.session).toEqual(base.session);
    expect(union.state.history.at(-1)?.context).toEqual(queue[0].context);
    expect(() => validateBackup(union.state)).not.toThrow();
  });
});
