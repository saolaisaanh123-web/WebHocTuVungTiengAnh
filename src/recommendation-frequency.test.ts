import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { empty, merge, parse, type Entry, type State } from "./core";
import { rankNewWords, recommendWords } from "./recommendations";

const NOW = new Date(2026, 9, 25, 12).getTime();
function entry(
  id: string,
  word: string,
  extra: Partial<Entry["word"]> = {},
): Entry {
  return {
    origin: "default",
    archived: false,
    word: {
      id,
      word,
      part_of_speech: "verb",
      meaning_vi: "nghĩa đã đối chiếu",
      example_en: `Please ${word} this.`,
      example_vi: "Hãy làm việc này.",
      collections: "oxford-3000",
      level: "A1",
      content_status: "reviewed",
      learning_status: "ready",
      ...extra,
    },
  };
}
const scored = (id: string, word: string, score = "5.8") =>
  entry(id, word, {
    frequency_zipf: score,
    frequency_source: "wordfreq-3.1.1-en-large",
    part_of_speech: "noun",
  });
const state = (...entries: Entry[]): State => ({
  ...empty(),
  entries: Object.fromEntries(entries.map((e) => [e.word.id, e])),
});
const recommendations = (s: State, entries = Object.values(s.entries)) =>
  recommendWords(s, entries, { mode: "common", now: NOW });

describe("Provenance-aware spelling frequency for reviewed senses", () => {
  it("uses a default exact-spelling donor outside the selected POS filter without changing data", () => {
    const donor = scored("drink-noun", "drink");
    const verb = entry("drink-verb", "drink");
    const other = scored("other", "other", "4");
    const s = state(donor, verb, other);
    const before = structuredClone(s);
    const result = recommendations(s, [other, verb]);
    expect(result.map((r) => r.entry.word.id)).toEqual([
      verb.word.id,
      other.word.id,
    ]);
    expect(result[0].reason).toContain("Tần suất Zipf 5.80");
    expect(result[0].reason).toContain("wordfreq 3.1.1 của cùng mặt chữ");
    expect(result[0].reason).toContain(
      "không phải tần suất riêng của nghĩa hoặc từ loại",
    );
    expect(s).toEqual(before);
    expect(verb.word.frequency_zipf).toBeUndefined();
  });

  it("never replaces a sense's own declared score", () => {
    const donor = scored("drink-noun", "drink");
    const verb = entry("drink-verb", "drink", { frequency_zipf: "4.2" });
    const result = recommendations(state(donor, verb), [verb])[0];
    expect(result.reason).toContain("Tần suất Zipf 4.20");
    expect(result.reason).not.toContain("Dùng số liệu");
  });

  it("keeps undocumented, personal, conflicting or different-spelling evidence unknown", () => {
    const verb = entry("drink-verb", "drink");
    const candidates = [
      [scored("personal", "drink"), "personal"],
      [scored("undocumented", "drink"), "undocumented"],
      [scored("drank", "drank"), "different"],
    ] as const;
    for (const [original, kind] of candidates) {
      const donor = structuredClone(original);
      if (kind === "personal") donor.origin = "personal";
      if (kind === "undocumented") donor.word.frequency_source = "unverified";
      expect(recommendations(state(donor, verb), [verb])[0].reason).toContain(
        "Chưa có số liệu tần suất.",
      );
    }
    const a = scored("drink-a", "drink", "5");
    const b = scored("drink-b", "drink", "6");
    const s = state(a, b, verb);
    expect(recommendations(s, [verb])[0].reason).toContain(
      "Chưa có số liệu tần suất.",
    );
    expect(recommendations(state(b, a, verb), [verb])).toEqual(
      recommendations(s, [verb]),
    );
  });

  it("respects deliberate exclusions, slang, personal targets and documented unscored decisions", () => {
    const cases = [
      [entry("month", "May"), scored("modal", "may")],
      [entry("company", "IT"), scored("pronoun", "it")],
      [entry("found-verb", "found"), scored("found-other", "found")],
      [
        entry("slang", "slay", { collections: "slang,oxford-3000" }),
        scored("literal", "slay"),
      ],
      [
        entry("phrase", "go", { expression_type: "idiom" }),
        scored("literal", "go"),
      ],
      [
        entry("no-score", "drink", {
          frequency_note: "Intentionally unscored for review",
        }),
        scored("noun", "drink"),
      ],
      [
        { ...entry("personal-verb", "drink"), origin: "personal" },
        scored("noun", "drink"),
      ],
    ];
    for (const [target, donor] of cases)
      expect(
        recommendations(state(target, donor), [target])[0].reason,
      ).toContain("Chưa có số liệu tần suất.");
  });

  it("brings all 21 reviewed basic verbs out of the last 500 candidates in both modes", () => {
    const corpus = parse(
      readFileSync(
        new URL("../public/data/vocabulary.txt", import.meta.url),
        "utf8",
      ),
    );
    const authored = JSON.parse(
      readFileSync(
        new URL(
          "../data/authoring/essential-senses-2026-10-24.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as { entries: { word: { id: string } }[] };
    const ids = authored.entries.map((e) => e.word.id);
    expect(ids).toHaveLength(21);
    const s = merge(empty(), corpus, "default");
    const before = structuredClone(s);
    for (const mode of ["smart", "common"] as const) {
      const result = rankNewWords(s, Object.values(s.entries), mode, NOW);
      for (const id of ids) {
        const position = result.findIndex((r) => r.entry.word.id === id);
        expect(position, `${id} in ${mode}`).toBeGreaterThanOrEqual(0);
        expect(position, `${id} in ${mode}`).toBeLessThan(result.length - 500);
        expect(result[position].reason).toContain(
          "wordfreq 3.1.1 của cùng mặt chữ",
        );
      }
    }
    expect(s).toEqual(before);
  });
});
