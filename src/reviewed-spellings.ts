import type { Word } from "./core";

type ReviewedSpelling = {
  headword: string;
  partOfSpeech: string;
  meaningVi: string;
  forms: readonly string[];
};

// Runtime corrections for existing reviewed entries. They leave the canonical
// TXT, imported words, frozen questions and content keys unchanged. A spelling
// is not a synonym: never infer these from punctuation, case or word endings.
const reviewed: Readonly<Record<string, ReviewedSpelling>> = {
  // Oxford American OK (exclamation), read 2026-10-27: "also okay";
  // its sentence-initial example uses Okay. Preserve other explicit case rules.
  // https://www.oxfordlearnersdictionaries.com/definition/american_english/ok_1
  "ox-565339bc4d33d7-01": {
    headword: "OK",
    partOfSpeech: "interjection",
    meaningVi: "được; đồng ý",
    forms: ["okay", "Okay"],
  },
  // Oxford American e-mail (noun), message sense, read 2026-10-27: "also email".
  // https://www.oxfordlearnersdictionaries.com/definition/american_english/e-mail_2
  "ox-82244417f956ac-01": {
    headword: "email",
    partOfSpeech: "noun",
    meaningVi: "thư điện tử",
    forms: ["e-mail"],
  },
};

/** Fail closed if an existing ID is edited or repurposed for another sense. */
export function reviewedSpellingVariants(word: Word): readonly string[] {
  const match = Object.hasOwn(reviewed, word.id)
    ? reviewed[word.id]
    : undefined;
  return match &&
    word.word === match.headword &&
    word.part_of_speech === match.partOfSpeech &&
    word.meaning_vi === match.meaningVi &&
    word.content_status === "reviewed" &&
    word.learning_status === "ready"
    ? match.forms
    : [];
}
