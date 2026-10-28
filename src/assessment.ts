import { canPractice, grade, normalize, type Word } from "./core";

export type LearningAssessment = {
  outcome: "correct" | "incorrect" | "ungraded";
  message?: string;
};

/** Shown only after a mismatch, before the learner confirms whether to count
 * it as forgotten or leave an ambiguous prompt ungraded. This does not make
 * any claim about general English correctness or accept a new answer. */
export function assessmentMismatchFeedback(skill: number): string {
  if (skill === 3)
    return "Cách viết chưa khớp lời gốc hoặc biến thể đã khai báo trong bài nghe. Nếu chưa nghe rõ hoặc thấy ngữ cảnh chưa đủ phân biệt, bạn có thể lưu lượt này không chấm.";
  if (skill === 4)
    return "Đáp án chưa khớp từ mục tiêu hoặc biến thể đã khai báo trong câu. Một câu có thể có cách điền khác hợp nghĩa; ứng dụng chưa đánh giá được mọi phương án. Hãy đối chiếu trước khi quyết định tính sai.";
  return "Đáp án chưa khớp từ mục tiêu hoặc biến thể đã khai báo. Nghĩa tiếng Việt có thể có nhiều cách diễn đạt; đây chưa phải kết luận rằng cách dùng tiếng Anh của bạn sai. Hãy đối chiếu trước khi quyết định tính sai.";
}

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
    { word: "close", partOfSpeech: "verb", meaningVi: "đóng; khép lại" },
    { word: "shut", partOfSpeech: "verb", meaningVi: "đóng lại" },
  ],
  [
    { word: "sick", partOfSpeech: "adjective", meaningVi: "bị ốm, không khỏe" },
    { word: "ill", partOfSpeech: "adjective", meaningVi: "ốm; mắc bệnh" },
  ],
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
    word: "close",
    partOfSpeech: "verb",
    meaningVi: "đóng; khép lại",
    example: "Please close the window before you leave.",
    answers: ["shut"],
  },
  {
    word: "shut",
    partOfSpeech: "verb",
    meaningVi: "đóng lại",
    example: "Please shut the window before you leave.",
    answers: ["close"],
  },
  {
    word: "sick",
    partOfSpeech: "adjective",
    meaningVi: "bị ốm, không khỏe",
    example: "She stayed home because she was sick.",
    answers: ["ill"],
  },
  {
    word: "ill",
    partOfSpeech: "adjective",
    meaningVi: "ốm; mắc bệnh",
    example: "She is too ill to travel.",
    answers: ["sick"],
  },
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
