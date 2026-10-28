import {
  canPractice,
  collectFresh,
  day,
  frequencyScore,
  type Entry,
  type Result,
  type State,
} from "./core";

import type { LearningMode } from "./practice-data";
import {
  isDelayedEvidence,
  isRetainedEvidence,
  isWeakEvidence,
  selectLearningEvidence,
} from "./evidence";
import { scheduleForEntries } from "./schedule-state";
export type { LearningMode } from "./practice-data";
export const selectionModes: {
  value: LearningMode;
  label: string;
  description: string;
}[] = [
  {
    value: "smart",
    label: "Thông minh",
    description: "Cân bằng tần suất, bằng chứng ghi nhớ và sự đa dạng.",
  },
  {
    value: "common",
    label: "Ưu tiên thông dụng",
    description:
      "Ưu tiên từ thông dụng cần học; giãn từ vừa trả lời đúng hoặc đã vững.",
  },
  {
    value: "weak",
    label: "Củng cố từ yếu",
    description:
      "Chọn từ còn yếu qua kiểm tra; Hiểu nghĩa và Nghe nhận biết còn nhận từ bạn tự báo chưa nhớ, có ghi rõ nguồn tự đánh giá.",
  },
  {
    value: "mixed",
    label: "Trộn từ",
    description:
      "Trộn có kiểm soát; thứ tự ổn định trong ngày khi dữ liệu không đổi.",
  },
];

export type WordRecommendation = {
  entry: Entry;
  reason: string;
  score: number;
};
type SkillMemory = {
  days: Set<string>;
  longGap: boolean;
  latest: Result;
  attempts: Result[];
};
type Summary = {
  count: number;
  latest: number;
  recent: Result[];
  independentDays: Set<string>;
  skillMemory: Map<number, SkillMemory>;
};
type Evidence = Summary & {
  weak: boolean;
  mistakes: number;
  stable: boolean;
};
type Candidate = WordRecommendation & {
  family: string;
  part: string;
  topic: string;
  practiceTier: number;
};
const DAY = 86400000;
const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];
const levelOf = (e: Entry) =>
  levels.indexOf((e.word.level || "").trim().toUpperCase());
const compareIds = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const SHARED_FREQUENCY_SOURCE = "wordfreq-3.1.1-en-large";
// Keep the exporter's documented case/lemma exclusions. In particular, a score
// for "may" must not silently fill the deliberately unscored month "May".
const frequencyConflations = new Set(["IT", "May", "March", "found"]);
function sharedFrequencyKey(entry: Entry): string | undefined {
  const word = entry.word;
  const spelling = word.word.trim();
  const collections = new Set(
    (word.collections || "").split(",").map((value) => value.trim()),
  );
  if (
    entry.origin !== "default" ||
    frequencyConflations.has(spelling) ||
    !/^[a-z]+(?:-[a-z]+)*$/i.test(spelling) ||
    collections.has("slang") ||
    word.expression_type?.trim() ||
    !["oxford-3000", "oxford-5000", "american-3000", "american-5000"].some(
      (name) => collections.has(name),
    )
  )
    return;
  return spelling.toLowerCase();
}

/** Scores measure written forms across meanings/POS. A new reviewed sense may
 * reuse an exact spelling's pinned score from the default corpus, including
 * when the donor is outside the selected filter. Personal edits, expressions,
 * undocumented sources and conflicting scores cannot supply that fallback.
 * This derived lookup never modifies TXT, entries, or an existing session. */
function sharedSpellingFrequencies(state: State): Map<string, number | null> {
  const scores = new Map<string, number | null>();
  for (const entry of Object.values(state.entries)) {
    if (entry.word.frequency_source !== SHARED_FREQUENCY_SOURCE) continue;
    const spelling = sharedFrequencyKey(entry);
    const score = frequencyScore(entry.word);
    if (spelling === undefined || score === undefined) continue;
    const old = scores.get(spelling);
    scores.set(spelling, old === undefined || old === score ? score : null);
  }
  return scores;
}

