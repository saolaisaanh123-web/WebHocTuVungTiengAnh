import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  answerForms,
  cloze,
  contentKey,
  empty,
  grade,
  merge,
  parse,
  serialize,
  validateBackup,
  type Word,
} from "./core";
import {
  headwordSearchText,
  getRegionalUsage,
  preferredHeadword,
  selectEnglishVoice,
  youglishUsUrl,
} from "./american-english";

const original: Word = {
  id: "original-neighbour-id",
  word: "neighbour",
  part_of_speech: "noun",
  meaning_vi: "người hàng xóm",
  example_en: "Our neighbour helped us move.",
  example_vi: "Người hàng xóm giúp chúng tôi chuyển nhà.",
};
const american: Word = { ...original, preferred_us_spelling: "neighbor" };

describe("Reviewed American-English preference", () => {
  it("binds regional guidance to the reviewed queue/rubbish senses without accepting American equivalents as spellings", () => {
    const words = parse(readFileSync("public/data/vocabulary.txt", "utf8"));
    for (const headword of ["queue", "rubbish"]) {
      const word = words.find((w) => w.word === headword)!;
      const key = contentKey(word, 1);
      const usage = getRegionalUsage(word)!;
      expect(usage.label).toContain("Anh–Anh");
      expect(usage.source.url).toContain("/definition/english/");
      expect(usage.source.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(
        getRegionalUsage({ ...word, meaning_vi: "nghĩa cá nhân khác" }),
      ).toBeUndefined();
      expect(
        getRegionalUsage({ ...word, part_of_speech: "verb" }),
      ).toBeUndefined();
      expect(contentKey(word, 1)).toBe(key);
      expect(grade(headword === "queue" ? "line" : "trash", word)).toBe(false);
    }
  });
  it("uses American English for new profiles and preserves an existing British preference in backups", () => {
    expect(empty().voice).toBe("en-US");
    const previous = {
      ...merge(empty(), [original], "default"),
      voice: "en-GB",
    };
    expect(validateBackup(JSON.parse(JSON.stringify(previous))).voice).toBe(
      "en-GB",
    );
  });

  it("shows an explicit reviewed US alias only for a US preference", () => {
    expect(preferredHeadword(american, "en-US")).toBe("neighbor");
    expect(preferredHeadword(american, "en-us")).toBe("neighbor");
    expect(preferredHeadword(american, "en-GB")).toBe("neighbour");
    expect(preferredHeadword(original, "en-US")).toBe("neighbour");
    expect(
      preferredHeadword({ ...original, preferred_us_spelling: " " }, "en-US"),
    ).toBe("neighbour");
  });

  it("accepts both spellings while rejecting unrelated answers and misspellings", () => {
    expect(answerForms(american)).toContain("neighbor");
    expect(grade("neighbor", american)).toBe(true);
    expect(grade("neighbour", american)).toBe(true);
    expect(grade("neighborx", american)).toBe(false);
    expect(grade("friend", american)).toBe(false);
  });

  it("clozes either spelling without rewriting the stored example", () => {
    expect(cloze(american)).toBe("Our ________ helped us move.");
    expect(
      cloze({ ...american, example_en: "Our neighbor helped us move." }),
    ).toBe("Our ________ helped us move.");
    expect(american.example_en).toBe(original.example_en);
  });

  it("roundtrips the optional TXT field and leaves old TXT records without an empty new field", () => {
    expect(parse(serialize([american]))[0]).toMatchObject(american);
    expect(serialize([original])).not.toContain("preferred_us_spelling:");
    expect(
      parse(serialize([original]))[0].preferred_us_spelling,
    ).toBeUndefined();
  });

  it("keeps content versions, schedules, history, active queue, and saved personal preference on a spelling-only update", () => {
    const state = { ...merge(empty(), [original], "default"), voice: "en-GB" };
    for (let skill = 0; skill < 6; skill++) {
      expect(contentKey(american, skill)).toBe(contentKey(original, skill));
      state.schedules[`${original.id}:${skill}`] = {
        last: 1000,
        due: 9000,
        step: 3,
      };
    }
    state.history = [
      {
        id: "past",
        wordId: original.id,
        time: 1000,
        skill: 1,
        answer: original.word,
        correct: true,
        hint: false,
        method: "rule",
        elapsed: 2000,
        session: "past-session",
        review: "past-review",
        gap: 0,
        first: true,
      },
    ];
    state.session = {
      id: "existing-session",
      queue: [{ id: original.id, skill: 1, review: "existing-review" }],
      index: 0,
      started: 3000,
      count: 1,
      scheduled: true,
    };
    const updated = merge(state, [american], "default");
    expect(updated.voice).toBe("en-GB");
    expect(updated.history).toEqual(state.history);
    expect(updated.schedules).toEqual(state.schedules);
    expect(updated.session).toEqual(state.session);
    expect(updated.entries[original.id].word.word).toBe("neighbour");
  });

  it("preserves a personal source override", () => {
    const state = merge(
      empty(),
      [{ ...original, meaning_vi: "nghĩa do tôi sửa" }],
      "personal",
    );
    const updated = merge(state, [american], "default");
    expect(updated.entries[original.id]).toEqual(state.entries[original.id]);
  });

  it("makes both spellings searchable regardless of the display preference", () => {
    expect(headwordSearchText(american)).toContain("neighbor");
    expect(headwordSearchText(american)).toContain("neighbour");
    expect(headwordSearchText(american)).toContain("người hàng xóm");
  });

  it("creates an encoded HTTPS YouGlish link for American usage, without embeds or requests", () => {
    expect(youglishUsUrl(american)).toBe(
      "https://youglish.com/pronounce/neighbor/english/us",
    );
    expect(
      youglishUsUrl({
        ...original,
        word: "look up / figure out?",
        preferred_us_spelling: "",
      }),
    ).toBe(
      "https://youglish.com/pronounce/look%20up%20%2F%20figure%20out%3F/english/us",
    );
  });

  it("selects an available US voice ahead of a British voice and reports a fallback through its actual language", () => {
    const voices = [{ lang: "vi-VN" }, { lang: "en-GB" }, { lang: "en-US" }];
    expect(selectEnglishVoice(voices, "en-US")).toBe(voices[2]);
    expect(selectEnglishVoice(voices, "en-GB")).toBe(voices[1]);
    expect(selectEnglishVoice([{ lang: "en-GB" }], "en-US")?.lang).toBe(
      "en-GB",
    );
    expect(selectEnglishVoice([{ lang: "vi-VN" }], "en-US")).toBeUndefined();
  });
});
