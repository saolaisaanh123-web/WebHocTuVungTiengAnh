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
const secondsPerSkill = [15, 30, 25, 40, 30, 90];
const secondsForSkill = (skill: number) => secondsPerSkill[skill] || 30;
const sessionBudgetMinutes = 20;
const sessionTaskLimit = 40;

/** A preview and actual Start share this plan. Inputs are already ordered and
 * ranked by the caller. Bound only NEW sessions, prioritizing the oldest due
 * prefix, then unfinished work, then whole fresh-word groups. Omitted reviews
 * remain due; no random IDs, saved queues, history or due dates are changed.
 * The time budget uses the same rough base costs as the estimate, not a claim
 * that every learner will finish in exactly twenty minutes. */
export function planScheduledStudy(
  state: State,
  active: Entry[],
  fresh: Entry[],
  now = Date.now(),
) {
  const allReviews: PlannedTask[] = scheduledReviews(state)
    .filter(([, schedule]) => schedule.due <= now)
    .sort((a, b) => a[1].due - b[1].due || compareIds(a[0], b[0]))
    .map(([key]) => ({
      id: key.slice(0, key.lastIndexOf(":")),
      skill: Number(key.slice(key.lastIndexOf(":") + 1)),
    }));
  const included = new Set(
    allReviews.map((task) => `${task.id}:${task.skill}`),
  );
  const allContinuing = filterPendingForPreference(
    state,
    pendingScheduledTasks(state, active),
  ).filter((task) => !included.has(`${task.id}:${task.skill}`));
  let usedSeconds = 0;
  let usedTasks = 0;
  const fits = (group: PlannedTask[]) =>
    usedTasks + group.length <= sessionTaskLimit &&
    usedSeconds +
      group.reduce((sum, task) => sum + secondsForSkill(task.skill), 0) <=
      sessionBudgetMinutes * 60;
  const admit = (group: PlannedTask[]) => {
    usedTasks += group.length;
    usedSeconds += group.reduce(
      (sum, task) => sum + secondsForSkill(task.skill),
      0,
    );
  };
  const takePrefix = (tasks: PlannedTask[]) => {
    const selected: PlannedTask[] = [];
    for (const task of tasks) {
      // The fixed budget always accommodates an individual supported task.
      // Keep a defensive first-task fallback if its rough cost changes later.
      if (!fits([task]) && usedTasks > 0) break;
      selected.push(task);
      admit([task]);
    }
    return selected;
  };
  const reviews = takePrefix(allReviews);
  const remainingReviews = allReviews.length - reviews.length;
  const continuing = remainingReviews ? [] : takePrefix(allContinuing);
  const remainingContinuing = allContinuing.length - continuing.length;
  const enrolledToday = active.filter(
    (entry) =>
      entry.enrolled && entry.enrolledAt && day(entry.enrolledAt) === day(now),
  ).length;
  const freshLimit = Math.min(
    fresh.length,
    Math.max(0, state.daily - enrolledToday),
    allReviews.length > 20 ? 2 : state.daily,
  );
  const introductions: PlannedTask[] = [];
  let freshWords = 0;
  if (!remainingReviews && !remainingContinuing)
    for (const entry of fresh.slice(0, freshLimit)) {
      const group = chosenStudySkills(state, entry).map((skill) => ({
        id: entry.word.id,
        skill,
      }));
      if (!group.length) continue;
      // A new word is introduced with all its chosen skills, rather than
      // silently dropping some skills to fill the remaining budget.
      if (!fits(group)) break;
      introductions.push(...group);
      freshWords++;
      admit(group);
    }
  return {
    reviews,
    continuing,
    introductions,
    freshWords,
    remainingReviews,
    remainingContinuing,
    budgetMinutes: sessionBudgetMinutes,
    taskLimit: sessionTaskLimit,
  };
}

/** A transparent rough range, not a prediction of the user's speed. Includes
 * listening/writing time and only the tasks in the planned/remaining queue. */
export function estimateStudyMinutes(
  tasks: readonly Pick<StudyTask, "skill">[],
) {
  const seconds = tasks.reduce(
    (total, task) => total + secondsForSkill(task.skill),
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
