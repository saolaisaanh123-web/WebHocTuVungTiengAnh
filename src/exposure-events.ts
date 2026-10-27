import type { Result, State } from "./core";

/** Immutable observations supplement the legacy latest-time map. They carry
 * no answer text and can be unioned safely after offline work on two devices. */
export type ExposureEvent = {
  id: string;
  wordId: string;
  time: number;
  /** A recorded answer also exposes its word; exclude that event from itself. */
  resultId?: string;
  /** Forms actually read in a reference table, not inferred from today's data.
   * They only lower confidence in written retrieval of another entry. */
  writtenForms?: string[];
};

const isTime = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const writtenFormKey = (value: string) =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();

function validWrittenForms(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 16 &&
    value.every(
      (form) =>
        typeof form === "string" &&
        form.length <= 128 &&
        form === form.trim() &&
        /\p{L}/u.test(form) &&
        !/[\u0000-\u001f\u007f]/u.test(form),
    ) &&
    new Set(value.map(writtenFormKey)).size === value.length
  );
}

export function validateExposureEvents(state: {
  entries: Record<string, unknown>;
  exposureEvents?: unknown;
}) {
  if (state.exposureEvents === undefined) return;
  if (!Array.isArray(state.exposureEvents))
    throw Error("Lịch sử tiếp xúc không hợp lệ.");
  const ids = new Set<string>();
  for (const value of state.exposureEvents) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw Error("Sự kiện tiếp xúc không hợp lệ.");
    const event = value as Partial<ExposureEvent>;
    if (
      typeof event.id !== "string" ||
      !event.id ||
      ids.has(event.id) ||
      typeof event.wordId !== "string" ||
      !Object.hasOwn(state.entries, event.wordId) ||
      !isTime(event.time) ||
      (event.resultId !== undefined &&
        (typeof event.resultId !== "string" || !event.resultId)) ||
      (event.writtenForms !== undefined &&
        (!validWrittenForms(event.writtenForms) ||
          event.resultId !== undefined))
    )
      throw Error("Sự kiện tiếp xúc không hợp lệ.");
    ids.add(event.id);
  }
}

const sameEvent = (left: ExposureEvent, right: ExposureEvent) =>
  left.id === right.id &&
  left.wordId === right.wordId &&
  left.time === right.time &&
  left.resultId === right.resultId &&
  JSON.stringify(left.writtenForms) === JSON.stringify(right.writtenForms);

/** A colliding immutable ID cannot silently turn one observation into another. */
export function mergeExposureEvents(
  ...collections: (readonly ExposureEvent[] | undefined)[]
): ExposureEvent[] | undefined {
  if (collections.every((items) => items === undefined)) return undefined;
  const records = new Map<string, ExposureEvent>();
  for (const items of collections) {
    for (const event of items || []) {
      const existing = records.get(event.id);
      if (existing && !sameEvent(existing, event))
        throw Error("ID sự kiện tiếp xúc trùng nhưng nội dung khác nhau.");
      if (!existing)
        records.set(event.id, {
          ...event,
          ...(event.writtenForms
            ? { writtenForms: [...event.writtenForms] }
            : {}),
        });
    }
  }
  return [...records.values()].sort(
    (a, b) => a.time - b.time || a.id.localeCompare(b.id),
  );
}

export function appendExposureEvent(state: State, event: ExposureEvent): State {
  if (!Object.hasOwn(state.entries, event.wordId)) return state;
  validateExposureEvents({ entries: state.entries, exposureEvents: [event] });
  return {
    ...state,
    exposureEvents: mergeExposureEvents(state.exposureEvents, [event]),
    exposures: {
      ...state.exposures,
      [event.wordId]: Math.max(
        state.exposures?.[event.wordId] || 0,
        event.time,
      ),
    },
  };
}

/** Preserve a legacy device's latest observation before a merge takes the
 * maximum timestamp. An answer-derived timestamp belongs to that answer, not
 * a second sighting of the same word at the same millisecond. */
export function exposureEventsForSnapshot(
  state: State,
): ExposureEvent[] | undefined {
  const additions: ExposureEvent[] = [];
  const explicit = new Set(
    (state.exposureEvents || []).map((event) =>
      JSON.stringify([event.wordId, event.time]),
    ),
  );
  const resultsAt = new Map<string, Result[]>();
  for (const result of state.history) {
    const key = JSON.stringify([result.wordId, result.time]);
    const group = resultsAt.get(key) || [];
    group.push(result);
    resultsAt.set(key, group);
  }
  for (const [wordId, time] of Object.entries(state.exposures || {})) {
    const point = JSON.stringify([wordId, time]);
    if (
      !Object.hasOwn(state.entries, wordId) ||
      !isTime(time) ||
      explicit.has(point)
    )
      continue;
    const answers = resultsAt.get(point);
    if (answers?.length) {
      for (const answer of answers)
        additions.push({
          id: `legacy-result:${JSON.stringify([wordId, time, answer.id])}`,
          wordId,
          time,
          resultId: answer.id,
        });
    } else
      additions.push({
        id: `legacy-view:${point}`,
        wordId,
        time,
      });
  }
  return mergeExposureEvents(
    state.exposureEvents,
    additions.length ? additions : undefined,
  );
}

