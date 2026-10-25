import { canPractice, grade, normalize, type Word } from "./core";

export type LearningAssessment = {
  outcome: "correct" | "incorrect" | "ungraded";
  message?: string;
};

// Reordering an explicitly separated Vietnamese gloss does not disambiguate
// an English answer ("to; lớn" and "lớn; to"). Do not infer equivalence from
// a shared substring, a translated token or a partially overlapping gloss.
const meaningCue = (meaning: string) =>
  [...new Set(meaning.split(/[;；]/u).map(normalize).filter(Boolean))]
    .sort()
    .join(";");

type SenseCue = {
  word: string;
  partOfSpeech: string;
  meaningVi: string;
};
const matchesSense = (word: Word, cue: SenseCue) =>
  normalize(word.word) === normalize(cue.word) &&
  normalize(word.part_of_speech || "") === normalize(cue.partOfSpeech) &&
  meaningCue(word.meaning_vi) === meaningCue(cue.meaningVi);

// Manually reviewed against the selected meanings in the corpus. These pairs
// only identify ambiguous Vietnamese recall prompts; they are not global
// interchangeable words or alternative spellings of the target.
const reviewedMeaningPairs: readonly (readonly [SenseCue, SenseCue])[] = [
  [
    { word: "begin", partOfSpeech: "verb", meaningVi: "bắt đầu" },
    { word: "start", partOfSpeech: "verb", meaningVi: "bắt đầu thực hiện" },
  ],
  [
    { word: "happy", partOfSpeech: "adjective", meaningVi: "vui; hạnh phúc" },
    { word: "glad", partOfSpeech: "adjective", meaningVi: "vui; mừng" },
  ],
];

// These are alternatives in these particular, reviewed sentences. They are not
// a synonym dictionary and must not be applied to a different use of the word.
const contextualAlternatives = [
  {
    word: "everyone",
    partOfSpeech: "pronoun",
    meaningVi: "mọi người",
    example: "Everyone needs time to rest.",
    answers: ["everybody"],
  },
  {
    word: "everybody",
    partOfSpeech: "pronoun",
    meaningVi: "mọi người",
    example: "Everybody is welcome at the meeting.",
    answers: ["everyone"],
  },
  {
    word: "film",
    partOfSpeech: "noun",
    meaningVi: "bộ phim",
    example: "We watched a film about life in a small coastal town.",
    answers: ["movie"],
  },
  {
    word: "big",
    partOfSpeech: "adjective",
    meaningVi: "to; lớn",
    example: "You need a big suitcase for such a long trip.",
    answers: ["large"],
  },
  {
    word: "large",
    partOfSpeech: "adjective",
    meaningVi: "lớn; to",
    example: "We need a large table for the family dinner.",
    answers: ["big"],
  },
  {
    word: "begin",
    partOfSpeech: "verb",
    meaningVi: "bắt đầu",
    example: "We will begin the interview at ten.",
    answers: ["start"],
  },
  {
    word: "start",
    partOfSpeech: "verb",
    meaningVi: "bắt đầu thực hiện",
    example: "We start work at eight every morning.",
    answers: ["begin"],
  },
  {
    word: "difficult",
    partOfSpeech: "adjective",
    meaningVi: "khó",
    example: "The final question was difficult for most students.",
    answers: ["hard"],
  },
  {
    word: "hard",
    partOfSpeech: "adjective",
    meaningVi: "khó",
    example: "This question is hard.",
    answers: ["difficult"],
  },
  {
    word: "happy",
    partOfSpeech: "adjective",
    meaningVi: "vui; hạnh phúc",
    example: "I am happy to see you.",
    answers: ["glad"],
  },
  {
    word: "glad",
    partOfSpeech: "adjective",
    meaningVi: "vui; mừng",
    example: "I am glad you came.",
    answers: ["happy"],
  },
];

// A different spelling of a homophone is not proof that the learner forgot the
// target. Keep the attempt for feedback, without marking success or failure.
// This intentionally covers only clear, common homophones, not near sounds.
const homophones = [
  ["to", "two", "too"],
  ["write", "right", "rite", "wright"],
  ["no", "know"],
  ["their", "there", "they're"],
  ["here", "hear"],
  ["your", "you're"],
  ["its", "it's"],
  ["one", "won"],
  ["for", "four"],
  ["by", "buy", "bye"],
];

/**
 * Grade target recall, while keeping a few known ambiguous answers neutral.
 * An ungraded alternative never certifies recall of either vocabulary entry.
 * There is deliberately no fuzzy matching or general English sentence grader.
 */
export function assessLearningAnswer(
  answer: string,
  word: Word,
  skill: number,
  words: Word[],
  contextualAnswers?: readonly string[],
): LearningAssessment {
  if (grade(answer, word)) return { outcome: "correct" };

  // Preserve explicit case requirements instead of bypassing them through a
  // matching alternative. Empty answers and ordinary typos remain incorrect.
  if (!answer.trim() || word.case_sensitive === "true")
    return { outcome: "incorrect" };

  if (skill === 1) {
    const meaning = meaningCue(word.meaning_vi);
    const partOfSpeech = normalize(word.part_of_speech || "");
    const alternative = words.find(
      (candidate) =>
        candidate.id !== word.id &&
        canPractice(candidate, 1) &&
        normalize(candidate.part_of_speech || "") === partOfSpeech &&
        (meaningCue(candidate.meaning_vi) === meaning ||
          reviewedMeaningPairs.some(
            ([left, right]) =>
              (matchesSense(word, left) && matchesSense(candidate, right)) ||
              (matchesSense(word, right) && matchesSense(candidate, left)),
          )) &&
        grade(answer, candidate),
    );
    if (alternative)
      return {
        outcome: "ungraded",
        message:
          `“${alternative.word}” cũng khớp nghĩa tiếng Việt và từ loại của đề. ` +
          `Chưa đủ căn cứ tính sai; từ mục tiêu là “${word.word}”. ` +
          "Lượt này không tính đúng/sai hoặc xác nhận đã nhớ từ.",
      };
  }

  if (skill === 4) {
    const alternative =
      contextualAnswers?.some(
        (value) => normalize(value) === normalize(answer),
      ) ||
      contextualAlternatives.some(
        (context) =>
          matchesSense(word, context) &&
          normalize(context.example) === normalize(word.example_en) &&
          context.answers.some(
            (value) => normalize(value) === normalize(answer),
          ),
      );
    // The optional alternatives belong to the frozen, reviewed question. They
    // are deliberately not accepted target spellings or a global synonym list.
    if (alternative)
      return {
        outcome: "ungraded",
        message:
          `“${answer.trim()}” phù hợp trong câu này, nhưng từ đang luyện là “${word.word}”. ` +
          "Lượt này không tính đúng/sai hoặc xác nhận đã nhớ từ mục tiêu.",
      };
  }

  if (skill === 3) {
    const target = normalize(word.word);
    const value = normalize(answer);
    if (
      homophones.some(
        (group) => group.includes(target) && group.includes(value),
      )
    )
      return {
        outcome: "ungraded",
        message:
          `“${answer.trim()}” có thể đồng âm với “${word.word}”. ` +
          "Hãy đối chiếu ngữ cảnh và cách viết; lượt này không tính đúng/sai hoặc xác nhận đã nhớ từ.",
      };
  }

  return { outcome: "incorrect" };
}
