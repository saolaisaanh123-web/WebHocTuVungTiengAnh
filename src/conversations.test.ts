import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contentKey, empty, merge, parse, type Result } from "./core";
import {
  availableDialogues,
  dialogues,
  listeningDialogues,
  evaluateDialogueAnswer,
  makeConversationAttempt,
  recommendDialogues,
} from "./conversations";
import { validatePracticeCollections } from "./practice-data";

const source = () =>
  merge(
    empty(),
    parse(readFileSync("public/data/vocabulary.txt", "utf8")),
    "default",
  );
const sample = dialogues.find((d) => d.id === "assignment-feedback")!;
const result = (wordId: string, overrides: Partial<Result> = {}): Result => ({
  id: "r-" + wordId,
  wordId,
  time: 10,
  skill: 0,
  answer: "test",
  correct: false,
  hint: false,
  method: "rule",
  elapsed: 2000,
  session: "test",
  review: "test",
  gap: 0,
  first: true,
  evidenceVersion: 2,
  ...overrides,
});

describe("Authored contextual conversation practice", () => {
  it("keeps all 14 existing texts and adds 30 complete listening lessons bound to reviewed senses", () => {
    const state = source();
    expect(dialogues.filter((d) => !d.id.startsWith("listen-"))).toHaveLength(
      14,
    );
    expect(listeningDialogues).toHaveLength(30);
    expect(availableDialogues(state)).toHaveLength(44);
    expect(new Set(dialogues.map((d) => d.id)).size).toBe(44);
    for (const d of dialogues) {
      expect(d.targets.length).toBeGreaterThanOrEqual(3);
      expect(d.targets.length).toBeLessThanOrEqual(7);
      expect(
        new Set(d.lines.map((l) => l.speaker)).size,
      ).toBeGreaterThanOrEqual(2);
      expect(d.lines.every((l) => l.vi && l.en)).toBe(true);
      for (const target of d.targets) {
        expect(target.partOfSpeech).toBe(
          state.entries[target.id].word.part_of_speech,
        );
        expect(
          d.lines.some((l) => l.en.toLowerCase().includes(target.lemma)),
        ).toBe(true);
      }
      expect(d.questions).toHaveLength(d.id.startsWith("listen-") ? 4 : 3);
      if (d.id.startsWith("listen-")) {
        expect(d.lines.length).toBeGreaterThanOrEqual(8);
        expect(d.lines.length).toBeLessThanOrEqual(12);
        expect(
          d.questions.filter((q) => q.kind === "comprehension"),
        ).toHaveLength(2);
        expect(d.questions.filter((q) => q.kind === "meaning")).toHaveLength(1);
        expect(d.questions.filter((q) => q.kind === "cloze")).toHaveLength(1);
      }
      for (const q of d.questions) {
        expect(
          q.targetIds.every((id) => d.targets.some((t) => t.id === id)),
        ).toBe(true);
        if (q.options)
          expect(q.accepted.every((a) => q.options!.includes(a))).toBe(true);
      }
    }
    expect(
      new Set(
        dialogues
          .filter((d) => !d.id.startsWith("listen-"))
          .map((d) => d.lines.length),
      ),
    ).toEqual(new Set([6, 8]));
    expect(listeningDialogues.filter((d) => d.level === "C1")).toHaveLength(6);
  });

  it("declines archived, lookup-only, missing or changed-sense targets", () => {
    for (const kind of [
      "archive",
      "lookup",
      "missing",
      "sense",
      "pos",
    ] as const) {
      const state = source();
      const id = sample.targets[0].id;
      if (kind === "archive") state.entries[id].archived = true;
      if (kind === "lookup") state.entries[id].word.learning_status = "lookup";
      if (kind === "missing") delete state.entries[id];
      if (kind === "sense")
        state.entries[id].word.meaning_vi = "một nghĩa cá nhân khác";
      if (kind === "pos") state.entries[id].word.part_of_speech = "verb";
      expect(availableDialogues(state).some((d) => d.id === sample.id)).toBe(
        false,
      );
    }
  });

  it("gives an honest fallback without history and deterministic ordering after reload", () => {
    const state = source();
    state.exposures = Object.fromEntries(
      sample.targets.map((target) => [target.id, Date.now()]),
    );
    const before = JSON.stringify(state);
    const first = recommendDialogues(state);
    expect(first[0].personalized).toBe(false);
    expect(first[0].reason).toContain("chưa có lịch sử");
    expect(recommendDialogues(JSON.parse(JSON.stringify(state)))).toEqual(
      first,
    );
    expect(JSON.stringify(state)).toBe(before);
  });

  it("prioritizes a true three-word overlap before a partial two-word match", () => {
    const state = source();
    sample.targets.slice(0, 3).forEach((t) => {
      state.entries[t.id].enrolled = true;
    });
    const other = dialogues.find((d) => d.id === "buying-a-desk")!;
    state.history = other.targets
      .slice(0, 2)
      .map((t) =>
        result(t.id, { contentVersion: contentKey(state.entries[t.id].word) }),
      );
    const list = recommendDialogues(state);
    expect(list[0].dialogue.id).toBe(sample.id);
    expect(list[0].personalized).toBe(true);
    expect(list[0].studied).toBe(3);
    expect(list.find((r) => r.dialogue.id === other.id)?.weak).toBe(2);
  });

  it("filters genuine difficulty and length variants and does not invent weak results", () => {
    const state = source();
    expect(
      recommendDialogues(state, { level: "B2", length: "long" }).every(
        (r) => r.dialogue.level === "B2" && r.dialogue.lines.length > 6,
      ),
    ).toBe(true);
    expect(recommendDialogues(state, { weakOnly: true })).toEqual([]);
    const t = sample.targets[0];
    state.history = [result(t.id, { contentVersion: "previous sense" })];
    expect(
      recommendDialogues(state).find((r) => r.dialogue.id === sample.id)?.weak,
    ).toBe(0);
    state.history[0].contentVersion = contentKey(state.entries[t.id].word);
    expect(recommendDialogues(state, { weakOnly: true })[0].dialogue.id).toBe(
      sample.id,
    );
  });

  it("normalizes only declared bounded answers, never grades arbitrary prose by similarity", () => {
    const gap = sample.questions.find((q) => q.kind === "cloze")!;
    expect(evaluateDialogueAnswer(gap, "  DEADLINE ").correct).toBe(true);
    expect(evaluateDialogueAnswer(gap, "deadline tomorrow").correct).toBe(
      false,
    );
    expect(evaluateDialogueAnswer(gap, "due date").correct).toBe(false);
    expect(evaluateDialogueAnswer(gap, "deadline").hint).toBe(true);
  });

  it("records supported answers and open writing separately without changing SRS or old history", () => {
    const state = source();
    const before = JSON.stringify(state);
    const values = Object.fromEntries(
      sample.questions.map((q) => [q.id, q.accepted[0]]),
    );
    values.reply = "Thanks, Ben. Could we meet at three tomorrow?";
    const attempt = makeConversationAttempt(state, sample, values, {
      lines: ["line-0"],
      complete: false,
    });
    expect(attempt.answers.filter((a) => a.correct)).toHaveLength(3);
    expect(attempt.answers.every((answer) => answer.hint)).toBe(true);
    expect(
      attempt.answers.find((a) => a.kind === "reply")?.correct,
    ).toBeUndefined();
    expect(attempt.targetContentVersions).toEqual(
      Object.fromEntries(
        sample.targets.map((t) => [t.id, contentKey(state.entries[t.id].word)]),
      ),
    );
    expect(attempt.listenedComplete).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
    expect(() =>
      validatePracticeCollections({ ...state, conversations: [attempt] }),
    ).not.toThrow();
  });

  it("only records unassisted immediate recall when the transcript stays hidden without a hint or retry", () => {
    const state = source();
    const values = Object.fromEntries(
      sample.questions.map((q) => [q.id, q.accepted[0]]),
    );
    const attempt = (usedHint = false, retryOf?: string) =>
      makeConversationAttempt(
        state,
        sample,
        values,
        { lines: [], complete: false, hidden: true, usedHint },
        retryOf,
      );
    expect(attempt().answers.every((answer) => !answer.hint)).toBe(true);
    expect(attempt(true).answers.every((answer) => answer.hint)).toBe(true);
    expect(
      attempt(false, "earlier-result").answers.every((answer) => answer.hint),
    ).toBe(true);
    expect(state.history).toEqual([]);
    expect(state.schedules).toEqual({});
  });

  it("distinguishes exposure, listening and an actual wrong answer when proposing retries", () => {
    const state = source();
    const values = Object.fromEntries(
      sample.questions.map((q) => [q.id, q.accepted[0]]),
    );
    values.understand = "wrong option";
    const first = makeConversationAttempt(state, sample, values, {
      lines: [],
      complete: false,
    });
    first.time = 10;
    state.conversations = [first];
    const recommended = recommendDialogues(state).find(
      (r) => r.dialogue.id === sample.id,
    )!;
    expect(recommended.studied).toBe(4);
    expect(recommended.weak).toBe(2);
    const corrected = makeConversationAttempt(
      state,
      sample,
      Object.fromEntries(sample.questions.map((q) => [q.id, q.accepted[0]])),
      { lines: [], complete: true },
      first.id,
    );
    corrected.time = 20;
    state.conversations.push(corrected);
    expect(
      recommendDialogues(state).find((r) => r.dialogue.id === sample.id)?.weak,
    ).toBe(2);
    expect(state.history).toEqual([]);
    expect(state.schedules).toEqual({});
  });
  it("keeps difficulty through supported repairs and requires a fresh delayed unassisted check", () => {
    const state = source();
    const day = 86_400_000;
    const start = Date.UTC(2026, 0, 1);
    const values = Object.fromEntries(
      sample.questions.map((q) => [q.id, q.accepted[0]]),
    );
    const cloze = sample.questions.find((q) => q.kind === "cloze")!;
    const failed = makeConversationAttempt(
      state,
      sample,
      { ...values, [cloze.id]: "not the answer" },
      { lines: [], complete: false, hidden: true },
    );
    failed.time = start;
    state.conversations = [failed];
    const weak = (now: number) =>
      recommendDialogues(state, { weakOnly: true, now }).find(
        (r) => r.dialogue.id === sample.id,
      )?.weak || 0;
    const add = (time: number, supported: boolean, retryOf?: string) => {
      const attempt = makeConversationAttempt(
        state,
        sample,
        values,
        { lines: [], complete: false, hidden: true, usedHint: supported },
        retryOf,
      );
      attempt.time = time;
      state.conversations!.push(attempt);
      return attempt;
    };
    expect(weak(start)).toBe(1);
    const repair = add(start + 60_000, true, failed.id);
    expect(weak(repair.time)).toBe(1);
    const nextDayRepair = add(repair.time + day, false, repair.id);
    expect(weak(nextDayRepair.time)).toBe(1);
    const early = add(nextDayRepair.time + day - 1, false);
    expect(weak(early.time)).toBe(1);
    const recovered = add(early.time + day, false);
    expect(weak(recovered.time)).toBe(0);
    const newLapse = { ...failed, id: "new-lapse", time: recovered.time + 1 };
    state.conversations.push(newLapse);
    expect(weak(newLapse.time)).toBe(1);
    expect(state.history).toEqual([]);
    expect(state.schedules).toEqual({});
  });

  it("does not let old versions or an unrelated answer clear current-sense difficulty", () => {
    const state = source();
    const day = 86_400_000;
    const start = Date.UTC(2026, 0, 1);
    const values = Object.fromEntries(
      sample.questions.map((q) => [q.id, q.accepted[0]]),
    );
    const cloze = sample.questions.find((q) => q.kind === "cloze")!;
    const id = cloze.targetIds[0];
    const make = (time: number, wrong = false) => {
      const attempt = makeConversationAttempt(
        state,
        sample,
        { ...values, ...(wrong ? { [cloze.id]: "wrong" } : {}) },
        { lines: [], complete: false, hidden: true },
      );
      attempt.time = time;
      return attempt;
    };
    const failed = make(start, true);
    const oldContent = make(start + day);
    oldContent.targetContentVersions[id] = "previous meaning";
    const oldDialogue = make(start + 2 * day);
    oldDialogue.dialogueVersion = "previous authored text";
    const unrelated = make(start + 3 * day);
    unrelated.answers = unrelated.answers.filter(
      (answer) => !answer.targetIds.includes(id),
    );
    const future = make(start + 10 * day);
    state.conversations = [future, unrelated, oldDialogue, oldContent, failed];
    const before = JSON.stringify(state);
    expect(
      recommendDialogues(state, { weakOnly: true, now: start + 4 * day }).find(
        (r) => r.dialogue.id === sample.id,
      )?.weak,
    ).toBe(1);
    expect(JSON.stringify(state)).toBe(before);
    // A new independent check of the current authored questions can clear the
    // dialogue-only difficulty, without mutating historical records or SRS.
    state.conversations.push(make(start + 4 * day));
    expect(
      recommendDialogues(state, { weakOnly: true, now: start + 4 * day }).find(
        (r) => r.dialogue.id === sample.id,
      ),
    ).toBeUndefined();
    expect(state.history).toEqual([]);
    expect(state.schedules).toEqual({});
    // Recovery in the authored dialogue cannot remove independent vocabulary
    // difficulty recorded by the existing learning-evidence selector.
    state.history = [
      result(id, {
        time: start + 4 * day,
        contentVersion: contentKey(state.entries[id].word),
      }),
    ];
    expect(
      recommendDialogues(state, { weakOnly: true, now: start + 4 * day }).find(
        (r) => r.dialogue.id === sample.id,
      )?.weak,
    ).toBe(1);
    state.history = [];
    state.conversations = [
      {
        ...failed,
        targetContentVersions: {
          ...failed.targetContentVersions,
          [id]: "old sense",
        },
      },
    ];
    expect(
      recommendDialogues(state, { weakOnly: true, now: start + 4 * day }),
    ).toEqual([]);
  });
});

