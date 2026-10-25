import { contentKey, type Word } from "./core";
import type {
  WritingAttempt,
  WritingIssue,
  WritingCategory,
} from "./practice-data";

export const WRITING_LIMIT = 1000;
export const writingCategories: Record<WritingCategory, string> = {
  "verb-pattern": "Cấu trúc động từ",
  agreement: "Hòa hợp chủ ngữ và động từ",
  spelling: "Chính tả",
  preposition: "Giới từ",
  tense: "Thì và chia động từ",
  article: "Mạo từ",
  "word-order": "Trật tự từ",
  "word-choice": "Nghĩa và cách dùng từ",
  naturalness: "Cách diễn đạt",
  other: "Lỗi khác",
};

type Rule = {
  id: string;
  pattern: RegExp;
  category: WritingCategory;
  message: string;
  explanation: string;
  example: string;
  replace: (match: RegExpExecArray) => string;
  focus?: (match: RegExpExecArray) => [number, number];
  skip?: (match: RegExpExecArray, text: string) => boolean;
};
const subjects: Record<string, string> = {
  me: "I",
  you: "you",
  him: "he",
  her: "she",
  us: "we",
  them: "they",
};
const gerunds: Record<string, string> = {
  see: "seeing",
  meet: "meeting",
  hear: "hearing",
  receive: "receiving",
  visit: "visiting",
  learn: "learning",
  speak: "speaking",
  join: "joining",
  attend: "attending",
  discuss: "discussing",
  study: "studying",
  read: "reading",
  work: "working",
  play: "playing",
  travel: "traveling",
  swim: "swimming",
};
const preserveCase = (source: string, value: string) =>
  /^[A-Z]/.test(source) ? value[0].toUpperCase() + value.slice(1) : value;

// About may introduce an approximate quantity or an independent time/place
// adjunct. A regex cannot reliably distinguish all of those from a topic.
// Only correct the small set of clearly topic-like noun phrases below; an
// unrecognized continuation remains ungraded, not a grammar endorsement.
const clearDiscussTopic =
  /^(?:(?:the|this|that|these|those|my|your|his|her|our|their)\s+)?(?:schedules?|plans?|budgets?|projects?|problems?|issues?|proposals?|reports?|results?|options?|ideas?|decisions?|polic(?:y|ies)|work|art|music|politics)\b/i;
