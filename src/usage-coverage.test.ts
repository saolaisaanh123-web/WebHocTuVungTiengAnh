import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canPractice, cloze, contentKey, empty, merge, parse } from "./core";
import {
  attachStudyContexts,
  getUsage,
  inspectUsageEntry,
  usageCoverage,
  usageEntries,
  type UsageEntry,
} from "./usage";

const txt = readFileSync("public/data/vocabulary.txt");
const words = parse(txt.toString("utf8"));
const byId = new Map(words.map((word) => [word.id, word]));
const newEntries = usageEntries.filter((entry) => entry.review !== undefined);
const authorKeys = [
  "wordId",
  "en",
  "vi",
  "phrase",
  "phraseExplanation",
  "note",
  "sourceId",
  "authorId",
];
const rows: Record<string, string>[] = readdirSync("data/usage-contexts")
  .filter((name) => /^range-.*\.json$/.test(name))
  .flatMap((name) =>
    JSON.parse(readFileSync(`data/usage-contexts/${name}`, "utf8")),
  );

describe("Whole selected-sense contextual coverage", () => {
  it("covers every existing selected ID/POS/meaning without replacing the 203 deeper supplements", () => {
    expect(words).toHaveLength(5586);
    expect(newEntries).toHaveLength(5383);
    expect(rows).toHaveLength(5383);
    expect(usageEntries).toHaveLength(5586);
    expect(new Set(usageEntries.map((entry) => entry.wordId)).size).toBe(5586);
    expect(usageCoverage(words)).toMatchObject({
      total: 5586,
      ready: 5586,
      missing: 0,
      incomplete: 0,
      mismatch: 0,
    });
    expect(createHash("sha256").update(txt).digest("hex")).toBe(
      "bfedc90307e912b5dd19f2620f92a45e0704b67054ef7a1070273fe2464209bb",
    );
  });

  it("binds the actual reviewed original sentence, translation and phrase to a different reviewer", () => {
    for (const row of rows) {
      const authored = Object.fromEntries(
        authorKeys
          .filter((key) => key in row)
          .sort()
          .map((key) => [key, row[key]]),
      );
      expect(
        createHash("sha256").update(JSON.stringify(authored)).digest("hex"),
        row.wordId,
      ).toBe(row.contentSha256);
      expect(row.reviewerId, row.wordId).not.toBe(row.authorId);
      expect(Number.isFinite(Date.parse(row.reviewedAt)), row.wordId).toBe(
        true,
      );
      expect(row.en.toLowerCase(), row.wordId).toContain(
        row.phrase.toLowerCase(),
      );
    }
    expect(new Set(rows.map((row) => row.en.toLowerCase())).size).toBe(
      rows.length,
    );
  });

  it("keeps lexical evidence distinct from authored illustrations and cannot inherit publisher grammar authority", () => {
    for (const entry of newEntries) {
      const word = byId.get(entry.wordId)!;
      expect(getUsage(word), entry.wordId).toBe(entry);
      expect(entry.example.origin).toBe("authored");
      expect(entry.example.translationOrigin).toBe("authored");
      expect(entry.example.en).not.toBe(word.example_en);
      if (word.example_type === "no-cloze") {
        expect(canPractice({ ...word, example_en: entry.example.en }, 4)).toBe(
          false,
        );
      } else {
        expect(cloze({ ...word, example_en: entry.example.en })).not.toBe(
          entry.example.en,
        );
      }
      expect(
        entry.patterns.every(
          (pattern) => pattern.origin === "authored-illustration",
        ),
      ).toBe(true);
      expect(
        entry.sources.every(
          (source) => source.scope === "lexical-meaning-only",
        ),
      ).toBe(true);
      expect(
        entry.sources.every(
          (source) =>
            source.identity?.headword === word.word &&
            source.identity?.partOfSpeech === word.part_of_speech,
        ),
      ).toBe(true);
      expect(entry.mistake).toBeUndefined();
      expect(entry.countability).toBeUndefined();
      expect(entry.principalParts).toBeUndefined();
      expect(
        getUsage({ ...word, meaning_vi: "nghĩa cá nhân khác" }),
      ).toBeUndefined();
    }
  });

  it("rejects a missing/self review, stale source identity and an unattested countability rule", () => {
    const entry = newEntries[0];
    expect(entry).toBeDefined();
    if (!entry) return;
    const word = byId.get(entry.wordId)!;
    const inspect = (change: Partial<UsageEntry>) =>
      inspectUsageEntry({ ...entry, ...change }, word);
    expect(inspect({ review: undefined }).status).toBe("reference");
    expect(
      inspect({
        review: { ...entry.review!, reviewerId: entry.review!.authorId },
      }).missing,
    ).toContain("review");
    expect(
      inspect({
        sources: entry.sources.map((source) => ({
          ...source,
          identity: { ...source.identity!, headword: "other" },
        })),
      }).missing,
    ).toContain("sources");
    expect(
      inspect({ countability: "an invented universal rule" }).missing,
    ).toContain("countability");
    expect(
      inspect({
        patterns: [
          { form: "invented grammar restriction", explanation: "unsupported" },
        ],
      }).missing,
    ).toContain("patterns");
  });

  it("does not change saved questions, original content versions, schedules or history just by loading new reference data", () => {
    const state = merge(empty(), words.slice(0, 15), "default");
    const word = words[0];
    const task = {
      id: word.id,
      skill: 4,
      review: "already-saved",
      context: {
        id: "frozen",
        en: word.example_en,
        vi: word.example_vi,
        targetVersion: contentKey(word, 4),
      },
    };
    const before = structuredClone(state);
    expect(attachStudyContexts(state, [task])).toEqual([task]);
    expect(state).toEqual(before);
  });
});
