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

export type UsageField =
  | "patterns"
  | "note"
  | "example"
  | "mistake"
  | "countability"
  | "principalParts";
export type UsageFieldReview = {
  status: "reviewed" | "pending" | "not-applicable";
  /** Receipt IDs, or receipt URLs when no separate ID was assigned. */
  sourceIds: string[];
  scope?: "lexical-meaning" | "usage";
};
export type UsageSource = {
  id?: string;
  url: string;
  title: string;
  checkedAt: string;
  sha256: string;
  status?: number;
  scope?: string;
  identity?: { headword: string; partOfSpeech: string; senseId?: string };
  license?: { name: string; url: string; attribution: string };
};
export type UsageEntry = {
  wordId: string;
  headword: string;
  partOfSpeech: string;
  meaningVi: string;
  patterns: {
    form: string;
    explanation: string;
    origin?: "authored-illustration";
  }[];
  countability?: string;
  principalParts?: {
    past: string;
    pastParticiple?: string;
    ing: string;
    thirdPerson: string;
  };
  note?: string;
  /** Omit when no actual word-specific mistake was verified. */
  mistake?: { incorrect: string; correct: string; explanation: string };
  example: {
    id: string;
    en: string;
    vi: string;
    alternatives?: string[];
    origin?: "authored" | "licensed-source";
    translationOrigin?: "authored" | "licensed-source";
  };
  sources: UsageSource[];
  /** New bulk data must record field-level review; a source link alone cannot
   * turn a generic note or an unreviewed translation into complete teaching. */
  review?: {
    status: "reviewed" | "draft";
    authorId?: string;
    reviewerId?: string;
    reviewedAt?: string;
    contentSha256?: string;
    fields: Partial<Record<UsageField, UsageFieldReview>>;
  };
};

// Authored supplements ship with the app for offline reading. They do not
// rewrite TXT, personal entries, stable IDs, or any existing review schedule.
const files = import.meta.glob<UsageEntry[]>("../data/usage/*.json", {
  eager: true,
  import: "default",
});
// Only the curated a–n batches predate field-level provenance. Unknown files
// cannot inherit this compatibility path by omitting their review metadata.
const legacyFiles = new Set(
  "abcdefghijklmn"
    .split("")
    .map((group) => `../data/usage/group-${group}.json`),
);
const legacyReviewedEntries = new WeakSet(
  Object.entries(files)
    .filter(([path]) => legacyFiles.has(path))
    .flatMap(([, entries]) => entries),
);
type ContextRecord = {
  wordId: string;
  en: string;
  vi: string;
  phrase: string;
  phraseExplanation: string;
  note?: string;
  sourceId: string;
  authorId: string;
  reviewerId: string;
  reviewedAt: string;
  contentSha256: string;
};
type ContextEvidence = {
  receipts: Record<string, UsageSource>;
  senses: Record<
    string,
    {
      wordId: string;
      headword: string;
      partOfSpeech: string;
      meaningVi: string;
      receiptId: string;
      senseId?: string;
    }
  >;
};
const evidenceFiles = import.meta.glob<ContextEvidence>(
  "../data/usage-contexts/evidence.json",
  { eager: true, import: "default" },
);
const contextEvidence = Object.values(evidenceFiles)[0];
const contextFiles = import.meta.glob<ContextRecord[]>(
  "../data/usage-contexts/range-*.json",
  { eager: true, import: "default" },
);
// A lexical receipt supports sense selection. The original bilingual sentence
// and its illustrative phrase were separately authored and peer-reviewed;
// neither is presented as a quotation or a publisher-certified grammar rule.
function contextUsage(row: ContextRecord): UsageEntry | undefined {
  const sense = contextEvidence?.senses[row.sourceId];
  const receipt = sense && contextEvidence.receipts[sense.receiptId];
  if (!sense || !receipt || sense.wordId !== row.wordId) return undefined;
  const field: UsageFieldReview = {
    status: "reviewed",
    sourceIds: [row.sourceId],
    scope: "lexical-meaning",
  };
  return {
    wordId: row.wordId,
    headword: sense.headword,
    partOfSpeech: sense.partOfSpeech,
    meaningVi: sense.meaningVi,
    patterns: [
      {
        form: row.phrase,
        explanation: row.phraseExplanation,
        origin: "authored-illustration",
      },
    ],
    ...(row.note ? { note: row.note } : {}),
    example: {
      id: `context-2:${row.wordId}`,
      en: row.en,
      vi: row.vi,
      origin: "authored",
      translationOrigin: "authored",
    },
    sources: [
      {
        ...receipt,
        id: row.sourceId,
        identity: {
          headword: sense.headword,
          partOfSpeech: sense.partOfSpeech,
          ...(sense.senseId ? { senseId: sense.senseId } : {}),
        },
      },
    ],
    review: {
      status: "reviewed",
      authorId: row.authorId,
      reviewerId: row.reviewerId,
      reviewedAt: row.reviewedAt,
      contentSha256: row.contentSha256,
      fields: {
        patterns: field,
        example: field,
        note: row.note ? field : { status: "not-applicable", sourceIds: [] },
      },
    },
  };
}
const contextEntries = Object.entries(contextFiles)
  .sort(([a], [b]) => a.localeCompare(b, "en"))
  .flatMap(([, rows]) => rows.map(contextUsage))
  .filter((entry): entry is UsageEntry => !!entry);
