import { describe, expect, it } from "vitest";
import {
  contentKey,
  empty,
  independence,
  interleaveQueue,
  merge,
  record,
  type Result,
  type State,
  type StudyTask,
  type Word,
} from "./core";
import { selectLearningEvidence } from "./evidence";
import {
  estimateStudyMinutes,
  orderScheduledTasks,
  planScheduledStudy,
  reviewForecast,
  scheduledReviews,
} from "./session-planning";

const DAY = 86_400_000;
const START = Date.UTC(2026, 5, 1, 12);
const word: Word = {
  id: "rotating-apple",
  word: "apple",
  part_of_speech: "noun",
  meaning_vi: "quả táo",
  example_en: "I eat an apple every day.",
  example_vi: "Tôi ăn một quả táo mỗi ngày.",
  content_status: "reviewed",
};
const setup = () => merge(empty(), [word], "default");
const tasks = (id = word.id): StudyTask[] =>
  [0, 1, 2, 3, 4, 5].map((skill) => ({
    id,
    skill,
    review: `${id}-review-${skill}`,
  }));
const answer = (
  skill: number,
  time: number,
  session: string,
  index: number,
): Result => ({
  id: `${session}:${index}`,
  wordId: word.id,
  time,
  skill,
  answer: word.word,
  correct: skill !== 5,
  hint: false,
  method: skill === 5 ? "ungraded" : [0, 2].includes(skill) ? "self" : "rule",
  elapsed: 1000,
  session,
  review: `${session}-review-${skill}`,
  gap: 0,
  first: true,
  evidenceVersion: 2,
  independent: true,
  audioPlayed: [2, 3].includes(skill) ? true : undefined,
  contentVersion: contentKey(word, skill),
});

describe("Consistent review forecast and session estimate", () => {
  it("includes overdue and later-today reviews once, excluding unusable and stale schedules", () => {
    const state = setup();
    const now = +new Date(2026, 9, 28, 12);
    const at = (offset: number, hour = 12) =>
      +new Date(2026, 9, 28 + offset, hour);
    for (const [skill, due] of [
      [0, at(-2)],
      [1, at(0, 23)],
      [2, at(1)],
      [3, at(6)],
      [4, at(7)],
    ])
      state.schedules[`${word.id}:${skill}`] = { due, last: at(-10), step: 2 };
    const archived = { ...word, id: "archived" };
    state.entries[archived.id] = {
      word: archived,
      origin: "custom",
      archived: true,
    };
    state.schedules[`${archived.id}:1`] = {
      due: at(-1),
      last: at(-10),
      step: 2,
    };
    state.schedules["missing:1"] = { due: at(-1), last: at(-10), step: 2 };
    state.schedules[`${word.id}:5`] = {
      due: at(-1),
      last: at(-10),
      step: 2,
      contentVersion: "old-meaning",
    };
    state.schedules[`${word.id}:99`] = { due: at(-1), last: at(-10), step: 2 };
    const before = structuredClone(state);
    expect(reviewForecast(state, now)).toEqual([2, 1, 0, 0, 0, 0, 1]);
    expect(
      scheduledReviews(state).filter(([, s]) => s.due <= now),
    ).toHaveLength(1);
    expect(state).toEqual(before);
  });

  it("estimates the same due, continuing and chosen fresh tasks that Start uses, without touching saved work", () => {
    const state = setup();
    const pear = {
      ...word,
      id: "fresh-pear",
      word: "pear",
      example_en: "I eat a pear every day.",
    };
    state.entries[pear.id] = { word: pear, origin: "custom", archived: false };
    state.entries[word.id].enrolled = true;
    state.entries[word.id].enrolledAt = START - DAY;
    state.studySkills = [4];
    state.schedules[`${word.id}:0`] = {
      due: START - 1,
      last: START - DAY,
      step: 0,
    };
    state.schedules[`${word.id}:1`] = {
      due: START + DAY,
      last: START - DAY,
      step: 0,
    };
    state.session = {
      id: "frozen",
      queue: tasks(),
      index: 2,
      started: START,
      scheduled: true,
      count: 6,
      draft: {
        key: "frozen:2",
        answer: "old draft",
        hint: false,
        revealed: false,
      },
    };
    const before = structuredClone(state);
    const plan = planScheduledStudy(
      state,
      Object.values(state.entries),
      [state.entries[pear.id]],
      START,
    );
    expect(plan.reviews).toEqual([{ id: word.id, skill: 0 }]);
    expect(plan.continuing).toEqual([{ id: word.id, skill: 4 }]);
    expect(plan.introductions).toEqual([{ id: pear.id, skill: 4 }]);
    expect(plan.freshWords).toBe(1);
    const oneSkill = estimateStudyMinutes(plan.introductions);
    const allSkills = estimateStudyMinutes(tasks(pear.id));
    expect(allSkills.min).toBeGreaterThan(oneSkill.max);
    expect(estimateStudyMinutes([])).toEqual({ min: 0, max: 0 });
    expect(state).toEqual(before);
  });
});

