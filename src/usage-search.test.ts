import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contentKey, empty, grade, merge, parse, serialize } from "./core";
import {
  getUsage,
  normalizeVocabularyLookup,
  prioritizeExactVocabularyMatches,
  vocabularyLookupText,
} from "./usage";

const words = parse(readFileSync("public/data/vocabulary.txt", "utf8"));
const word = (headword: string) =>
  words.find((entry) => entry.word === headword)!;
const matches = (headword: string, query: string) =>
  vocabularyLookupText(word(headword)).includes(
    normalizeVocabularyLookup(query),
  );

describe("Sense-bound vocabulary reference lookup", () => {
  it("finds reviewed verb forms, patterns and Vietnamese explanations without accents", () => {
    expect(matches("go", "went")).toBe(true);
    expect(matches("go", "gone")).toBe(true);
    expect(matches("go", "go home")).toBe(true);
    expect(matches("get", "gotten")).toBe(true);
    expect(matches("work", "lam viec co muc dich")).toBe(true);
    expect(matches("advice", "khong dem duoc")).toBe(true);
    expect(normalizeVocabularyLookup("  ĐẾM ĐƯỢC  ")).toBe("dem duoc");
    expect(normalizeVocabularyLookup("  somebody’s   name ")).toBe(
      "somebody's name",
    );
  });

  it("puts the searched headword before incidental phrase matches without changing the remaining library order", () => {
    const entries = words
      .filter((w) => vocabularyLookupText(w).includes("elevator"))
      .map((word) => ({ word }));
    expect(entries.length).toBeGreaterThan(1);
    const before = structuredClone(entries);
    const ranked = prioritizeExactVocabularyMatches(entries, " ELEVATOR ");
    expect(ranked[0].word.word).toBe("elevator");
    expect(ranked.filter((e) => e.word.word !== "elevator")).toEqual(
      entries.filter((e) => e.word.word !== "elevator"),
    );
    expect(prioritizeExactVocabularyMatches(entries, "")).toEqual(entries);
    expect(entries).toEqual(before);
  });

  it("prioritizes US spellings and actual reviewed forms without inheriting forms after a sense edit", () => {
    const go = word("go");
    const incidental = {
      ...word("day"),
      id: "personal",
      collocation: "the trip went well",
    };
    expect(
      prioritizeExactVocabularyMatches(
        [{ word: incidental }, { word: go }],
        "went",
      )[0].word,
    ).toBe(go);
    const edited = { ...go, meaning_vi: "nghĩa khác do tôi sửa" };
    expect(
      prioritizeExactVocabularyMatches(
        [{ word: incidental }, { word: edited }],
        "went",
      )[0].word,
    ).toBe(incidental);
    const neighbor = word("neighbour");
    expect(
      prioritizeExactVocabularyMatches(
        [{ word: incidental }, { word: neighbor }],
        "neighbor",
      )[0].word,
    ).toBe(neighbor);
  });

  it("keeps explicit headword spellings and personal collocations searchable", () => {
    const source = {
      ...word("go"),
      id: "personal-lookup",
      word: "neighbour",
      preferred_us_spelling: "neighbor",
      spelling_variants: "next-door neighbour",
      meaning_vi: "người hàng xóm",
      collocation: "a friendly neighbour",
    };
    for (const query of [
      "NEIGHBOR",
      "neighbour neighbor",
      "next-door neighbour",
      "hang xom",
      "friendly",
    ])
      expect(vocabularyLookupText(source)).toContain(
        normalizeVocabularyLookup(query),
      );
  });

  it("never attaches reference forms to a changed meaning, POS or ID, including in-place edits", () => {
    const changed = { ...word("go") };
    expect(vocabularyLookupText(changed)).toContain("went");
    changed.meaning_vi = "nghĩa riêng do người học sửa";
    expect(getUsage(changed)).toBeUndefined();
    expect(vocabularyLookupText(changed)).not.toContain("went");
    expect(vocabularyLookupText(changed)).toContain("nghia rieng");
    const alterations: Record<string, string>[] = [
      { part_of_speech: "noun" },
      { id: "a-different-personal-id" },
      { word: "go now" },
    ];
    for (const alteration of alterations)
      expect(
        vocabularyLookupText({ ...word("go"), ...alteration }),
      ).not.toContain("went");
  });

  it("does not use source URLs, authored examples, wrong sentences or alternatives as lookup aliases", () => {
    const go = word("go");
    const usage = getUsage(go)!;
    const text = vocabularyLookupText(go);
    expect(text).not.toContain("oxfordlearnersdictionaries");
    expect(text).not.toContain("goed");
    expect(text).not.toContain(normalizeVocabularyLookup(usage.example.en));
    expect(text).not.toContain(normalizeVocabularyLookup(usage.example.vi));
    expect(text).not.toContain("head");
  });

  it("leaves word content, accepted answers, backup data and schedules unchanged", () => {
    const go = word("go");
    const state = merge(empty(), [go], "default");
    state.schedules[`${go.id}:1`] = {
      last: 1_800_000_000_000,
      due: 1_900_000_000_000,
      step: 3,
    };
    state.session = {
      id: "pending",
      queue: [{ id: go.id, skill: 1, review: "same" }],
      index: 0,
      started: 1_800_000_000_000,
      count: 1,
      scheduled: true,
    };
    const before = structuredClone(state);
    const text = serialize([go]);
    const versions = [0, 1, 2, 3, 4, 5].map((skill) => contentKey(go, skill));
    vocabularyLookupText(go);
    vocabularyLookupText(go);
    expect(grade("went", go)).toBe(false);
    expect(serialize([go])).toBe(text);
    expect([0, 1, 2, 3, 4, 5].map((skill) => contentKey(go, skill))).toEqual(
      versions,
    );
    expect(state).toEqual(before);
  });
});