export const usageEntries = Object.entries(files)
  .sort(([a], [b]) => a.localeCompare(b, "en"))
  .flatMap(([, entries]) => entries)
  .concat(contextEntries);
const byId = new Map<string, UsageEntry[]>();
for (const entry of usageEntries) {
  const candidates = byId.get(entry.wordId) || [];
  candidates.push(entry);
  byId.set(entry.wordId, candidates);
}

function matchesUsage(entry: UsageEntry, word: Word) {
  return (
    entry.wordId === word.id &&
    entry.headword === word.word &&
    entry.partOfSpeech === (word.part_of_speech || "") &&
    entry.meaningVi === word.meaning_vi
  );
}
function chooseReference(candidates: readonly UsageEntry[], word: Word) {
  const matching = candidates.filter((entry) => matchesUsage(entry, word));
  // A new draft/reference layer must never hide an existing reviewed entry.
  return matching.find((entry) => readyUsage(entry, word)) || matching[0];
}

/** Reference coverage is separate from material safe to use in exercises. */
export function getUsageReference(word: Word): UsageEntry | undefined {
  return chooseReference(byId.get(word.id) || [], word);
}

const nonempty = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const pinnedWordNet = (url: string) =>
  /^https:\/\/(?:raw\.githubusercontent\.com\/globalwordnet\/english-wordnet\/[a-f0-9]{40}\/|github\.com\/globalwordnet\/english-wordnet\/blob\/[a-f0-9]{40}\/)/.test(
    url,
  );
const safeHttps = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};
const trustedPublisher = (url: string) => {
  if (!safeHttps(url)) return false;
  const host = new URL(url).hostname;
  return (
    [
      "www.oxfordlearnersdictionaries.com",
      "oxfordlearnersdictionaries.com",
      "dictionary.cambridge.org",
      "dictionaryblog.cambridge.org",
      "learnenglish.britishcouncil.org",
      "www.merriam-webster.com",
      "www.collinsdictionary.com",
      "www.ldoceonline.com",
      "www.ahdictionary.com",
      "wordnet.princeton.edu",
      "en-word.net",
    ].includes(host) || pinnedWordNet(url)
  );
};
function validReceipt(source: UsageSource, legacy: boolean, word: Word) {
  if (
    !source ||
    !trustedPublisher(source.url) ||
    !nonempty(source.title) ||
    !Number.isFinite(Date.parse(source.checkedAt)) ||
    !/^[a-f0-9]{64}$/.test(source.sha256)
  )
    return false;
  if (
    !legacy &&
    (source.status !== 200 || !nonempty(source.scope) || !source.identity)
  )
    return false;
  if (
    source.identity &&
    (source.identity.headword !== word.word ||
      source.identity.partOfSpeech !== word.part_of_speech)
  )
    return false;
  if (
    pinnedWordNet(source.url) &&
    (!source.identity || !nonempty(source.identity.senseId))
  )
    return false;
  if (
    legacy &&
    (!/\/definition\/(?:american_english|english)\//.test(source.url) ||
      !/oxford/i.test(source.title))
  )
    return false;
  return true;
}

