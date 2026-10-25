import { describe, expect, it } from "vitest";
import { contentKey, empty, merge, type Result, type Word } from "./core";
import {
  evidenceForSkill,
  isDelayedEvidence,
  isRetainedEvidence,
  isWeakEvidence,
  selectLearningEvidence,
} from "./evidence";

const DAY = 86_400_000;
const NOW = Date.parse("2026-10-22T09:00:00+07:00");
const word: Word = {
  id: "review-word",
  word: "appointment",
  part_of_speech: "noun",
  meaning_vi: "cuộc hẹn",
  example_en: "I have an appointment tomorrow.",
  example_vi: "Tôi có một cuộc hẹn vào ngày mai.",
  learning_status: "ready",
};
const state = () => merge(empty(), [word], "default");
const result = (
  id: string,
  time: number,
  patch: Partial<Result> = {},
): Result => ({
  id,
  wordId: word.id,
  time,
  skill: 1,
  answer: word.word,
  correct: true,
  hint: false,
  method: "rule",
  elapsed: 1000,
  session: `session-${id}`,
  review: `review-${id}`,
  gap: 8 * DAY,
  first: true,
  independent: true,
  evidenceVersion: 2,
  contentVersion: contentKey(word, 1),
  exposureGap: 8 * DAY,
  ...patch,
});

describe("shared current-sense evidence", () => {
  it("requires a known observed interval instead of an independent flag alone", () => {
    expect(
      isDelayedEvidence(result("unknown", NOW, { exposureGap: undefined })),
    ).toBe(false);
    expect(
      isDelayedEvidence(result("short", NOW, { exposureGap: DAY - 1 })),
    ).toBe(false);
    expect(isDelayedEvidence(result("day", NOW, { exposureGap: DAY }))).toBe(
      true,
    );
    expect(isDelayedEvidence(result("hint", NOW, { hint: true }))).toBe(false);
    expect(isDelayedEvidence(result("repeat", NOW, { first: false }))).toBe(
      false,
    );
  });

  it("separates a hinted failure signal from objective accuracy", () => {
    const s = state();
    s.history = [
      result("good", NOW - 8 * DAY),
      result("hinted", NOW, { hint: true, correct: false }),
    ];
    const selected = selectLearningEvidence(s, NOW);
    expect(selected.attempts).toHaveLength(2);
    expect(selected.objective).toHaveLength(1);
    const skill = evidenceForSkill(selected, word.id, 1);
    expect(skill.weak).toBe(true);
    expect(skill.retained).toBe(false);
  });

  it("deduplicates the first review before a later answer changes grading method or hint status", () => {
    const s = state();
    const first = result("initial", NOW - 8 * DAY, {
      method: "ungraded",
      correct: false,
    });
    s.history = [
      first,
      { ...first },
      result("later", NOW, { review: first.review }),
    ];
    const selected = selectLearningEvidence(s, NOW);
    expect(selected.history).toHaveLength(2);
    expect(selected.current).toHaveLength(2);
    expect(selected.attempts).toHaveLength(0);
    expect(selected.objective).toHaveLength(0);
  });

  it("does not trust imported first flags for repeated testing of a skill in the same session", () => {
    const s = state();
    const first = result("initial", NOW - 8 * DAY, {
      hint: true,
      correct: false,
    });
    s.history = [first, result("repeat", NOW, { session: first.session })];
    const selected = selectLearningEvidence(s, NOW);
    expect(selected.attempts.map((item) => item.id)).toEqual([first.id]);
    expect(selected.objective).toHaveLength(0);
    expect(evidenceForSkill(selected, word.id, 1).weak).toBe(true);
    expect(s.history.at(-1)?.first).toBe(true);
  });

  it("retains old histories while excluding obsolete meanings, future times, and archived entries", () => {
    const s = state();
    s.history = [
      result("old", NOW - DAY, { contentVersion: "obsolete-sense" }),
      result("future", NOW + 1),
      result("valid", NOW),
    ];
    const before = structuredClone(s);
    const selected = selectLearningEvidence(s, NOW);
    expect(selected.history.map((r) => r.id)).toEqual(["old", "valid"]);
    expect(selected.current.map((r) => r.id)).toEqual(["valid"]);
    expect(s).toEqual(before);
    const archived = {
      ...s,
      entries: { [word.id]: { ...s.entries[word.id], archived: true } },
    };
    expect(selectLearningEvidence(archived, NOW).history).toHaveLength(0);
  });

  it("reconciles a merged recent exposure without modifying the saved answer", () => {
    const s = state();
    const answer = result("answer", NOW);
    s.history = [answer];
    s.exposureEvents = [
      { id: "phone-open", wordId: word.id, time: NOW - 30_000 },
    ];
    const selected = selectLearningEvidence(s, NOW);
    expect(selected.current[0]).toMatchObject({
      independent: false,
      exposureGap: 30_000,
    });
    expect(selected.delayed).toHaveLength(0);
    expect(answer).toMatchObject({ independent: true, exposureGap: 8 * DAY });
    expect(s.history[0]).toBe(answer);
  });

  it("requires distinct delayed correct days, a real seven-day gap, and no recent weakness", () => {
    const attempts = [24, 16, 8].map((days) =>
      result(String(days), NOW - days * DAY),
    );
    expect(isRetainedEvidence(attempts)).toBe(true);
    expect(
      isRetainedEvidence([...attempts, result("latest", NOW, { hint: true })]),
    ).toBe(false);
    expect(
      isWeakEvidence([...attempts, result("latest", NOW, { hint: true })]),
    ).toBe(true);
    expect(
      isRetainedEvidence(attempts.map((r) => ({ ...r, exposureGap: DAY }))),
    ).toBe(false);
  });

  it("keeps a lapse weak after an immediate repair and restores old retained evidence only after a spaced recovery", () => {
    const retained = [50, 40, 30].map((days) =>
      result(`retained-${days}`, NOW - days * DAY),
    );
    const lapse = result("lapse", NOW - 2 * DAY, { correct: false });
    const immediate = result("repair", lapse.time + 60_000, {
      independent: false,
      exposureGap: 60_000,
    });
    const attempts = [...retained, lapse, immediate];
    const before = structuredClone(attempts);
    expect(isWeakEvidence(attempts)).toBe(true);
    expect(isRetainedEvidence(attempts)).toBe(false);
    expect(attempts).toEqual(before);

    const supported = result("hinted-recovery", NOW, {
      hint: true,
      independent: false,
      exposureGap: 2 * DAY - 60_000,
    });
    expect(isRetainedEvidence([...attempts, supported])).toBe(false);

    const recovery = result("spaced-recovery", NOW, {
      exposureGap: 2 * DAY - 60_000,
    });
    expect(isWeakEvidence([...attempts, recovery])).toBe(false);
    expect(isRetainedEvidence([...attempts, recovery])).toBe(true);
    // A later lapse starts a new recovery period, even after past recovery.
    expect(
      isWeakEvidence([
        ...attempts,
        recovery,
        result("new-lapse", NOW + DAY, { correct: false }),
        result("new-immediate", NOW + DAY + 60_000, {
          independent: false,
          exposureGap: 60_000,
        }),
      ]),
    ).toBe(true);
  });
});
