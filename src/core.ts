import type {
  ConversationAttempt,
  WritingAttempt,
  LearningMode,
} from "./practice-data";
import { validatePracticeCollections } from "./practice-data";
import {
  appendExposureEvent,
  lastObservedExposure,
  validateExposureEvents,
  type ExposureEvent,
} from "./exposure-events";
import {
  evidenceForSkill,
  selectLearningEvidence,
  type LearningEvidence,
} from "./evidence";
import { scheduleForEntries } from "./schedule-state";
import { reviewedSpellingVariants } from "./reviewed-spellings";

export const skills = [
  "Hiểu nghĩa",
  "Nhớ để viết",
  "Nghe nhận biết",
  "Nghe và chính tả",
  "Dùng trong ngữ cảnh",
  "Tự sử dụng",
];
export type Word = {
  id: string;
  word: string;
  meaning_vi: string;
  example_en: string;
  example_vi: string;
  [key: string]: string;
};
export type Entry = {
  word: Word;
  origin: string;
  archived: boolean;
  known?: boolean;
  goal?: string;
  notes?: string;
  reports?: string[];
  archivedReason?: "user" | "source";
  enrolled?: boolean;
  enrolledAt?: number;
};
/** Frozen when a new session starts; updates cannot replace a question mid-session. */
export type StudyContext = {
  id: string;
  en: string;
  vi: string;
  targetVersion: string;
  alternatives?: string[];
};
export type StudyTask = {
  id: string;
  skill: number;
  review: string;
  context?: StudyContext;
};
export type Result = {
  id: string;
  wordId: string;
  time: number;
  skill: number;
  answer: string;
  correct: boolean;
  hint: boolean;
  method: "self" | "rule" | "ungraded";
  elapsed: number;
  session: string;
  review: string;
  gap: number;
  first: boolean;
  independent?: boolean;
  audioPlayed?: boolean;
  evidenceVersion?: 2;
  scheduled?: boolean;
  contentVersion?: string;
  exposureGap?: number;
  assessmentNote?: string;
  context?: StudyContext;
};
export type Schedule = {
  due: number;
  last: number;
  step: number;
  contentVersion?: string;
};
export type WritingDraft = {
  wordId: string;
  parentId?: string;
  text: string;
  updatedAt: number;
  contentVersion?: string;
};
export type Session = {
  id: string;
  queue: StudyTask[];
  index: number;
  started: number;
  scheduled: boolean;
  count: number;
  goal?: { due: number; continuing: number; fresh: number };
  draft?: {
    key: string;
    answer: string;
    hint: boolean;
    revealed: boolean;
    assessment?: PendingAssessment;
  };
};
/** A mismatched first answer awaits the learner's decision before any grade
 * or due date is saved. Its original timing survives pause/reload/backup. */
export type PendingAssessment = {
  time: number;
  elapsed: number;
  hint: boolean;
  independent: boolean;
  audioPlayed: boolean;
  contentVersion: string;
};
export function validPendingAssessment(
  value: unknown,
): value is PendingAssessment {
  if (!value || typeof value !== "object") return false;
  const item = value as PendingAssessment;
  return (
    Number.isFinite(item.time) &&
    item.time >= 0 &&
    Number.isFinite(item.elapsed) &&
    item.elapsed >= 0 &&
    typeof item.hint === "boolean" &&
    typeof item.independent === "boolean" &&
    typeof item.audioPlayed === "boolean" &&
    typeof item.contentVersion === "string"
  );
}
export type State = {
  version: 1;
  entries: Record<string, Entry>;
  history: Result[];
  schedules: Record<string, Schedule>;
  daily: number;
  voice: string;
  rate: number;
  session?: Session;
  pausedScheduled?: Session;
  exposures?: Record<string, number>;
  exposureEvents?: ExposureEvent[];
  sourceVersion?: string;
  learningMode?: LearningMode;
  writing?: WritingAttempt[];
  conversations?: ConversationAttempt[];
  writingDrafts?: Record<string, WritingDraft>;
  learningFloor?: "all" | "A2" | "B1" | "B2" | "C1";
  studySkills?: number[];
};
export const empty = (): State => ({
  version: 1,
  entries: {},
  history: [],
  schedules: {},
  daily: 5,
  voice: "en-US",
  rate: 0.85,
});
export const fields = [
  "id",
  "word",
  "part_of_speech",
  "meaning_vi",
  "definition_en",
  "definition_source",
  "ipa",
  "level",
  "topics",
  "collections",
  "collocation",
  "example_en",
  "example_vi",
  "audio_word",
  "audio_example",
  "accepted_answers",
  "spelling_variants",
  "preferred_us_spelling",
  "source",
  "note",
  "content_status",
  "example_type",
  "register",
  "region",
  "case_sensitive",
  "frequency_zipf",
  "frequency_source",
  "frequency_note",
  "expression_type",
  "news_source",
  "news_title",
  "news_url",
  "news_date",
  "news_excerpt",
  "news_context_vi",
  "news_source_type",
  "news_media_url",
  "news_media_start",
  "news_media_note",
  "learning_status",
  "learning_note",
  "source_fact_index",
];

