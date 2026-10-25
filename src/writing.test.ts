import { describe, expect, it } from "vitest";
import { empty, contentKey, type Word } from "./core";
import { validatePracticeCollections } from "./practice-data";
import {
  WRITING_LIMIT,
  applyWritingSuggestions,
  checkWritingLocally,
  makeWritingAttempt,
  validateWritingText,
  writingErrorCounts,
} from "./writing";

const word: Word = {
  id: "suggest",
  word: "suggest",
  meaning_vi: "đề xuất",
  example_en: "He suggested that I study English.",
  example_vi: "Anh ấy đề xuất tôi học tiếng Anh.",
};

describe("bounded, offline sentence feedback", () => {
  it("explains the requested suggest pattern, highlights actual source, and proposes a that clause", () => {
    const text = "He suggested me to study English.";
    const issues = checkWritingLocally(text);
    expect(issues).toHaveLength(1);
    expect(issues[0].category).toBe("verb-pattern");
    expect(text.slice(issues[0].start, issues[0].end)).toBe(
      "suggested me to study",
    );
    expect(issues[0].explanation).toContain("suggest + V-ing");
    expect(issues[0].example).toContain("He suggested that I study English.");
    expect(applyWritingSuggestions(text, issues)).toBe(
      "He suggested that I study English.",
    );
  });

  it.each([
    ["We discussed about the schedule.", "We discussed the schedule."],
    ["I look forward to meet you.", "I look forward to meeting you."],
    ["She enjoys to study English.", "She enjoys studying English."],
    ["I enjoy to travel.", "I enjoy traveling."],
    ["Despite of the rain, we went out.", "Despite the rain, we went out."],
    [
      "You should to confirm the appointment.",
      "You should confirm the appointment.",
    ],
    ["I'm agree with you.", "I agree with you."],
  ])("provides a narrow structural correction for %s", (text, expected) => {
    const issues = checkWritingLocally(text);
    expect(issues.length).toBeGreaterThan(0);
    expect(applyWritingSuggestions(text, issues)).toBe(expected);
    expect(issues.every((issue) => issue.explanation && issue.example)).toBe(
      true,
    );
  });

  it("accepts alternative correct structures without treating one reference sentence as the answer", () => {
    for (const text of [
      "He suggested studying English.",
      "He suggested that I should study English.",
      "He suggested that I study English.",
      "We had a discussion about the schedule.",
      "I look forward to the visit.",
      "He suggested me to a producer.",
      "The schedule runs from May to June.",
      "You ought to confirm it.",
      "We discussed about twenty cases.",
      "We discussed about 20 cases.",
      "We discussed about a dozen cases.",
      "We discussed about half the cases.",
      "We discussed about the same number of cases.",
      "We discussed about as many cases as we did last week.",
      "We discussed about as few cases as last week.",
      "We discussed about as much as I expected.",
      "We discussed about as little as possible.",
      "We discussed about double the usual number of cases.",
      "We discussed about another ten cases before lunch.",
      "We discussed about almost twice the usual number of cases.",
      "We discussed about noon whether to postpone the meeting.",
      "We discussed about midnight what we should do next.",
      "We discussed about the same time whether to cancel.",
      "We discussed about how many people to invite.",
      "I need a can to make a lantern.",
      "It is a must to visit the museum.",
      'The phrase "despite of" is wrong.',
      "The phrase 'despite of' is wrong.",
    ])
      expect(checkWritingLocally(text)).toEqual([]);
  });

  it("leaves uncertain discuss-about continuations unchanged and ungraded", () => {
    const text = "We discussed about double the usual number of cases.";
    const attempt = makeWritingAttempt(word, text);
    expect(attempt.status).toBe("ungraded");
    expect(attempt.issues).toEqual([]);
    expect(attempt).not.toHaveProperty("correctedText");
    expect(applyWritingSuggestions(text, attempt.issues)).toBe(text);
    expect(attempt.assessment.grammar).toBe("uncertain");
  });

  it("retains modal-to detection with a clear pronoun subject and exact offsets", () => {
    const text =
      "Maybe they should to discuss the plan, but I need a can to make a lantern.";
    const issues = checkWritingLocally(text);
    expect(issues).toHaveLength(1);
    expect(text.slice(issues[0].start, issues[0].end)).toBe(" to");
    expect(applyWritingSuggestions(text, issues)).toBe(
      "Maybe they should discuss the plan, but I need a can to make a lantern.",
    );
  });

  it("never infers correctness or target usage from the absence of local matches", () => {
    const attempt = makeWritingAttempt(
      word,
      "Something not grammatical yesterday yes.",
    );
    expect(attempt.status).toBe("ungraded");
    expect(attempt.assessment).toEqual({
      grammar: "uncertain",
      usage: "uncertain",
      naturalness: "uncertain",
    });
    expect(attempt.summary).toContain("chưa thể xác nhận");
    expect(attempt.contentVersion).toBe(contentKey(word, 5));
    expect(attempt).not.toHaveProperty("independent");
  });

  it("keeps UTF-16 offsets correct and does not replace similar text elsewhere", () => {
    const text =
      "🙂 We discussed about art; our discussion about music was useful.";
    const issues = checkWritingLocally(text);
    expect(issues).toHaveLength(1);
    expect(text.slice(issues[0].start, issues[0].end)).toBe(" about");
    expect(applyWritingSuggestions(text, issues)).toBe(
      "🙂 We discussed art; our discussion about music was useful.",
    );
  });

  it("resolves multiple corrections using source offsets and ignores overlapping replacements", () => {
    const text = "I am agree, and you should to discuss about the plan.";
    const issues = checkWritingLocally(text);
    expect(issues).toHaveLength(3);
    expect(applyWritingSuggestions(text, issues)).toBe(
      "I agree, and you should discuss the plan.",
    );
    expect(
      issues.every(
        (issue, index) => !index || issue.start >= issues[index - 1].end,
      ),
    ).toBe(true);
  });

  it("preserves original and revised records under unique IDs and a parent link", () => {
    const original = makeWritingAttempt(
      word,
      "He suggested me to study English.",
    );
    const snapshot = structuredClone(original);
    const revised = makeWritingAttempt(
      word,
      original.correctedText!,
      original.id,
    );
    expect(original).toEqual(snapshot);
    expect(revised.id).not.toBe(original.id);
    expect(revised.parentId).toBe(original.id);
    expect(revised.status).toBe("ungraded");
    expect(original.status).toBe("issues");
    const state = empty();
    state.entries[word.id] = { word, origin: "personal", archived: false };
    state.writing = [original, revised];
    expect(() => validatePracticeCollections(state)).not.toThrow();
    expect(state.history).toEqual([]);
    expect(state.schedules).toEqual({});
  });

  it("counts affected attempts per category rather than duplicating repeated issues in a sentence", () => {
    const a = makeWritingAttempt(
      word,
      "We discuss about music and discuss about art.",
    );
    const b = makeWritingAttempt(word, "You should to study English.");
    expect(a.issues).toHaveLength(2);
    expect(writingErrorCounts([a, b])).toEqual([
      ["preposition", 1],
      ["verb-pattern", 1],
    ]);
  });

  it("rejects empty or oversized inputs without pretending they were checked", () => {
    expect(validateWritingText("   ")).toContain("Hãy viết");
    expect(validateWritingText("a".repeat(WRITING_LIMIT + 1))).toContain(
      "quá dài",
    );
    expect(() => makeWritingAttempt(word, "")).toThrow();
    expect(() =>
      makeWritingAttempt(word, "a".repeat(WRITING_LIMIT + 1)),
    ).toThrow();
    expect(checkWritingLocally("a".repeat(WRITING_LIMIT + 1))).toEqual([]);
  });
});
