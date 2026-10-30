/** Additive learner records: older backups remain valid without these fields. */
export type LearningMode = "smart" | "common" | "weak" | "mixed";
export type WritingCategory =
  | "verb-pattern"
  | "tense"
  | "agreement"
  | "preposition"
  | "article"
  | "word-order"
  | "word-choice"
  | "spelling"
  | "naturalness"
  | "other";
export type WritingIssue = {
  id: string;
  category: WritingCategory;
  start: number;
  end: number;
  message: string;
  explanation: string;
  suggestion?: string;
  example?: string;
};
export type WritingVerdict = "uncertain" | "correct" | "issues";
export type WritingAttempt = {
  id: string;
  wordId: string;
  time: number;
  text: string;
  parentId?: string;
  source: "local" | "service" | "ai" | "unavailable";
  status: "issues" | "reviewed" | "ungraded";
  issues: WritingIssue[];
  correctedText?: string;
  summary: string;
  assessment: {
    grammar: WritingVerdict;
    usage: WritingVerdict;
    naturalness: WritingVerdict;
  };
  contentVersion: string;
  serviceError?: string;
  independent?: boolean;
  exposureGap?: number;
};
export type ConversationAnswer = {
  questionId: string;
  kind: "comprehension" | "cloze" | "meaning" | "reply";
  answer: string;
  correct?: boolean;
  targetIds: string[];
  explanation: string;
  hint: boolean;
};
export type ConversationAttempt = {
  id: string;
  dialogueId: string;
  dialogueVersion: string;
  time: number;
  targetIds: string[];
  targetContentVersions: Record<string, string>;
  answers: ConversationAnswer[];
  read: boolean;
  listenedLineIds: string[];
  listenedComplete: boolean;
  /** Missing means a legacy read/practice attempt, never inferred listen-first. */
  mode?: "read" | "listen";
  transcriptRevealed?: boolean;
  retryOf?: string;
  /** A new contextual check after a recorded rest, separate from a repair.
   * It never supplies delayed vocabulary-recall or SRS evidence. */
  delayedCheck?: DelayedConversationCheck;
};
export type DelayedConversationCheck = {
  previousAttemptId: string;
  startedAt: number;
  previousContactAt: number;
};

const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string";
const nonempty = (v: unknown): v is string => text(v) && v.length > 0;
const strings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every(text);
const time = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;
const optionalText = (v: unknown) => v === undefined || text(v);
const verdict = (v: unknown) =>
  ["uncertain", "correct", "issues"].includes(v as string);
const category = (v: unknown) =>
  [
    "verb-pattern",
    "tense",
    "agreement",
    "preposition",
    "article",
    "word-order",
    "word-choice",
    "spelling",
    "naturalness",
    "other",
  ].includes(v as string);

