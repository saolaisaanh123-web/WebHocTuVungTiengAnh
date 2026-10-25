import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assessLearningAnswer } from "./assessment";
import {
  canPractice,
  contentKey,
  empty,
  merge,
  parse,
  record,
  type Word,
} from "./core";
import { selectLearningEvidence } from "./evidence";

const words = parse(readFileSync("public/data/vocabulary.txt", "utf8"));
const entry = (headword: string): Word => {
  const found = words.find((word) => word.word === headword);
  if (!found) throw Error(`Missing corpus fixture: ${headword}`);
  return found;
};
const assess = (answer: string, headword: string, skill: number) =>
  assessLearningAnswer(answer, entry(headword), skill, words);
const usage: {
  wordId: string;
  headword: string;
  partOfSpeech: string;
  meaningVi: string;
  example: { en: string; vi: string; alternatives?: string[] };
}[] = JSON.parse(readFileSync("data/usage/group-a.json", "utf8"));

describe("fair target-word assessment on the real corpus", () => {
  it.each([1, 3, 4])("accepts the target itself for skill %i", (skill) => {
    expect(assess(" EVERYONE ", "everyone", skill)).toEqual({
      outcome: "correct",
    });
  });

  it.each([
    ["everybody", "everyone"],
    ["everyone", "everybody"],
    ["fairness", "justice"],
    ["justice", "fairness"],
  ])("keeps %s neutral for the shared meaning cue of %s", (answer, target) => {
    expect(canPractice(entry(answer), 1)).toBe(true);
    expect(canPractice(entry(target), 1)).toBe(true);
    expect(assess(answer, target, 1)).toMatchObject({ outcome: "ungraded" });
  });

  it("uses the displayed part of speech to distinguish decide and decision", () => {
    expect(entry("decide").meaning_vi).toBe(entry("decision").meaning_vi);
    expect(assess("decide", "decision", 1)).toEqual({ outcome: "incorrect" });
    expect(assess("decision", "decide", 1)).toEqual({ outcome: "incorrect" });
  });

  it.each([
    ["large", "big"],
    ["big", "large"],
    ["start", "begin"],
    ["begin", "start"],
    ["glad", "happy"],
    ["happy", "glad"],
  ])(
    "keeps %s neutral for the reviewed ambiguous meaning cue of %s",
    (answer, target) => {
      expect(assess(answer, target, 1)).toMatchObject({
        outcome: "ungraded",
      });
      expect(assess(target, target, 1)).toEqual({ outcome: "correct" });
    },
  );

  it("treats reordered semicolon glosses alike without inferring equivalence from one shared gloss", () => {
    const target = entry("big");
    const alternative = entry("large");
    expect(
      assessLearningAnswer("large", target, 1, [target, alternative]),
    ).toMatchObject({ outcome: "ungraded" });
    for (const meaning_vi of ["lớn; quan trọng", "to", "lớn hơn"])
      expect(
        assessLearningAnswer("large", target, 1, [
          target,
          { ...alternative, meaning_vi },
        ]),
      ).toEqual({ outcome: "incorrect" });
  });

  it("binds reviewed meaning pairs to the current senses and part of speech of both entries", () => {
    const begin = entry("begin");
    const start = entry("start");
    for (const changed of [
      { ...start, meaning_vi: "khởi động máy" },
      { ...start, part_of_speech: "noun" },
      { ...start, learning_status: "lookup" },
    ])
      expect(assessLearningAnswer("start", begin, 1, [begin, changed])).toEqual(
        { outcome: "incorrect" },
      );
    expect(
      assessLearningAnswer(
        "start",
        { ...begin, meaning_vi: "có nguồn gốc" },
        1,
        [begin, start],
      ),
    ).toEqual({ outcome: "incorrect" });
  });

  it("does not infer synonyms from a different Vietnamese cue or unchecked entry", () => {
    const target = entry("justice");
    for (const alternative of [
      { ...entry("fairness"), meaning_vi: "sự công bằng; tính vô tư" },
      { ...entry("fairness"), learning_status: "lookup" },
      { ...entry("fairness"), part_of_speech: "" },
    ])
      expect(
        assessLearningAnswer("fairness", target, 1, [target, alternative]),
      ).toEqual({ outcome: "incorrect" });
  });

  it("allows declared answer variants of the matching alternative", () => {
    const target = entry("justice");
    const alternative = {
      ...entry("fairness"),
      accepted_answers: "fairness|equity",
    };
    expect(
      assessLearningAnswer("equity", target, 1, [target, alternative]),
    ).toMatchObject({ outcome: "ungraded" });
    expect(assess("equity", "justice", 1)).toEqual({ outcome: "incorrect" });
  });

  it.each([
    ["everybody", "everyone"],
    ["everyone", "everybody"],
    ["movie", "film"],
    ["large", "big"],
    ["big", "large"],
    ["start", "begin"],
    ["begin", "start"],
    ["hard", "difficult"],
    ["difficult", "hard"],
    ["glad", "happy"],
    ["happy", "glad"],
  ])(
    "keeps the reviewed contextual alternative %s neutral for %s",
    (answer, target) => {
      expect(canPractice(entry(target), 4)).toBe(true);
      expect(assess(answer, target, 4)).toMatchObject({ outcome: "ungraded" });
    },
  );

  it("does not generalize a contextual alternative to another sentence or word sense", () => {
    const film = entry("film");
    for (const modified of [
      { ...film, example_en: "A thin film of oil covered the water." },
      { ...film, part_of_speech: "verb" },
      { ...film, meaning_vi: "màng mỏng" },
    ])
      expect(assessLearningAnswer("movie", modified, 4, words)).toEqual({
        outcome: "incorrect",
      });
    // A matching Vietnamese cue alone is not a reviewed cloze alternative.
    expect(assess("fairness", "justice", 4)).toEqual({ outcome: "incorrect" });
  });

  it.each([
    ["big", "large", 1],
    ["begin", "start", 1],
    ["difficult", "hard", 4],
    ["happy", "glad", 4],
  ] as const)(
    "does not reset a due schedule or award recall evidence for %s → %s",
    (target, answer, skill) => {
      const word = entry(target);
      const now = Date.now();
      const state = merge(empty(), [word], "default");
      state.exposures = { [word.id]: now - 8 * 86_400_000 };
      state.schedules[`${word.id}:${skill}`] = {
        step: 3,
        last: now - 14 * 86_400_000,
        due: now - 1,
        contentVersion: contentKey(word, skill),
      };
      const before = structuredClone(state.schedules);
      const assessment = assessLearningAnswer(answer, word, skill, words);
      expect(assessment.outcome).toBe("ungraded");
      const after = record(
        state,
        {
          id: `ambiguous-${word.id}`,
          wordId: word.id,
          time: now,
          skill,
          answer,
          correct: false,
          hint: false,
          method: "ungraded",
          elapsed: 2_000,
          session: "ambiguous-session",
          review: "ambiguous-review",
          gap: 0,
          first: true,
          independent: false,
          evidenceVersion: 2,
        },
        true,
      );
      expect(after.schedules).toEqual(before);
      expect(after.history).toHaveLength(1);
      expect(after.history[0]).toMatchObject({ answer, method: "ungraded" });
      expect(selectLearningEvidence(after, now).attempts).toEqual([]);
    },
  );

  it("does not apply a reviewed contextual synonym to another skill or an unreviewed context", () => {
    for (const [target, answer] of [
      ["difficult", "hard"],
      ["happy", "glad"],
      ["big", "large"],
    ]) {
      expect(assess(answer, target, 3)).toEqual({ outcome: "incorrect" });
      expect(
        assessLearningAnswer(
          answer,
          { ...entry(target), example_en: `Another use of ${target}.` },
          4,
          words,
        ),
      ).toEqual({ outcome: "incorrect" });
    }
  });

  it.each([
    ["suggest", "recommend"],
    ["suggest", "advise"],
    ["recommend", "suggest"],
  ])(
    "keeps %s's source-reviewed second-context answer %s neutral",
    (target, answer) => {
      const original = entry(target);
      const supplement = usage.find((row) => row.wordId === original.id)!;
      expect(supplement.headword).toBe(original.word);
      expect(supplement.partOfSpeech).toBe(original.part_of_speech);
      expect(supplement.meaningVi).toBe(original.meaning_vi);
      const contextualWord = {
        ...original,
        example_en: supplement.example.en,
        example_vi: supplement.example.vi,
      };
      const result = assessLearningAnswer(
        answer,
        contextualWord,
        4,
        words,
        supplement.example.alternatives,
      );
      expect(result.outcome).toBe("ungraded");
      expect(result.message).toContain("không tính đúng/sai");
      expect(
        assessLearningAnswer(
          original.word,
          contextualWord,
          4,
          words,
          supplement.example.alternatives,
        ).outcome,
      ).toBe("correct");
      // A sentence-bound alternative is never accepted in an unrelated recall skill.
      expect(
        assessLearningAnswer(
          answer,
          contextualWord,
          3,
          words,
          supplement.example.alternatives,
        ).outcome,
      ).toBe("incorrect");
    },
  );

  it("does not turn an unreviewed synonym or typo into contextual credit", () => {
    const supplement = usage.find((row) => row.headword === "suggest")!;
    const contextualWord = {
      ...entry("suggest"),
      example_en: supplement.example.en,
      example_vi: supplement.example.vi,
    };
    for (const answer of ["recomend", "think", "recommend that", ""])
      expect(
        assessLearningAnswer(
          answer,
          contextualWord,
          4,
          words,
          supplement.example.alternatives,
        ).outcome,
      ).toBe("incorrect");
    // Callers must attach only the reviewed alternatives for the actual frozen
    // question; the default API never guesses synonyms by headword alone.
    expect(
      assessLearningAnswer("recommend", entry("suggest"), 4, words).outcome,
    ).toBe("incorrect");
  });

  it.each([
    ["two", "to"],
    ["too", "two"],
    ["right", "write"],
    ["know", "no"],
    ["there", "their"],
    ["they’re", "their"],
  ])(
    "does not mark the homophone %s as forgotten %s in dictation",
    (answer, target) => {
      expect(canPractice(entry(target), 3)).toBe(true);
      expect(assess(answer, target, 3)).toMatchObject({ outcome: "ungraded" });
    },
  );

  it("limits the homophone exception to dictation", () => {
    expect(assess("two", "to", 1)).toEqual({ outcome: "incorrect" });
    expect(assess("two", "to", 4)).toEqual({ outcome: "incorrect" });
  });

  it.each(["", "evryone", "everyone else", "every body"])(
    "does not hide ordinary recall errors: %j",
    (answer) => {
      expect(assess(answer, "everyone", 1)).toEqual({ outcome: "incorrect" });
      expect(assess(answer, "everyone", 4)).toEqual({ outcome: "incorrect" });
    },
  );

  it("preserves explicit case requirements for targets and neutral alternatives", () => {
    const target = { ...entry("everyone"), case_sensitive: "true" };
    expect(assessLearningAnswer("everyone", target, 4, words)).toEqual({
      outcome: "correct",
    });
    for (const [answer, skill] of [
      ["EVERYONE", 4],
      ["EVERYBODY", 4],
      ["everybody", 1],
    ] as const)
      expect(assessLearningAnswer(answer, target, skill, words)).toEqual({
        outcome: "incorrect",
      });
    expect(
      assessLearningAnswer(
        "RIGHT",
        { ...entry("write"), case_sensitive: "true" },
        3,
        words,
      ),
    ).toEqual({ outcome: "incorrect" });
  });
});
