import {
  canPractice,
  cloze,
  contentKey,
  validStudyContext,
  type State,
  type StudyContext,
  type StudyTask,
  type Word,
} from "./core";

export type UsageEntry = {
  wordId: string;
  headword: string;
  partOfSpeech: string;
  meaningVi: string;
  patterns: { form: string; explanation: string }[];
  countability?: string;
  principalParts?: {
    past: string;
    pastParticiple?: string;
    ing: string;
    thirdPerson: string;
  };
  note: string;
  mistake: { incorrect: string; correct: string; explanation: string };
  example: { id: string; en: string; vi: string; alternatives?: string[] };
  sources: { url: string; title: string; checkedAt: string; sha256: string }[];
};

// Authored supplements ship with the app for offline reading. They do not
// rewrite TXT, personal entries, stable IDs, or any existing review schedule.
const files = import.meta.glob<UsageEntry[]>("../data/usage/*.json", {
  eager: true,
  import: "default",
});
export const usageEntries = Object.entries(files)
  .sort(([a], [b]) => a.localeCompare(b, "en"))
  .flatMap(([, entries]) => entries);
const byId = new Map(usageEntries.map((entry) => [entry.wordId, entry]));

/** A personal change of sense/POS must not inherit the source's usage rules. */
export function getUsage(word: Word): UsageEntry | undefined {
  const entry = byId.get(word.id);
  return entry &&
    entry.headword === word.word &&
    entry.partOfSpeech === (word.part_of_speech || "") &&
    entry.meaningVi === word.meaning_vi
    ? entry
    : undefined;
}

/** Lookup normalization is deliberately separate from answer grading. Folding
 * Vietnamese accents helps find a note; it never expands accepted answers. */
export const normalizeVocabularyLookup = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLocaleLowerCase("vi-VN")
    .replace(/[’‘]/g, "'")
    .trim()
    .replace(/\s+/g, " ");

const lookupCache = new WeakMap<
  Word,
  { fields: string[]; usage: UsageEntry | undefined; text: string }
>();

/** Index only the current word and its sense-matched reviewed reference.
 * Examples, incorrect sentences, alternative answers and source URLs are not
 * lookup aliases: mentioning another word in them must not attach its forms
 * to this sense. The cache also checks fields so in-place imported edits cannot
 * keep an old sense's reference text. This function never mutates learner data. */
export function vocabularyLookupText(word: Word): string {
  const usage = getUsage(word);
  const fields = [
    word.word,
    word.preferred_us_spelling || "",
    word.spelling_variants || "",
    word.meaning_vi,
    word.collocation || "",
    word.part_of_speech || "",
  ];
  const cached = lookupCache.get(word);
  if (
    cached &&
    cached.usage === usage &&
    fields.every((value, index) => value === cached.fields[index])
  )
    return cached.text;
  const text = [
    // Preserve the previous contiguous headword/alias/meaning search too.
    fields.slice(0, 4).filter(Boolean).join(" "),
    ...fields.slice(4),
    ...(usage?.principalParts ? Object.values(usage.principalParts) : []),
    ...(usage?.patterns.flatMap((pattern) => [
      pattern.form,
      pattern.explanation,
    ]) || []),
    usage?.countability || "",
  ]
    .filter(Boolean)
    .map(normalizeVocabularyLookup)
    .join("\n");
  lookupCache.set(word, { fields, usage, text });
  return text;
}

/** Never silently fall back to a different question if the saved sense changed. */
export function exerciseWord(
  word: Word,
  context?: StudyContext,
): Word | undefined {
  if (context === undefined) return word;
  if (
    !validStudyContext(context) ||
    context.targetVersion !== contentKey(word, 4)
  )
    return undefined;
  const exercise = {
    ...word,
    example_en: context.en,
    example_vi: context.vi,
    // Source URL audio belongs to the original example, never to a new sentence.
    audio_example: "",
  };
  return canPractice(exercise, 4) && cloze(exercise) !== context.en
    ? exercise
    : undefined;
}

/** Called only for a newly created session. Alternation is based on the last
 * first attempt, not reload time or randomness. Retries keep the frozen task. */
export function attachStudyContexts(
  state: State,
  tasks: StudyTask[],
): StudyTask[] {
  return tasks.map((task) => {
    if (task.skill !== 4 || task.context !== undefined) return task;
    const word = state.entries[task.id]?.word;
    if (!word) return task;
    const usage = getUsage(word);
    if (!usage || !canPractice(word, 4)) return task;
    const version = contentKey(word, 4);
    const previous = state.history
      .filter(
        (r) =>
          r.wordId === task.id &&
          r.skill === 4 &&
          r.first &&
          r.contentVersion === version,
      )
      .sort((a, b) => b.time - a.time || a.id.localeCompare(b.id))[0];
    if (!previous || previous.context?.id === usage.example.id) return task;
    const context: StudyContext = {
      id: usage.example.id,
      en: usage.example.en,
      vi: usage.example.vi,
      targetVersion: version,
      ...(usage.example.alternatives
        ? { alternatives: [...usage.example.alternatives] }
        : {}),
    };
    return exerciseWord(word, context) ? { ...task, context } : task;
  });
}