// This is only a visual-form heuristic, never a claim of semantic similarity.
function wordFamily(text: string): string {
  const normalized = text
    .toLowerCase()
    .trim()
    .replace(/[^a-z -]/g, "");
  if (normalized.length < 5 || normalized.includes(" ")) return normalized;
  const root = normalized.replace(
    /(?:ations?|ments?|ingly|ing|edly|ed|es|s)$/,
    "",
  );
  return root.length >= 4 ? root : normalized;
}
function firstTag(text: string | undefined): string {
  return (text || "").split(/[,;|]/)[0].trim().toLowerCase();
}
function hash(text: string): number {
  let result = 2166136261;
  for (let i = 0; i < text.length; i++) {
    result ^= text.charCodeAt(i);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0) / 4294967296;
}
function calendarAge(now: number, previous: number): number {
  if (!previous) return 30;
  const a = new Date(now);
  const b = new Date(previous);
  return Math.max(
    0,
    Math.round(
      (Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) -
        Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) /
        DAY,
    ),
  );
}

// One pass through history. Legacy/self-marked/obsolete answers remain in the
// backup but cannot justify either a weakness claim or a memory claim here.
function indexEvidence(
  state: State,
  entries: Entry[],
  now: number,
  skill?: number,
): Map<string, Evidence> {
  const words = new Map(entries.map((e) => [e.word.id, e.word]));
  const summaries = new Map<string, Summary>();
  for (const r of selectLearningEvidence(state, now).attempts) {
    const word = words.get(r.wordId);
    if (
      !word ||
      (skill !== undefined && r.skill !== skill) ||
      !canPractice(word, r.skill) ||
      r.method !== "rule"
    )
      continue;
    const summary: Summary = summaries.get(r.wordId) || {
      count: 0,
      latest: 0,
      recent: [],
      independentDays: new Set<string>(),
      skillMemory: new Map<number, SkillMemory>(),
    };
    summary.count++;
    summary.latest = Math.max(summary.latest, r.time);
    // Fixed four-result window, including when imported history is unsorted.
    summary.recent.push(r);
    summary.recent.sort((a, b) => b.time - a.time || compareIds(a.id, b.id));
    summary.recent.length = Math.min(4, summary.recent.length);
    const memory: SkillMemory = summary.skillMemory.get(r.skill) || {
      days: new Set<string>(),
      longGap: false,
      latest: r,
      attempts: [],
    };
    memory.attempts.push(r);
    if (
      r.time > memory.latest.time ||
      (r.time === memory.latest.time && compareIds(r.id, memory.latest.id) < 0)
    )
      memory.latest = r;
    if (r.correct && !r.hint && isDelayedEvidence(r)) {
      summary.independentDays.add(day(r.time));
      memory.days.add(day(r.time));
      // A long interval in this skill does not prove a long interval without
      // seeing the word elsewhere. Older backups lacking this field stay valid
      // history but cannot establish seven-day retention.
      if ((r.exposureGap ?? 0) >= 7 * DAY) memory.longGap = true;
    }
    summary.skillMemory.set(r.skill, memory);
    summaries.set(r.wordId, summary);
  }
  const evidence = new Map<string, Evidence>();
  for (const [id, summary] of summaries) {
    const weakSkills = [...summary.skillMemory.values()]
      .filter((memory) => isWeakEvidence(memory.attempts))
      .sort(
        (a, b) =>
          b.latest.time - a.latest.time || compareIds(a.latest.id, b.latest.id),
      );
    const recent = weakSkills.length
      ? [...weakSkills[0].attempts]
          .sort((a, b) => b.time - a.time || compareIds(a.id, b.id))
          .slice(0, 4)
      : summary.recent;
    const mistakes = recent.filter((r) => !r.correct || r.hint).length;
    const weak = weakSkills.length > 0;
    evidence.set(id, {
      ...summary,
      recent,
      mistakes,
      weak,
      stable:
        !weak &&
        [...summary.skillMemory.values()].some((memory) =>
          isRetainedEvidence(memory.attempts),
        ),
    });
  }
  return evidence;
}

/** A recognition self-rating can request practice without becoming objective
 * evidence. Only the first current-sense rating/check of a session counts; an
 * immediate retry must not erase the learner's original request for support. */