export type UsageReadiness = {
  status: "missing" | "mismatch" | "reference" | "ready";
  missing: (UsageField | "identity" | "sources" | "review")[];
  legacy: boolean;
};

/** Validates a recorded review, not the truth of English rules by heuristic.
 * Draft references remain visible as coverage gaps and never enter cloze. */
export function inspectUsageEntry(
  entry: UsageEntry | undefined,
  word: Word,
): UsageReadiness {
  if (!entry)
    return {
      status: "missing",
      missing: ["patterns", "note", "example", "sources", "review"],
      legacy: false,
    };
  const legacy = legacyReviewedEntries.has(entry) && entry.review === undefined;
  if (
    entry.wordId !== word.id ||
    entry.headword !== word.word ||
    entry.partOfSpeech !== (word.part_of_speech || "") ||
    entry.meaningVi !== word.meaning_vi
  )
    return { status: "mismatch", missing: ["identity"], legacy };
  const missing: UsageReadiness["missing"] = [];
  const sourceList = Array.isArray(entry.sources) ? entry.sources : [];
  const receipts = new Map(
    sourceList
      .filter((source) => validReceipt(source, legacy, word))
      .map((source) => [source.id || source.url, source]),
  );
  if (!receipts.size || receipts.size !== entry.sources?.length)
    missing.push("sources");
  if (
    !legacy &&
    (entry.review?.status !== "reviewed" ||
      !nonempty(entry.review.authorId) ||
      !nonempty(entry.review.reviewerId) ||
      entry.review.authorId === entry.review.reviewerId ||
      !Number.isFinite(Date.parse(entry.review.reviewedAt || "")) ||
      !/^[a-f0-9]{64}$/.test(entry.review.contentSha256 || ""))
  )
    missing.push("review");
  const validField = (field: UsageField) => {
    if (legacy) return true;
    const reviewed = entry.review?.fields?.[field];
    return (
      reviewed?.status === "reviewed" &&
      Array.isArray(reviewed.sourceIds) &&
      reviewed.sourceIds.length > 0 &&
      reviewed.sourceIds.every((id) => receipts.has(id))
    );
  };
  const noPatterns =
    !legacy &&
    entry.review?.fields?.patterns?.status === "not-applicable" &&
    entry.patterns?.length === 0 &&
    Array.isArray(entry.review.fields.patterns.sourceIds) &&
    entry.review.fields.patterns.sourceIds.length > 0 &&
    entry.review.fields.patterns.sourceIds.every((id) => receipts.has(id));
  if (
    !Array.isArray(entry.patterns) ||
    (!entry.patterns.length && !noPatterns) ||
    entry.patterns.some(
      (pattern) =>
        !pattern || !nonempty(pattern.form) || !nonempty(pattern.explanation),
    ) ||
    (!noPatterns && !validField("patterns"))
  )
    missing.push("patterns");
  const noNote =
    !legacy &&
    entry.note === undefined &&
    entry.review?.fields.note?.status === "not-applicable";
  if (!noNote && (!nonempty(entry.note) || !validField("note")))
    missing.push("note");
  if (
    !legacy &&
    entry.patterns?.some(
      (pattern) =>
        pattern.origin === "authored-illustration" &&
        !entry.example?.en
          .toLocaleLowerCase("en-US")
          .includes(pattern.form.toLocaleLowerCase("en-US")),
    )
  )
    missing.push("patterns");
  if (
    !legacy &&
    entry.review?.fields.patterns?.scope === "lexical-meaning" &&
    entry.patterns?.some(
      (pattern) => pattern.origin !== "authored-illustration",
    )
  )
    missing.push("patterns");
  const example = entry.example;
  if (
    !example ||
    !nonempty(example.id) ||
    !nonempty(example.en) ||
    !nonempty(example.vi) ||
    example.en.trim() === (word.example_en || "").trim() ||
    (word.example_type !== "no-cloze" &&
      cloze({ ...word, example_en: example.en }) === example.en) ||
    !validField("example") ||
    (!legacy &&
      (!["authored", "licensed-source"].includes(example.origin || "") ||
        !["authored", "licensed-source"].includes(
          example.translationOrigin || "",
        )))
  )
    missing.push("example");
  if (
    example?.origin === "licensed-source" ||
    example?.translationOrigin === "licensed-source"
  ) {
    const cited = entry.review?.fields?.example?.sourceIds || [];
    if (
      !cited.some((id) => {
        const license = receipts.get(id)?.license;
        return (
          license &&
          nonempty(license.name) &&
          nonempty(license.attribution) &&
          safeHttps(license.url)
        );
      }) &&
      !missing.includes("example")
    )
      missing.push("example");
  }
  for (const field of ["mistake", "countability", "principalParts"] as const) {
    if (
      entry[field] !== undefined &&
      (!validField(field) ||
        (!legacy && entry.review?.fields[field]?.scope !== "usage"))
    )
      missing.push(field);
  }
  if (
    entry.mistake &&
    (![
      entry.mistake.incorrect,
      entry.mistake.correct,
      entry.mistake.explanation,
    ].every(nonempty) ||
      entry.mistake.incorrect === entry.mistake.correct)
  )
    missing.push("mistake");
  if (entry.countability !== undefined && !nonempty(entry.countability))
    missing.push("countability");
  if (
    entry.principalParts &&
    (![
      entry.principalParts.past,
      entry.principalParts.ing,
      entry.principalParts.thirdPerson,
    ].every(nonempty) ||
      (entry.principalParts.pastParticiple !== undefined &&
        !nonempty(entry.principalParts.pastParticiple)))
  )
    missing.push("principalParts");
  return {
    status: missing.length ? "reference" : "ready",
    missing: [...new Set(missing)],
    legacy,
  };
}