const cefrOrder = ["A1", "A2", "B1", "B2", "C1", "C2"];
const englishOrder = new Intl.Collator("en", { sensitivity: "base" });
export function frequencyScore(word: Word): number | undefined {
  const value = word.frequency_zipf?.trim();
  if (!value) return undefined;
  const score = Number(value);
  return Number.isFinite(score) && score >= 0 && score <= 9 ? score : undefined;
}

// Sort a copy so library order cannot change stored entries, sessions or history.
export function sortForLearning(entries: Entry[]): Entry[] {
  const levelRank = (word: Word) => {
    const rank = cefrOrder.indexOf((word.level || "").trim().toUpperCase());
    return rank < 0 ? cefrOrder.length : rank;
  };
  return entries.slice().sort((a, b) => {
    const level = levelRank(a.word) - levelRank(b.word);
    if (level) return level;
    const aScore = frequencyScore(a.word);
    const bScore = frequencyScore(b.word);
    if (aScore !== bScore) {
      if (aScore === undefined) return 1;
      if (bScore === undefined) return -1;
      return bScore - aScore;
    }
    return (
      englishOrder.compare(a.word.word, b.word.word) ||
      a.word.id.localeCompare(b.word.id, "en")
    );
  });
}
export function parse(text: string): Word[] {
  const blocks = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n");
  const words: Word[] = [];
  const ids = new Set<string>();
  let current: Record<string, string> = {};
  let start = 1;
  function finish() {
    if (!Object.keys(current).length) return;
    const required =
      current.content_status === "reference"
        ? ["id", "word", "source"]
        : current.content_status === "dictionary"
          ? ["id", "word", "meaning_vi", "source"]
          : ["id", "word", "meaning_vi", "example_en", "example_vi"];
    for (const key of required)
      if (!current[key]?.trim())
        throw Error(
          `Mục ${current.id || words.length + 1}, dòng ${start}: thiếu ${key}`,
        );
    if (ids.has(current.id))
      throw Error(`Dòng ${start}: ID trùng "${current.id}"`);
    if (["__proto__", "constructor", "prototype"].includes(current.id))
      throw Error(`Dòng ${start}: ID không được hỗ trợ`);
    ids.add(current.id);
    words.push(current as Word);
    current = {};
  }
  blocks.forEach((line, i) => {
    if (line.trim() === "---") {
      finish();
      start = i + 2;
      return;
    }
    if (!line.trim()) return;
    const match = line.match(/^([a-z_]+):\s?(.*)$/);
    if (!match) throw Error(`Dòng ${i + 1}: cần định dạng trường: nội dung`);
    if (!fields.includes(match[1]))
      throw Error(`Dòng ${i + 1}: trường không hỗ trợ ${match[1]}`);
    if (Object.hasOwn(current, match[1]))
      throw Error(`Dòng ${i + 1}: trường ${match[1]} bị lặp`);
    current[match[1]] = match[2];
  });
  finish();
  if (!words.length) throw Error("File không có mục từ.");
  return words;
}
export const serialize = (words: Word[]) =>
  words
    .map((w) =>
      fields
        .filter(
          (f) =>
            !["spelling_variants", "preferred_us_spelling"].includes(f) ||
            !!w[f],
        )
        .map((f) => `${f}: ${(w[f] || "").replace(/[\r\n]+/g, " ")}`)
        .join("\n"),
    )
    .join("\n---\n") + "\n";