function selfReportedWeakness(
  state: State,
  now: number,
  skill?: number,
): Map<string, Result> {
  const evidence = selectLearningEvidence(state, now);
  const validSuccesses = new Set(
    evidence.attempts
      .filter((r) => [0, 2].includes(r.skill) && r.correct && !r.hint)
      .map((r) => r.id),
  );
  const ratings = new Map<string, Result>();
  const seenReviews = new Set<string>();
  const seenSessions = new Set<string>();
  for (const r of evidence.current) {
    if (
      ![0, 2].includes(r.skill) ||
      (skill !== undefined && r.skill !== skill) ||
      !canPractice(state.entries[r.wordId].word, r.skill)
    )
      continue;
    const review = JSON.stringify([r.wordId, r.skill, r.review || r.id]);
    const session = JSON.stringify([r.wordId, r.skill, r.session]);
    if (seenReviews.has(review) || seenSessions.has(session)) continue;
    seenReviews.add(review);
    seenSessions.add(session);
    if (!r.first || (r.skill === 2 && r.audioPlayed !== true)) continue;
    const request = JSON.stringify([r.wordId, r.skill]);
    if (r.method === "self") {
      if (r.correct && !r.hint) ratings.delete(request);
      else if (!r.correct) ratings.set(request, r);
    } else if (validSuccesses.has(r.id)) {
      ratings.delete(request);
    }
  }
  // A success in visual recognition cannot clear a listening request (or the
  // reverse). An unfiltered list returns each word once, using its latest
  // still-unresolved request only for the explanatory self-rating label.
  const byWord = new Map<string, Result>();
  for (const rating of ratings.values()) {
    const old = byWord.get(rating.wordId);
    if (
      !old ||
      rating.time > old.time ||
      (rating.time === old.time && compareIds(rating.id, old.id) < 0)
    )
      byWord.set(rating.wordId, rating);
  }
  return byWord;
}

function supportedLevel(
  entries: Entry[],
  evidence: Map<string, Evidence>,
): number {
  const byLevel = new Map<number, Set<string>>();
  for (const e of entries) {
    const level = levelOf(e);
    const proof = evidence.get(e.word.id);
    if (
      level < 0 ||
      !proof ||
      ![...proof.skillMemory.values()].some(
        (memory) =>
          memory.days.size >= 2 && memory.latest.correct && !memory.latest.hint,
      ) ||
      proof.weak
    )
      continue;
    const ids = byLevel.get(level) || new Set<string>();
    ids.add(e.word.id);
    byLevel.set(level, ids);
  }
  // B1 is a selection prior for this personal app, never a proficiency result.
  // Raise it only after repeated independent recall of several distinct words.
  let target = 2;
  for (const [level, ids] of byLevel)
    if (ids.size >= 3) target = Math.max(target, Math.min(4, level));
  return target;
}
function memoryReason(proof: Evidence | undefined, exposed: boolean): string {
  if (!proof)
    return exposed
      ? "Đã tiếp xúc; chưa có lượt trả lời được chấm phù hợp."
      : "Chưa có lượt trả lời được chấm phù hợp.";
  if (proof.weak)
    return proof.mistakes
      ? `${proof.mistakes}/${proof.recent.length} lượt gần nhất sai hoặc cần gợi ý.`
      : "Có lần sai/cần gợi ý trước đó; chưa có kiểm tra phục hồi độc lập sau khoảng nghỉ.";
  if (proof.stable)
    return "Ít nhất một kỹ năng đã trả lời độc lập trên ít nhất 3 ngày, có khoảng cách không tiếp xúc từ 7 ngày; giảm ưu tiên luyện lại.";
  if (proof.independentDays.size)
    return `Có bằng chứng nhớ độc lập trên ${proof.independentDays.size} ngày; chưa đủ kết luận nhớ vững.`;
  return "Đã trả lời; chưa có bằng chứng nhớ độc lập sau một khoảng thời gian.";
}
function diversityPenalty(candidate: Candidate, recent: Candidate[]): number {
  let penalty = 0;
  for (let i = 0; i < recent.length; i++) {
    const previous = recent[recent.length - 1 - i];
    const weight = i === 0 ? 1 : 0.4;
    if (candidate.family && candidate.family === previous.family)
      penalty += 22 * weight;
    if (candidate.part && candidate.part === previous.part)
      penalty += 3 * weight;
    if (candidate.topic && candidate.topic === previous.topic)
      penalty += 4 * weight;
  }
  return penalty;
}

/**
 * Learning recommendations, separate from the library's CEFR order and SRS.
 * No mutation, random calls, queue changes, schedule changes or enrolment.
 * Complexity: one history pass, a word sort, then a bounded 12-item lookahead.
 */