const rules: Rule[] = [
  {
    id: "suggest-object-infinitive",
    pattern:
      /\b(suggest(?:s|ed|ing)?)\s+(me|you|him|her|us|them)\s+to\s+(study|read|work|play|travel|swim|see|meet|learn|visit|speak|go|take|make|do|be|have|use|try|wait|call|write|start|stop|confirm|schedule|book|apply|accept|help|discuss)\b/gi,
    category: "verb-pattern",
    message: "Kiểm tra cấu trúc suggest + người + to + động từ.",
    explanation:
      "Trong nghĩa đề xuất một hành động, suggest không đi với tân ngữ chỉ người rồi to + động từ. Có thể dùng suggest + V-ing hoặc suggest + that + chủ ngữ + động từ nguyên thể. Gợi ý dưới đây dùng mệnh đề that; hãy kiểm tra lại ý và thì trong ngữ cảnh của bạn.",
    example:
      "He suggested that I study English. / He suggested studying English.",
    replace: (m) => `${m[1]} that ${subjects[m[2].toLowerCase()]} ${m[3]}`,
  },
  {
    id: "discuss-about",
    pattern: /\b(discuss(?:es|ed|ing)?)(\s+about)\b/gi,
    category: "preposition",
    message: "Discuss nhận chủ đề trực tiếp, thường không thêm about.",
    explanation:
      "Khi about chỉ có ý nối discuss với chủ đề, dùng discuss + chủ đề hoặc talk about + chủ đề. About vẫn có thể mang nghĩa xấp xỉ hay thuộc trạng ngữ thời gian, nên không phải cứ thấy discuss và about đứng cạnh nhau là sai. Bộ kiểm tra chỉ gợi ý sửa một số cụm chủ đề rõ ràng; không áp dụng cho danh từ discussion about.",
    example: "We discussed the schedule. / We talked about the schedule.",
    replace: () => "",
    focus: (m) => [m[1].length, m[0].length],
    // A positive scope avoids endlessly extending an incomplete blacklist of
    // quantities (double, another ten, almost twice...) and time expressions.
    skip: (m, text) =>
      !clearDiscussTopic.test(text.slice(m.index! + m[0].length).trimStart()),
  },
  {
    id: "look-forward-gerund",
    pattern:
      /\b(look(?:s|ed|ing)?\s+forward\s+to)\s+(see|meet|hear|receive|visit|learn|speak|join|attend|discuss)\s+(you|him|her|us|them|the|a|an|my|your|our|their|more)\b/gi,
    category: "verb-pattern",
    message: "Sau look forward to, động từ cần ở dạng V-ing.",
    explanation:
      "To trong look forward to là giới từ; khi theo sau bằng động từ, dùng V-ing. Hệ thống chỉ nhận diện một số mẫu rõ ràng, không đoán mọi từ sau to là động từ.",
    example:
      "I look forward to meeting you. / We look forward to hearing your ideas.",
    replace: (m) => `${m[1]} ${gerunds[m[2].toLowerCase()]} ${m[3]}`,
  },
  {
    id: "enjoy-infinitive",
    pattern:
      /\b(enjoy(?:s|ed|ing)?)\s+to\s+(study|read|work|play|travel|swim|see|meet|learn|visit|speak)\b/gi,
    category: "verb-pattern",
    message: "Enjoy thường đi với V-ing, không dùng to + động từ.",
    explanation:
      "Khi diễn tả thích làm một việc, dùng enjoy + V-ing. Câu gợi ý chỉ thay cấu trúc này và chưa xác nhận các phần còn lại.",
    example: "I enjoy reading. / She enjoys learning English.",
    replace: (m) => `${m[1]} ${gerunds[m[2].toLowerCase()]}`,
  },
  {
    id: "despite-of",
    pattern: /\bdespite\s+of\b/gi,
    category: "preposition",
    message: "Không dùng of ngay sau despite trong cấu trúc này.",
    explanation:
      "Dùng despite + danh từ/V-ing, hoặc in spite of + danh từ/V-ing. Chưa kiểm tra được toàn bộ thành phần sau giới từ.",
    example:
      "Despite the rain, we went out. / In spite of the rain, we went out.",
    replace: (m) => preserveCase(m[0], "despite"),
  },
  {
    id: "modal-to",
    pattern:
      /\b(I|you|he|she|it|we|they)(\s+)(can|could|must|should|would|may|might)(\s+to)\s+(study|read|work|play|travel|swim|see|meet|learn|visit|speak|go|take|make|do|be|have|use|try|wait|call|write|start|stop|confirm|schedule|book|apply|accept|help|discuss)\b/gi,
    category: "verb-pattern",
    message:
      "Sau động từ khuyết thiếu này, dùng động từ nguyên thể không có to.",
    explanation:
      "Can, could, must, should, would, may và might đi với động từ nguyên thể không to. Quy tắc không áp dụng cho have to, ought to hoặc used to.",
    example: "You should confirm the appointment. / I can help you.",
    replace: () => "",
    focus: (m) => {
      const start = m[1].length + m[2].length + m[3].length;
      return [start, start + m[4].length];
    },
  },
  {
    id: "i-am-agree",
    pattern: /\b(I\s+am|I['’]m)\s+agree\b/g,
    category: "verb-pattern",
    message: "Agree là động từ; trong mẫu I agree không cần am.",
    explanation:
      "Dùng I agree để nói tôi đồng ý. Có thể dùng I am in agreement nhưng đó là một cấu trúc khác. Chưa đánh giá các mệnh đề khác trong câu.",
    example: "I agree with you. / I agree that we should wait.",
    replace: () => "I agree",
  },
];

export function validateWritingText(text: string): string | undefined {
  if (!text.trim()) return "Hãy viết câu trước khi kiểm tra.";
  if (text.length > WRITING_LIMIT)
    return `Câu quá dài. Giới hạn ${WRITING_LIMIT} ký tự cho mỗi lượt kiểm tra.`;
  return undefined;
}

/** A small structural checker, deliberately never a general correctness grader. */
export function checkWritingLocally(text: string): WritingIssue[] {
  if (validateWritingText(text)) return [];
  const issues: WritingIssue[] = [];
  // Quoted or metalinguistic material is not necessarily the learner's own
  // intended sentence. Checking fewer spans is safer than correcting a quote.
  const quoted = [
    ...text.matchAll(
      /"[^"\n]*"|“[^”\n]*”|‘[^’\n]*’|`[^`\n]*`|(?:^|[\s([:])'[^'\n]+'(?=$|[\s.,!?;:)])/g,
    ),
  ].map((match) => [match.index!, match.index! + match[0].length]);
  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    for (const match of text.matchAll(rule.pattern)) {
      const focus = rule.focus?.(match) || [0, match[0].length];
      const start = match.index! + focus[0];
      const end = match.index! + focus[1];
      if (
        rule.skip?.(match, text) ||
        quoted.some(([left, right]) => start < right && end > left)
      )
        continue;
      // Do not stack two proposed replacements on the same source span.
      if (issues.some((issue) => start < issue.end && end > issue.start))
        continue;
      issues.push({
        id: `${rule.id}:${start}`,
        category: rule.category,
        start,
        end,
        message: rule.message,
        explanation: rule.explanation,
        suggestion: rule.replace(match),
        example: rule.example,
      });
    }
  }
  return issues.sort((a, b) => a.start - b.start);
}

export function applyWritingSuggestions(text: string, issues: WritingIssue[]) {
  return [...issues]
    .sort((a, b) => b.start - a.start)
    .reduce(
      (value, issue) =>
        issue.suggestion === undefined
          ? value
          : value.slice(0, issue.start) +
            issue.suggestion +
            value.slice(issue.end),
      text,
    );
}

export function makeWritingAttempt(
  word: Word,
  text: string,
  parentId?: string,
): WritingAttempt {
  const validation = validateWritingText(text);
  if (validation) throw new Error(validation);
  const issues = checkWritingLocally(text);
  return {
    id: crypto.randomUUID(),
    wordId: word.id,
    text,
    time: Date.now(),
    contentVersion: contentKey(word, 5),
    ...(parentId ? { parentId } : {}),
    source: "local",
    status: issues.length ? "issues" : "ungraded",
    issues,
    summary: issues.length
      ? "Phát hiện một số cấu trúc cần sửa hoặc xem lại; chưa chấm toàn bộ câu."
      : "Không phát hiện lỗi trong phạm vi kiểm tra; chưa thể xác nhận cách dùng từ và ngữ cảnh.",
    assessment: {
      grammar: issues.length ? "issues" : "uncertain",
      usage: "uncertain",
      naturalness: "uncertain",
    },
    ...(issues.some((issue) => issue.suggestion !== undefined)
      ? { correctedText: applyWritingSuggestions(text, issues) }
      : {}),
  };
}

export function writingErrorCounts(attempts: WritingAttempt[]) {
  const counts: Record<string, number> = {};
  for (const attempt of attempts)
    for (const category of new Set(
      attempt.issues.map((issue) => issue.category),
    ))
      counts[category] = (counts[category] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}