/** A personal change of sense/POS must not inherit rules or a second context. */
const readinessCache = new WeakMap<
  UsageEntry,
  { key: string; ready: boolean }
>();
function readyUsage(entry: UsageEntry, word: Word) {
  // Packaged entries are immutable teaching data. Cache their source/review
  // checks across the fresh Word objects returned by IndexedDB transactions.
  const key = JSON.stringify([
    word.word,
    word.part_of_speech,
    word.meaning_vi,
    word.example_en,
    word.accepted_answers,
    word.spelling_variants,
    word.preferred_us_spelling,
    word.case_sensitive,
  ]);
  const cached = readinessCache.get(entry);
  if (cached?.key === key) return cached.ready;
  const ready = inspectUsageEntry(entry, word).status === "ready";
  readinessCache.set(entry, { key, ready });
  return ready;
}
export function getUsage(word: Word): UsageEntry | undefined {
  const entry = getUsageReference(word);
  return entry && readyUsage(entry, word) ? entry : undefined;
}

/** Counts actual per-sense readiness, never simply the number of JSON rows. */
export function usageCoverage(
  words: readonly Word[],
  entries: readonly UsageEntry[] = usageEntries,
) {
  const references = new Map<string, UsageEntry[]>();
  for (const entry of entries)
    references.set(entry.wordId, [
      ...(references.get(entry.wordId) || []),
      entry,
    ]);
  const counts = {
    total: words.length,
    reference: 0,
    ready: 0,
    missing: 0,
    incomplete: 0,
    mismatch: 0,
  };
  for (const word of words) {
    const candidates = references.get(word.id) || [];
    const status = inspectUsageEntry(
      chooseReference(candidates, word) || candidates[0],
      word,
    ).status;
    if (status === "ready") {
      counts.ready++;
      counts.reference++;
    } else if (status === "reference") {
      counts.incomplete++;
      counts.reference++;
    } else if (status === "mismatch") counts.mismatch++;
    else counts.missing++;
  }
  return counts;
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

/** Exact headwords, explicit spellings and sense-reviewed principal forms
 * lead reference search results. Stable partition preserves the library's
 * CEFR/frequency order among all other matches; this does not order learning. */
export function prioritizeExactVocabularyMatches<T extends { word: Word }>(
  entries: readonly T[],
  query: string,
): T[] {
  const normalized = normalizeVocabularyLookup(query);
  if (!normalized) return [...entries];
  const exact: T[] = [],
    other: T[] = [];
  for (const entry of entries) {
    const word = entry.word;
    const forms = [
      word.word,
      word.preferred_us_spelling || "",
      ...(word.spelling_variants || "").split("|"),
      ...Object.values(getUsage(word)?.principalParts || {}),
    ];
    (forms.some((form) => normalizeVocabularyLookup(form) === normalized)
      ? exact
      : other
    ).push(entry);
  }
  return [...exact, ...other];
}

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