/** Validate before restoring or merging cloud records; never coerce invalid evidence. */
export function validatePracticeCollections(s: {
  entries: Record<string, unknown>;
  learningMode?: unknown;
  writing?: unknown;
  conversations?: unknown;
}) {
  if (
    s.learningMode !== undefined &&
    !["smart", "common", "weak", "mixed"].includes(s.learningMode as string)
  )
    throw Error("Chế độ lựa chọn từ không hợp lệ.");
  const ids = new Set<string>();
  if (s.writing !== undefined) {
    if (!Array.isArray(s.writing)) throw Error("Lịch sử viết không hợp lệ.");
    for (const a of s.writing) {
      if (
        !object(a) ||
        !nonempty(a.id) ||
        ids.has(a.id) ||
        !text(a.wordId) ||
        !Object.hasOwn(s.entries, a.wordId) ||
        !time(a.time) ||
        !nonempty(a.text) ||
        !optionalText(a.parentId) ||
        !["local", "service", "ai", "unavailable"].includes(
          a.source as string,
        ) ||
        !["issues", "reviewed", "ungraded"].includes(a.status as string) ||
        !text(a.summary) ||
        !text(a.contentVersion) ||
        !optionalText(a.correctedText) ||
        !optionalText(a.serviceError) ||
        !object(a.assessment) ||
        ![
          a.assessment.grammar,
          a.assessment.usage,
          a.assessment.naturalness,
        ].every(verdict) ||
        !Array.isArray(a.issues)
      )
        throw Error("Bản ghi phản hồi câu viết không hợp lệ.");
      if (
        (a.independent !== undefined && typeof a.independent !== "boolean") ||
        (a.exposureGap !== undefined && !time(a.exposureGap))
      )
        throw Error("Bằng chứng câu viết không hợp lệ.");
      if (
        a.source !== "ai" &&
        (a.status === "reviewed" ||
          Object.values(a.assessment).includes("correct"))
      )
        throw Error(
          "Kiểm tra tại máy chưa đủ để xác nhận câu viết đúng toàn diện.",
        );
      if (
        (a.status === "issues" && !a.issues.length) ||
        (a.status === "ungraded" && a.issues.length > 0) ||
        (a.status === "reviewed" &&
          (a.issues.length > 0 ||
            Object.values(a.assessment).includes("uncertain")))
      )
        throw Error("Kết luận phản hồi không khớp bằng chứng câu viết.");
      if (a.parentId !== undefined) {
        const parent = s.writing.find(
          (p: unknown) => object(p) && p.id === a.parentId,
        ) as WritingAttempt | undefined;
        if (
          !parent ||
          parent.id === a.id ||
          parent.wordId !== a.wordId ||
          parent.time > a.time
        )
          throw Error("Bản gốc của câu viết lại không hợp lệ.");
      }
      const issueIds = new Set<string>();
      for (const issue of a.issues) {
        if (
          !object(issue) ||
          !nonempty(issue.id) ||
          issueIds.has(issue.id) ||
          !category(issue.category) ||
          !Number.isInteger(issue.start) ||
          !Number.isInteger(issue.end) ||
          (issue.start as number) < 0 ||
          (issue.end as number) <= (issue.start as number) ||
          (issue.end as number) > a.text.length ||
          !nonempty(issue.message) ||
          !nonempty(issue.explanation) ||
          !optionalText(issue.suggestion) ||
          !optionalText(issue.example)
        )
          throw Error("Vị trí hoặc nội dung lỗi câu viết không hợp lệ.");
        issueIds.add(issue.id);
      }
      ids.add(a.id);
    }
  }
  ids.clear();
  if (s.conversations !== undefined) {
    if (!Array.isArray(s.conversations))
      throw Error("Lịch sử hội thoại không hợp lệ.");
    for (const a of s.conversations) {
      if (
        !object(a) ||
        !nonempty(a.id) ||
        ids.has(a.id) ||
        !nonempty(a.dialogueId) ||
        !nonempty(a.dialogueVersion) ||
        !time(a.time) ||
        !strings(a.targetIds) ||
        a.targetIds.some((id) => !Object.hasOwn(s.entries, id)) ||
        !object(a.targetContentVersions) ||
        Object.entries(a.targetContentVersions).some(
          ([id, version]) =>
            !(a.targetIds as string[]).includes(id) || !text(version),
        ) ||
        a.targetIds.some(
          (id) => !Object.hasOwn(a.targetContentVersions as object, id),
        ) ||
        !Array.isArray(a.answers) ||
        typeof a.read !== "boolean" ||
        !strings(a.listenedLineIds) ||
        typeof a.listenedComplete !== "boolean" ||
        (a.mode !== undefined &&
          !["read", "listen"].includes(a.mode as string)) ||
        (a.transcriptRevealed !== undefined &&
          typeof a.transcriptRevealed !== "boolean") ||
        (a.transcriptRevealed !== undefined && a.mode === undefined) ||
        !optionalText(a.retryOf)
      )
        throw Error("Bản ghi luyện hội thoại không hợp lệ.");
      if (
        new Set(a.targetIds).size !== a.targetIds.length ||
        (a.listenedComplete && a.listenedLineIds.length === 0)
      )
        throw Error("Dữ liệu tiếp xúc hội thoại không hợp lệ.");
      if (a.mode === "listen") {
        const heard = a.listenedLineIds as string[];
        if (
          !a.listenedComplete ||
          typeof a.transcriptRevealed !== "boolean" ||
          a.read !== a.transcriptRevealed ||
          new Set(heard).size !== heard.length ||
          heard.some((id, index) => id !== `line-${index}`)
        )
          throw Error("Bằng chứng bài nghe không đầy đủ hoặc không nhất quán.");
      }
      if (a.retryOf !== undefined) {
        const previous = s.conversations.find(
          (p: unknown) => object(p) && p.id === a.retryOf,
        ) as ConversationAttempt | undefined;
        if (
          !previous ||
          previous.id === a.id ||
          previous.dialogueId !== a.dialogueId ||
          previous.time > a.time
        )
          throw Error("Lượt hội thoại cần luyện lại không hợp lệ.");
      }
      if (a.delayedCheck !== undefined) {
        const check = a.delayedCheck;
        if (
          !object(check) ||
          !nonempty(check.previousAttemptId) ||
          !time(check.startedAt) ||
          !time(check.previousContactAt) ||
          check.startedAt > (a.time as number) ||
          check.startedAt - check.previousContactAt < 86_400_000 ||
          a.retryOf !== undefined
        )
          throw Error("Lượt kiểm tra hội thoại sau khoảng nghỉ không hợp lệ.");
        const previous = s.conversations.find(
          (item: unknown) =>
            object(item) && item.id === check.previousAttemptId,
        ) as ConversationAttempt | undefined;
        if (
          !previous ||
          previous.id === a.id ||
          previous.dialogueId !== a.dialogueId ||
          previous.dialogueVersion !== a.dialogueVersion ||
          previous.time > check.previousContactAt ||
          previous.targetIds.length !== a.targetIds.length ||
          !previous.targetIds.every(
            (id) =>
              (a.targetIds as string[]).includes(id) &&
              previous.targetContentVersions[id] ===
                (a.targetContentVersions as Record<string, string>)[id],
          )
        )
          throw Error(
            "Nguồn của lượt kiểm tra hội thoại sau khoảng nghỉ không còn khớp.",
          );
      }
      const questionIds = new Set<string>();
      for (const answer of a.answers) {
        if (
          !object(answer) ||
          !nonempty(answer.questionId) ||
          questionIds.has(answer.questionId) ||
          !["comprehension", "cloze", "meaning", "reply"].includes(
            answer.kind as string,
          ) ||
          !text(answer.answer) ||
          !strings(answer.targetIds) ||
          answer.targetIds.some(
            (id) => !(a.targetIds as string[]).includes(id),
          ) ||
          !text(answer.explanation) ||
          typeof answer.hint !== "boolean" ||
          (answer.correct !== undefined &&
            typeof answer.correct !== "boolean") ||
          (answer.kind === "reply" && answer.correct !== undefined) ||
          (a.mode === "listen" &&
            a.transcriptRevealed === true &&
            answer.hint !== true)
        )
          throw Error("Câu trả lời hội thoại không hợp lệ.");
        questionIds.add(answer.questionId);
      }
      ids.add(a.id);
    }
  }
}
