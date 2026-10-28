import { describe, expect, it } from "vitest";
import {
  contentKey,
  empty,
  merge,
  validPendingAssessment,
  validateBackup,
  type PendingAssessment,
  type State,
  type Word,
} from "./core";

const word: Word = {
  id: "pending-assessment-word",
  word: "record",
  part_of_speech: "verb",
  meaning_vi: "ghi lại",
  example_en: "Please record the meeting.",
  example_vi: "Hãy ghi lại cuộc họp.",
  content_status: "reviewed",
  learning_status: "ready",
};
const now = Date.UTC(2026, 9, 28, 12);
const snapshot = (skill = 1): PendingAssessment => ({
  time: now,
  elapsed: 2300,
  hint: false,
  independent: true,
  audioPlayed: skill === 3,
  contentVersion: contentKey(word, skill),
});
const stateWithDraft = (skill = 1): State => {
  const state = merge(empty(), [word], "personal");
  state.session = {
    id: "pending-session",
    started: now - 5000,
    index: 0,
    count: 1,
    scheduled: true,
    queue: [{ id: word.id, skill, review: "pending-review" }],
    draft: {
      key: "pending-session:0",
      answer: "another answer",
      hint: false,
      revealed: true,
      assessment: snapshot(skill),
    },
  };
  state.schedules[`${word.id}:${skill}`] = {
    step: 3,
    last: now - 14 * 86_400_000,
    due: now - 1000,
    contentVersion: contentKey(word, skill),
  };
  return state;
};

describe("pending assessment backup compatibility", () => {
  it.each([1, 3, 4])(
    "round-trips the original pending answer and timing for skill %i without grading it",
    (skill) => {
      const state = stateWithDraft(skill);
      state.pausedScheduled = structuredClone(state.session);
      const before = structuredClone(state);
      const restored = validateBackup(JSON.parse(JSON.stringify(state)));
      expect(restored).toEqual(before);
      expect(restored.history).toEqual([]);
      expect(restored.schedules).toEqual(before.schedules);
      expect(restored.session?.draft?.assessment).toEqual(snapshot(skill));
      expect(restored.pausedScheduled?.draft).toEqual(restored.session?.draft);
      expect(state).toEqual(before);
    },
  );

  it("continues to accept legacy drafts without a pending assessment", () => {
    const state = stateWithDraft();
    delete state.session!.draft!.assessment;
    state.session!.draft!.revealed = false;
    expect(validateBackup(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it("rejects malformed pending evidence rather than coercing it into a grade", () => {
    for (const changed of [
      { time: -1 },
      { time: Infinity },
      { time: "123" },
      { elapsed: NaN },
      { elapsed: -1 },
      { hint: 0 },
      { independent: "true" },
      { audioPlayed: undefined },
      { contentVersion: 7 },
    ]) {
      const assessment = { ...snapshot(), ...changed };
      expect(validPendingAssessment(assessment)).toBe(false);
      const state = stateWithDraft();
      state.session!.draft!.assessment = assessment as PendingAssessment;
      expect(() => validateBackup(state)).toThrow(
        "Phiên học sao lưu không hợp lệ",
      );
    }
  });

  it("does not accept a pending grade before feedback is revealed or on self-rated/writing tasks", () => {
    const hidden = stateWithDraft();
    hidden.session!.draft!.revealed = false;
    expect(() => validateBackup(hidden)).toThrow(
      "Phiên học sao lưu không hợp lệ",
    );
    for (const skill of [0, 2, 5])
      expect(() => validateBackup(stateWithDraft(skill))).toThrow(
        "Phiên học sao lưu không hợp lệ",
      );
  });
});
