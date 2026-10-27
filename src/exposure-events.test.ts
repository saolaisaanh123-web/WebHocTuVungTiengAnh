import { describe, expect, it } from "vitest";
import {
  contentKey,
  empty,
  expose,
  exposeWrittenForms,
  merge,
  record,
  type Result,
  type State,
  validateBackup,
} from "./core";
import {
  appendExposureEvent,
  deriveResultExposure,
  exposureEventsForSnapshot,
  mergeExposureEvents,
  validateExposureEvents,
  type ExposureEvent,
} from "./exposure-events";
import {
  cloudPayload,
  decodeCloudPayload,
  encodeCloudPayload,
  mergeCloudState,
} from "./sync";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 22, 12);
function state(): State {
  const next = empty();
  next.entries.word = {
    origin: "default",
    archived: false,
    word: {
      id: "word",
      word: "suggest",
      part_of_speech: "verb",
      meaning_vi: "đề xuất",
      example_en: "I suggest leaving early.",
      example_vi: "Tôi đề xuất đi sớm.",
    },
  };
  return next;
}
function result(overrides: Partial<Result> = {}): Result {
  return {
    id: "answer",
    wordId: "word",
    time: NOW - 60_000,
    skill: 1,
    answer: "suggest",
    correct: true,
    hint: false,
    method: "rule",
    elapsed: 1000,
    session: "local-session",
    review: "review",
    gap: 0,
    first: true,
    independent: true,
    evidenceVersion: 2,
    exposureGap: 8 * DAY - 60_000,
    contentVersion: contentKey(state().entries.word.word, 1),
    ...overrides,
  };
}
const older: ExposureEvent = {
  id: "older",
  wordId: "word",
  time: NOW - 8 * DAY,
};

function pairedForms(): State {
  return merge(
    empty(),
    [
      {
        id: "drink-noun",
        word: "drink",
        part_of_speech: "noun",
        meaning_vi: "đồ uống",
        example_en: "Your drink is ready.",
        example_vi: "Đồ uống của bạn đã sẵn sàng.",
      },
      {
        id: "drink-verb",
        word: "drink",
        part_of_speech: "verb",
        meaning_vi: "uống",
        example_en: "I drink water with lunch.",
        example_vi: "Tôi uống nước trong bữa trưa.",
      },
    ],
    "default",
  );
}

function verbResult(state: State, skill = 1): Result {
  return result({
    id: `verb-answer-${skill}`,
    wordId: "drink-verb",
    time: NOW,
    skill,
    answer: "drink",
    audioPlayed: [2, 3].includes(skill) ? true : undefined,
    contentVersion: contentKey(state.entries["drink-verb"].word, skill),
    exposureGap: 8 * DAY,
  });
}

function inflectedForms(): State {
  const current = merge(
    empty(),
    [
      {
        id: "interest-v",
        word: "interest",
        part_of_speech: "verb",
        meaning_vi: "khiến ai quan tâm",
        example_en: "These books interest me.",
        example_vi: "Những cuốn sách này làm tôi quan tâm.",
      },
      {
        id: "interested-adj",
        word: "interested",
        part_of_speech: "adjective",
        meaning_vi: "quan tâm; hứng thú",
        example_en: "I am interested in science.",
        example_vi: "Tôi quan tâm tới khoa học.",
      },
    ],
    "default",
  );
  current.exposures = {
    "interest-v": NOW - 8 * DAY,
    "interested-adj": NOW - 8 * DAY,
  };
  return current;
}
function adjectiveResult(current: State, skill = 1): Result {
  return result({
    id: `adj-answer-${skill}`,
    wordId: "interested-adj",
    time: NOW,
    skill,
    answer: "interested",
    audioPlayed: [2, 3].includes(skill) || undefined,
    exposureGap: 8 * DAY,
    contentVersion: contentKey(current.entries["interested-adj"].word, skill),
  });
}

