import {
  canPractice,
  day,
  pendingScheduledTasks,
  type Entry,
  type Result,
  type State,
  type StudyTask,
} from "./core";
import { selectLearningEvidence } from "./evidence";
import {
  chosenStudySkills,
  filterPendingForPreference,
} from "./learning-preferences";
import { scheduleForEntries } from "./schedule-state";

/** One eligibility check for Home, the forecast and NEW session planning. */
export function scheduledReviews(state: State) {
  return Object.entries(state.schedules).filter(([key, schedule]) => {
    const boundary = key.lastIndexOf(":"),
      entry = state.entries[key.slice(0, boundary)],
      skill = Number(key.slice(boundary + 1));
    return (
      boundary > 0 &&
      Number.isFinite(schedule.due) &&
      entry &&
      !entry.archived &&
      canPractice(entry.word, skill) &&
      !!scheduleForEntries(state, key, state.entries)
    );
  });
}

/** Today's total includes all overdue reviews, counted once. Future days use
 * local calendar boundaries (including daylight-saving transitions). */
export function reviewForecast(state: State, now = Date.now()): number[] {
  const reviews = scheduledReviews(state);
  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(now);
    date.setDate(date.getDate() + offset);
    const label = day(+date);
    return reviews.filter(([, schedule]) =>
      offset === 0 ? day(schedule.due) <= label : day(schedule.due) === label,
    ).length;
  });
}

type PlannedTask = Pick<StudyTask, "id" | "skill">;

/** A preview and actual Start share this plan. Inputs are already ordered and
 * ranked by the caller; no random IDs, saved queues or due dates are changed. */
export function planScheduledStudy(
  state: State,
  active: Entry[],
  fresh: Entry[],
  now = Date.now(),
) {
  const reviews: PlannedTask[] = scheduledReviews(state)
    .filter(([, schedule]) => schedule.due <= now)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([key]) => ({
      id: key.slice(0, key.lastIndexOf(":")),
      skill: Number(key.slice(key.lastIndexOf(":") + 1)),
    }));
  const included = new Set(reviews.map((task) => `${task.id}:${task.skill}`));
  const continuing = filterPendingForPreference(
    state,
    pendingScheduledTasks(state, active),
  ).filter((task) => !included.has(`${task.id}:${task.skill}`));
  const enrolledToday = active.filter(
    (entry) =>
      entry.enrolled && entry.enrolledAt && day(entry.enrolledAt) === day(now),
  ).length;
  const freshWords = Math.min(
    fresh.length,
    Math.max(0, state.daily - enrolledToday),
    reviews.length > 20 ? 2 : state.daily,
  );
  const introductions = fresh.slice(0, freshWords).flatMap((entry) =>
    chosenStudySkills(state, entry).map((skill) => ({
      id: entry.word.id,
      skill,
    })),
  );
  return { reviews, continuing, introductions, freshWords };
}

/** A transparent rough range, not a prediction of the user's speed. Includes
 * listening/writing time and only the tasks in the planned/remaining queue. */
export function estimateStudyMinutes(
  tasks: readonly Pick<StudyTask, "skill">[],
) {
  const secondsPerSkill = [15, 30, 25, 40, 30, 90];
  const seconds = tasks.reduce(
    (total, task) => total + (secondsPerSkill[task.skill] || 30),
    0,
  );
  return { min: Math.ceil(seconds / 60), max: Math.ceil((seconds * 1.5) / 60) };
}

const objectiveCycle = [1, 3, 4];
const selfAndWriting = [0, 2, 5];
const compareIds = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function savedPosition(result: Result): number {
  if (!result.id.startsWith(`${result.session}:`)) return Infinity;
  const suffix = result.id.slice(result.session.length + 1);
  return /^\d+$/.test(suffix) ? Number(suffix) : Infinity;
}

/** For a NEW queue only. Each word gets a different first blind skill than
 * its previous scheduled session; all tasks/reviews/context snapshots stay.
 * The caller interleaves word groups afterwards and keeps introductions last.
 * This does not lower the independent-recall threshold or change due dates. */
export function orderScheduledTasks(
  state: State,
  tasks: StudyTask[],
  now = Date.now(),
): StudyTask[] {
  const groups = new Map<string, StudyTask[]>();
  for (const task of tasks) {
    const group = groups.get(task.id) || [];
    group.push(task);
    groups.set(task.id, group);
  }
  const firstBySession = new Map<string, Result>();
  for (const result of selectLearningEvidence(state, now).current) {
    if (
      !groups.has(result.wordId) ||
      !result.scheduled ||
      !result.first ||
      result.method !== "rule" ||
      !objectiveCycle.includes(result.skill)
    )
      continue;
    const key = JSON.stringify([result.wordId, result.session]);
    const old = firstBySession.get(key);
    if (
      !old ||
      result.time < old.time ||
      (result.time === old.time &&
        savedPosition(result) < savedPosition(old)) ||
      (result.time === old.time &&
        savedPosition(result) === savedPosition(old) &&
        compareIds(result.id, old.id) < 0)
    )
      firstBySession.set(key, result);
  }
  const lastSession = new Map<string, Result>();
  for (const result of firstBySession.values()) {
    const old = lastSession.get(result.wordId);
    if (
      !old ||
      result.time > old.time ||
      (result.time === old.time && compareIds(result.session, old.session) > 0)
    )
      lastSession.set(result.wordId, result);
  }
  return [...groups.entries()].flatMap(([id, group]) => {
    const last = lastSession.get(id);
    const offset = last
      ? (objectiveCycle.indexOf(last.skill) + 1) % objectiveCycle.length
      : 0;
    const priority = [
      ...objectiveCycle.slice(offset),
      ...objectiveCycle.slice(0, offset),
      ...selfAndWriting,
    ];
    return group
      .slice()
      .sort((a, b) => priority.indexOf(a.skill) - priority.indexOf(b.skill));
  });
}