type Observation = { time: number; resultId?: string };
type ObservationIndex = {
  entries: State["entries"];
  history: State["history"];
  historyLength: number;
  events: State["exposureEvents"];
  eventsLength: number;
  byWord: Map<string, Observation[]>;
  byWrittenForm: Map<string, Observation[]>;
  writtenForms: Map<string, Set<string>>;
  formsByWord: Map<string, string[]>;
};
const indexes = new WeakMap<State, ObservationIndex>();
function observationIndex(state: State) {
  const cached = indexes.get(state);
  if (
    cached &&
    cached.entries === state.entries &&
    cached.history === state.history &&
    cached.events === state.exposureEvents &&
    cached.historyLength === state.history.length &&
    cached.eventsLength === (state.exposureEvents?.length || 0)
  )
    return cached;
  const index = new Map<string, Observation[]>();
  const byWrittenForm = new Map<string, Observation[]>();
  const add = (wordId: string, point: Observation) => {
    if (!isTime(point.time)) return;
    const values = index.get(wordId) || [];
    values.push(point);
    index.set(wordId, values);
  };
  for (const event of state.exposureEvents || []) {
    add(event.wordId, { time: event.time, resultId: event.resultId });
    for (const form of event.writtenForms || []) {
      const key = writtenFormKey(form);
      const points = byWrittenForm.get(key) || [];
      points.push({ time: event.time, resultId: event.resultId });
      byWrittenForm.set(key, points);
    }
  }
  for (const result of state.history)
    add(result.wordId, { time: result.time, resultId: result.id });
  for (const values of index.values()) values.sort((a, b) => a.time - b.time);
  for (const values of byWrittenForm.values())
    values.sort((a, b) => a.time - b.time);
  const writtenForms = new Map<string, Set<string>>();
  const formsByWord = new Map<string, string[]>();
  for (const [id, entry] of Object.entries(state.entries)) {
    // These are written forms of the same headword, never general synonyms or
    // pronunciation equivalents. In particular, record n/v can prime spelling
    // without establishing that the other pronunciation or meaning was heard.
    const forms = [
      ...new Set(
        [
          entry.word.word,
          entry.word.preferred_us_spelling || "",
          ...(entry.word.spelling_variants || "").split("|"),
        ]
          .map((form) =>
            form.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase(),
          )
          .filter(Boolean),
      ),
    ];
    formsByWord.set(id, forms);
    for (const form of forms) {
      const ids = writtenForms.get(form) || new Set<string>();
      ids.add(id);
      writtenForms.set(form, ids);
    }
  }
  const built = {
    entries: state.entries,
    history: state.history,
    historyLength: state.history.length,
    events: state.exposureEvents,
    eventsLength: state.exposureEvents?.length || 0,
    byWord: index,
    byWrittenForm,
    writtenForms,
    formsByWord,
  };
  indexes.set(state, built);
  return built;
}

/** Most skills test a particular meaning. Written retrieval also needs a
 * quiet interval for the answer's form, even when another POS has its own ID.
 * This lookup only lowers confidence; it never merges meaning or SRS state. */
export function lastObservedExposure(
  state: State,
  wordId: string,
  time: number,
  options: {
    skill?: number;
    excludeResultId?: string;
    includeEqualLegacy?: boolean;
  } = {},
): number | undefined {
  const index = observationIndex(state);
  const ids = new Set([wordId]);
  const formObservations: Observation[][] = [];
  if ([1, 3, 4].includes(options.skill ?? 0)) {
    for (const form of index.formsByWord.get(wordId) || []) {
      for (const id of index.writtenForms.get(form) || []) ids.add(id);
      formObservations.push(index.byWrittenForm.get(form) || []);
    }
  }
  let previous: number | undefined;
  const inspect = (observations: Observation[], ownAnswer = false) => {
    let left = 0,
      right = observations.length;
    while (left < right) {
      const middle = (left + right) >>> 1;
      if (observations[middle].time <= time) left = middle + 1;
      else right = middle;
    }
    for (let i = left - 1; i >= 0; i--) {
      if (
        ownAnswer &&
        options.excludeResultId !== undefined &&
        observations[i].resultId === options.excludeResultId
      )
        continue;
      previous = Math.max(previous ?? 0, observations[i].time);
      break;
    }
  };
  for (const observations of formObservations) inspect(observations);
  for (const id of ids) {
    inspect(index.byWord.get(id) || [], id === wordId);
    // After an answer, the equal legacy map timestamp usually belongs to that
    // answer. Explicit distinct same-time events remain visible above. Before
    // recording an answer no own event exists, so an equal timestamp is recent.
    const latestLegacy = state.exposures?.[id];
    if (
      isTime(latestLegacy) &&
      (latestLegacy < time ||
        ((options.includeEqualLegacy || id !== wordId) &&
          latestLegacy === time))
    )
      previous = Math.max(previous ?? 0, latestLegacy);
  }
  return previous;
}

/** Reconcile derived evidence against the combined observation chronology.
 * Never rewrite a saved answer, promote non-independent work, or fabricate a
 * missing legacy gap. A new observation may only shorten the saved interval. */
export function deriveResultExposure(
  state: State,
  result: Result,
): { independent: boolean; exposureGap?: number } {
  const previous = lastObservedExposure(state, result.wordId, result.time, {
    skill: result.skill,
    excludeResultId: result.id,
  });
  const observedGap =
    previous === undefined ? undefined : Math.max(0, result.time - previous);
  const savedGap = isTime(result.exposureGap) ? result.exposureGap : undefined;
  const exposureGap =
    savedGap === undefined
      ? undefined
      : observedGap === undefined
        ? savedGap
        : Math.min(savedGap, observedGap);
  return {
    independent:
      result.independent === true &&
      result.first &&
      !result.hint &&
      (observedGap === undefined || observedGap >= 86_400_000) &&
      (exposureGap === undefined || exposureGap >= 86_400_000),
    exposureGap,
  };
}