describe("Listen-first attempt evidence", () => {
  it("requires successful complete audio with every line before storing a listening result", () => {
    const state = source();
    const values = Object.fromEntries(
      sample.questions.map((question) => [question.id, question.accepted[0]]),
    );
    const lines = sample.lines.map((_, index) => `line-${index}`);
    for (const audio of [
      { mode: "listen" as const, lines, complete: false },
      { mode: "listen" as const, lines: lines.slice(1), complete: true },
      { mode: "listen" as const, lines: [], complete: true },
    ])
      expect(() =>
        makeConversationAttempt(state, sample, values, audio),
      ).toThrow(/nghe hết/);
    const before = structuredClone(state);
    const attempt = makeConversationAttempt(state, sample, values, {
      mode: "listen",
      lines,
      complete: true,
      transcriptRevealed: false,
    });
    expect(attempt).toMatchObject({
      mode: "listen",
      read: false,
      transcriptRevealed: false,
      listenedComplete: true,
      listenedLineIds: lines,
    });
    expect(
      attempt.answers.every((answer) => answer.correct && !answer.hint),
    ).toBe(true);
    validatePracticeCollections({ ...state, conversations: [attempt] });
    expect(state).toEqual(before);
  });

  it("records opening the transcript and retries as supported, preserving legacy read records", () => {
    const state = source();
    const values = Object.fromEntries(
      sample.questions.map((question) => [question.id, question.accepted[0]]),
    );
    const audio = {
      mode: "listen" as const,
      lines: sample.lines.map((_, index) => `line-${index}`),
      complete: true,
      transcriptRevealed: true,
    };
    const revealed = makeConversationAttempt(state, sample, values, audio);
    expect(revealed.read).toBe(true);
    expect(revealed.answers.every((answer) => answer.hint)).toBe(true);
    const retry = makeConversationAttempt(
      state,
      sample,
      values,
      { ...audio, transcriptRevealed: false },
      revealed.id,
    );
    expect(retry.answers.every((answer) => answer.hint)).toBe(true);
    validatePracticeCollections({ ...state, conversations: [revealed, retry] });
    const legacy = makeConversationAttempt(state, sample, values, {
      lines: [],
      complete: false,
    });
    expect(legacy).not.toHaveProperty("mode");
    expect(legacy).not.toHaveProperty("transcriptRevealed");
    expect(legacy.read).toBe(true);
  });
});
