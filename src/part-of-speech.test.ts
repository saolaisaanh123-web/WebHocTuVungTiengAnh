import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "./core";
import { formatPartOfSpeech, partOfSpeechCaption } from "./part-of-speech";

describe("Part-of-speech display labels", () => {
  it("provides bilingual labels for every category currently used in the canonical vocabulary", () => {
    const words = parse(readFileSync("public/data/vocabulary.txt", "utf8"));
    const categories = new Set(words.map((word) => word.part_of_speech));
    expect(categories.size).toBe(22);
    for (const category of categories) {
      expect(category?.trim()).toBeTruthy();
      const display = formatPartOfSpeech(category);
      expect(display, category).toMatch(/^[^·]+ · /);
      expect(display.split(" · ")[1], category).toBe(category);
      expect(display.split(" · ")[0], category).not.toBe(category);
    }
  });

  it("makes common grammatical labels readable without removing their English names", () => {
    expect(formatPartOfSpeech("noun")).toBe("Danh từ · noun");
    expect(formatPartOfSpeech("verb")).toBe("Động từ · verb");
    expect(formatPartOfSpeech("adjective")).toBe("Tính từ · adjective");
    expect(formatPartOfSpeech("adverb")).toBe("Trạng từ · adverb");
    expect(formatPartOfSpeech("modal verb")).toBe(
      "Động từ khuyết thiếu · modal verb",
    );
    expect(partOfSpeechCaption("noun")).toBe("Từ loại");
    expect(partOfSpeechCaption("modal verb")).toBe("Từ loại");
    expect(partOfSpeechCaption("phrasal verb")).toBe("Từ loại");
  });

  it("distinguishes expression kinds from grammatical parts of speech", () => {
    expect(formatPartOfSpeech("idiom")).toBe("Thành ngữ · idiom");
    expect(formatPartOfSpeech("abbreviation")).toBe(
      "Từ viết tắt · abbreviation",
    );
    for (const kind of [
      "idiom",
      "noun phrase",
      "verb phrase",
      "prepositional phrase",
      "phrase",
      "clause",
      "abbreviation",
      "expression",
    ])
      expect(partOfSpeechCaption(kind), kind).toBe("Dạng từ / cụm");
  });

  it("recognizes simple dictionary abbreviations and harmless label spacing", () => {
    expect(formatPartOfSpeech(" n. ")).toBe("Danh từ · noun");
    expect(formatPartOfSpeech(" V. ")).toBe("Động từ · verb");
    expect(formatPartOfSpeech("adj.")).toBe("Tính từ · adjective");
    expect(formatPartOfSpeech("ADV.")).toBe("Trạng từ · adverb");
    expect(formatPartOfSpeech("  NOUN   PHRASE  ")).toBe(
      "Cụm danh từ · noun phrase",
    );
    expect(partOfSpeechCaption("  NOUN   PHRASE  ")).toBe("Dạng từ / cụm");
    expect(partOfSpeechCaption("v.")).toBe("Từ loại");
  });

  it("explains missing labels while preserving unknown personal or mixed text", () => {
    for (const value of [undefined, "", " \n\t "])
      expect(formatPartOfSpeech(value)).toBe("Chưa khai báo từ loại");
    for (const value of [
      "n., v.",
      "Noun / verb",
      "ghi chú   riêng",
      "constructor",
      "toString",
    ])
      expect(formatPartOfSpeech(`  ${value}  `)).toBe(value);
    expect(partOfSpeechCaption()).toBe("Từ loại");
    expect(partOfSpeechCaption("nhãn riêng")).toBe("Từ loại");
  });
});
