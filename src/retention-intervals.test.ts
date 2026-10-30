import { describe, expect, it } from "vitest";
import {
  contentKey,
  empty,
  expose,
  merge,
  record,
  validateBackup,
  type Result,
  type State,
  type Word,
} from "./core";
import { mergeCloudState } from "./sync";

const DAY = 86_400_000;
const START = Date.UTC(2026, 0, 5, 12);
const word: Word = {
  id: "retention-apple",
  word: "apple",
  part_of_speech: "noun",
  meaning_vi: "quả táo",
  example_en: "I put an apple in my bag.",
  example_vi: "Tôi bỏ một quả táo vào túi.",
  content_status: "reviewed",
  learning_status: "ready",
};
const at = (day: number) => START + day * DAY;
const key = (skill = 1) => `${word.id}:${skill}`;
const initial = () => merge(empty(), [word], "default");
const answer = (day: number, extra: Partial<Result> = {}): Result => ({
  id: `answer-${day}-${extra.skill ?? 1}`,
  wordId: word.id,
  skill: 1,
  time: at(day),
  answer: word.word,
  correct: true,
  hint: false,
  method: "rule",
  elapsed: 2000,
  session: `session-${day}`,
  review: `review-${day}-${extra.skill ?? 1}`,
  gap: 0,
  first: true,
  evidenceVersion: 2,
  independent: true,
  audioPlayed: true,
  ...extra,
});
function mature(skill = 1) {
  let state = initial();
  for (const day of [0, 1, 4, 11, 25])
    state = record(state, answer(day, { skill }), true);
  return state;
}
const daysUntil = (state: State, day: number, skill = 1) =>
  (state.schedules[key(skill)].due - at(day)) / DAY;