export function diff(state: State, words: Word[], origin: string) {
  const incoming = new Set(words.map((w) => w.id));
  return {
    added: words.filter((w) => !Object.hasOwn(state.entries, w.id)).length,
    changed: words.filter(
      (w) =>
        Object.hasOwn(state.entries, w.id) &&
        !(origin === "default" && state.entries[w.id].origin !== origin) &&
        fields.some(
          (field) =>
            (state.entries[w.id].word[field] || "") !== (w[field] || ""),
        ),
    ).length,
    archived: Object.values(state.entries).filter(
      (e) => e.origin === origin && !e.archived && !incoming.has(e.word.id),
    ).length,
    revived: words.filter((w) => {
      const old = Object.hasOwn(state.entries, w.id)
        ? state.entries[w.id]
        : undefined;
      return (
        old?.origin === origin &&
        old.archived &&
        old.archivedReason === "source"
      );
    }).length,
  };
}
export function merge(state: State, words: Word[], origin: string): State {
  const next = structuredClone(state);
  const ids = new Set(words.map((w) => w.id));
  Object.values(next.entries).forEach((e) => {
    if (e.origin === origin && !ids.has(e.word.id) && !e.archived) {
      e.archived = true;
      e.archivedReason = "source";
    }
  });
  words.forEach((word) => {
    if (["__proto__", "constructor", "prototype"].includes(word.id))
      throw Error("ID mục từ không được hỗ trợ");
    const old = Object.hasOwn(next.entries, word.id)
      ? next.entries[word.id]
      : undefined;
    if (old && old.origin !== origin && origin === "default") return;
    if (old) {
      for (let skill = 0; skill < skills.length; skill++)
        if (contentKey(old.word, skill) !== contentKey(word, skill))
          delete next.schedules[`${word.id}:${skill}`];
    }
    next.entries[word.id] = {
      ...old,
      word: { ...word },
      origin,
      // A pre-migration archived entry has no reason: preserve it as a user
      // choice rather than silently restoring something they hid.
      archived: !!old?.archived && old.archivedReason !== "source",
      archivedReason:
        old?.archived && old.archivedReason !== "source" ? "user" : undefined,
    };
  });
  return next;
}
export const normalize = (s: string) =>
  s.trim().replace(/[’‘]/g, "'").replace(/\s+/g, " ").toLocaleLowerCase();
export const answerForms = (w: Word) =>
  [
    w.word,
    ...(w.accepted_answers || "").split("|"),
    ...(w.spelling_variants || "").split("|"),
    ...reviewedSpellingVariants(w),
    w.preferred_us_spelling || "",
  ]
    .map((a) => a.trim())
    .filter(Boolean);
export const grade = (answer: string, w: Word) =>
  answerForms(w).some((a) =>
    w.case_sensitive === "true"
      ? a.trim().replace(/\s+/g, " ") === answer.trim().replace(/\s+/g, " ")
      : normalize(a) === normalize(answer),
  );
export function cloze(w: Word) {
  const answers = answerForms(w).sort((a, b) => b.length - a.length);
  let text = w.example_en || "";
  for (const answer of answers) {
    const escaped = answer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(
      new RegExp("(?<![\\p{L}\\p{N}])" + escaped + "(?![\\p{L}\\p{N}])", "giu"),
      "________",
    );
  }
  return text;
}
export function validLearningMeaning(meaning: string): boolean {
  return (
    /\p{L}/u.test(meaning || "") &&
    !/^\s*(?:\(\s*như\s*\)|xem thêm|xem mục|see also|see|→|=>|=)\s+\S/iu.test(
      meaning,
    )
  );
}
export const canPractice = (w: Word, skill: number) =>
  Number.isInteger(skill) &&
  skill >= 0 &&
  skill < skills.length &&
  !["blocked", "lookup", "review"].includes(w.learning_status) &&
  (!["dictionary", "reference"].includes(w.content_status) ||
    w.learning_status === "ready") &&
  validLearningMeaning(w.meaning_vi) &&
  (skill !== 4 ||
    (w.example_type !== "no-cloze" &&
      !!w.example_en &&
      !!w.example_vi &&
      cloze(w) !== w.example_en));