describe("Bounded new scheduled sessions", () => {
  const matureState = () => {
    const words: Word[] = Array.from({ length: 120 }, (_, index) => ({
      ...word,
      id: `mature-${String(index).padStart(3, "0")}`,
    }));
    const state = merge(empty(), words, "default");
    state.studySkills = [0, 1, 2, 3, 4];
    for (const [index, item] of words.entries()) {
      state.entries[item.id].enrolled = true;
      state.entries[item.id].enrolledAt = START - 60 * DAY;
      for (let skill = 0; skill < 5; skill++)
        state.schedules[`${item.id}:${skill}`] = {
          due: START - (120 - index) * DAY + skill,
          last: START - (150 - index) * DAY,
          step: 4,
          contentVersion: contentKey(item, skill),
        };
    }
    return state;
  };

  it("takes an oldest-due prefix from 600 reviews, defers fresh words and leaves every stored record untouched", () => {
    const state = matureState();
    const freshWord = { ...word, id: "new-after-backlog" };
    state.entries[freshWord.id] = {
      word: freshWord,
      origin: "default",
      archived: false,
    };
    state.session = {
      id: "frozen-existing-session",
      queue: tasks("mature-119"),
      index: 2,
      started: START - 60_000,
      scheduled: true,
      count: 6,
      draft: {
        key: "frozen-existing-session:2",
        answer: "unfinished",
        hint: true,
        revealed: false,
      },
    };
    state.pausedScheduled = structuredClone(state.session);
    const before = structuredClone(state);
    const plan = planScheduledStudy(
      state,
      Object.values(state.entries),
      [state.entries[freshWord.id]],
      START,
    );
    expect(plan.reviews).toHaveLength(40);
    expect(plan.remainingReviews).toBe(560);
    expect(plan.remainingContinuing).toBe(0);
    expect(plan.introductions).toEqual([]);
    expect(plan.freshWords).toBe(0);
    expect(plan.budgetMinutes).toBe(20);
    expect(plan.taskLimit).toBe(40);
    expect(estimateStudyMinutes(plan.reviews).min).toBeLessThanOrEqual(20);
    expect(plan.reviews.map((task) => `${task.id}:${task.skill}`)).toEqual(
      Object.entries(state.schedules)
        .sort((a, b) => a[1].due - b[1].due)
        .slice(0, 40)
        .map(([key]) => key),
    );
    expect(state).toEqual(before);
  });

  it("lets successive completed sessions cover the entire backlog without duplicates or postponing omitted schedules", () => {
    let state = matureState();
    const completed = new Set<string>();
    for (let batch = 0; batch < 20; batch++) {
      const now = START + batch * 60_000;
      const plan = planScheduledStudy(
        state,
        Object.values(state.entries),
        [],
        now,
      );
      if (!plan.reviews.length) break;
      expect(plan.reviews.length).toBeLessThanOrEqual(40);
      expect(estimateStudyMinutes(plan.reviews).min).toBeLessThanOrEqual(20);
      const omitted = Object.fromEntries(
        Object.entries(state.schedules).filter(
          ([key]) =>
            !plan.reviews.some((task) => key === `${task.id}:${task.skill}`),
        ),
      );
      for (const [index, task] of plan.reviews.entries()) {
        const key = `${task.id}:${task.skill}`;
        expect(completed.has(key), key).toBe(false);
        completed.add(key);
        state = record(
          state,
          {
            ...answer(task.skill, now + index, `batch-${batch}`, index),
            wordId: task.id,
            review: `batch-${batch}-${key}`,
            contentVersion: contentKey(state.entries[task.id].word, task.skill),
          },
          true,
        );
      }
      for (const [key, schedule] of Object.entries(omitted))
        expect(state.schedules[key], key).toEqual(schedule);
    }
    expect(completed.size).toBe(600);
    expect(
      planScheduledStudy(
        state,
        Object.values(state.entries),
        [],
        START + DAY / 2,
      ).reviews,
    ).toEqual([]);
    expect(Object.keys(state.schedules)).toHaveLength(600);
  });

  it("bounds slow unfinished writing tasks and admits fresh words only as complete skill groups", () => {
    const state = merge(
      empty(),
      Array.from({ length: 20 }, (_, index) => ({
        ...word,
        id: `pending-${index}`,
      })),
      "default",
    );
    state.studySkills = [5];
    for (const entry of Object.values(state.entries)) {
      entry.enrolled = true;
      entry.enrolledAt = START - DAY;
    }
    const freshWord = { ...word, id: "fresh-later" };
    state.entries[freshWord.id] = {
      word: freshWord,
      origin: "default",
      archived: false,
    };
    const plan = planScheduledStudy(
      state,
      Object.values(state.entries),
      [state.entries[freshWord.id]],
      START,
    );
    expect(plan.continuing).toHaveLength(13);
    expect(plan.remainingContinuing).toBe(7);
    expect(plan.introductions).toEqual([]);
    expect(plan.freshWords).toBe(0);
    expect(estimateStudyMinutes(plan.continuing).min).toBe(20);

    const fresh = merge(
      empty(),
      Array.from({ length: 6 }, (_, index) => ({
        ...word,
        id: `fresh-${index}`,
      })),
      "default",
    );
    fresh.daily = 6;
    const all = Object.values(fresh.entries);
    const introductions = planScheduledStudy(fresh, all, all, START);
    expect(introductions.freshWords).toBe(5);
    expect(introductions.introductions).toHaveLength(30);
    for (const entry of all.slice(0, 5))
      expect(
        introductions.introductions
          .filter((task) => task.id === entry.word.id)
          .map((task) => task.skill),
      ).toEqual([0, 1, 2, 3, 4, 5]);
    expect(
      introductions.introductions.some((task) => task.id === "fresh-5"),
    ).toBe(false);
  });
});

