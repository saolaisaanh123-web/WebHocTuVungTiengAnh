import { describe, expect, it } from "vitest";
import { analyzeLearning, evidenceMetric } from "./analytics";
import {
  contentKey,
  empty,
  merge,
  type Result,
  type State,
  type Word,
} from "./core";
import type { ConversationAttempt, WritingAttempt } from "./practice-data";
const DAY = 86_400_000;
const NOW = +new Date("2026-10-19T12:00:00+07:00");
const word: Word = {
  id: "appointment",
  word: "appointment",
  meaning_vi: "cuộc hẹn",
  example_en: "I have an appointment today.",
  example_vi: "Hôm nay tôi có một cuộc hẹn.",
  content_status: "reviewed",
  part_of_speech: "noun",
};
const initial = () => merge(empty(), [word], "default");
let serial = 0;
const result = (overrides: Partial<Result> = {}): Result => ({
  id: `evidence-${++serial}`,
  wordId: word.id,
  time: NOW - DAY,
  skill: 1,
  answer: "appointment",
  correct: true,
  hint: false,
  method: "rule",
  elapsed: 1200,
  session: `session-${serial}`,
  review: `review-${serial}`,
  gap: 8 * DAY,
  first: true,
  independent: true,
  evidenceVersion: 2,
  contentVersion: contentKey(word, 1),
  exposureGap: 8 * DAY,
  ...overrides,
});
const writing = (overrides: Partial<WritingAttempt> = {}): WritingAttempt => ({
  id: `writing-${++serial}`,
  wordId: word.id,
  time: NOW - DAY,
  text: "I have an appointment tomorrow.",
  source: "local",
  status: "ungraded",
  issues: [],
  summary: "Chưa thể chấm tự động",
  assessment: {
    grammar: "uncertain",
    usage: "uncertain",
    naturalness: "uncertain",
  },
  contentVersion: contentKey(word, 5),
  ...overrides,
});
const dialogue = (
  overrides: Partial<ConversationAttempt> = {},
): ConversationAttempt => ({
  id: `dialogue-${++serial}`,
  dialogueId: "arranging-appointment",
  dialogueVersion: "v1",
  time: NOW - 1000,
  targetIds: [word.id],
  targetContentVersions: { [word.id]: contentKey(word, 5) },
  answers: [],
  read: true,
  listenedLineIds: [],
  listenedComplete: false,
  ...overrides,
});
function withHistory(history: Result[]): State {
  return { ...initial(), history };
}