export const isSlang = (w: Word) =>
  (w.collections || "").split(",").includes("slang");
// A change of meaning or teaching context must not reuse mastery or schedules
// earned for the previous sense. Keep the old results for an honest history.
// Reviewed spelling variants do not change the taught sense: adding a regional
// spelling (including preferred_us_spelling) must preserve existing content
// keys, history and review schedules.
export const contentKey = (w: Word, skill = 0) =>
  JSON.stringify([
    w.word,
    w.part_of_speech || "",
    w.meaning_vi,
    ...([1, 3, 4].includes(skill)
      ? [w.accepted_answers || "", w.case_sensitive || ""]
      : []),
    ...(skill === 4 ? [w.example_en || "", w.example_vi || ""] : []),
  ]);
export function validStudyContext(value: unknown): value is StudyContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const c = value as Record<string, unknown>;
  return (
    ["id", "en", "vi", "targetVersion"].every(
      (key) => typeof c[key] === "string" && c[key].trim().length > 0,
    ) &&
    (c.alternatives === undefined ||
      (Array.isArray(c.alternatives) &&
        c.alternatives.every(
          (answer) => typeof answer === "string" && answer.trim().length > 0,
        )))
  );
}
export function expose(state: State, id: string, time = Date.now()): State {
  if (!Object.hasOwn(state.entries, id)) return state;
  return appendExposureEvent(state, {
    id: crypto.randomUUID(),
    wordId: id,
    time,
  });
}
/** Only call after these particular forms have actually been visible. This
 * observes the source entry and written forms, never credits another meaning. */
