import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contentKey, empty, merge, parse, type Result } from "./core";
import {
  conversationPracticeIds,
  dialogues,
  makeConversationAttempt,
  recommendDialogues,
} from "./conversations";
import { selectConversationVoices } from "./ConversationPractice";

const source = () =>
  merge(
    empty(),
    parse(readFileSync("public/data/vocabulary.txt", "utf8")),
    "default",
  );
const sample = dialogues.find(
  (dialogue) => dialogue.id === "assignment-feedback",
)!;
const other = dialogues.find((dialogue) => dialogue.id === "buying-a-desk")!;
const history = (id: string, contentVersion: string, time = 100): Result => ({
  id: `result-${id}`,
  wordId: id,
  time,
  skill: 0,
  answer: "answer",
  correct: false,
  hint: false,
  method: "rule",
  first: true,
  evidenceVersion: 2,
  session: `session-${id}`,
  review: `review-${id}`,
  elapsed: 1200,
  gap: 0,
  contentVersion,
});

describe("Conversation recommendations refer to actual current senses", () => {
  it("adds two natural practice groups for reviewed verb senses without reusing their noun or adjective IDs", () => {
    const state = source();
    const expected = {
      "preparing-for-a-visit": [
        "clean-verb-01",
        "shop-verb-01",
        "drink-verb-01",
        "open-verb-01",
      ],
      "booking-a-later-train": [
        "book-verb-01",
        "search-verb-01",
        "miss-verb-transport-01",
      ],
    };
    for (const [dialogueId, ids] of Object.entries(expected)) {
      const item = dialogues.find((dialogue) => dialogue.id === dialogueId)!;
      expect(item.targets.map((target) => target.id)).toEqual(ids);
      expect(
        item.targets.every((target) => target.partOfSpeech === "verb"),
      ).toBe(true);
      expect(conversationPracticeIds(state, ids)).toEqual(ids);
      expect(recommendDialogues(state, { targetIds: ids })[0].dialogue.id).toBe(
        dialogueId,
      );
      for (const target of item.targets) {
        const word = state.entries[target.id].word;
        expect(target.meaning).toBe(word.meaning_vi);
        expect(word.source).toContain("american_english/");
      }
      const values = Object.fromEntries(
        item.questions.map((question) => [question.id, question.accepted[0]]),
      );
      const attempt = makeConversationAttempt(state, item, values, {
        lines: [],
        complete: false,
      });
      expect(attempt.answers.every((answer) => answer.correct)).toBe(true);
      expect(attempt.targetIds).toEqual(ids);
      expect(state.history).toEqual([]);
      expect(state.schedules).toEqual({});
      // A different sense on a reused spelling must not inherit this dialogue.
      state.entries[ids[0]].word.meaning_vi = "một nghĩa cá nhân khác";
      expect(
        recommendDialogues(state, { targetIds: ids }).some(
          (recommendation) => recommendation.dialogue.id === dialogueId,
        ),
      ).toBe(false);
    }
    expect(
      new Set(
        dialogues.flatMap((dialogue) =>
          dialogue.targets.map((target) => target.id),
        ),
      ).size,
    ).toBe(55);
  });

  it("does not call old-sense or future practice a current personalized dialogue", () => {
    const state = source();
    state.history = sample.targets
      .slice(0, 3)
      .map((target) => history(target.id, "obsolete-sense"));
    const before = JSON.stringify(state);
    const obsolete = recommendDialogues(state, { now: 1000 }).find(
      (item) => item.dialogue.id === sample.id,
    )!;
    expect(obsolete).toMatchObject({
      studied: 0,
      weak: 0,
      personalized: false,
    });
    expect(JSON.stringify(state)).toBe(before);

    state.history = sample.targets
      .slice(0, 3)
      .map((target) =>
        history(target.id, contentKey(state.entries[target.id].word), 2000),
      );
    expect(
      recommendDialogues(state, { now: 1000 }).find(
        (item) => item.dialogue.id === sample.id,
      ),
    ).toMatchObject({ studied: 0, weak: 0, personalized: false });
  });

  it("uses current-version saved practice and keeps obsolete conversation targets out", () => {
    const state = source();
    state.history = sample.targets
      .slice(0, 3)
      .map((target) =>
        history(target.id, contentKey(state.entries[target.id].word)),
      );
    expect(
      recommendDialogues(state).find((item) => item.dialogue.id === sample.id),
    ).toMatchObject({ studied: 3, weak: 3, personalized: true });
    const attempt = makeConversationAttempt(
      state,
      sample,
      {},
      { lines: [], complete: false },
    );
    state.history = [];
    attempt.targetContentVersions = Object.fromEntries(
      sample.targets.map((target) => [target.id, "obsolete"]),
    );
    state.conversations = [attempt];
    expect(
      recommendDialogues(state).find((item) => item.dialogue.id === sample.id),
    ).toMatchObject({ studied: 0, weak: 0, personalized: false });
  });

  it("offers an action only for three or more senses present together in a real available text", () => {
    const state = source();
    const unsupported = Object.values(state.entries)
      .filter(
        (entry) =>
          (entry.word.word === "drink" &&
            entry.word.part_of_speech === "noun") ||
          (entry.word.word === "love" &&
            entry.word.part_of_speech === "noun") ||
          (entry.word.word === "open" &&
            entry.word.part_of_speech === "adjective"),
      )
      .map((entry) => entry.word.id);
    expect(unsupported).toHaveLength(3);
    expect(conversationPracticeIds(state, unsupported)).toEqual([]);
    const requested = sample.targets.slice(0, 3).map((target) => target.id);
    expect(
      conversationPracticeIds(state, [...unsupported, ...requested]),
    ).toEqual(requested);
    state.entries[requested[0]].archived = true;
    expect(conversationPracticeIds(state, requested)).toEqual([]);
  });

  it("routes requested senses ahead of an unrelated personalized text and never invents missing targets", () => {
    const state = source();
    other.targets.forEach((target) => {
      state.entries[target.id].enrolled = true;
    });
    const requested = sample.targets.slice(0, 3).map((target) => target.id);
    const recommended = recommendDialogues(state, { targetIds: requested });
    expect(recommended[0]).toMatchObject({
      dialogue: { id: sample.id },
      matched: 3,
    });
    expect(
      recommended.every((item) =>
        item.dialogue.targets.some((target) => requested.includes(target.id)),
      ),
    ).toBe(true);
    expect(
      recommendDialogues(state, { targetIds: ["does-not-exist"] }),
    ).toEqual([]);
  });
});

describe("Conversation speakers preserve the selected regional voice", () => {
  it("reuses the US voice rather than alternating with a British voice", () => {
    const british = { lang: "en-GB", voiceURI: "gb-1" };
    const american = { lang: "en-US", voiceURI: "us-1" };
    expect(selectConversationVoices([british, american], "en-US")).toEqual([
      american,
      american,
    ]);
  });

  it("uses a second same-region voice when available, including normalized locales", () => {
    const one = { lang: "en-US", voiceURI: "us-1" };
    const two = { lang: "en_us", voiceURI: "us-2" };
    const british = { lang: "en-GB", voiceURI: "gb-1" };
    expect(selectConversationVoices([one, british, two], "en-US")).toEqual([
      one,
      two,
    ]);
  });

  it("returns the real fallback language or no voice without pretending en-US exists", () => {
    const british = { lang: "en-GB", voiceURI: "gb-1" };
    expect(selectConversationVoices([british], "en-US")).toEqual([
      british,
      british,
    ]);
    expect(
      selectConversationVoices([{ lang: "vi-VN" }], "en-US"),
    ).toBeUndefined();
  });
});
