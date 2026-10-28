import {
  canPractice,
  contentKey,
  skills,
  type Result,
  type State,
} from "./core";
import {
  evidenceForSkill,
  isDelayedEvidence,
  selectLearningEvidence,
} from "./evidence";
import { conversationPracticeIds } from "./conversations";

const DAY = 86_400_000;
export type KnowledgeStatus =
  "new" | "exposed" | "learning" | "weak" | "retained" | "active";
export const knowledgeLabels: Record<KnowledgeStatus, string> = {
  new: "Chưa học",
  exposed: "Mới tiếp xúc",
  learning: "Đang ghi nhớ",
  weak: "Cần củng cố",
  retained: "Ghi nhớ khá vững",
  active: "Có bằng chứng dùng chủ động",
};
export type EvidenceMetric = {
  total: number;
  correct: number;
  rate: number | null;
  interval: [number, number] | null;
  confidence:
    "Chưa đủ dữ liệu" | "Ít dữ liệu" | "Đang tích lũy" | "Nhiều lượt hơn";
};
export type SkillInsight = {
  skill: number;
  label: string;
  objective: EvidenceMetric;
  immediate: EvidenceMetric;
  delayed: EvidenceMetric;
  unverified: EvidenceMetric;
  supported: number;
  self: number;
  ungraded: number;
  excluded: number;
  ai: EvidenceMetric;
  localIssues: number;
  serviceReviews: number;
  serviceIssues: number;
};
export type WordInsight = {
  id: string;
  status: KnowledgeStatus;
  reasons: string[];
  attempts: number;
  failures: number;
  weakSkills: number[];
  retainedSkills: number[];
  activeEvidence: number;
  latest: number;
};
export type LearningRecommendation = {
  id: string;
  title: string;
  reason: string;
  action: "practice" | "writing" | "conversation";
  skill?: number;
  ids: string[];
};
export type ActivityPeriod = {
  start: number;
  end: number;
  label: string;
  total: number;
  valid: number;
  correct: number;
  writing: number;
  conversations: number;
};

/** A small sample is not made reliable by a high percentage. Wilson bounds
 * describe sample uncertainty, not a calibrated proficiency score. */
export function evidenceMetric(total: number, correct: number): EvidenceMetric {
  if (!total)
    return {
      total: 0,
      correct: 0,
      rate: null,
      interval: null,
      confidence: "Chưa đủ dữ liệu",
    };
  const p = correct / total,
    z = 1.96,
    z2 = z * z;
  const centre = (p + z2 / (2 * total)) / (1 + z2 / total);
  const radius =
    (z * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total))) /
    (1 + z2 / total);
  return {
    total,
    correct,
    rate: p,
    interval: [Math.max(0, centre - radius), Math.min(1, centre + radius)],
    confidence:
      total < 5
        ? "Ít dữ liệu"
        : total < 20
          ? "Đang tích lũy"
          : "Nhiều lượt hơn",
  };
}

const metric = (results: Result[]) =>
  evidenceMetric(results.length, results.filter((r) => r.correct).length);
const isIndependent = isDelayedEvidence;
export const writingCategoryLabels: Record<string, string> = {
  "verb-pattern": "Cấu trúc động từ",
  tense: "Thì",
  agreement: "Hòa hợp chủ ngữ và động từ",
  preposition: "Giới từ",
  article: "Mạo từ",
  "word-order": "Trật tự từ",
  "word-choice": "Lựa chọn từ",
  spelling: "Chính tả",
  naturalness: "Cách diễn đạt",
  other: "Lỗi khác",
};
const calendarDay = (time: number) => {
  const d = new Date(time);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};
function validTime(time: number, now: number) {
  return Number.isFinite(time) && time > 0 && time <= now;
}

