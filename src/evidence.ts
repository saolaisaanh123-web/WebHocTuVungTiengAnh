import { canPractice, contentKey, type Result, type State } from "./core";
import { deriveResultExposure } from "./exposure-events";

export const EVIDENCE_DAY = 86_400_000;

export function validEvidenceTime(time: number, now: number): boolean {
  return Number.isFinite(time) && time > 0 && time <= now;
}

/** Missing exposure history is unknown, never proof of a day without contact. */
export function isDelayedEvidence(result: Result): boolean {
  return (
    result.method === "rule" &&
    result.first &&
    !result.hint &&
    result.evidenceVersion === 2 &&
    result.independent === true &&
    Number.isFinite(result.exposureGap) &&
    result.exposureGap! >= EVIDENCE_DAY &&
    (![2, 3].includes(result.skill) || result.audioPlayed === true)
  );
}

const chronological = (a: Result, b: Result) =>
  a.time - b.time || a.id.localeCompare(b.id);
const groupKey = (result: Result) => `${result.wordId}:${result.skill}`;
const calendarDay = (time: number) => {
  const date = new Date(time);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

/** First attempts with support can reveal weakness, but never improve the
 * independent accuracy denominator. All callers use the same four-attempt window. */
export function isWeakEvidence(attempts: readonly Result[]): boolean {
  const ordered = [...attempts].sort(chronological);
  const recent = ordered.slice(-4);
  const latest = recent.at(-1);
  const lapse = ordered
    .filter((result) => !result.correct || result.hint)
    .at(-1);
  // A repair immediately after forgetting is useful practice, not proof that
  // recall has recovered. Preserve weakness until a real post-lapse spaced
  // check; older retained results alone cannot clear a new lapse.
  const awaitingRecovery =
    !!lapse &&
    !ordered.some(
      (result) =>
        result.time - lapse.time >= EVIDENCE_DAY &&
        result.correct &&
        isDelayedEvidence(result),
    );
  return (
    !!latest &&
    (awaitingRecovery ||
      !latest.correct ||
      latest.hint ||
      recent.filter((result) => !result.correct || result.hint).length >= 2)
  );
}

export function isRetainedEvidence(attempts: readonly Result[]): boolean {
  if (isWeakEvidence(attempts)) return false;
  const clean = attempts.filter(
    (result) => result.correct && isDelayedEvidence(result),
  );
  return (
    new Set(clean.map((result) => calendarDay(result.time))).size >= 3 &&
    clean.some((result) => result.exposureGap! >= 7 * EVIDENCE_DAY)
  );
}

/** Derived view only: historical answers and flags are never rewritten.
 * Deduplicate before filtering grading method/hints, so an old client's later
 * supported repair cannot become the review's first independent attempt. */
export function selectLearningEvidence(state: State, now = Date.now()) {
  const active = new Set(
    Object.values(state.entries)
      .filter((entry) => !entry.archived)
      .map((entry) => entry.word.id),
  );
  const seenIds = new Set<string>();
  const history = state.history
    .filter((result) => {
      if (
        seenIds.has(result.id) ||
        !active.has(result.wordId) ||
        !validEvidenceTime(result.time, now)
      )
        return false;
      seenIds.add(result.id);
      return true;
    })
    .map((result) => ({ ...result, ...deriveResultExposure(state, result) }))
    .sort(chronological);
  const versions = new Map<string, string>();
  const current = history.filter((result) => {
    const key = groupKey(result);
    let version = versions.get(key);
    if (version === undefined) {
      version = contentKey(state.entries[result.wordId].word, result.skill);
      versions.set(key, version);
    }
    return result.contentVersion === version;
  });
  const seenReviews = new Set<string>();
  const seenSessionSkills = new Set<string>();
  const attempts = current.filter((result) => {
    const key = JSON.stringify([
      result.wordId,
      result.skill,
      result.review || result.id,
    ]);
    if (seenReviews.has(key)) return false;
    seenReviews.add(key);
    const sessionSkill = JSON.stringify([
      result.wordId,
      result.skill,
      result.session,
    ]);
    if (seenSessionSkills.has(sessionSkill)) return false;
    seenSessionSkills.add(sessionSkill);
    return (
      result.first &&
      result.method === "rule" &&
      result.evidenceVersion === 2 &&
      result.skill >= 0 &&
      result.skill < 5 &&
      canPractice(state.entries[result.wordId].word, result.skill) &&
      (![2, 3].includes(result.skill) || result.audioPlayed === true)
    );
  });
  const objective = attempts.filter((result) => !result.hint);
  const delayed = objective.filter(isDelayedEvidence);
  const attemptsBySkill = new Map<string, Result[]>();
  const currentBySkill = new Map<string, Result[]>();
  for (const result of current) {
    const key = groupKey(result);
    const group = currentBySkill.get(key) || [];
    group.push(result);
    currentBySkill.set(key, group);
  }
  for (const result of attempts) {
    const key = groupKey(result);
    const group = attemptsBySkill.get(key) || [];
    group.push(result);
    attemptsBySkill.set(key, group);
  }
  return {
    history,
    current,
    attempts,
    objective,
    delayed,
    attemptsBySkill,
    currentBySkill,
  };
}

export type LearningEvidence = ReturnType<typeof selectLearningEvidence>;

/** Use a shared selection for many rows instead of scanning all history per cell. */
export function evidenceForSkill(
  evidence: LearningEvidence,
  id: string,
  skill: number,
) {
  const key = `${id}:${skill}`;
  const attempts = evidence.attemptsBySkill.get(key) || [];
  const objective = attempts.filter((result) => !result.hint);
  const delayed = objective.filter(isDelayedEvidence);
  return {
    current: evidence.currentBySkill.get(key) || [],
    attempts,
    objective,
    delayed,
    weak: isWeakEvidence(attempts),
    retained: isRetainedEvidence(attempts),
  };
}

export function skillEvidence(
  state: State,
  id: string,
  skill: number,
  now = Date.now(),
) {
  return evidenceForSkill(selectLearningEvidence(state, now), id, skill);
}
