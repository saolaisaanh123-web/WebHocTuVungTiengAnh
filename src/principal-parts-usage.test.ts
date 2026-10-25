import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  cloze,
  contentKey,
  empty,
  grade,
  merge,
  parse,
  type Result,
} from "./core";
import {
  attachStudyContexts,
  exerciseWord,
  getUsage,
  type UsageEntry,
} from "./usage";

const corpus = parse(readFileSync("public/data/vocabulary.txt", "utf8"));
const additions = JSON.parse(
  readFileSync("data/usage/group-j.json", "utf8"),
) as UsageEntry[];
const NOW = new Date(2026, 9, 25, 12).getTime();
const forms = {
  go: ["went", "gone", "going", "goes"],
  get: ["got", "gotten", "getting", "gets"],
  take: ["took", "taken", "taking", "takes"],
  buy: ["bought", "bought", "buying", "buys"],
  run: ["ran", "run", "running", "runs"],
  write: ["wrote", "written", "writing", "writes"],
};

describe("Reviewed principal parts and additional contexts", () => {
  it("binds all six irregular-verb supplements to the existing exact sense", () => {
    expect(additions.map((entry) => entry.headword).sort()).toEqual(
      Object.keys(forms).sort(),
    );
    for (const entry of additions) {
      const word = corpus.find((candidate) => candidate.id === entry.wordId)!;
      expect(word, entry.wordId).toBeDefined();
      expect(word.part_of_speech).toBe("verb");
      expect(getUsage(word)).toEqual(entry);
      expect(Object.values(entry.principalParts!)).toEqual(
        forms[entry.headword as keyof typeof forms],
      );
      expect(entry.example.en).not.toBe(word.example_en);
      expect(cloze({ ...word, example_en: entry.example.en })).toContain(
        "________",
      );
      for (const source of entry.sources) {
        expect(source.url).toMatch(
          /^https:\/\/www\.oxfordlearnersdictionaries\.com\/definition\/(?:american_english|english)\//,
        );
        expect(source.sha256).toMatch(/^[a-f0-9]{64}$/);
      }
      expect(
        getUsage({ ...word, meaning_vi: "nghĩa cá nhân khác" }),
      ).toBeUndefined();
      expect(getUsage({ ...word, part_of_speech: "noun" })).toBeUndefined();
    }
  });

  it("keeps forms as reference instead of accepting the wrong tense in every exercise", () => {
    for (const entry of additions) {
      const word = corpus.find((candidate) => candidate.id === entry.wordId)!;
      const before = structuredClone(word);
      const keys = [0, 1, 2, 3, 4, 5].map((skill) => contentKey(word, skill));
      getUsage(word);
      for (const form of Object.values(entry.principalParts!)) {
        if (form !== word.word)
          expect(grade(form, word), `${word.word}: ${form}`).toBe(false);
      }
      expect(word).toEqual(before);
      expect(
        [0, 1, 2, 3, 4, 5].map((skill) => contentKey(word, skill)),
      ).toEqual(keys);
    }
  });

  it("uses each new context only in a newly planned task and preserves schedules and old questions", () => {
    for (const entry of additions) {
      const word = corpus.find((candidate) => candidate.id === entry.wordId)!;
      const version = contentKey(word, 4);
      const s = merge(empty(), [word], "default");
      const previous: Result = {
        id: `old-${word.id}`,
        wordId: word.id,
        time: NOW - 8 * 86_400_000,
        skill: 4,
        answer: word.word,
        correct: true,
        hint: false,
        method: "rule",
        elapsed: 1200,
        session: `old-session-${word.id}`,
        review: `old-review-${word.id}`,
        gap: 0,
        first: true,
        independent: true,
        evidenceVersion: 2,
        contentVersion: version,
      };
      s.history = [previous];
      s.schedules[`${word.id}:4`] = {
        due: NOW,
        last: previous.time,
        step: 3,
        contentVersion: version,
      };
      const tasks = [
        { id: word.id, skill: 4, review: `new-review-${word.id}` },
      ];
      const before = structuredClone(s);
      const planned = attachStudyContexts(s, tasks);
      expect(planned[0].context?.en).toBe(entry.example.en);
      expect(planned[0].context?.targetVersion).toBe(version);
      const exercise = exerciseWord(word, planned[0].context)!;
      expect(exercise.accepted_answers).toBe(word.accepted_answers);
      expect(exercise.id).toBe(word.id);
      expect(tasks[0]).not.toHaveProperty("context");
      expect(s).toEqual(before);
      expect(exerciseWord(word)?.example_en).toBe(word.example_en);
    }
  });

  it("explains the American gotten scope and the separate have got construction", () => {
    const get = additions.find((entry) => entry.headword === "get")!;
    expect(get.note).toContain("nghĩa nhận được");
    expect(get.note).toContain("have got");
    expect(
      get.sources.some((source) =>
        source.url.endsWith("/american_english/have_1"),
      ),
    ).toBe(true);
    const take = additions.find((entry) => entry.headword === "take")!;
    expect(take.meaningVi).toBe("cầm hoặc nắm lấy");
    expect(
      take.patterns.every((pattern) => !/bus|time/.test(pattern.form)),
    ).toBe(true);
  });
});
