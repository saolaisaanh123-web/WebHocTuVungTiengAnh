import { describe, expect, it } from "vitest";
import {
  contentKey,
  empty,
  record,
  validateBackup,
  type Result,
  type State,
} from "./core";
import type { ConversationAttempt, WritingAttempt } from "./practice-data";

function fixture(): State {
  const state = empty();
  state.entries.apple = {
    origin: "personal",
    archived: false,
    word: {
      id: "apple",
      word: "apple",
      meaning_vi: "quả táo",
      example_en: "I ate an apple.",
      example_vi: "Tôi đã ăn một quả táo.",
    },
  };
  return state;
}

function writing(overrides: Partial<WritingAttempt> = {}): WritingAttempt {
  return {
    id: "writing:1",
    wordId: "apple",
    time: 1000,
    text: "I ate an apple.",
    source: "local",
    status: "ungraded",
    issues: [],
    summary: "Chưa thể chấm tự động toàn bộ câu.",
    assessment: {
      grammar: "uncertain",
      usage: "uncertain",
      naturalness: "uncertain",
    },
    contentVersion: "apple:meaning:1",
    ...overrides,
  };
}

function conversation(
  overrides: Partial<ConversationAttempt> = {},
): ConversationAttempt {
  return {
    id: "conversation:1",
    dialogueId: "market",
    dialogueVersion: "1",
    time: 1000,
    targetIds: ["apple"],
    targetContentVersions: { apple: "apple:meaning:1" },
    answers: [
      {
        questionId: "market:cloze",
        kind: "cloze",
        answer: "apple",
        correct: true,
        targetIds: ["apple"],
        explanation: "An apple là một quả táo.",
        hint: false,
      },
      {
        questionId: "market:reply",
        kind: "reply",
        answer: "One apple, please.",
        targetIds: ["apple"],
        explanation: "Câu trả lời tự viết chưa được chấm.",
        hint: false,
      },
    ],
    read: true,
    listenedLineIds: ["market:line1"],
    listenedComplete: false,
    ...overrides,
  };
}

describe("additive practice backup compatibility", () => {
  it("accepts the original schema without inventing new learning evidence", () => {
    const original = JSON.parse(JSON.stringify(fixture()));
    const restored = validateBackup(original);
    expect(restored).toEqual(original);
    expect(restored.version).toBe(1);
    expect(restored).not.toHaveProperty("writing");
    expect(restored).not.toHaveProperty("conversations");
  });

  it("roundtrips original sentences, revisions and dialogue retries losslessly", () => {
    const state = fixture();
    state.learningMode = "weak";
    state.writing = [
      writing(),
      writing({ id: "writing:2", parentId: "writing:1", time: 2000 }),
    ];
    state.conversations = [
      conversation(),
      conversation({
        id: "conversation:2",
        retryOf: "conversation:1",
        time: 2000,
      }),
    ];
    expect(validateBackup(JSON.parse(JSON.stringify(state)))).toEqual(state);
    expect(state.history).toEqual([]);
    expect(state.schedules).toEqual({});
  });

  it.each(["invalid", null, 1, {}, []])(
    "rejects invalid selection mode %j",
    (learningMode) => {
      expect(() => validateBackup({ ...fixture(), learningMode })).toThrow();
    },
  );

  it("rejects malformed collection containers and duplicate attempt IDs", () => {
    for (const field of ["writing", "conversations"])
      for (const value of [null, {}, "[]"])
        expect(() =>
          validateBackup({ ...fixture(), [field]: value }),
        ).toThrow();
    expect(() =>
      validateBackup({ ...fixture(), writing: [writing(), writing()] }),
    ).toThrow();
    expect(() =>
      validateBackup({
        ...fixture(),
        conversations: [conversation(), conversation()],
      }),
    ).toThrow();
  });
});

