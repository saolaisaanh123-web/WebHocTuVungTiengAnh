import type { Word } from "./core";
import regionalUsage from "../data/authoring/regional-usage-2026-10-25.json";

/** Editorial regional guidance belongs to an exact sense. It is display-only:
 * it never turns US equivalents into accepted spellings or changes old IDs. */
export function getRegionalUsage(w: Word) {
  return regionalUsage.find(
    (entry) =>
      entry.wordId === w.id &&
      entry.headword === w.word &&
      entry.partOfSpeech === w.part_of_speech &&
      entry.meaningVi === w.meaning_vi,
  );
}

// This is an editorially verified spelling alias, never a replacement ID or sense.
// A saved British-English preference remains the learner's choice.
export function preferredHeadword(w: Word, voice: string): string {
  return /^en[-_]US$/i.test(voice) && w.preferred_us_spelling?.trim()
    ? w.preferred_us_spelling.trim()
    : w.word;
}

export function headwordSearchText(w: Word): string {
  return [w.word, w.preferred_us_spelling, w.spelling_variants, w.meaning_vi]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
}

export function youglishUsUrl(w: Word): string {
  return `https://youglish.com/pronounce/${encodeURIComponent(preferredHeadword(w, "en-US"))}/english/us`;
}

export function selectEnglishVoice<T extends { lang: string }>(
  voices: T[],
  preferred: string,
): T | undefined {
  const english = voices.filter((voice) => /^en(?:[-_]|$)/i.test(voice.lang));
  const locale = (value: string) => value.replace(/_/g, "-").toLowerCase();
  return (
    english.find((voice) => locale(voice.lang) === locale(preferred)) ||
    english[0]
  );
}