describe("actually observed inflected forms", () => {
  it("lowers only written-retrieval confidence after a displayed form without crediting or exposing the other meaning", () => {
    for (const skill of [1, 3, 4]) {
      const base = inflectedForms();
      const viewed = exposeWrittenForms(
        base,
        "interest-v",
        ["interested"],
        NOW - 1000,
      );
      expect(viewed.exposures?.["interested-adj"]).toBe(NOW - 8 * DAY);
      expect(viewed.entries).toEqual(base.entries);
      expect(viewed.history).toEqual([]);
      expect(viewed.schedules).toEqual({});
      const answered = record(viewed, adjectiveResult(viewed, skill), false);
      expect(answered.history[0]).toMatchObject({
        correct: true,
        independent: false,
        exposureGap: 1000,
      });
      expect(deriveResultExposure(answered, answered.history[0])).toEqual({
        independent: false,
        exposureGap: 1000,
      });
      expect(answered.schedules).toEqual({});
      expect(base.exposureEvents).toBeUndefined();
    }
  });

  it("does not infer semantic recognition or unseen forms from a verb table", () => {
    for (const skill of [0, 2]) {
      const viewed = exposeWrittenForms(
        inflectedForms(),
        "interest-v",
        ["interested"],
        NOW - 1000,
      );
      expect(
        record(viewed, adjectiveResult(viewed, skill), false).history[0],
      ).toMatchObject({ independent: true, exposureGap: 8 * DAY });
    }
    for (const [form, time] of [
      ["interesting", NOW - 1000],
      ["interested", NOW + 1],
    ] as const) {
      const viewed = exposeWrittenForms(
        inflectedForms(),
        "interest-v",
        [form],
        time,
      );
      expect(
        record(viewed, adjectiveResult(viewed), false).history[0],
      ).toMatchObject({ independent: true, exposureGap: 8 * DAY });
    }
  });

  it("keeps observed form text through later edits and two-device observations straddling the answer", () => {
    const base = inflectedForms();
    const laptop = record(base, adjectiveResult(base), false);
    const saved = structuredClone(laptop.history[0]);
    let phone = exposeWrittenForms(
      base,
      "interest-v",
      ["interested"],
      NOW - 1000,
    );
    phone = exposeWrittenForms(phone, "interest-v", ["interested"], NOW + 1000);
    // The table may later change, but its stored observations remain factual.
    phone = {
      ...phone,
      entries: {
        ...phone.entries,
        "interest-v": {
          ...phone.entries["interest-v"],
          word: {
            ...phone.entries["interest-v"].word,
            word: "changed",
            meaning_vi: "nghĩa mới",
          },
        },
      },
    };
    const merged = mergeCloudState(base, laptop, phone).state;
    expect(
      merged.exposureEvents
        ?.filter((event) => event.writtenForms)
        .map((event) => event.time),
    ).toEqual([NOW - 1000, NOW + 1000]);
    expect(deriveResultExposure(merged, merged.history[0])).toEqual({
      independent: false,
      exposureGap: 1000,
    });
    expect(merged.history[0]).toEqual(saved);
    expect(laptop.history[0]).toEqual(saved);
    expect(merged.schedules).toEqual({});
  });

  it("preserves optional form events in JSON backups and compact cloud roundtrips without a storage migration", async () => {
    const viewed = exposeWrittenForms(
      inflectedForms(),
      "interest-v",
      ["interested", " interesting ", "interested"],
      NOW - 1000,
    );
    const backup = validateBackup(JSON.parse(JSON.stringify(viewed)));
    expect(backup.exposureEvents).toEqual(viewed.exposureEvents);
    expect(backup.exposureEvents?.[0].writtenForms).toEqual([
      "interested",
      "interesting",
    ]);
    const cloud = await decodeCloudPayload(await encodeCloudPayload(viewed));
    expect(cloud).toEqual(cloudPayload(viewed));
    expect(cloud.exposureEvents?.[0].writtenForms).toEqual([
      "interested",
      "interesting",
    ]);
    expect(
      validateBackup(JSON.parse(JSON.stringify(inflectedForms())))
        .exposureEvents,
    ).toBeUndefined();
  });

  it("does not self-exclude a separate same-time form sighting with a misleading result reference", () => {
    const current = inflectedForms();
    const answered = record(current, adjectiveResult(current), false);
    const raw = {
      ...answered,
      exposureEvents: [
        ...(answered.exposureEvents || []),
        {
          id: "distinct-form-at-answer",
          wordId: "interest-v",
          time: NOW,
          writtenForms: ["interested"],
          resultId: answered.history[0].id,
        },
      ],
    };
    // Unsupported hybrids are rejected at the boundary; even a caller with an
    // unchecked State must not turn a different observation into its own answer.
    expect(() => validateBackup(raw)).toThrow();
    expect(deriveResultExposure(raw, raw.history[0])).toEqual({
      independent: false,
      exposureGap: 0,
    });
    const valid = {
      ...answered,
      exposureEvents: [
        ...(answered.exposureEvents || []),
        {
          id: "real-form-at-answer",
          wordId: "interest-v",
          time: NOW,
          writtenForms: ["interested"],
        },
      ],
    };
    expect(deriveResultExposure(valid, valid.history[0])).toEqual({
      independent: false,
      exposureGap: 0,
    });
  });

  it("rejects malformed or conflicting immutable form observations and copies form arrays", () => {
    const current = inflectedForms();
    const forms = ["interested"];
    const event = {
      id: "form-view",
      wordId: "interest-v",
      time: NOW,
      writtenForms: forms,
    };
    const copied = appendExposureEvent(current, event);
    forms[0] = "changed";
    expect(copied.exposureEvents?.[0].writtenForms).toEqual(["interested"]);
    expect(() =>
      mergeExposureEvents(copied.exposureEvents, [
        { ...event, writtenForms: ["interesting"] },
      ]),
    ).toThrow(/trùng/);
    expect(() =>
      validateBackup({
        ...current,
        exposureEvents: [
          { ...event, writtenForms: ["interested"], resultId: "adj-answer-1" },
        ],
      }),
    ).toThrow();
    expect(() =>
      mergeExposureEvents(copied.exposureEvents, [
        { id: event.id, wordId: event.wordId, time: event.time },
      ]),
    ).toThrow(/trùng/);
    for (const writtenForms of [
      [],
      [""],
      [" interested"],
      ["interested\n"],
      ["a".repeat(129)],
      ["interested", "INTERESTED"],
      Array.from({ length: 17 }, (_, i) => `form${i}`),
      [123],
    ]) {
      expect(
        () =>
          validateBackup({
            ...current,
            exposureEvents: [{ ...event, writtenForms }],
          }),
        JSON.stringify(writtenForms),
      ).toThrow();
    }
  });
});