describe("New scheduled-session planning", () => {
  it("rotates the first objective skill across real review dates and keeps SRS unchanged", () => {
    let state = setup();
    const firstSkills: number[] = [];
    for (const [round, day] of [0, 1, 4, 11, 25, 55].entries()) {
      const time = START + day * DAY + round * 60_000;
      const queue =
        round === 0
          ? tasks()
          : orderScheduledTasks(
              state,
              tasks().filter((task) => task.skill !== 5),
              time,
            );
      if (round > 0) firstSkills.push(queue[0].skill);
      for (const [index, task] of queue.entries()) {
        const at = time + index * 1000;
        state = record(
          state,
          {
            ...answer(task.skill, at, `round-${round}`, index),
            independent: independence(state, word.id, at),
          },
          true,
        );
      }
    }
    expect(firstSkills).toEqual([3, 4, 1, 3, 4]);
    const delayed = selectLearningEvidence(state, START + 60 * DAY).delayed;
    for (const skill of [1, 3, 4]) {
      expect(
        delayed.some((result) => result.skill === skill),
        `skill ${skill}`,
      ).toBe(true);
      expect(state.schedules[`${word.id}:${skill}`].step).toBe(4);
    }
    // Later answers still stay non-independent after the first answer reveals
    // the word. Rotation adds opportunities rather than granting extra credit.
    expect(delayed).toHaveLength(5);
  });

  it("keeps every task, review and snapshot while preserving word-group order for interleaving", () => {
    const state = setup();
    const other = { ...word, id: "another-apple" };
    state.entries[other.id] = {
      word: other,
      origin: "default",
      archived: false,
    };
    const queue = [...tasks(word.id), ...tasks(other.id)];
    queue[4].context = {
      id: "frozen",
      en: "An apple fell.",
      vi: "Một quả táo rơi.",
      targetVersion: contentKey(word, 4),
    };
    state.session = {
      id: "already-open",
      queue: structuredClone(queue),
      index: 2,
      started: START,
      scheduled: true,
      count: queue.length,
    };
    state.pausedScheduled = structuredClone(state.session);
    const before = structuredClone({ state, queue });
    const ordered = orderScheduledTasks(state, queue, START);
    expect(ordered).toHaveLength(queue.length);
    expect(new Set(ordered)).toEqual(new Set(queue));
    expect({ state, queue }).toEqual(before);
    const interleaved = interleaveQueue(ordered);
    expect(interleaved.slice(0, 4).map((task) => task.id)).toEqual([
      word.id,
      other.id,
      word.id,
      other.id,
    ]);
    expect(
      interleaved.find((task) => task.skill === 4 && task.id === word.id)
        ?.context,
    ).toEqual(queue[4].context);
    expect(orderScheduledTasks(state, queue, START + 1000)).toEqual(ordered);
  });

  it("uses each word's own last session, skipping stale meanings, future records and free practice", () => {
    const state = setup();
    const previous = answer(1, START - DAY, "previous", 0);
    state.history = [{ ...previous, scheduled: true }];
    expect(orderScheduledTasks(state, tasks(), START)[0].skill).toBe(3);
    for (const changed of [
      { ...previous, scheduled: false },
      { ...previous, scheduled: true, contentVersion: "old-meaning" },
      { ...previous, scheduled: true, time: START + DAY },
    ]) {
      const next = { ...state, history: [changed] };
      expect(orderScheduledTasks(next, tasks(), START)[0].skill).toBe(1);
    }
    const onlyWriting = tasks().filter((task) =>
      [0, 1, 5].includes(task.skill),
    );
    expect(
      orderScheduledTasks(state, onlyWriting, START).map((task) => task.skill),
    ).toEqual([1, 0, 5]);
  });
});