describe("writing evidence validation", () => {
  const issue = {
    id: "verb:1",
    category: "verb-pattern" as const,
    start: 2,
    end: 5,
    message: "Cần kiểm tra dạng động từ.",
    explanation: "Giải thích về cấu trúc trong ngữ cảnh này.",
    suggestion: "eat",
    example: "I eat an apple every day.",
  };

  it("retains a partial local finding without claiming the rest of the sentence is correct", () => {
    const attempt = writing({
      status: "issues",
      issues: [issue],
      assessment: {
        grammar: "issues",
        usage: "uncertain",
        naturalness: "uncertain",
      },
    });
    expect(
      validateBackup({ ...fixture(), writing: [attempt] }).writing,
    ).toEqual([attempt]);
  });

  it.each([
    { start: -1 },
    { start: 2.5 },
    { end: 2 },
    { end: 999 },
    { end: Number.NaN },
    { category: "invented-category" },
    { message: "" },
    { explanation: "" },
    { suggestion: 123 },
  ])("rejects invalid issue position or payload %j", (invalid) => {
    expect(() =>
      validateBackup({
        ...fixture(),
        writing: [
          writing({
            status: "issues",
            issues: [{ ...issue, ...invalid }],
          } as Partial<WritingAttempt>),
        ],
      }),
    ).toThrow();
  });

  it("rejects missing vocabulary and inherited object-property references", () => {
    for (const wordId of ["deleted-word", "toString", "__proto__"])
      expect(() =>
        validateBackup({ ...fixture(), writing: [writing({ wordId })] }),
      ).toThrow();
  });

  it("rejects missing or self-referencing sentence revisions", () => {
    for (const parentId of ["missing-original", "writing:1"])
      expect(() =>
        validateBackup({ ...fixture(), writing: [writing({ parentId })] }),
      ).toThrow();
  });

  it("rejects falsified local correctness and inconsistent external verdicts", () => {
    const correct = {
      grammar: "correct" as const,
      usage: "correct" as const,
      naturalness: "correct" as const,
    };
    for (const attempt of [
      writing({ status: "reviewed" }),
      writing({ assessment: correct }),
      writing({ source: "unavailable", status: "reviewed" }),
      writing({ source: "ai", status: "reviewed" }),
      writing({ source: "ai", status: "issues", issues: [] }),
      writing({
        source: "ai",
        status: "reviewed",
        assessment: correct,
        issues: [issue],
      }),
    ])
      expect(() =>
        validateBackup({ ...fixture(), writing: [attempt] }),
      ).toThrow();
    const reviewed = writing({
      source: "ai",
      status: "reviewed",
      assessment: correct,
    });
    expect(
      validateBackup({ ...fixture(), writing: [reviewed] }).writing,
    ).toEqual([reviewed]);
  });

  it("rejects malformed exposure evidence", () => {
    for (const invalid of [
      { independent: "yes" },
      { exposureGap: -1 },
      { exposureGap: Number.POSITIVE_INFINITY },
    ])
      expect(() =>
        validateBackup({
          ...fixture(),
          writing: [writing(invalid as Partial<WritingAttempt>)],
        }),
      ).toThrow();
  });
});