describe("immutable cross-device exposure evidence", () => {
  it("does not count just-seen spelling in another POS as independent written recall, without merging schedules or meaning IDs", () => {
    for (const skill of [1, 3, 4]) {
      let current = pairedForms();
      current.exposures = {
        "drink-noun": NOW - 8 * DAY,
        "drink-verb": NOW - 8 * DAY,
      };
      current.schedules[`drink-verb:${skill}`] = {
        due: NOW + DAY,
        last: NOW - 8 * DAY,
        step: 3,
        contentVersion: contentKey(current.entries["drink-verb"].word, skill),
      };
      current = expose(current, "drink-noun", NOW - 1000);
      const before = structuredClone(current);
      const after = record(current, verbResult(current, skill), false);
      expect(after.history[0]).toMatchObject({
        independent: false,
        exposureGap: 1000,
        correct: true,
      });
      expect(deriveResultExposure(after, after.history[0])).toEqual({
        independent: false,
        exposureGap: 1000,
      });
      expect(after.schedules).toEqual(before.schedules);
      expect(Object.keys(after.entries)).toEqual(["drink-noun", "drink-verb"]);
      expect(current).toEqual(before);
    }
  });

  it("keeps meaning recognition separate from a same-spelling POS and ignores unrelated or future forms", () => {
    for (const skill of [0, 2]) {
      let current = pairedForms();
      current.exposures = { "drink-verb": NOW - 8 * DAY };
      current = expose(current, "drink-noun", NOW - 1000);
      const after = record(current, verbResult(current, skill), false);
      expect(after.history[0]).toMatchObject({
        independent: true,
        exposureGap: 8 * DAY,
      });
    }
    let current = pairedForms();
    current.entries["drink-noun"].word.word = "drinking";
    current.exposures = { "drink-verb": NOW - 8 * DAY };
    current = expose(current, "drink-noun", NOW - 1000);
    expect(
      record(current, verbResult(current), false).history[0].independent,
    ).toBe(true);
    const future = expose(pairedForms(), "drink-noun", NOW + 1);
    expect(
      record(future, verbResult(future), false).history[0].exposureGap,
    ).toBeUndefined();
  });

  it("reconciles a cross-device observation of another POS without rewriting the saved answer", () => {
    const base = pairedForms();
    base.exposures = { "drink-verb": NOW - 8 * DAY };
    const local = record(base, verbResult(base), false);
    const answer = local.history[0];
    expect(answer.independent).toBe(true);
    const phone = expose(base, "drink-noun", NOW - 1000);
    const merged = mergeCloudState(base, local, phone);
    expect(merged.conflicts).toEqual([]);
    expect(deriveResultExposure(merged.state, merged.state.history[0])).toEqual(
      { independent: false, exposureGap: 1000 },
    );
    expect(merged.state.history[0]).toEqual(answer);
    expect(local.history[0]).toMatchObject({
      independent: true,
      exposureGap: 8 * DAY,
    });
  });

  it("retains both same-form phone views straddling a remote answer instead of trusting only the later map timestamp", () => {
    const base = pairedForms();
    base.exposures = {
      "drink-noun": NOW - 8 * DAY,
      "drink-verb": NOW - 8 * DAY,
    };
    const local = record(base, verbResult(base), false);
    const answer = structuredClone(local.history[0]);
    expect(answer.independent).toBe(true);

    const beforeAnswer = expose(base, "drink-noun", NOW - 1000);
    const afterAnswer = expose(beforeAnswer, "drink-noun", NOW + 1000);
    expect(afterAnswer.exposures?.["drink-noun"]).toBe(NOW + 1000);
    const merged = mergeCloudState(base, local, afterAnswer);
    expect(merged.conflicts).toEqual([]);
    expect(
      merged.state.exposureEvents
        ?.filter((event) => event.wordId === "drink-noun")
        .map((event) => event.time),
    ).toEqual([NOW - 8 * DAY, NOW - 1000, NOW + 1000]);
    expect(deriveResultExposure(merged.state, merged.state.history[0])).toEqual(
      { independent: false, exposureGap: 1000 },
    );
    expect(merged.state.history[0]).toEqual(answer);
    expect(local.history[0]).toEqual(answer);
    expect(merged.state.schedules).toEqual({});
    expect(base.exposureEvents).toBeUndefined();
  });

  it("treats an equal legacy timestamp on another POS as a distinct exposure, not this answer's own map entry", () => {
    const current = pairedForms();
    const answer = verbResult(current);
    current.history = [answer];
    current.exposures = { "drink-noun": NOW, "drink-verb": NOW };
    expect(deriveResultExposure(current, answer)).toEqual({
      independent: false,
      exposureGap: 0,
    });
    expect(answer.independent).toBe(true);
  });

  it("unions event IDs deterministically without losing older observations or changing inputs", () => {
    const phone = { id: "phone", wordId: "word", time: NOW - 90_000 };
    const left = [phone, older],
      right = [{ ...older }];
    const before = structuredClone({ left, right });
    expect(mergeExposureEvents(left, right)).toEqual([older, phone]);
    expect(mergeExposureEvents(right, left)).toEqual([older, phone]);
    expect({ left, right }).toEqual(before);
    expect(mergeExposureEvents(undefined, undefined)).toBeUndefined();
  });

  it("rejects an immutable ID collision and malformed backup observations", () => {
    expect(() =>
      mergeExposureEvents([older], [{ ...older, time: NOW }]),
    ).toThrow();
    const current = state();
    for (const exposureEvents of [
      "not an array",
      [{ ...older, time: -1 }],
      [{ ...older, time: NaN }],
      [{ ...older, wordId: "missing" }],
      [older, older],
      [{ ...older, resultId: "" }],
    ])
      expect(() =>
        validateExposureEvents({ ...current, exposureEvents }),
      ).toThrow();
    expect(() => validateExposureEvents(current)).not.toThrow();
  });

  it("appends an observation without lowering the legacy latest-time map", () => {
    const current = state();
    current.exposures = { word: NOW };
    const updated = appendExposureEvent(current, older);
    expect(updated.exposures?.word).toBe(NOW);
    expect(updated.exposureEvents).toEqual([older]);
    expect(current.exposureEvents).toBeUndefined();
    expect(appendExposureEvent(updated, older).exposureEvents).toHaveLength(1);
  });

  it("excludes an answer's own history/event while preserving its observed eight-day gap", () => {
    const current = state(),
      answer = result();
    current.history = [answer];
    current.exposures = { word: answer.time };
    current.exposureEvents = [
      older,
      {
        id: "result:answer",
        wordId: "word",
        time: answer.time,
        resultId: answer.id,
      },
    ];
    expect(deriveResultExposure(current, answer)).toEqual({
      independent: true,
      exposureGap: answer.exposureGap,
    });
  });

  it("invalidates a saved eight-day result when another device viewed the meaning thirty seconds earlier", () => {
    const base = appendExposureEvent(state(), older);
    const local = structuredClone(base),
      phone = structuredClone(base);
    const answer = result();
    local.history = [answer];
    local.exposureEvents!.push({
      id: "result:answer",
      wordId: "word",
      time: answer.time,
      resultId: answer.id,
    });
    local.exposures = { word: answer.time };
    const observed = appendExposureEvent(phone, {
      id: "phone-read",
      wordId: "word",
      time: NOW - 90_000,
    });
    const merged = mergeCloudState(base, local, observed);
    expect(merged.conflicts).toEqual([]);
    expect(merged.state.exposureEvents).toHaveLength(3);
    expect(deriveResultExposure(merged.state, merged.state.history[0])).toEqual(
      {
        independent: false,
        exposureGap: 30_000,
      },
    );
    expect(merged.state.history[0]).toEqual(answer);
    expect(local.history[0]).toEqual(answer);
  });

  it("preserves older snapshots' distinct latest views before max-map merge loses their chronology", () => {
    const local = state(),
      phone = state();
    const answer = result();
    local.history = [answer];
    local.exposures = { word: answer.time };
    phone.exposures = { word: answer.time - 30_000 };
    const before = structuredClone({ local, phone });
    const merged = mergeCloudState(undefined, local, phone);
    expect(merged.conflicts).toEqual([]);
    expect(merged.state.exposures?.word).toBe(answer.time);
    expect(deriveResultExposure(merged.state, answer)).toEqual({
      independent: false,
      exposureGap: 30_000,
    });
    expect(merged.state.history[0]).toEqual(answer);
    expect({ local, phone }).toEqual(before);
  });

  it("migrates an own legacy answer timestamp idempotently without manufacturing a same-time view", () => {
    const current = state(),
      answer = result();
    current.history = [answer];
    current.exposures = { word: answer.time };
    const events = exposureEventsForSnapshot(current)!;
    expect(events).toHaveLength(1);
    expect(events[0].resultId).toBe(answer.id);
    const upgraded = { ...current, exposureEvents: events };
    expect(exposureEventsForSnapshot(upgraded)).toEqual(events);
    expect(deriveResultExposure(upgraded, answer)).toEqual({
      independent: true,
      exposureGap: answer.exposureGap,
    });
    expect(current.exposureEvents).toBeUndefined();
  });

  it("reports cloud event ID conflicts as immutable instead of silently choosing a device", () => {
    const local = appendExposureEvent(state(), older);
    const remote = appendExposureEvent(state(), { ...older, time: NOW });
    const merged = mergeCloudState(undefined, local, remote);
    expect(merged.conflicts).toMatchObject([
      { path: "exposureEvents.older", immutable: true },
    ]);
    expect(local.exposureEvents).toEqual([older]);
  });

  it("treats a distinct same-time exposure as ambiguous and ignores later/future observations", () => {
    const current = state(),
      answer = result();
    current.history = [answer];
    current.exposureEvents = [
      older,
      {
        id: "after-answer",
        wordId: "word",
        time: answer.time + 1,
      },
      {
        id: "future",
        wordId: "word",
        time: NOW + 100 * DAY,
      },
    ];
    expect(deriveResultExposure(current, answer).independent).toBe(true);
    const sameTime = {
      ...current,
      exposureEvents: [
        ...current.exposureEvents,
        { id: "other-device-same-ms", wordId: "word", time: answer.time },
      ],
    };
    expect(deriveResultExposure(sameTime, answer)).toEqual({
      independent: false,
      exposureGap: 0,
    });
  });

  it("uses a prior result or legacy timestamp as a shorter bound without inventing unknown legacy gaps", () => {
    const current = state(),
      answer = result();
    current.exposures = { word: answer.time - 3000 };
    expect(deriveResultExposure(current, answer)).toEqual({
      independent: false,
      exposureGap: 3000,
    });
    current.exposures = {};
    current.history = [
      { ...result(), id: "earlier-question", time: answer.time - 2000 },
    ];
    expect(deriveResultExposure(current, answer)).toEqual({
      independent: false,
      exposureGap: 2000,
    });
    const noKnownGap = result({ exposureGap: undefined });
    expect(deriveResultExposure(state(), noKnownGap)).toEqual({
      independent: true,
      exposureGap: undefined,
    });
  });

  it("never upgrades self-supported or repeated work into independent evidence", () => {
    const current = appendExposureEvent(state(), older);
    for (const patch of [
      { independent: false },
      { first: false },
      { hint: true },
    ])
      expect(deriveResultExposure(current, result(patch)).independent).toBe(
        false,
      );
  });

  it("rejects explicit old-sense schedule stamps even if a merged snapshot already contains the new meaning", () => {
    const local = state(),
      remote = state();
    local.schedules["word:1"] = {
      last: NOW - DAY,
      due: NOW,
      step: 0,
      contentVersion: contentKey(local.entries.word.word, 1),
    };
    remote.schedules["word:1"] = {
      last: NOW,
      due: NOW + 30 * DAY,
      step: 4,
      contentVersion: "old-sense",
    };
    const merged = mergeCloudState(undefined, local, remote);
    expect(merged.state.schedules["word:1"]).toEqual(local.schedules["word:1"]);
  });
});