describe("Conservative long-term review intervals", () => {
  it.each([1, 3, 4])(
    "keeps the first five steps then gradually extends proven independent skill %i, capped at 180 days",
    (skill) => {
      let state = mature(skill);
      expect(state.schedules[key(skill)]).toMatchObject({
        step: 4,
        due: at(55),
      });
      for (const [day, expected] of [
        [55, 60],
        [115, 90],
        [205, 180],
        [385, 180],
        [565, 180],
      ]) {
        const before = structuredClone(state);
        state = record(state, answer(day, { skill }), true);
        expect(daysUntil(state, day, skill)).toBe(expected);
        expect(state.schedules[key(skill)].step).toBe(4);
        expect(state.history.slice(0, -1)).toEqual(before.history);
        expect(validateBackup(JSON.parse(JSON.stringify(state)))).toEqual(
          state,
        );
      }
    },
  );

  it.each([0, 2])(
    "never extends self-rated skill %i beyond thirty days",
    (skill) => {
      let state = initial();
      for (const day of [0, 1, 4, 11, 25, 55, 85, 115]) {
        state = record(state, answer(day, { skill, method: "self" }), true);
        expect(state.schedules[key(skill)].step).toBeLessThanOrEqual(4);
        if (day >= 25) expect(daysUntil(state, day, skill)).toBe(30);
      }
    },
  );

  it("does not treat an imported mature stage or missing legacy evidence as proof of retention", () => {
    for (const prior of [
      [],
      mature().history.map((r) => ({
        ...r,
        evidenceVersion: undefined,
        exposureGap: undefined,
      })),
    ]) {
      const state = initial();
      state.history = prior;
      state.schedules[key()] = {
        step: 4,
        last: at(25),
        due: at(55),
        contentVersion: contentKey(word, 1),
      };
      state.exposures = { [word.id]: at(25) };
      expect(daysUntil(record(state, answer(55), true), 55)).toBe(30);
    }
  });

  it("requires scheduled evidence, separate sessions and separate days rather than repeated practice", () => {
    let state = initial();
    for (const day of [0, 1, 4, 11, 25])
      state = record(state, answer(day), false);
    state.schedules[key()] = {
      step: 4,
      last: at(25),
      due: at(55),
      contentVersion: contentKey(word, 1),
    };
    expect(daysUntil(record(state, answer(55), true), 55)).toBe(30);

    const repeated = mature();
    repeated.history = repeated.history.map((r) => ({
      ...r,
      session: "one-session",
      review: "one-review",
    }));
    expect(daysUntil(record(repeated, answer(55), true), 55)).toBe(30);
  });

  it("does not use obsolete meanings or future records to lengthen the current schedule", () => {
    for (const history of [
      mature().history.map((r) => ({ ...r, contentVersion: "old-sense" })),
      mature().history.map((r) => ({ ...r, time: r.time + 200 * DAY })),
    ]) {
      const state = mature();
      state.history = history;
      expect(daysUntil(record(state, answer(55), true), 55)).toBe(30);
    }
  });

  it("keeps a recently primed success at thirty days and never promotes missing audio", () => {
    const primed = expose(mature(), word.id, at(55) - 60_000);
    expect(daysUntil(record(primed, answer(55), true), 55)).toBe(30);
    const audio = mature(3);
    const old = structuredClone(audio.schedules);
    const next = record(
      audio,
      answer(55, { skill: 3, audioPlayed: false }),
      true,
    );
    expect(next.schedules).toEqual(old);
    expect(next.history.at(-1)).toMatchObject({
      method: "ungraded",
      independent: false,
    });
  });

  it("uses the actual quiet interval, taking at most one tier instead of extrapolating from calendar age", () => {
    const long = mature();
    long.schedules[key()] = {
      ...long.schedules[key()],
      last: at(25),
      due: at(205),
    };
    const seen = expose(long, word.id, at(175));
    const next = record(seen, answer(205), true);
    expect(daysUntil(next, 205)).toBe(60);
    const veryLate = record(mature(), answer(205), true);
    expect(daysUntil(veryLate, 205)).toBe(60);
  });

  it("requires three new clean scheduled days after a hint rather than reusing pre-lapse successes", () => {
    let state = record(mature(), answer(55, { hint: true }), true);
    expect(daysUntil(state, 55)).toBe(1);
    state = record(state, answer(86), true);
    expect(daysUntil(state, 86)).toBe(30);
    state = record(state, answer(116), true);
    expect(daysUntil(state, 116)).toBe(30);
    state = record(state, answer(146), true);
    expect(daysUntil(state, 146)).toBe(60);
    const lapse = record(state, answer(147, { correct: false }), true);
    expect(lapse.schedules[key()]).toMatchObject({ step: 0, due: at(148) });
  });

  it("does not move existing schedules for free practice, an early answer or a duplicate repair", () => {
    const state = record(mature(), answer(55), true);
    state.session = {
      id: "saved",
      queue: [{ id: word.id, skill: 1, review: "saved-review" }],
      index: 0,
      started: at(56),
      scheduled: true,
      count: 1,
      draft: {
        key: "saved:0",
        answer: "unfinished",
        hint: false,
        revealed: false,
      },
    };
    state.pausedScheduled = structuredClone(state.session);
    const before = structuredClone(state);
    for (const [result, scheduled] of [
      [answer(56), true],
      [answer(115), false],
      [answer(115, { method: "ungraded" }), true],
      [answer(115, { review: "review-55-1", first: false }), true],
    ] as const) {
      const next = record(state, result, scheduled);
      expect(next.schedules).toEqual(before.schedules);
      expect(next.session).toEqual(before.session);
      expect(next.pausedScheduled).toEqual(before.pausedScheduled);
      expect(state).toEqual(before);
    }
  });

  it("reconciles merged observations before trusting old independent evidence", () => {
    const base = mature();
    let remote = structuredClone(base);
    for (const day of [1, 4, 11, 25])
      remote = expose(remote, word.id, at(day) - 500);
    const merged = mergeCloudState(base, base, remote);
    expect(merged.conflicts).toHaveLength(0);
    expect(merged.state.history).toEqual(base.history);
    expect(daysUntil(record(merged.state, answer(55), true), 55)).toBe(30);
    expect(daysUntil(record(base, answer(55), true), 55)).toBe(60);
  });
});