describe("conversation evidence validation", () => {
  it("roundtrips additive listen-first metadata while retaining legacy read records", () => {
    const legacy = conversation();
    const listening = conversation({
      id: "listening:1",
      mode: "listen",
      transcriptRevealed: false,
      read: false,
      listenedComplete: true,
      listenedLineIds: ["line-0", "line-1"],
    });
    const next = validateBackup({
      ...fixture(),
      conversations: [legacy, listening],
    });
    expect(next.conversations).toEqual([legacy, listening]);
  });

  it("rejects unsupported or contradictory listen-first claims", () => {
    const base = conversation({
      mode: "listen",
      transcriptRevealed: false,
      read: false,
      listenedComplete: true,
      listenedLineIds: ["line-0", "line-1"],
    });
    for (const overrides of [
      { listenedComplete: false },
      { listenedLineIds: [] },
      { listenedLineIds: ["line-1"] },
      { listenedLineIds: ["line-0", "line-0"] },
      { read: true },
      { transcriptRevealed: undefined },
      { mode: "unknown" },
      { mode: undefined, transcriptRevealed: false },
      { transcriptRevealed: true, read: true },
    ])
      expect(() =>
        validateBackup({
          ...fixture(),
          conversations: [{ ...base, ...overrides }],
        }),
      ).toThrow();
    const supported = structuredClone(base);
    supported.transcriptRevealed = true;
    supported.read = true;
    supported.answers.forEach((answer) => {
      answer.hint = true;
    });
    expect(
      validateBackup({ ...fixture(), conversations: [supported] })
        .conversations,
    ).toEqual([supported]);
  });

  it("never interprets reading, listening or an open reply as a correct answer", () => {
    const attempt = conversation({ answers: [] });
    expect(
      validateBackup({ ...fixture(), conversations: [attempt] }).conversations,
    ).toEqual([attempt]);
    for (const correct of [true, false]) {
      const forged = conversation();
      forged.answers[1].correct = correct;
      expect(() =>
        validateBackup({ ...fixture(), conversations: [forged] }),
      ).toThrow();
    }
  });

  it("rejects missing target words and missing or extraneous content versions", () => {
    for (const attempt of [
      conversation({ targetIds: ["deleted-word"] }),
      conversation({ targetContentVersions: {} }),
      conversation({ targetContentVersions: { apple: "v1", extra: "v1" } }),
      conversation({ targetIds: ["toString"], targetContentVersions: {} }),
    ])
      expect(() =>
        validateBackup({ ...fixture(), conversations: [attempt] }),
      ).toThrow();
  });

  it("rejects answers outside the dialogue's targets and duplicate question IDs", () => {
    const missingTarget = conversation();
    missingTarget.answers[0].targetIds = ["missing-word"];
    const duplicateQuestion = conversation();
    duplicateQuestion.answers[1].questionId =
      duplicateQuestion.answers[0].questionId;
    for (const attempt of [missingTarget, duplicateQuestion])
      expect(() =>
        validateBackup({ ...fixture(), conversations: [attempt] }),
      ).toThrow();
  });

  it("rejects missing or self-referencing dialogue retries", () => {
    for (const retryOf of ["missing-attempt", "conversation:1"])
      expect(() =>
        validateBackup({
          ...fixture(),
          conversations: [conversation({ retryOf })],
        }),
      ).toThrow();
  });
});

describe("actual retention exposure interval", () => {
  const day = 86400000;
  const answer = (overrides: Partial<Result> = {}): Result => ({
    id: "result:1",
    wordId: "apple",
    time: 10 * day,
    skill: 1,
    answer: "apple",
    correct: true,
    hint: false,
    method: "rule",
    elapsed: 2000,
    session: "session",
    review: "review:1",
    gap: 0,
    first: true,
    evidenceVersion: 2,
    independent: true,
    ...overrides,
  });

  it("uses the most recent encounter across skills rather than a fabricated input interval", () => {
    let state = fixture();
    state.history = [
      answer({
        id: "old:writing",
        time: day,
        contentVersion: contentKey(state.entries.apple.word, 1),
      }),
      answer({ id: "old:meaning", skill: 0, time: 8 * day }),
    ];
    state.exposures = { apple: 9 * day };
    state = record(
      state,
      answer({ gap: 999 * day, exposureGap: 999 * day }),
      false,
    );
    expect(state.history.at(-1)?.exposureGap).toBe(day);
    expect(state.history.at(-1)?.gap).toBe(9 * day);
    expect(state.schedules).toEqual({});
    expect(validateBackup(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it("keeps a first encounter separate from a measured delayed recall", () => {
    const state = record(fixture(), answer(), false);
    expect(state.history.at(-1)?.exposureGap).toBeUndefined();
    expect(state.history.at(-1)?.gap).toBe(0);
    for (const exposureGap of [-1, Number.NaN, Number.POSITIVE_INFINITY])
      expect(() =>
        validateBackup({
          ...state,
          history: [{ ...state.history[0], exposureGap }],
        }),
      ).toThrow();
  });
});
