import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assessLearningAnswer } from "./assessment";
import {
  answerForms,
  cloze,
  contentKey,
  empty,
  exposeWrittenForms,
  grade,
  merge,
  parse,
  record,
  serialize,
  validateBackup,
  type Word,
} from "./core";

const words = parse(readFileSync("public/data/vocabulary.txt", "utf8"));
const entry = (id: string) => words.find((word) => word.id === id)!;
const ok = entry("ox-565339bc4d33d7-01");
const email = entry("ox-82244417f956ac-01");
const reviewed = [
  [ok, "okay"],
  [ok, "Okay"],
  [email, "e-mail"],
] as const;
const reviewedCases = reviewed.map(
  ([word, spelling]) => [word.word, spelling, word] as const,
);
const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 28, 12);

describe("equivalent Oxford American spellings on unchanged legacy words", () => {
  it.each(reviewedCases)(
    "accepts %s's reviewed spelling %s in written recall and cloze",
    (_, spelling, word) => {
      expect(answerForms(word)).toContain(spelling);
      expect(grade(spelling, word)).toBe(true);
      for (const skill of [1, 3, 4])
        expect(assessLearningAnswer(spelling, word, skill, words)).toEqual({
          outcome: "correct",
        });
      expect(
        cloze({
          ...word,
          example_en: `She wrote ${spelling} and ${word.word}.`,
        }),
      ).toBe("She wrote ________ and ________.");
      expect(grade(`${spelling}x`, word)).toBe(false);
    },
  );

  it("does not apply a reviewed spelling after its ID, headword, POS or meaning changes", () => {
    for (const [word, spelling] of reviewed) {
      for (const changed of [
        { ...word, id: "custom-word" },
        { ...word, word: "different-word", accepted_answers: "different-word" },
        { ...word, part_of_speech: "adjective" },
        { ...word, meaning_vi: "nghĩa khác" },
        { ...word, learning_status: "lookup" },
        { ...word, content_status: "draft" },
      ])
        expect(grade(spelling, changed)).toBe(false);
    }
  });

  it("keeps explicit case requirements for I and May and the unchanged OK spelling", () => {
    expect(ok.case_sensitive).toBe("true");
    expect(grade("OK", ok)).toBe(true);
    expect(grade("ok", ok)).toBe(false);
    for (const [id, lower] of [
      ["ox-a83dd0ccbffe39-01", "i"],
      ["ox-8c78fe5b993648-01", "may"],
    ]) {
      const word = entry(id);
      expect(word.case_sensitive).toBe("true");
      expect(grade(lower, word)).toBe(false);
      expect(grade(word.word, word)).toBe(true);
    }
  });

  it("does not mutate the TXT representation, content version, history or active session while loading aliases", () => {
    for (const [word, spelling] of reviewed) {
      const snapshot = structuredClone(word);
      const text = serialize([word]);
      const state = merge(empty(), [word], "default");
      for (let skill = 0; skill < 6; skill++)
        state.schedules[`${word.id}:${skill}`] = {
          step: 3,
          last: NOW - 14 * DAY,
          due: NOW - 1,
          contentVersion: contentKey(word, skill),
        };
      state.session = {
        id: "pending",
        queue: [{ id: word.id, skill: 1, review: "pending" }],
        index: 0,
        started: NOW,
        scheduled: true,
        count: 1,
        draft: {
          key: "pending:0",
          answer: spelling,
          hint: false,
          revealed: false,
        },
      };
      const before = structuredClone(state);
      expect(grade(spelling, word)).toBe(true);
      expect(word).toEqual(snapshot);
      expect(serialize([word])).toBe(text);
      const reloaded = merge(state, parse(text), "default");
      expect(reloaded.schedules).toEqual(before.schedules);
      expect(reloaded.history).toEqual(before.history);
      expect(reloaded.session).toEqual(before.session);
      expect(serialize([reloaded.entries[word.id].word])).toBe(text);
      expect(validateBackup(JSON.parse(JSON.stringify(state)))).toEqual(before);
      expect(contentKey(word, 1)).toBe(
        JSON.stringify([
          word.word,
          word.part_of_speech,
          word.meaning_vi,
          word.accepted_answers,
          word.case_sensitive,
        ]),
      );
    }
  });

  it.each(reviewedCases)(
    "does not reset %s's valid answer %s to the first SRS step",
    (_, spelling, word) => {
      const state = merge(empty(), [word], "default");
      state.exposures = { [word.id]: NOW - 8 * DAY };
      state.schedules[`${word.id}:1`] = {
        step: 3,
        last: NOW - 14 * DAY,
        due: NOW - 1,
        contentVersion: contentKey(word, 1),
      };
      const beforeVersion = state.schedules[`${word.id}:1`].contentVersion;
      const assessment = assessLearningAnswer(spelling, word, 1, words);
      const next = record(
        state,
        {
          id: "valid-spelling",
          wordId: word.id,
          time: NOW,
          skill: 1,
          answer: spelling,
          correct: assessment.outcome === "correct",
          hint: false,
          method: "rule",
          elapsed: 2000,
          session: "delayed-session",
          review: "delayed-review",
          gap: 0,
          first: true,
          independent: true,
          evidenceVersion: 2,
        },
        true,
      );
      expect(next.schedules[`${word.id}:1`]).toMatchObject({
        step: 4,
        contentVersion: beforeVersion,
      });
      expect(next.history[0]).toMatchObject({
        correct: true,
        independent: true,
      });
    },
  );

  it("does not certify delayed written recall immediately after seeing an equivalent spelling elsewhere", () => {
    const source: Word = {
      id: "source",
      word: "note",
      meaning_vi: "ghi chú",
      example_en: "Read the note.",
      example_vi: "Đọc ghi chú.",
    };
    let state = merge(empty(), [ok, source], "default");
    state.exposures = { [ok.id]: NOW - 8 * DAY };
    state = exposeWrittenForms(state, source.id, ["okay"], NOW - 1000);
    const next = record(
      state,
      {
        id: "primed-spelling",
        wordId: ok.id,
        time: NOW,
        skill: 1,
        answer: "OK",
        correct: true,
        hint: false,
        method: "rule",
        elapsed: 2000,
        session: "session",
        review: "review",
        gap: 0,
        first: true,
        independent: true,
        evidenceVersion: 2,
      },
      false,
    );
    expect(next.history[0]).toMatchObject({
      independent: false,
      exposureGap: 1000,
    });
    expect(next.exposures?.[ok.id]).toBe(NOW);
  });
});