/** Reports never mutate schedules, sessions, entries, or historical evidence. */
export function analyzeLearning(state: State, now = Date.now()) {
  const entries = Object.values(state.entries).filter((e) => !e.archived);
  const activeIds = new Set(entries.map((e) => e.word.id));
  const evidence = selectLearningEvidence(state, now);
  const {
    history,
    current,
    attempts,
    objective,
    delayed: independent,
  } = evidence;
  const byWord = new Map<string, Result[]>();
  const attemptsByWord = new Map<string, Result[]>();
  const allByWord = new Map<string, Result[]>();
  for (const r of history) {
    const group = allByWord.get(r.wordId) || [];
    group.push(r);
    allByWord.set(r.wordId, group);
  }
  for (const r of objective) {
    const group = byWord.get(r.wordId) || [];
    group.push(r);
    byWord.set(r.wordId, group);
  }
  for (const r of attempts) {
    const group = attemptsByWord.get(r.wordId) || [];
    group.push(r);
    attemptsByWord.set(r.wordId, group);
  }

  // Kept as separate evidence sources: local pattern detection is not a full
  // grammar assessment, and AI feedback is not human validation.
  const writing = (state.writing || []).filter(
    (w) => activeIds.has(w.wordId) && validTime(w.time, now),
  );
  const currentWriting = writing.filter(
    (w) => w.contentVersion === contentKey(state.entries[w.wordId].word, 5),
  );
  const aiWriting = currentWriting.filter(
    (w) => w.source === "ai" && w.status === "reviewed" && w.text.trim(),
  );
  const conversations = (state.conversations || []).filter((c) =>
    validTime(c.time, now),
  );
  const conversationIds = new Set(conversations.flatMap((c) => c.targetIds));
  const currentConversations = conversations.filter(
    (c) =>
      c.targetIds.length > 0 &&
      c.targetIds.every(
        (id) =>
          activeIds.has(id) &&
          c.targetContentVersions[id] === contentKey(state.entries[id].word, 5),
      ),
  );
  const conversationAnswers = currentConversations
    .filter((c) => !c.retryOf)
    .flatMap((c) => c.answers)
    .filter(
      (a) =>
        a.answer.trim() && a.kind !== "reply" && typeof a.correct === "boolean",
    );
  const listenFirstAnswers = currentConversations
    .filter(
      (attempt) =>
        attempt.mode === "listen" &&
        attempt.listenedComplete &&
        attempt.transcriptRevealed === false &&
        !attempt.retryOf,
    )
    .flatMap((attempt) => attempt.answers)
    .filter(
      (answer) =>
        !answer.hint &&
        answer.kind !== "reply" &&
        answer.answer.trim() &&
        typeof answer.correct === "boolean",
    );
  const conversationEvidence = {
    attempts: conversations.length,
    read: conversations.filter((c) => c.read).length,
    listened: conversations.filter((c) => c.listenedComplete).length,
    answered: evidenceMetric(
      conversationAnswers.length,
      conversationAnswers.filter((a) => a.correct).length,
    ),
    supported: evidenceMetric(
      conversationAnswers.filter((a) => a.hint).length,
      conversationAnswers.filter((a) => a.hint && a.correct).length,
    ),
    listenFirst: evidenceMetric(
      listenFirstAnswers.length,
      listenFirstAnswers.filter((answer) => answer.correct).length,
    ),
    contextMeaning: evidenceMetric(
      listenFirstAnswers.filter((answer) => answer.kind === "meaning").length,
      listenFirstAnswers.filter(
        (answer) => answer.kind === "meaning" && answer.correct,
      ).length,
    ),
    retries: conversations.filter((c) => !!c.retryOf).length,
    replies: currentConversations
      .flatMap((c) => c.answers)
      .filter((a) => a.kind === "reply" && a.answer.trim()).length,
  };

  const words: WordInsight[] = entries.map((entry) => {
    const id = entry.word.id,
      results = byWord.get(id) || [],
      testedAttempts = attemptsByWord.get(id) || [],
      all = allByWord.get(id) || [];
    const weakSkills: number[] = [],
      retainedSkills: number[] = [];
    for (let skill = 0; skill < 5; skill++) {
      const proof = evidenceForSkill(evidence, id, skill);
      if (proof.weak) weakSkills.push(skill);
      if (proof.retained) retainedSkills.push(skill);
    }
    const active = aiWriting
      .filter(
        (w) =>
          w.wordId === id &&
          w.assessment.usage === "correct" &&
          w.issues.length === 0 &&
          w.assessment.grammar === "correct" &&
          w.independent === true,
      )
      .sort((a, b) => a.time - b.time);
    const activeDays: number[] = [];
    const activeSentences = new Set<string>();
    for (const w of active) {
      const sentence = w.text.toLowerCase().replace(/[^a-z0-9]/g, "");
      const last = activeDays.at(-1);
      if (
        !activeSentences.has(sentence) &&
        (last === undefined ||
          (w.time - last >= DAY && calendarDay(w.time) !== calendarDay(last)))
      ) {
        activeDays.push(w.time);
        activeSentences.add(sentence);
      }
    }
    const touched =
      all.length > 0 ||
      !!state.exposures?.[id] ||
      writing.some((w) => w.wordId === id) ||
      conversationIds.has(id);
    const status: KnowledgeStatus = weakSkills.length
      ? "weak"
      : activeDays.length >= 2
        ? "active"
        : retainedSkills.length
          ? "retained"
          : results.length
            ? "learning"
            : touched
              ? "exposed"
              : "new";
    const reasons: string[] = [];
    if (weakSkills.length)
      reasons.push(
        `Có lần sai/cần gợi ý chưa được kiểm tra phục hồi độc lập sau khoảng nghỉ, hoặc ít nhất 2 lượt cần hỗ trợ trong 4 lượt gần nhất ở: ${weakSkills.map((s) => skills[s]).join(", ")}.`,
      );
    else if (status === "active")
      reasons.push(
        `${activeDays.length} ngày viết độc lập có phản hồi AI phù hợp và không phát hiện lỗi; chưa phải xác nhận của giáo viên.`,
      );
    else if (status === "retained")
      reasons.push(
        `Ít nhất 3 ngày nhớ đúng độc lập ở ${retainedSkills.map((s) => skills[s]).join(", ")}, có một lần cách mọi tiếp xúc đã ghi nhận ít nhất 7 ngày.`,
      );
    else if (status === "learning")
      reasons.push(
        `${results.length} lượt kiểm tra hợp lệ; chưa đủ bằng chứng nhớ dài hạn.`,
      );
    else if (status === "exposed")
      reasons.push(
        "Đã xem, nghe, tự đánh giá hoặc viết; chưa đủ lượt kiểm tra độc lập cho nghĩa hiện tại.",
      );
    else
      reasons.push(
        "Chưa có tiếp xúc được ghi nhận; dấu Đã biết do bạn chọn không phải kết quả kiểm tra.",
      );
    return {
      id,
      status,
      reasons,
      attempts: testedAttempts.length,
      failures: testedAttempts.filter((r) => !r.correct).length,
      weakSkills,
      retainedSkills,
      activeEvidence: activeDays.length,
      latest: all.at(-1)?.time || 0,
    };
  });
  const counts = Object.fromEntries(
    Object.keys(knowledgeLabels).map((key) => [
      key,
      words.filter((w) => w.status === key).length,
    ]),
  ) as Record<KnowledgeStatus, number>;
  const skillInsights: SkillInsight[] = [
    ...skills,
    "Ngữ pháp và cách dùng khi viết",
  ].map((label, skill) => {
    const h = objective.filter((r) => r.skill === skill);
    const ai =
      skill === 5
        ? aiWriting.filter((w) => w.assessment.usage !== "uncertain")
        : skill === 6
          ? aiWriting
          : [];
    return {
      skill,
      label,
      objective: metric(h),
      immediate: metric(
        h.filter((r) => Number.isFinite(r.exposureGap) && r.exposureGap! < DAY),
      ),
      delayed: metric(h.filter(isIndependent)),
      unverified: metric(
        h.filter(
          (r) =>
            !isIndependent(r) &&
            (!Number.isFinite(r.exposureGap) || r.exposureGap! >= DAY),
        ),
      ),
      supported: attempts.filter((r) => r.skill === skill && r.hint).length,
      self: current.filter((r) => r.skill === skill && r.method === "self")
        .length,
      ungraded:
        current.filter((r) => r.skill === skill && r.method === "ungraded")
          .length +
        (skill === 5
          ? currentWriting.filter(
              (w) => w.source !== "ai" || w.status !== "reviewed",
            ).length
          : 0),
      excluded: history.filter((r) => r.skill === skill).length - h.length,
      ai: evidenceMetric(
        ai.length,
        ai.filter((w) =>
          skill === 5
            ? w.assessment.usage === "correct"
            : w.issues.length === 0,
        ).length,
      ),
      localIssues:
        skill === 6
          ? currentWriting.filter(
              (w) => w.source === "local" && w.issues.length > 0,
            ).length
          : 0,
      serviceReviews:
        skill === 6
          ? currentWriting.filter((w) => w.source === "service").length
          : 0,
      serviceIssues:
        skill === 6
          ? currentWriting.filter(
              (w) => w.source === "service" && w.issues.length > 0,
            ).length
          : 0,
    };
  });

  const retention = [
    { key: "day", label: "Từ 1 đến dưới 7 ngày", minDays: 1, maxDays: 7 },
    { key: "week", label: "Từ 7 đến dưới 30 ngày", minDays: 7, maxDays: 30 },
    {
      key: "month",
      label: "Từ 30 ngày trở lên",
      minDays: 30,
      maxDays: Infinity,
    },
  ].map((bucket) => ({
    ...bucket,
    metric: metric(
      independent.filter(
        (r) =>
          Number.isFinite(r.exposureGap) &&
          r.exposureGap! >= bucket.minDays * DAY &&
          r.exposureGap! < bucket.maxDays * DAY,
      ),
    ),
  }));
  const missingExposureGap = objective.filter(
    (r) => !Number.isFinite(r.exposureGap),
  ).length;

  const savedSentenceTimes = new Map<string, number[]>();
  for (const r of history)
    if (r.skill === 5) {
      const key = JSON.stringify([r.wordId, r.answer.trim()]);
      const times = savedSentenceTimes.get(key) || [];
      times.push(r.time);
      savedSentenceTimes.set(key, times);
    }
  // One saved sentence may also have a feedback record. Count it once while
  // retaining subsequent revisions as new practice actions.
  const additionalWriting = writing.filter(
    (w) =>
      !(
        savedSentenceTimes.get(JSON.stringify([w.wordId, w.text.trim()])) || []
      ).some((time) => Math.abs(time - w.time) < 60_000),
  );
  const periods = (kind: "week" | "month", count: number): ActivityPeriod[] => {
    const end = new Date(now);
    end.setHours(0, 0, 0, 0);
    if (kind === "week") end.setDate(end.getDate() - ((end.getDay() + 6) % 7));
    else end.setDate(1);
    const start = +end;
    return Array.from({ length: count }, (_, i) => {
      const a = new Date(start),
        b = new Date(start);
      if (kind === "week") {
        a.setDate(a.getDate() - (count - 1 - i) * 7);
        b.setDate(b.getDate() - (count - 2 - i) * 7);
      } else {
        a.setMonth(a.getMonth() - (count - 1 - i));
        b.setMonth(b.getMonth() - (count - 2 - i));
      }
      const included = history.filter((r) => r.time >= +a && r.time < +b),
        tested = objective.filter((r) => r.time >= +a && r.time < +b);
      const written = additionalWriting.filter(
        (w) => w.time >= +a && w.time < +b,
      );
      const spokenContext = conversations.filter(
        (c) => c.time >= +a && c.time < +b,
      );
      return {
        start: +a,
        end: Math.min(+b, now),
        label:
          kind === "week"
            ? a.toLocaleDateString("vi-VN", {
                day: "2-digit",
                month: "2-digit",
              })
            : a.toLocaleDateString("vi-VN", {
                month: "2-digit",
                year: "numeric",
              }),
        total: included.length + written.length + spokenContext.length,
        valid: tested.length,
        correct: tested.filter((r) => r.correct).length,
        writing: written.length,
        conversations: spokenContext.length,
      };
    });
  };
  const frequentlyForgotten = words
    .filter((w) => {
      const h = attemptsByWord.get(w.id) || [];
      return (
        new Set(h.filter((r) => !r.correct).map((r) => calendarDay(r.time)))
          .size >= 2 && w.status === "weak"
      );
    })
    .sort((a, b) => b.failures - a.failures)
    .map((w) => w.id);
  const improving = words
    .filter((w) => {
      const h = attemptsByWord.get(w.id) || [],
        recent = h.slice(-3),
        older = h.slice(0, -3);
      return (
        older.some((r) => !r.correct) &&
        recent.length >= 3 &&
        recent.every((r) => r.correct && isIndependent(r)) &&
        new Set(recent.map((r) => calendarDay(r.time))).size >= 3 &&
        w.status !== "weak"
      );
    })
    .map((w) => w.id);
  const overpracticedWeak = words
    .filter(
      (w) =>
        w.status === "weak" &&
        (attemptsByWord.get(w.id)?.filter((r) => w.weakSkills.includes(r.skill))
          .length || 0) >= 8 &&
        w.retainedSkills.length === 0,
    )
    .sort((a, b) => b.attempts - a.attempts)
    .map((w) => w.id);

  const due = Object.entries(state.schedules).filter(([key, s]) => {
    const index = key.lastIndexOf(":"),
      id = key.slice(0, index),
      skill = Number(key.slice(index + 1));
    return (
      activeIds.has(id) &&
      canPractice(state.entries[id].word, skill) &&
      s.due <= now
    );
  });
  const recommendations: LearningRecommendation[] = [];
  const weak = skillInsights
    .filter(
      (s) =>
        s.skill < 5 &&
        s.delayed.total >= 3 &&
        s.delayed.correct < s.delayed.total,
    )
    .sort(
      (a, b) =>
        (a.delayed.rate ?? 1) - (b.delayed.rate ?? 1) ||
        b.delayed.total - a.delayed.total,
    )[0];
  if (weak) {
    const ids = words
      .filter(
        (w) =>
          w.weakSkills.includes(weak.skill) &&
          canPractice(state.entries[w.id].word, weak.skill),
      )
      .sort((a, b) => b.failures - a.failures)
      .map((w) => w.id);
    if (ids.length)
      recommendations.push({
        id: "weak-skill",
        title: `Củng cố ${weak.label.toLocaleLowerCase("vi")}`,
        reason: `${weak.delayed.total - weak.delayed.correct}/${weak.delayed.total} lượt kiểm tra độc lập chưa đúng ở kỹ năng này; ${ids.length} mục còn lỗi gần đây.`,
        action: "practice",
        skill: weak.skill,
        ids,
      });
  }
  if (!recommendations.length) {
    const latestWeak = words
      .filter((w) => w.weakSkills.length)
      .sort((a, b) => b.latest - a.latest)[0];
    if (latestWeak) {
      const skill = latestWeak.weakSkills[0];
      recommendations.push({
        id: "recent-mistake",
        title: `Rà lại ${skills[skill].toLocaleLowerCase("vi")}`,
        reason: `“${state.entries[latestWeak.id].word.word}” có lỗi kiểm tra gần đây. Đây là lỗi đã ghi nhận, chưa đủ để kết luận bạn yếu toàn bộ kỹ năng.`,
        action: "practice",
        skill,
        ids: [latestWeak.id],
      });
    }
  }
  const issueCounts = new Map<string, number>();
  for (const w of currentWriting)
    if (w.status === "reviewed" || w.issues.length)
      for (const issue of w.issues)
        issueCounts.set(
          issue.category,
          (issueCounts.get(issue.category) || 0) + 1,
        );
  const frequentIssue = [...issueCounts].sort((a, b) => b[1] - a[1])[0];
  if (frequentIssue)
    recommendations.push({
      id: "writing-errors",
      title: "Viết lại những câu đã được phản hồi",
      reason: `${frequentIssue[1]} lỗi thuộc nhóm “${writingCategoryLabels[frequentIssue[0]] || frequentIssue[0]}” được công cụ phát hiện. Hãy đọc giải thích và thử viết lại; phản hồi tự động có thể cần đối chiếu.`,
      action: "writing",
      ids: [],
    });
  const conversationCandidates = words.filter(
    (w) =>
      w.status === "learning" || w.status === "retained" || w.status === "weak",
  );
  const conversationTargets = conversationPracticeIds(
    state,
    conversationCandidates.map((w) => w.id),
  );
  if (conversationTargets.length >= 3)
    recommendations.push({
      id: "apply-context",
      title: "Thử dùng từ trong hội thoại",
      reason: `${conversationTargets.length} mục có kết quả kiểm tra hiện tại và có bài hội thoại phù hợp. Luyện ngữ cảnh giúp kiểm tra cách dùng; đọc hội thoại không được tính thành thạo.`,
      action: "conversation",
      ids: conversationTargets,
    });

  return {
    words,
    counts,
    conversationEvidence,
    skills: skillInsights,
    retention,
    missingExposureGap,
    frequentlyForgotten,
    improving,
    overpracticedWeak,
    recommendations: recommendations.slice(0, 3),
    dueCount: due.length,
    weekly: periods("week", 6),
    monthly: periods("month", 6),
    issues: [...issueCounts].sort((a, b) => b[1] - a[1]),
    totals: {
      history: history.length,
      objective: objective.length,
      independent: independent.length,
      self: history.filter((r) => r.method === "self").length,
      ungraded: history.filter((r) => r.method === "ungraded").length,
      archivedOrMissing: state.history.length - history.length,
    },
  };
}