describe("Evidence-based learning insights", () => {
  it("keeps new users and manually-known words out of mastery, without inventing a diagnosis", () => {
    const state = initial();
    state.entries[word.id].known = true;
    const report = analyzeLearning(state, NOW);
    expect(report.counts.new).toBe(1);
    expect(report.recommendations).toHaveLength(0);
    expect(report.skills.every((s) => s.objective.rate === null)).toBe(true);
    expect(report.retention.every((r) => r.metric.total === 0)).toBe(true);
    expect(report.weekly.every((p) => p.total === 0)).toBe(true);
  });
  it("separates looking, self-assessment and ungraded writing from tested recall", () => {
    const state = withHistory([
      result({ skill: 0, method: "self", contentVersion: contentKey(word, 0) }),
      result({
        skill: 5,
        method: "ungraded",
        correct: false,
        contentVersion: contentKey(word, 5),
      }),
    ]);
    state.exposures = { [word.id]: NOW - 1000 };
    const r = analyzeLearning(state, NOW);
    expect(r.counts.exposed).toBe(1);
    expect(r.totals.objective).toBe(0);
    expect(r.skills[0].self).toBe(1);
    expect(r.skills[5].ungraded).toBe(1);
    expect(r.counts.retained + r.counts.active).toBe(0);
  });
  it("rejects stale content, hints, retries, failed audio and duplicate review evidence", () => {
    const clean = result();
    const state = withHistory([
      clean,
      { ...clean },
      result({ review: clean.review }),
      result({ hint: true }),
      result({ first: false }),
      result({ contentVersion: "old-meaning" }),
      result({
        skill: 3,
        audioPlayed: false,
        contentVersion: contentKey(word, 3),
      }),
      result({ evidenceVersion: undefined }),
      result({ time: NOW + 1 }),
    ]);
    const r = analyzeLearning(state, NOW);
    expect(r.totals.objective).toBe(1);
    expect(r.skills[1].objective.total).toBe(1);
    expect(r.skills[3].objective.total).toBe(0);
  });
  it("shows immediate and independent denominators separately, with honest small-sample uncertainty", () => {
    const r = analyzeLearning(
      withHistory([
        result({ independent: false, exposureGap: 5000, time: NOW - 9 * DAY }),
        result({ correct: false, time: NOW - DAY }),
      ]),
      NOW,
    );
    expect(r.skills[1].immediate).toMatchObject({
      total: 1,
      correct: 1,
      rate: 1,
      confidence: "Ít dữ liệu",
    });
    expect(r.skills[1].delayed).toMatchObject({
      total: 1,
      correct: 0,
      rate: 0,
    });
    expect(evidenceMetric(1, 1).interval![0]).toBeLessThan(0.3);
    expect(evidenceMetric(0, 0).interval).toBeNull();
  });
  it("uses exact non-overlapping rest intervals and never infers 7/30-day recall from a same-skill gap", () => {
    // Each saved interval must be possible in the actual chronology. Separate
    // same-time attempts would themselves expose the answer and bound the gap.
    const intervals = [
      DAY - 1,
      DAY,
      7 * DAY - 1,
      7 * DAY,
      30 * DAY - 1,
      30 * DAY,
    ];
    let time = NOW - 100 * DAY - intervals.reduce((sum, gap) => sum + gap, 0);
    const unknown = result({
      time: time - 80 * DAY,
      exposureGap: undefined,
      gap: 80 * DAY,
    });
    const state = withHistory([
      unknown,
      ...intervals.map((exposureGap, index) => {
        time += exposureGap;
        return result({ time, exposureGap, correct: index !== 3 });
      }),
    ]);
    const r = analyzeLearning(state, NOW);
    expect(r.retention.map((b) => b.metric.total)).toEqual([2, 2, 1]);
    expect(r.retention.map((b) => b.metric.correct)).toEqual([2, 1, 1]);
    expect(r.missingExposureGap).toBe(1);
  });
  it("keeps a first answer with an unknown exposure interval out of both measured time groups", () => {
    const state = withHistory([
      result({ time: NOW, exposureGap: undefined, gap: 0 }),
    ]);
    const before = structuredClone(state);
    const report = analyzeLearning(state, NOW);
    expect(report.skills[1].objective.total).toBe(1);
    expect(report.skills[1].delayed.total).toBe(0);
    expect(report.skills[1].immediate.total).toBe(0);
    expect(report.skills[1].unverified.total).toBe(1);
    expect(report.retention.every((bucket) => bucket.metric.total === 0)).toBe(
      true,
    );
    expect(report.missingExposureGap).toBe(1);
    expect(state).toEqual(before);
  });
  it("flags a recent hinted failure without inflating independent accuracy or erasing older answers", () => {
    const history = [32, 24, 16, 8].map((days) =>
      result({ time: NOW - days * DAY }),
    );
    const state = withHistory(history);
    expect(analyzeLearning(state, NOW).counts.retained).toBe(1);
    const latest = result({
      time: NOW,
      hint: true,
      correct: false,
      independent: false,
      exposureGap: 8 * DAY,
    });
    const updated = { ...state, history: [...history, latest] };
    const report = analyzeLearning(updated, NOW);
    expect(report.words[0]).toMatchObject({
      status: "weak",
      failures: 1,
      attempts: 5,
      weakSkills: [1],
      retainedSkills: [],
    });
    expect(report.skills[1].objective).toMatchObject({ total: 4, correct: 4 });
    expect(report.skills[1].supported).toBe(1);
    expect(report.recommendations[0]).toMatchObject({
      action: "practice",
      skill: 1,
      ids: [word.id],
    });
    expect(updated.history).toEqual([...history, latest]);
  });
  it("requires same-skill, distinct independent days and a real seven-day rest for retained status", () => {
    const history = [
      result({ time: NOW - 20 * DAY, exposureGap: DAY }),
      result({ time: NOW - 10 * DAY, exposureGap: DAY }),
      result({ time: NOW - DAY, exposureGap: DAY }),
    ];
    expect(analyzeLearning(withHistory(history), NOW).counts.retained).toBe(0);
    history[2].exposureGap = 8 * DAY;
    expect(analyzeLearning(withHistory(history), NOW).counts.retained).toBe(1);
    const r = analyzeLearning(
      withHistory([...history, result({ time: NOW - 1000, correct: false })]),
      NOW,
    );
    expect(r.counts.weak).toBe(1);
    expect(r.counts.retained).toBe(0);
    history[2] = {
      ...history[2],
      skill: 3,
      audioPlayed: true,
      contentVersion: contentKey(word, 3),
    };
    expect(analyzeLearning(withHistory(history), NOW).counts.retained).toBe(0);
  });
  it("identifies recurring forgetting and too much unsuccessful practice from actual failures", () => {
    const history = Array.from({ length: 8 }, (_, n) =>
      result({ time: NOW - (9 - n) * DAY, correct: false }),
    );
    const r = analyzeLearning(withHistory(history), NOW);
    expect(r.frequentlyForgotten).toEqual([word.id]);
    expect(r.overpracticedWeak).toEqual([word.id]);
    expect(r.recommendations[0]).toMatchObject({
      action: "practice",
      skill: 1,
      ids: [word.id],
    });
    expect(r.recommendations[0].reason).toContain("8/8");
  });

  it("does not diagnose overpractice from an obsolete meaning or tests of another skill", () => {
    const oldSense = Array.from({ length: 8 }, (_, n) =>
      result({
        time: NOW - (10 - n) * DAY,
        contentVersion: "previous-meaning",
      }),
    );
    const currentFailure = result({ time: NOW, correct: false });
    const report = analyzeLearning(
      withHistory([...oldSense, currentFailure]),
      NOW,
    );
    expect(report.words[0]).toMatchObject({ status: "weak", attempts: 1 });
    expect(report.totals.history).toBe(9);
    expect(report.overpracticedWeak).toEqual([]);

    const otherSkill = oldSense.map((r) => ({
      ...r,
      skill: 0,
      contentVersion: contentKey(word, 0),
    }));
    expect(
      analyzeLearning(withHistory([...otherSkill, currentFailure]), NOW)
        .overpracticedWeak,
    ).toEqual([]);
  });

  it("keeps a recently forgotten word weak after a new-session immediate correct answer", () => {
    const retained = [50, 40, 30].map((days) =>
      result({ time: NOW - days * DAY }),
    );
    const failure = result({ time: NOW - 120_000, correct: false });
    const repair = result({
      time: NOW - 60_000,
      independent: false,
      exposureGap: 60_000,
    });
    const state = withHistory([...retained, failure, repair]);
    const before = structuredClone(state);
    const report = analyzeLearning(state, NOW);
    expect(report.words[0]).toMatchObject({
      status: "weak",
      weakSkills: [1],
      retainedSkills: [],
    });
    expect(report.words[0].reasons.join(" ")).toContain("phục hồi độc lập");
    expect(state).toEqual(before);
  });
  it("requires three independent successful days after earlier mistakes before claiming improvement", () => {
    const history = [
      result({ time: NOW - 20 * DAY, correct: false }),
      ...[15, 8, 1].map((n) => result({ time: NOW - n * DAY })),
    ];
    expect(analyzeLearning(withHistory(history), NOW).improving).toEqual([
      word.id,
    ]);
    history[3].independent = false;
    expect(analyzeLearning(withHistory(history), NOW).improving).toHaveLength(
      0,
    );
  });
  it("records conversation reading and exercise results separately without certifying recall", () => {
    const state = initial();
    state.conversations = [
      dialogue({
        answers: [
          {
            questionId: "q1",
            kind: "comprehension",
            answer: "tomorrow",
            correct: true,
            targetIds: [word.id],
            explanation: "Tomorrow",
            hint: false,
          },
          {
            questionId: "q2",
            kind: "cloze",
            answer: word.word,
            correct: true,
            targetIds: [word.id],
            explanation: "",
            hint: true,
          },
          {
            questionId: "q3",
            kind: "reply",
            answer: "That works for me.",
            targetIds: [word.id],
            explanation: "Chưa chấm",
            hint: false,
          },
        ],
      }),
      dialogue({
        retryOf: "previous",
        answers: [
          {
            questionId: "q1",
            kind: "cloze",
            answer: word.word,
            correct: true,
            targetIds: [word.id],
            explanation: "",
            hint: false,
          },
        ],
      }),
    ];
    const r = analyzeLearning(state, NOW);
    expect(r.conversationEvidence.answered).toMatchObject({
      total: 2,
      correct: 2,
    });
    expect(r.conversationEvidence.supported).toMatchObject({
      total: 1,
      correct: 1,
    });
    expect(r.conversationEvidence.replies).toBe(1);
    expect(r.conversationEvidence.retries).toBe(1);
    expect(r.counts.exposed).toBe(1);
    expect(r.totals.objective).toBe(0);
    expect(r.counts.active).toBe(0);
  });
  it("separates first listening without a transcript from reading, hints, retries and stale meanings", () => {
    const state = initial();
    const listen = dialogue({
      mode: "listen",
      transcriptRevealed: false,
      read: false,
      listenedComplete: true,
      listenedLineIds: ["line-0", "line-1"],
      answers: [
        {
          questionId: "detail",
          kind: "comprehension",
          answer: "tomorrow",
          correct: true,
          targetIds: [word.id],
          explanation: "",
          hint: false,
        },
        {
          questionId: "sense",
          kind: "meaning",
          answer: "wrong",
          correct: false,
          targetIds: [word.id],
          explanation: "",
          hint: false,
        },
      ],
    });
    state.conversations = [
      listen,
      {
        ...listen,
        id: "revealed",
        read: true,
        transcriptRevealed: true,
        answers: listen.answers.map((a) => ({ ...a, hint: true })),
      },
      { ...listen, id: "retry", retryOf: listen.id },
      { ...listen, id: "incomplete", listenedComplete: false },
      {
        ...listen,
        id: "old",
        targetContentVersions: { [word.id]: "old-meaning" },
      },
      {
        ...listen,
        id: "legacy",
        mode: undefined,
        transcriptRevealed: undefined,
      },
    ];
    const before = structuredClone(state);
    const report = analyzeLearning(state, NOW);
    expect(report.conversationEvidence.listenFirst).toMatchObject({
      total: 2,
      correct: 1,
    });
    expect(report.conversationEvidence.contextMeaning).toMatchObject({
      total: 1,
      correct: 0,
    });
    expect(report.totals.objective).toBe(0);
    expect(report.counts.retained).toBe(0);
    expect(report.counts.active).toBe(0);
    expect(state).toEqual(before);
  });
  it("does not confuse no local/service issues with verified correct active use", () => {
    const state = initial();
    state.writing = [
      writing({ source: "local", independent: true }),
      writing({ source: "service", independent: true, time: NOW - 5 * DAY }),
      writing({
        source: "service",
        status: "issues",
        issues: [
          {
            id: "suggest",
            category: "verb-pattern",
            start: 0,
            end: 1,
            message: "Sai cấu trúc",
            explanation: "Giải thích",
          },
        ],
      }),
    ];
    const r = analyzeLearning(state, NOW);
    expect(r.counts.active).toBe(0);
    expect(r.skills[6].ai.total).toBe(0);
    expect(r.skills[6].serviceReviews).toBe(2);
    expect(r.skills[6].serviceIssues).toBe(1);
    expect(r.issues).toEqual([["verb-pattern", 1]]);
    expect(r.recommendations.some((a) => a.action === "writing")).toBe(true);
  });
  it("supports future reviewed usage cautiously, requiring two current-content independent writing days", () => {
    const state = initial();
    const ai = {
      source: "ai" as const,
      status: "reviewed" as const,
      independent: true,
      assessment: {
        grammar: "correct" as const,
        usage: "correct" as const,
        naturalness: "uncertain" as const,
      },
    };
    state.writing = [
      writing({ ...ai, time: NOW - 5 * DAY }),
      writing({
        ...ai,
        time: NOW - DAY,
        text: "Can we move our appointment to Friday?",
      }),
    ];
    expect(analyzeLearning(state, NOW).counts.active).toBe(1);
    state.writing[1].contentVersion = "previous-sense";
    expect(analyzeLearning(state, NOW).counts.active).toBe(0);
    state.writing[1].contentVersion = contentKey(word, 5);
    state.writing[1].independent = false;
    expect(analyzeLearning(state, NOW).counts.active).toBe(0);
    state.writing[1].independent = true;
    state.writing[1].text = state.writing[0].text;
    expect(analyzeLearning(state, NOW).counts.active).toBe(0);
  });
  it("preserves due schedules and sessions, ignores archived/future results, and handles calendar periods", () => {
    const state = withHistory([
      result({ time: NOW - 1000 }),
      result({ time: NOW + DAY }),
    ]);
    state.schedules[`${word.id}:1`] = {
      due: NOW - DAY,
      last: NOW - 2 * DAY,
      step: 1,
    };
    state.session = {
      id: "session-running",
      queue: [{ id: word.id, skill: 1, review: "r" }],
      index: 0,
      started: NOW - 1000,
      scheduled: true,
      count: 1,
    };
    const before = JSON.stringify(state);
    const r = analyzeLearning(state, NOW);
    expect(r.dueCount).toBe(1);
    expect(r.weekly.reduce((a, p) => a + p.total, 0)).toBe(1);
    expect(r.monthly.reduce((a, p) => a + p.total, 0)).toBe(1);
    expect(r.weekly).toHaveLength(6);
    expect(r.monthly).toHaveLength(6);
    expect(JSON.stringify(state)).toBe(before);
    state.entries[word.id].archived = true;
    const archived = analyzeLearning(state, NOW);
    expect(archived.dueCount).toBe(0);
    expect(archived.words).toHaveLength(0);
    expect(archived.totals.objective).toBe(0);
  });
  it("includes writing and dialogue activity without counting the same saved sentence twice", () => {
    const sentence = writing({ time: NOW - 1000 });
    const state = withHistory([
      result({
        skill: 5,
        method: "ungraded",
        answer: sentence.text,
        time: sentence.time,
        contentVersion: contentKey(word, 5),
      }),
    ]);
    state.writing = [
      sentence,
      writing({ text: "Is my appointment still confirmed?", time: NOW - 500 }),
    ];
    state.conversations = [dialogue()];
    const r = analyzeLearning(state, NOW);
    expect(r.weekly.reduce((sum, p) => sum + p.total, 0)).toBe(3);
    expect(r.monthly.reduce((sum, p) => sum + p.total, 0)).toBe(3);
    expect(r.weekly.reduce((sum, p) => sum + p.valid, 0)).toBe(0);
  });
});