export function recommendWords(
  state: State,
  entries: Entry[],
  options: {
    mode?: LearningMode;
    intent?: "new" | "practice";
    limit?: number;
    now?: number;
    skill?: number;
  } = {},
): WordRecommendation[] {
  const mode = options.mode || "smart";
  const intent = options.intent || "practice";
  const now = options.now ?? Date.now();
  const skill = options.skill;
  if (
    skill !== undefined &&
    (!Number.isInteger(skill) || skill < 0 || skill > 5)
  )
    return [];
  const eligible = (
    intent === "new" ? collectFresh(state, entries) : entries
  ).filter((e) => !e.archived && !e.known && canPractice(e.word, skill ?? 0));
  const evidence = indexEvidence(state, entries, now, skill);
  const selfReported =
    mode === "weak" && (skill === undefined || [0, 2].includes(skill))
      ? selfReportedWeakness(state, now, skill)
      : new Map<string, Result>();
  const sharedFrequencies = sharedSpellingFrequencies(state);
  // Recency controls optional practice variety, not mastery. Self-ratings and
  // saved writing still represent time spent, even when they cannot establish
  // objective recall. Keep the latest current-sense result so a newer failure
  // or supported answer is never hidden behind an earlier success.
  const practiceLatest = new Map<string, Result>();
  if (mode === "common" && intent === "practice") {
    for (const result of selectLearningEvidence(state, now).current) {
      if (skill !== undefined && result.skill !== skill) continue;
      practiceLatest.set(result.wordId, result);
    }
  }
  // Ability inference uses all words, including words already in the schedule.
  const target = supportedLevel(entries, evidence);
  const seed = day(now);
  const seenIds = new Set<string>();
  const ranked: Candidate[] = [];
  for (const entry of eligible) {
    const id = entry.word.id;
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    const proof = evidence.get(id);
    const selfRating = selfReported.get(id);
    if (mode === "weak" && !proof?.weak && !selfRating) continue;
    const ownFrequency = frequencyScore(entry.word);
    const sharedKey = sharedFrequencyKey(entry);
    const inheritedFrequency =
      ownFrequency === undefined &&
      !entry.word.frequency_zipf?.trim() &&
      !entry.word.frequency_source?.trim() &&
      !entry.word.frequency_note?.trim() &&
      sharedKey !== undefined
        ? sharedFrequencies.get(sharedKey)
        : undefined;
    const frequency = ownFrequency ?? inheritedFrequency ?? undefined;
    const level = levelOf(entry);
    const affinity =
      level < 0 ? 0 : Math.max(-4, 6 - 2 * Math.abs(level - target));
    const age = calendarAge(
      now,
      Math.max(proof?.latest || 0, state.exposures?.[id] || 0),
    );
    let score: number;
    let practiceTier = 0;
    let recentPractice: "correct" | "self" | "writing" | undefined;
    if (mode === "common") {
      score = (frequency ?? 2.5) * 20 + affinity * 0.15;
      if (intent === "practice" && !proof?.weak) {
        const relevantSkills =
          skill === undefined ? [0, 1, 2, 3, 4, 5] : [skill];
        const due = relevantSkills.some((s) => {
          const schedule = scheduleForEntries(
            state,
            `${id}:${s}`,
            state.entries,
          );
          return schedule !== undefined && schedule.due <= now;
        });
        if (!due) {
          const latest = practiceLatest.get(id);
          if (latest && !latest.hint && now - latest.time < DAY) {
            if (latest.correct && latest.method === "rule")
              recentPractice = "correct";
            else if (latest.correct && latest.method === "self")
              recentPractice = "self";
            else if (
              latest.skill === 5 &&
              latest.method === "ungraded" &&
              latest.answer.trim()
            )
              recentPractice = "writing";
          }
          // Stable pools keep frequency as their main ordering signal, while
          // a completed round leaves room for other useful words. If every
          // candidate is cooling down, we still offer a valid practice set.
          const needsSupport =
            !!latest &&
            (latest.hint || (!latest.correct && latest.method !== "ungraded"));
          practiceTier = recentPractice
            ? 2
            : !needsSupport && proof?.stable
              ? 1
              : 0;
        }
      }
    } else if (mode === "weak") {
      score =
        (proof?.weak
          ? (proof.recent[0].correct && !proof.recent[0].hint ? 0 : 26) +
            proof.mistakes * 8 +
            (proof.mistakes / proof.recent.length) * 16
          : 18) +
        Math.min(10, age) +
        (frequency ?? 2.5) * 2;
    } else if (mode === "mixed") {
      score =
        hash(`${seed}:${id}`) * 30 +
        (frequency ?? 2.5) * 2 +
        (!proof ? 4 : 0) +
        (proof?.weak ? 5 : 0) -
        (proof?.stable ? 8 : 0);
    } else {
      score =
        (frequency ?? 2.5) * 12 +
        affinity +
        (!proof ? 10 : 0) +
        (proof?.weak ? 26 + proof.mistakes * 2 : 0) -
        (proof?.stable ? 24 : 0) +
        (intent === "practice" ? Math.min(10, age) - (age < 1 ? 12 : 0) : 0);
    }
    const frequencyReason =
      frequency === undefined
        ? "Chưa có số liệu tần suất."
        : `Tần suất Zipf ${frequency.toFixed(2)}${entry.word.level ? `; CEFR ${entry.word.level}` : ""}.${ownFrequency === undefined ? " Dùng số liệu wordfreq 3.1.1 của cùng mặt chữ; không phải tần suất riêng của nghĩa hoặc từ loại này." : ""}`;
    const memoryExplanation = selfRating
      ? `${proof?.weak ? `${memoryReason(proof, !!state.exposures?.[id])} ` : ""}Bạn tự báo chưa nhớ; chưa phải kết quả kiểm tra khách quan. Theo bài ${selfRating.skill === 2 ? "Nghe nhận biết" : "Hiểu nghĩa"}.`
      : memoryReason(proof, !!state.exposures?.[id]);
    ranked.push({
      entry,
      score,
      reason: `${frequencyReason} ${memoryExplanation}${mode === "mixed" ? " Thứ tự trộn cố định trong ngày." : ""}${practiceTier === 2 ? (recentPractice === "self" ? " Vừa tự đánh giá; tạm nhường lượt cho từ khác trong 24 giờ, chưa xác nhận nhớ độc lập." : recentPractice === "writing" ? " Vừa luyện viết; tạm nhường lượt cho từ khác trong 24 giờ, câu chưa được chấm đúng." : " Vừa trả lời đúng; tạm giảm ưu tiên trong 24 giờ nếu còn từ khác cần luyện.") : practiceTier === 1 ? " Ưu tiên từ cần học khác trước khi luyện lại từ đã vững." : ""}`,
      family: wordFamily(entry.word.word),
      part: firstTag(entry.word.part_of_speech),
      topic: firstTag(entry.word.topics),
      practiceTier,
    });
  }
  ranked.sort(
    (a, b) =>
      a.practiceTier - b.practiceTier ||
      b.score - a.score ||
      compareIds(a.entry.word.id, b.entry.word.id),
  );
  const requested = options.limit ?? ranked.length;
  const limit = Math.min(
    ranked.length,
    Math.max(
      0,
      requested === Infinity ? ranked.length : Math.floor(requested) || 0,
    ),
  );
  const result: Candidate[] = [];
  const window = ranked.slice(0, 12);
  let nextIndex = window.length;
  while (window.length && result.length < limit) {
    const recent = result.slice(-3);
    let best = 0;
    let adjustedScore = -Infinity;
    for (let i = 0; i < window.length; i++) {
      const adjusted = window[i].score - diversityPenalty(window[i], recent);
      if (
        window[i].practiceTier < window[best].practiceTier ||
        (window[i].practiceTier === window[best].practiceTier &&
          adjusted > adjustedScore)
      ) {
        best = i;
        adjustedScore = adjusted;
      }
    }
    const [selected] = window.splice(best, 1);
    result.push({ ...selected, score: Math.round(adjustedScore * 100) / 100 });
    if (nextIndex < ranked.length) window.push(ranked[nextIndex++]);
  }
  return result.map(({ entry, reason, score }) => ({ entry, reason, score }));
}

export const rankNewWords = (
  state: State,
  entries: Entry[],
  mode: LearningMode = "smart",
  now?: number,
): WordRecommendation[] =>
  recommendWords(state, entries, { mode, intent: "new", now });