export function exposeWrittenForms(
  state: State,
  id: string,
  forms: readonly string[],
  time = Date.now(),
): State {
  if (!Object.hasOwn(state.entries, id)) return state;
  const unique = new Map<string, string>();
  for (const form of forms) {
    const clean = form.normalize("NFKC").trim().replace(/\s+/g, " ");
    if (clean) unique.set(clean.toLowerCase(), clean);
  }
  if (!unique.size) return state;
  return appendExposureEvent(state, {
    id: crypto.randomUUID(),
    wordId: id,
    time,
    writtenForms: [...unique]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, form]) => form),
  });
}
export function independence(
  state: State,
  id: string,
  time = Date.now(),
  skill = 0,
): boolean {
  const last = lastObservedExposure(state, id, time, {
    skill,
    includeEqualLegacy: true,
  });
  return !last || time - last >= 86400000;
}
export function interleaveQueue<T extends { id: string }>(tasks: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const task of tasks) {
    const group = groups.get(task.id) || [];
    group.push(task);
    groups.set(task.id, group);
  }
  const result: T[] = [];
  for (let round = 0; ; round++) {
    let added = false;
    for (const group of groups.values())
      if (group[round]) {
        result.push(group[round]);
        added = true;
      }
    if (!added) return result;
  }
}
function enrolledIds(state: State): Set<string> {
  const ids = new Set(
    Object.values(state.entries)
      .filter((e) => e.enrolled)
      .map((e) => e.word.id),
  );
  for (const key of Object.keys(state.schedules))
    ids.add(key.slice(0, key.lastIndexOf(":")));
  return ids;
}
export function collectFresh(state: State, entries: Entry[]): Entry[] {
  const enrolled = enrolledIds(state);
  return entries.filter(
    (e) =>
      !e.archived &&
      !e.known &&
      !enrolled.has(e.word.id) &&
      canPractice(e.word, 0) &&
      !isSlang(e.word),
  );
}
export function pendingScheduledTasks(
  state: State,
  entries: Entry[],
): { id: string; skill: number }[] {
  const enrolled = enrolledIds(state);
  const done = new Set(
    state.history
      .filter(
        (r) =>
          r.scheduled &&
          (r.skill === 5 || r.method !== "ungraded") &&
          Object.hasOwn(state.entries, r.wordId) &&
          r.contentVersion ===
            contentKey(state.entries[r.wordId].word, r.skill),
      )
      .map((r) => `${r.wordId}:${r.skill}`),
  );
  const tasks: { id: string; skill: number }[] = [];
  for (const e of entries) {
    if (!enrolled.has(e.word.id) || e.archived || e.known) continue;
    for (let skill = 0; skill < skills.length; skill++) {
      if (e.goal === "recognition" && ![0, 2].includes(skill)) continue;
      const key = `${e.word.id}:${skill}`;
      if (
        canPractice(e.word, skill) &&
        !Object.hasOwn(state.schedules, key) &&
        !done.has(key)
      )
        tasks.push({ id: e.word.id, skill });
    }
  }
  return interleaveQueue(tasks);
}
export function selectFreePractice(
  state: State,
  entries: Entry[],
  limit = 20,
): Entry[] {
  const latest = new Map<string, number>();
  const skillLatest = new Map<string, Result>();
  const weak = new Set<string>();
  for (const r of state.history) {
    latest.set(r.wordId, Math.max(latest.get(r.wordId) || 0, r.time));
    const key = `${r.wordId}:${r.skill}`;
    if (r.method !== "ungraded" && r.time >= (skillLatest.get(key)?.time || 0))
      skillLatest.set(key, r);
  }
  for (const r of skillLatest.values())
    if (!r.correct || r.hint) weak.add(r.wordId);
  return entries
    .filter((e) => !e.archived)
    .slice()
    .sort((a, b) => {
      const aLast = latest.get(a.word.id) || 0,
        bLast = latest.get(b.word.id) || 0;
      if (!aLast || !bLast) return aLast - bLast;
      if (weak.has(a.word.id) !== weak.has(b.word.id))
        return weak.has(a.word.id) ? -1 : 1;
      return aLast - bLast;
    })
    .slice(0, Math.max(0, Math.floor(limit)));
}
export const day = (n: number) => {
  const d = new Date(n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export function strength(
  state: State,
  id: string,
  skill: number,
  evidence?: LearningEvidence,
) {
  const proof = evidenceForSkill(
    evidence || selectLearningEvidence(state),
    id,
    skill,
  );
  if (!proof.current.length) return "Chưa đủ dữ liệu";
  if (proof.weak) return "Cần củng cố";
  if (proof.retained) return "Nhớ khá vững";
  return proof.objective.length ? "Chưa ổn định" : "Đang làm quen";
}
export function record(state: State, r: Result, scheduled: boolean) {
  if (state.history.some((x) => x.id === r.id)) return state;
  if (!Object.hasOwn(state.entries, r.wordId)) return state;
  if (!canPractice(state.entries[r.wordId].word, r.skill)) return state;
  const version = contentKey(state.entries[r.wordId].word, r.skill);
  if (
    r.context !== undefined &&
    (r.skill !== 4 ||
      !validStudyContext(r.context) ||
      r.context.targetVersion !== version ||
      cloze({ ...state.entries[r.wordId].word, example_en: r.context.en }) ===
        r.context.en)
  )
    throw Error(
      "Ngữ cảnh không còn khớp nghĩa đang học. Bỏ qua lượt này để giữ kết quả và lịch ôn hiện có.",
    );
  // A same-session repair is never a fresh retrieval, even if an older client
  // or imported caller supplies first:true. Preserve prior results unchanged.
  const first =
    r.first &&
    !state.history.some(
      (old) =>
        old.wordId === r.wordId &&
        old.skill === r.skill &&
        (old.review === r.review || old.session === r.session),
    );
  let previous = 0;
  const lastExposure = lastObservedExposure(state, r.wordId, r.time, {
    skill: r.skill,
    includeEqualLegacy: true,
  });
  for (const old of state.history) {
    if (
      old.wordId === r.wordId &&
      old.skill === r.skill &&
      old.contentVersion === version &&
      old.time <= r.time
    )
      previous = Math.max(previous, old.time);
  }
  const audioUnavailable =
    r.evidenceVersion === 2 &&
    [2, 3].includes(r.skill) &&
    r.audioPlayed !== true;
  r = {
    ...r,
    first,
    scheduled,
    contentVersion: version,
    gap: previous ? r.time - previous : 0,
    exposureGap: lastExposure ? Math.max(0, r.time - lastExposure) : undefined,
    ...(r.evidenceVersion === 2
      ? {
          independent:
            r.independent === true &&
            !r.hint &&
            first &&
            independence(state, r.wordId, r.time, r.skill),
        }
      : {}),
    ...(audioUnavailable
      ? { correct: false, method: "ungraded" as const, independent: false }
      : {}),
  };
  let next: State = {
    ...state,
    entries: { ...state.entries },
    history: [...state.history, r],
    schedules: { ...state.schedules },
    exposures: {
      ...state.exposures,
      [r.wordId]: Math.max(state.exposures?.[r.wordId] || 0, r.time),
    },
    session: state.session
      ? { ...state.session, queue: [...state.session.queue] }
      : undefined,
  };
  if (scheduled)
    next.entries[r.wordId] = {
      ...next.entries[r.wordId],
      enrolled: true,
      enrolledAt: next.entries[r.wordId].enrolledAt ?? r.time,
    };
  const key = `${r.wordId}:${r.skill}`;
  if (
    scheduled &&
    r.method !== "ungraded" &&
    !next.history.slice(0, -1).some((x) => x.review === r.review)
  ) {
    const old = scheduleForEntries(state, key, state.entries);
    const dueForReview = !old || r.time >= old.due;
    // Scheduling and objective mastery answer different questions. Revealing
    // a self-assessed answer or seeing the word in another skill must not trap
    // the remaining skills at a one-day interval. Due dates and first attempts
    // control advancement here; independent rule-graded evidence alone can
    // establish mastery elsewhere.
    const canAdvance = r.correct && !r.hint && r.first;
    // A correct early check must not repeatedly postpone or inflate a future
    // schedule. A real failure still warrants a short review, even if early.
    if (!r.correct || dueForReview) {
      const step = !r.correct
        ? 0
        : canAdvance
          ? Math.min((old?.step ?? -1) + 1, 4)
          : (old?.step ?? 0);
      // Hinted recall holds its stage and asks for a fresh check tomorrow;
      // it is neither evidence of forgetting nor a reason to advance stages.
      const interval = canAdvance && r.correct ? [1, 3, 7, 14, 30][step] : 1;
      const due = new Date(r.time);
      due.setDate(due.getDate() + interval);
      next.schedules[key] = {
        last: r.time,
        due: due.getTime(),
        step,
        contentVersion: version,
      };
    }
  }
  next = appendExposureEvent(next, {
    id: `result:${r.id}`,
    resultId: r.id,
    wordId: r.wordId,
    time: r.time,
  });
  return next;
}
export { subscribeStoredState as subscribeStorage } from "./storage";
import { readStoredState, saveStoredState } from "./storage";
export async function read(): Promise<State> {
  return readStoredState(empty);
}
export async function save(
  state: State,
  base?: State,
  options?: { replace?: boolean },
): Promise<State> {
  return saveStoredState(state, base, options);
}
export function validateBackup(x: unknown): State {
  const s = x as State;
  if (
    !s ||
    s.version !== 1 ||
    !s.entries ||
    typeof s.entries !== "object" ||
    Array.isArray(s.entries) ||
    !Array.isArray(s.history) ||
    !s.schedules ||
    typeof s.schedules !== "object" ||
    Array.isArray(s.schedules) ||
    !Number.isInteger(s.daily) ||
    s.daily < 1 ||
    s.daily > 30 ||
    typeof s.voice !== "string" ||
    !Number.isFinite(s.rate) ||
    s.rate < 0.1 ||
    s.rate > 2 ||
    (s.sourceVersion !== undefined && typeof s.sourceVersion !== "string") ||
    (s.exposures !== undefined &&
      (!s.exposures ||
        typeof s.exposures !== "object" ||
        Array.isArray(s.exposures)))
  )
    throw Error("Bản sao lưu không hợp lệ.");
  if (
    s.learningFloor !== undefined &&
    !["all", "A2", "B1", "B2", "C1"].includes(s.learningFloor)
  )
    throw Error("Mức ưu tiên từ mới không hợp lệ.");
  if (
    s.studySkills !== undefined &&
    (!Array.isArray(s.studySkills) ||
      !s.studySkills.length ||
      s.studySkills.some((n) => !Number.isInteger(n) || n < 0 || n > 5) ||
      new Set(s.studySkills).size !== s.studySkills.length)
  )
    throw Error("Kỹ năng luyện không hợp lệ.");
  if (
    [s.session, s.pausedScheduled].some(
      (v) => v !== undefined && (!v || typeof v !== "object"),
    )
  )
    throw Error("Phiên học sao lưu không hợp lệ.");
  for (const [id, e] of Object.entries(s.entries)) {
    if (
      !e?.word ||
      e.word.id !== id ||
      typeof e.origin !== "string" ||
      typeof e.archived !== "boolean" ||
      (e.notes !== undefined && typeof e.notes !== "string") ||
      (e.known !== undefined && typeof e.known !== "boolean") ||
      (e.goal !== undefined &&
        !["recognition", "active", "all"].includes(e.goal)) ||
      (e.reports !== undefined &&
        (!Array.isArray(e.reports) ||
          e.reports.some((v) => typeof v !== "string"))) ||
      (e.archivedReason !== undefined &&
        !["user", "source"].includes(e.archivedReason)) ||
      (e.enrolled !== undefined && typeof e.enrolled !== "boolean") ||
      (e.enrolledAt !== undefined &&
        (!Number.isFinite(e.enrolledAt) || e.enrolledAt < 0)) ||
      Object.values(e.word).some((v) => typeof v !== "string")
    )
      throw Error("Mục từ sao lưu không hợp lệ.");
    parse(serialize([e.word]));
  }
  const ids = new Set<string>();
  for (const r of s.history) {
    if (
      !r ||
      typeof r.id !== "string" ||
      !r.id ||
      ids.has(r.id) ||
      typeof r.wordId !== "string" ||
      !Object.hasOwn(s.entries, r.wordId) ||
      !Number.isFinite(r.time) ||
      r.time < 0 ||
      !Number.isInteger(r.skill) ||
      r.skill < 0 ||
      r.skill > 5 ||
      !["self", "rule", "ungraded"].includes(r.method) ||
      typeof r.answer !== "string" ||
      typeof r.correct !== "boolean" ||
      typeof r.hint !== "boolean" ||
      typeof r.first !== "boolean" ||
      typeof r.session !== "string" ||
      typeof r.review !== "string" ||
      !Number.isFinite(r.elapsed) ||
      r.elapsed < 0 ||
      !Number.isFinite(r.gap) ||
      r.gap < 0 ||
      (r.independent !== undefined && typeof r.independent !== "boolean") ||
      (r.audioPlayed !== undefined && typeof r.audioPlayed !== "boolean") ||
      (r.evidenceVersion !== undefined && r.evidenceVersion !== 2) ||
      (r.evidenceVersion === 2 && typeof r.independent !== "boolean") ||
      (r.evidenceVersion === 2 &&
        [2, 3].includes(r.skill) &&
        typeof r.audioPlayed !== "boolean") ||
      (r.scheduled !== undefined && typeof r.scheduled !== "boolean") ||
      (r.contentVersion !== undefined &&
        typeof r.contentVersion !== "string") ||
      (r.assessmentNote !== undefined &&
        typeof r.assessmentNote !== "string") ||
      (r.context !== undefined &&
        (r.skill !== 4 || !validStudyContext(r.context))) ||
      (r.exposureGap !== undefined &&
        (!Number.isFinite(r.exposureGap) || r.exposureGap < 0))
    )
      throw Error("Lịch sử sao lưu không hợp lệ.");
    ids.add(r.id);
  }
  for (const [key, v] of Object.entries(s.schedules)) {
    const cut = key.lastIndexOf(":");
    if (
      !Object.hasOwn(s.entries, key.slice(0, cut)) ||
      !/^[0-5]$/.test(key.slice(cut + 1)) ||
      !v ||
      !Number.isFinite(v.due) ||
      !Number.isFinite(v.last) ||
      v.last < 0 ||
      v.due < v.last ||
      !Number.isInteger(v.step) ||
      v.step < 0 ||
      v.step > 4 ||
      (v.contentVersion !== undefined && typeof v.contentVersion !== "string")
    )
      throw Error("Lịch ôn không hợp lệ.");
  }
  for (const [id, time] of Object.entries(s.exposures || {})) {
    if (!Object.hasOwn(s.entries, id) || !Number.isFinite(time) || time < 0)
      throw Error("Lần tiếp xúc sao lưu không hợp lệ.");
  }
  validateExposureEvents(s);
  if (s.writingDrafts !== undefined) {
    if (
      !s.writingDrafts ||
      typeof s.writingDrafts !== "object" ||
      Array.isArray(s.writingDrafts)
    )
      throw Error("Nháp viết không hợp lệ.");
    for (const [key, draft] of Object.entries(s.writingDrafts)) {
      if (
        ["__proto__", "constructor", "prototype"].includes(key) ||
        !draft ||
        !Object.hasOwn(s.entries, draft.wordId) ||
        typeof draft.text !== "string" ||
        !Number.isFinite(draft.updatedAt) ||
        draft.updatedAt < 0 ||
        (draft.parentId !== undefined && typeof draft.parentId !== "string") ||
        (draft.contentVersion !== undefined &&
          typeof draft.contentVersion !== "string")
      )
        throw Error("Nháp viết không hợp lệ.");
    }
  }
  for (const v of [s.session, s.pausedScheduled]) {
    if (!v) continue;
    if (
      typeof v.id !== "string" ||
      !Array.isArray(v.queue) ||
      !Number.isInteger(v.index) ||
      v.index < 0 ||
      v.index >= v.queue.length ||
      typeof v.scheduled !== "boolean" ||
      !Number.isFinite(v.started) ||
      v.started < 0 ||
      !Number.isInteger(v.count) ||
      v.count < 0 ||
      v.count > v.queue.length ||
      (v.goal !== undefined &&
        (!v.goal ||
          typeof v.goal !== "object" ||
          ![v.goal.due, v.goal.continuing, v.goal.fresh].every(
            (n) => Number.isInteger(n) && n >= 0,
          ) ||
          v.goal.due + v.goal.continuing + v.goal.fresh > v.queue.length)) ||
      (v === s.pausedScheduled && !v.scheduled) ||
      (v.draft !== undefined &&
        (!v.draft ||
          typeof v.draft.key !== "string" ||
          typeof v.draft.answer !== "string" ||
          typeof v.draft.hint !== "boolean" ||
          typeof v.draft.revealed !== "boolean" ||
          (v.draft.assessment !== undefined &&
            (!validPendingAssessment(v.draft.assessment) ||
              !v.draft.revealed ||
              ![1, 3, 4].includes(v.queue[v.index]?.skill))))) ||
      v.queue.some(
        (t) =>
          !t ||
          !Object.hasOwn(s.entries, t.id) ||
          !Number.isInteger(t.skill) ||
          t.skill < 0 ||
          t.skill > 5 ||
          typeof t.review !== "string" ||
          (t.context !== undefined &&
            (t.skill !== 4 || !validStudyContext(t.context))),
      )
    )
      throw Error("Phiên học sao lưu không hợp lệ.");
  }
  validatePracticeCollections(s);
  return s;
}
