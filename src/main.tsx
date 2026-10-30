import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  BookOpen,
  BookText,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  Download,
  Headphones,
  Leaf,
  MessageCircle,
  Layers,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Target,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import {
  type State,
  type Word,
  type Session,
  type PendingAssessment,
  validPendingAssessment,
  empty,
  read,
  save,
  parse,
  serialize,
  merge,
  diff,
  skills,
  strength,
  record,
  day,
  validateBackup,
  canPractice,
  cloze,
  isSlang,
  sortForLearning,
  expose,
  exposeWrittenForms,
  independence,
  interleaveQueue,
  contentKey,
} from "./core";
import {
  StorageConflictError,
  subscribeStoredState,
  rebaseState,
} from "./storage";
import "./style.css";
import ErrorBoundary from "./ErrorBoundary";
import WordDetail from "./DictionaryEntry";
import UsageNotes from "./UsageNotes";
import { formatPartOfSpeech, partOfSpeechCaption } from "./part-of-speech";
import {
  attachStudyContexts,
  exerciseWord,
  getUsage,
  normalizeVocabularyLookup,
  prioritizeExactVocabularyMatches,
  vocabularyLookupText,
} from "./usage";
import { selectLearningEvidence } from "./evidence";
import { mergeBackupSchedules } from "./schedule-state";
import {
  mergeExposureEvents,
  exposureEventsForSnapshot,
} from "./exposure-events";
import {
  orderScheduledTasks,
  scheduledReviews,
  reviewForecast,
  planScheduledStudy,
  estimateStudyMinutes,
} from "./session-planning";
import { freshForPreference, chosenStudySkills } from "./learning-preferences";
import CollectionBrowser from "./CollectionBrowser";
import {
  rankNewWords,
  recommendWords,
  selectionModes,
} from "./recommendations";
import { analyzeLearning } from "./analytics";
import { LearningInsights } from "./LearningInsights";
import ConversationPractice from "./ConversationPractice";
import { dialogues, listeningDialogues } from "./conversations";
import WritingFeedback from "./WritingFeedback";
import { flushWritingDrafts, writingDraftSavedEvent } from "./writing-drafts";
import SyncSettings from "./SyncSettings";
import { useVisibleExposure } from "./useVisibleExposure";
import { assessLearningAnswer, assessmentMismatchFeedback } from "./assessment";
import { sessionProgress, sessionSummaryLines } from "./session-guidance";
import GrammarReference from "./GrammarReference";
import { grammarArticles, grammarGroups } from "./grammar-data";
import { preferredHeadword, selectEnglishVoice } from "./american-english";
import { clearSyncBinding } from "./sync";
import { pronunciationPrompt } from "./pronunciation";
import {
  registerOffline,
  getOfflineStatus,
  offlineStatusEvent,
} from "./offline";
import {
  validatePracticeCollections,
  type ConversationAttempt,
  type WritingAttempt,
  type LearningMode,
} from "./practice-data";
const uid = () => crypto.randomUUID();
const collectionLabels: Record<string, string> = {
  academic: "Oxford OPAL · Học thuật",
  "opal-written": "OPAL · Văn viết học thuật",
  "opal-spoken": "OPAL · Văn nói học thuật",
  "american-3000": "American Oxford 3000",
  "american-5000": "American Oxford 5000 · Bổ sung",
  "cambridge-blog": "Cambridge Blog · Ngôn ngữ hiện đại",
};
const statusLabels: Record<string, string> = {
  new: "Chưa học",
  studied: "Đã học",
  known: "Tự đánh dấu đã biết",
  usage: "Có cách dùng và ngữ cảnh bổ sung",
};
function download(name: string, text: string, type = "text/plain") {
  const url = URL.createObjectURL(
    new Blob([text], { type: type + ";charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function storeBrowserDraft(draft?: Session["draft"]) {
  try {
    if (draft)
      sessionStorage.setItem("jeongyeon-session-draft", JSON.stringify(draft));
    else sessionStorage.removeItem("jeongyeon-session-draft");
  } catch {
    /* IndexedDB remains the durable draft when browser session storage is unavailable. */
  }
}
async function corpusVersion(text: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
function App() {
  const [state, setState] = useState<State>(empty),
    [loaded, setLoaded] = useState(false),
    [page, setPage] = useState("today"),
    [notice, setNotice] = useState(""),
    [search, setSearch] = useState(""),
    [topic, setTopic] = useState(""),
    [collection, setCollection] = useState(""),
    [level, setLevel] = useState(""),
    [status, setStatus] = useState(""),
    [libraryPage, setLibraryPage] = useState(1),
    [detail, setDetail] = useState<string>(),
    [editor, setEditor] = useState<string>(),
    [pending, setPending] = useState<{
      words: Word[];
      origin: string;
      version?: string;
    }>(),
    [availableWords, setAvailableWords] = useState<Word[]>(),
    [sourceVersion, setSourceVersion] = useState<string>(),
    [loadAttempt, setLoadAttempt] = useState(0),
    [audioPlayed, setAudioPlayed] = useState(false),
    [audioPlaying, setAudioPlaying] = useState(false),
    [backup, setBackup] = useState<State>(),
    [replace, setReplace] = useState(false),
    [settings, setSettings] = useState(false),
    [range, setRange] = useState(30),
    [focus, setFocus] = useState("studied"),
    [evidenceLimit, setEvidenceLimit] = useState(100),
    [practice, setPractice] = useState(1),
    [conversationOpen, setConversationOpen] = useState(false),
    [conversationTargetIds, setConversationTargetIds] = useState<string[]>([]),
    [, refreshClock] = useState(0),
    [offlineStatus, setOfflineStatus] = useState(getOfflineStatus),
    [writingReview, setWritingReview] = useState<{
      wordId: string;
      text?: string;
      parentId?: string;
    }>(),
    [answer, setAnswer] = useState(""),
    [revealed, setRevealed] = useState(false),
    [hint, setHint] = useState(false),
    [feedback, setFeedback] = useState<string>(),
    [pendingAssessment, setPendingAssessment] = useState<PendingAssessment>(),
    [busy, setBusy] = useState(false),
    [summary, setSummary] = useState<string>();
  const hasModal =
    !!detail || editor !== undefined || !!pending || !!backup || settings;
  const displayWord = (word?: Word) =>
    word ? preferredHeadword(word, state.voice) : "";
  useEffect(() => {
    const update = () => setOfflineStatus(getOfflineStatus());
    window.addEventListener(offlineStatusEvent, update);
    update();
    return () => window.removeEventListener(offlineStatusEvent, update);
  }, []);
  useEffect(() => {
    // Summary clocks can change while the learner leaves this tab open. The
    // saved session itself stays fixed; only a newly started plan uses now.
    const update = () => {
      if (!document.hidden) refreshClock((value) => value + 1);
    };
    const timer = window.setInterval(update, 60_000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  useEffect(() => {
    if (!hasModal) return;
    const previous = document.activeElement as HTMLElement;
    requestAnimationFrame(() =>
      Array.from(document.querySelectorAll<HTMLElement>(".modal"))
        .filter((d) => d.getClientRects().length > 0)
        .at(-1)
        ?.querySelector<HTMLElement>("button,input,textarea,select")
        ?.focus(),
    );
    const handle = (e: KeyboardEvent) => {
      const dialogs = Array.from(
        document.querySelectorAll<HTMLElement>(".modal"),
      ).filter((d) => d.getClientRects().length > 0);
      const dialog = dialogs[dialogs.length - 1];
      if (!dialog) return;
      if (e.key === "Escape") {
        setDetail(undefined);
        setEditor(undefined);
        setPending(undefined);
        setBackup(undefined);
        setSettings(false);
      }
      if (e.key === "Tab") {
        const collapsed = Array.from(
          dialog.querySelectorAll("details:not([open])"),
        );
        const nodes = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button,input,textarea,select,[href],summary,[tabindex]:not([tabindex="-1"])',
          ),
        ).filter(
          (n) =>
            !n.matches(":disabled") &&
            n.tabIndex >= 0 &&
            n.offsetParent !== null &&
            // Chromium can report layout boxes for a disclosure's hidden
            // inputs after it has been opened and closed. Only its summary
            // remains in the keyboard order while the disclosure is closed.
            collapsed.every(
              (details) =>
                details === n ||
                !details.contains(n) ||
                details.querySelector(":scope > summary")?.contains(n),
            ),
        );
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, [hasModal, detail, editor !== undefined, !!pending, !!backup, settings]);
  const lock = useRef(false),
    started = useRef(Date.now()),
    lastLibraryPage = useRef(1),
    current = useRef(state),
    audioRef = useRef<HTMLAudioElement | undefined>(undefined),
    playbackToken = useRef(0),
    draftTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    draftWrites = useRef<Promise<void>>(Promise.resolve()),
    answerDraft = useRef<Session["draft"]>(undefined);
  current.current = state;
  const commit = async (
    next: State,
    options?: { replace?: boolean },
    base: State = state,
  ) => {
    const persisted = await save(next, base, options);
    current.current = persisted;
    setState(persisted);
    return persisted;
  };
  const taskKey = state.session
    ? `${state.session.id}:${state.session.index}`
    : "";
  const stopAudio = () => {
    playbackToken.current++;
    audioRef.current?.pause();
    audioRef.current = undefined;
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    setAudioPlaying(false);
  };
  const persistDraft = (draft = answerDraft.current): Promise<void> => {
    draftWrites.current = draftWrites.current
      .catch(() => {})
      .then(async () => {
        if (!draft) return;
        const base = current.current;
        if (
          !base.session ||
          `${base.session.id}:${base.session.index}` !== draft.key
        )
          return;
        await commit(
          { ...base, session: { ...base.session, draft } },
          undefined,
          base,
        );
      });
    return draftWrites.current;
  };
  const updateDraft = (value: string, shown = revealed, helped = hint) => {
    setAnswer(value);
    const draft = {
      key: taskKey,
      answer: value,
      revealed: shown,
      hint: helped,
    };
    answerDraft.current = draft;
    storeBrowserDraft(draft);
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(
      () => persistDraft(draft).catch(notifyError),
      180,
    );
  };
  const pause = async () => {
    clearTimeout(draftTimer.current);
    await persistDraft();
    stopAudio();
    setPage("today");
    setNotice(
      "Đã lưu phiên và câu trả lời đang viết. Bạn có thể tiếp tục sau.",
    );
  };
  const resetFilters = () => {
    setSearch("");
    setTopic("");
    setCollection("");
    setLevel("");
    setStatus("");
  };
  const exposeIds = (ids: string[]) => {
    if (!ids.length) return;
    const base = current.current;
    const existing = [...new Set(ids)].filter((id) =>
      Object.hasOwn(base.entries, id),
    );
    if (!existing.length) return;
    const time = Date.now();
    // Keep each view, not only the latest map timestamp: a later phone view
    // must not hide an earlier view that primed an answer on another device.
    const next = existing.reduce((state, id) => expose(state, id, time), base);
    commit(next, undefined, base).catch(notifyError);
  };
  const exposeForms = (wordId: string, forms: string[]) => {
    const base = current.current;
    const next = exposeWrittenForms(base, wordId, forms);
    if (next !== base) commit(next, undefined, base).catch(notifyError);
  };
  const openDetail = (id: string) => {
    setDetail(id);
    const base = current.current;
    commit(expose(base, id), undefined, base).catch(notifyError);
  };
  useEffect(() => {
    if (page === "learn") return;
    window.scrollTo({ top: 0, behavior: "instant" });
    const frame = requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(
          "main [data-page-heading], .workspace main h1",
        )
        ?.focus({ preventScroll: true }),
    );
    stopAudio();
    persistDraft().catch(notifyError);
    return () => cancelAnimationFrame(frame);
  }, [page]);
  useEffect(() => {
    if (page !== "learn") return;
    let alive = true;
    const input = document.querySelector<HTMLTextAreaElement>(
      ".study textarea:not(:disabled)",
    );
    if (!input) {
      window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    // Browser autofocus happens before the page effect/layout settles and
    // ignores the fixed bottom navigation. Focus and reveal the answer after
    // layout, and repeat when a mobile keyboard changes the visual viewport.
    const revealInput = () => {
      if (!alive || !input.isConnected || input.disabled) return;
      const viewport = window.visualViewport;
      const top = (viewport?.offsetTop || 0) + 16;
      let bottom =
        (viewport?.offsetTop || 0) +
        (viewport?.height || window.innerHeight) -
        16;
      const navigation = document
        .querySelector("aside")
        ?.getBoundingClientRect();
      if (
        navigation &&
        navigation.width >= window.innerWidth * 0.9 &&
        navigation.top < bottom &&
        navigation.bottom > top
      )
        bottom = Math.min(bottom, navigation.top - 16);
      const box = input.getBoundingClientRect();
      const actions = input
        .closest(".study")
        ?.querySelector(".study-actions")
        ?.getBoundingClientRect();
      const targetBottom =
        actions && actions.bottom - box.top <= bottom - top
          ? Math.max(box.bottom, actions.bottom)
          : box.bottom;
      if (targetBottom > bottom)
        window.scrollBy({ top: targetBottom - bottom, behavior: "instant" });
      else if (box.top < top)
        window.scrollBy({ top: box.top - top, behavior: "instant" });
    };
    const frame = requestAnimationFrame(() => {
      if (!alive) return;
      input.focus({ preventScroll: true });
      revealInput();
    });
    document.fonts.ready.then(revealInput);
    window.visualViewport?.addEventListener("resize", revealInput);
    window.addEventListener("resize", revealInput);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      window.visualViewport?.removeEventListener("resize", revealInput);
      window.removeEventListener("resize", revealInput);
    };
  }, [page, taskKey]);
  useEffect(() => {
    if (page !== "library") return;
    requestAnimationFrame(() => {
      const results = document.querySelector<HTMLElement>(".word-grid");
      if (libraryPage !== lastLibraryPage.current)
        results?.scrollIntoView({ block: "start" });
      lastLibraryPage.current = libraryPage;
      results?.focus({ preventScroll: true });
    });
  }, [libraryPage]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let s = await read();
        const isEmpty = !Object.keys(s.entries).length;
        if (!alive) return;
        if (!isEmpty) {
          current.current = s;
          setState(s);
          setLoaded(true);
        }
        try {
          let version: string | undefined;
          try {
            const manifest = await fetch(
              import.meta.env.BASE_URL + "data/vocabulary-version.json",
              { cache: "no-cache" },
            );
            if (manifest.ok) {
              const data = await manifest.json();
              version =
                typeof data.version === "string" ? data.version : undefined;
            }
          } catch {
            /* Old deployments and imported test files can omit the manifest. */
          }
          if (alive) setSourceVersion(version);
          if (!isEmpty && version && s.sourceVersion === version) return;
          const res = await fetch(
            import.meta.env.BASE_URL + "data/vocabulary.txt",
            { cache: "no-cache" },
          );
          if (!res.ok) throw Error("Không tải được vocabulary.txt");
          const text = await res.text();
          const incoming = parse(text);
          version = await corpusVersion(text);
          if (alive) setSourceVersion(version);
          if (isEmpty) {
            const base = s;
            s = await save(
              { ...merge(s, incoming, "default"), sourceVersion: version },
              base,
            );
          } else if (
            Object.values(diff(s, incoming, "default")).some((n) => n > 0)
          ) {
            if (alive) setAvailableWords(incoming);
          } else if (version) {
            s = await save({ ...s, sourceVersion: version }, s);
            if (alive) {
              current.current = s;
              setState(s);
            }
          }
        } catch (error) {
          if (isEmpty) throw error;
          if (alive)
            setNotice(
              "Đang dùng kho đã lưu; chưa kiểm tra được bản mới: " +
                String(error),
            );
        }
        if (alive && isEmpty) {
          current.current = s;
          setState(s);
          setLoaded(true);
        }
      } catch (e) {
        if (alive) setNotice("Không thể mở dữ liệu: " + String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadAttempt]);
  useEffect(
    () =>
      subscribeStoredState(() => {
        read()
          .then((next) => {
            current.current = next;
            setState(next);
            setNotice("Đã đồng bộ thay đổi từ tab khác trên thiết bị này.");
          })
          .catch(notifyError);
      }),
    [],
  );
  useEffect(() => {
    let alive = true;
    const refreshDraftState = () => {
      read()
        .then((next) => {
          if (!alive) return;
          current.current = next;
          setState(next);
        })
        .catch(notifyError);
    };
    window.addEventListener(writingDraftSavedEvent, refreshDraftState);
    return () => {
      alive = false;
      window.removeEventListener(writingDraftSavedEvent, refreshDraftState);
    };
  }, []);
  useEffect(() => {
    stopAudio();
    setAudioPlayed(false);
    const session = current.current.session;
    const saved = session
      ? current.current.history.find(
          (r) => r.id === `${session.id}:${session.index}`,
        )
      : undefined;
    let draft = session?.draft?.key === taskKey ? session.draft : undefined;
    try {
      const local = JSON.parse(
        sessionStorage.getItem("jeongyeon-session-draft") || "null",
      );
      if (
        local?.key === taskKey &&
        typeof local.answer === "string" &&
        typeof local.hint === "boolean" &&
        typeof local.revealed === "boolean" &&
        (local.assessment === undefined ||
          validPendingAssessment(local.assessment))
      )
        draft = local;
    } catch {
      /* Ignore an incomplete browser draft. */
    }
    answerDraft.current = draft;
    setAnswer(saved?.answer ?? draft?.answer ?? "");
    setHint(draft?.hint ?? false);
    setRevealed(!!saved || !!draft?.revealed);
    setPendingAssessment(saved ? undefined : draft?.assessment);
    setFeedback(
      saved
        ? (saved.assessmentNote ? saved.assessmentNote + " " : "") +
            "Lượt này đã được lưu. Tiếp tục để tránh tính trùng."
        : undefined,
    );
    started.current = Date.now();
    lock.current = !!saved;
    const question = session?.queue[session.index];
    if (question?.skill === 5) {
      const base = current.current;
      commit(expose(base, question.id), undefined, base).catch(notifyError);
    }
  }, [taskKey]);
  const active = useMemo(
      () =>
        sortForLearning(
          Object.values(state.entries).filter((e) => !e.archived),
        ),
      [state.entries],
    ),
    now = Date.now();
  const due = scheduledReviews(state).filter(
    ([, schedule]) => schedule.due <= now,
  );
  const dueWords = new Set(due.map(([k]) => k.slice(0, k.lastIndexOf(":"))))
    .size;
  const overdue = new Set(
    due
      .filter(([, s]) => day(s.due) < day(now))
      .map(([k]) => k.slice(0, k.lastIndexOf(":"))),
  ).size;
  const studiedIds = new Set(state.history.map((h) => h.wordId));
  const learningMode = state.learningMode || "smart";
  const freshRecommendations = useMemo(
    () =>
      rankNewWords(
        state,
        freshForPreference(active, state.learningFloor).filter(
          (e) =>
            (!level || e.word.level === level) &&
            chosenStudySkills(state, e).length > 0,
        ),
        learningMode,
        now,
      ),
    [
      state.entries,
      state.history,
      state.schedules,
      state.exposures,
      state.exposureEvents,
      state.learningFloor,
      state.studySkills,
      learningMode,
      level,
      day(now),
    ],
  );
  const fresh = freshRecommendations.map((r) => r.entry);
  const studiedToday = new Set(
    state.history.filter((h) => day(h.time) === day(now)).map((h) => h.wordId),
  );
  const newToday = active.filter(
    (e) => e.enrolled && e.enrolledAt && day(e.enrolledAt) === day(now),
  ).length;
  const todayPlan = useMemo(
    () => planScheduledStudy(state, active, fresh, now),
    [
      state.entries,
      state.history,
      state.schedules,
      state.daily,
      state.studySkills,
      active,
      freshRecommendations,
      Math.floor(now / 60_000),
    ],
  );
  const planned = todayPlan.freshWords;
  const resumable = state.session || state.pausedScheduled;
  const estimatedTasks = resumable
    ? resumable.queue.slice(resumable.index)
    : [
        ...todayPlan.reviews,
        ...todayPlan.continuing,
        ...todayPlan.introductions,
      ];
  const estimatedMinutes = estimateStudyMinutes(estimatedTasks);
  const forecast = reviewForecast(state, now);
  const lookupIndex = useMemo(
    () =>
      new Map(
        active.map((entry) => [
          entry.word.id,
          vocabularyLookupText(entry.word),
        ]),
      ),
    [active],
  );
  const lookupQuery = normalizeVocabularyLookup(search);
  const filtered = prioritizeExactVocabularyMatches(
    active.filter(
      (e) =>
        (lookupIndex.get(e.word.id) || "").includes(lookupQuery) &&
        (!topic || (e.word.topics || "").split(",").includes(topic)) &&
        (!collection ||
          (e.word.collections || "").split(",").includes(collection)) &&
        (!level || e.word.level === level) &&
        (!status ||
          (status === "usage"
            ? !!getUsage(e.word)
            : status === "known"
              ? e.known
              : status === "new"
                ? !studiedIds.has(e.word.id)
                : studiedIds.has(e.word.id))),
    ),
    lookupQuery,
  );
  const practiceEligible = filtered.filter((e) =>
    canPractice(e.word, practice),
  );
  const practiceRecommendations = useMemo(
    () =>
      recommendWords(state, practiceEligible, {
        mode: learningMode,
        intent: "practice",
        skill: practice,
        limit: 20,
        now,
      }),
    [
      state.entries,
      state.history,
      state.exposures,
      state.exposureEvents,
      learningMode,
      practice,
      search,
      topic,
      collection,
      level,
      status,
      day(now),
    ],
  );
  const learningReport = useMemo(
    () => analyzeLearning(state, now),
    [
      state.entries,
      state.history,
      state.schedules,
      state.exposures,
      state.exposureEvents,
      state.writing,
      state.conversations,
      Math.floor(now / 60_000),
    ],
  );
  const learningEvidence = useMemo(
    () => selectLearningEvidence(state, now),
    [state, day(now)],
  );
  const reviewWordId =
    writingReview?.wordId ||
    state.writing?.at(-1)?.wordId ||
    state.history
      .slice()
      .reverse()
      .find((r) => r.skill === 5)?.wordId ||
    active.find((e) => canPractice(e.word, 5))?.word.id;
  const filterSummary =
    [
      search && `Tìm: ${search}`,
      topic && `Chủ đề: ${topic}`,
      collection && `Bộ: ${collection}`,
      level && `CEFR: ${level}`,
      status && `Trạng thái: ${statusLabels[status] || status}`,
    ]
      .filter(Boolean)
      .join(" · ") || "Toàn bộ Kho từ";
  // Scope metadata can contain the answer itself (e.g. topic "study").
  // Keep exact filter values in the library, never in the blind-test preview.
  const practiceFilterSummary =
    [
      search && "Đã lọc theo nội dung tìm kiếm",
      topic && "Đã lọc theo chủ đề",
      collection && "Đã lọc theo bộ từ",
      level && `CEFR: ${level}`,
      status && `Trạng thái: ${statusLabels[status] || "Đã chọn"}`,
    ]
      .filter(Boolean)
      .join(" · ") || "Toàn bộ Kho từ";
  const readyCount = active.filter((e) => canPractice(e.word, 0)).length;
  const pageCount = Math.max(1, Math.ceil(filtered.length / 60));
  const currentLibraryPage = Math.min(libraryPage, pageCount);
  const visibleWords = filtered.slice(
    (currentLibraryPage - 1) * 60,
    currentLibraryPage * 60,
  );
  const visibleWordIds = visibleWords.map((e) => e.word.id).join("\n");
  const libraryExposureRef = useVisibleExposure(
    exposeIds,
    visibleWordIds,
    page === "library" && !hasModal,
  );
  const heroWordId = fresh[0]?.word.id;
  const heroExposureRef = useVisibleExposure(
    exposeIds,
    heroWordId || "",
    page === "today" && !hasModal,
  );
  useEffect(
    () => setLibraryPage(1),
    [search, topic, collection, level, status],
  );
  const selectOptions = (key: string) => [
    ...new Set(
      active.flatMap((e) => (e.word[key] || "").split(",")).filter(Boolean),
    ),
  ];
  const notifyError = (e: unknown) => {
    if (e instanceof StorageConflictError)
      read()
        .then((next) => {
          current.current = next;
          setState(next);
        })
        .catch(() => {});
    setNotice(String(e));
    setBusy(false);
    lock.current = false;
  };
  async function source() {
    try {
      const r = await fetch(import.meta.env.BASE_URL + "data/vocabulary.txt", {
        cache: "no-store",
      });
      if (!r.ok) throw Error("Không tải được kho mặc định");
      const text = await r.text();
      setPending({
        words: parse(text),
        origin: "default",
        version: await corpusVersion(text),
      });
    } catch (e) {
      notifyError(e);
    }
  }
  async function file(
    event: React.ChangeEvent<HTMLInputElement>,
    json = false,
  ) {
    const f = event.target.files?.[0];
    event.target.value = "";
    if (!f) return;
    try {
      const text = await f.text();
      if (json) setBackup(validateBackup(JSON.parse(text)));
      else setPending({ words: parse(text), origin: "personal" });
    } catch (e) {
      notifyError(e);
    }
  }
  const changeLearningMode = (mode: LearningMode) => {
    const base = current.current;
    commit({ ...base, learningMode: mode }, undefined, base).catch(notifyError);
  };
  const saveWriting = async (attempt: WritingAttempt) => {
    const base = current.current;
    if (base.writing?.some((a) => a.id === attempt.id)) return;
    const next = { ...base, writing: [...(base.writing || []), attempt] };
    validatePracticeCollections(next);
    await commit(next, undefined, base);
  };
  const saveConversation = async (attempt: ConversationAttempt) => {
    const base = current.current;
    if (base.conversations?.some((a) => a.id === attempt.id)) return;
    const next = {
      ...base,
      conversations: [...(base.conversations || []), attempt],
    };
    validatePracticeCollections(next);
    await commit(next, undefined, base);
  };
  const openConversation = (ids: string[] = []) => {
    setConversationTargetIds(ids);
    setConversationOpen(true);
    setPage("practice");
  };
  const openWritingReview = () => {
    setPage("progress");
    requestAnimationFrame(() =>
      document
        .getElementById("writing-review")
        ?.scrollIntoView({ block: "start" }),
    );
  };
  async function start(
    scheduled = true,
    only?: string | string[],
    skillOverride?: number,
  ) {
    try {
      clearTimeout(draftTimer.current);
      await persistDraft();
      stopAudio();
      const base = current.current;
      if (scheduled && (base.pausedScheduled || base.session?.scheduled)) {
        if (base.pausedScheduled)
          await commit(
            {
              ...base,
              session: base.pausedScheduled,
              pausedScheduled: undefined,
            },
            undefined,
            base,
          );
        setPage("learn");
        return;
      }
      let queue: Session["queue"] = [];
      let goal: Session["goal"];
      if (scheduled) {
        // Recompute from the latest persisted view and actual start time,
        // rather than the Home render which may predate midnight/the due time.
        const planningNow = Date.now();
        const planningActive = sortForLearning(
          Object.values(base.entries).filter((item) => !item.archived),
        );
        const planningFresh = rankNewWords(
          base,
          freshForPreference(planningActive, base.learningFloor).filter(
            (item) =>
              (!level || item.word.level === level) &&
              chosenStudySkills(base, item).length > 0,
          ),
          base.learningMode || "smart",
          planningNow,
        ).map((recommendation) => recommendation.entry);
        const plan = planScheduledStudy(
          base,
          planningActive,
          planningFresh,
          planningNow,
        );
        goal = {
          due: plan.reviews.length,
          continuing: plan.continuing.length,
          fresh: plan.introductions.length,
        };
        queue = interleaveQueue(
          orderScheduledTasks(
            base,
            [...plan.reviews, ...plan.continuing].map((item) => ({
              ...item,
              review: uid(),
            })),
            planningNow,
          ),
        );
        queue.push(
          ...interleaveQueue(
            plan.introductions.map((item) => ({ ...item, review: uid() })),
          ),
        );
      } else {
        const eligible = (
          only
            ? (Array.isArray(only) ? only : [only]).map(
                (id) => base.entries[id],
              )
            : filtered
        ).filter((e) => !!e && canPractice(e.word, skillOverride ?? practice));
        const selected = only
          ? eligible.slice(0, 20)
          : recommendWords(base, eligible, {
              mode: base.learningMode || "smart",
              intent: "practice",
              skill: skillOverride ?? practice,
              limit: 20,
            }).map((r) => r.entry);
        queue = selected.map((e) => ({
          id: e.word.id,
          skill: skillOverride ?? practice,
          review: uid(),
        }));
      }
      if (!queue.length) {
        setNotice(
          "Chưa có mục đủ điều kiện cho dạng bài này. Mục chưa rà chất lượng vẫn tra cứu được trong Kho từ; hãy đổi bộ lọc hoặc chọn dạng bài khác.",
        );
        return;
      }
      queue = attachStudyContexts(base, queue);
      await commit(
        {
          ...base,
          pausedScheduled:
            !scheduled && base.session?.scheduled
              ? base.session
              : base.pausedScheduled,
          session: {
            id: uid(),
            queue: scheduled ? queue : interleaveQueue(queue),
            index: 0,
            started: Date.now(),
            scheduled,
            count: queue.length,
            ...(goal ? { goal } : {}),
          },
        },
        undefined,
        base,
      );
      answerDraft.current = undefined;
      storeBrowserDraft();
      setSummary(undefined);
      setPage("learn");
    } catch (e) {
      notifyError(e);
    }
  }
  const task = state.session?.queue[state.session.index],
    entry = task ? state.entries[task.id] : undefined,
    w = entry?.word,
    exercise = w && task?.skill === 4 ? exerciseWord(w, task.context) : w;
  const wordPronunciation = useMemo(
    () => w && pronunciationPrompt(w, state.entries, state.voice),
    [w, state.entries, state.voice],
  );
  const sessionGuide = useMemo(
    () => state.session && sessionProgress(state.session, state.history),
    [state.session, state.history],
  );
  function speak(text: string, url?: string, forTask = false) {
    if (!text.trim()) return;
    stopAudio();
    const token = playbackToken.current;
    const key = taskKey;
    setNotice("");
    if (forTask) {
      setAudioPlayed(false);
      setAudioPlaying(true);
    }
    const valid = () =>
      playbackToken.current === token &&
      (!forTask ||
        (current.current.session &&
          `${current.current.session.id}:${current.current.session.index}` ===
            key));
    const complete = () => {
      if (!valid()) return;
      setAudioPlaying(false);
      if (forTask) setAudioPlayed(true);
    };
    const fail = () => {
      if (!valid()) return;
      setAudioPlaying(false);
      if (forTask) setAudioPlayed(false);
      setNotice(
        "Không phát được âm thanh. Bài nghe chưa được đánh giá; hãy thử lại hoặc bỏ qua lượt này.",
      );
    };
    const synth = () => {
      if (!valid()) return;
      if (!("speechSynthesis" in window)) {
        fail();
        return;
      }
      const selectedVoice = selectEnglishVoice(
        speechSynthesis.getVoices(),
        state.voice,
      );
      if (!selectedVoice) {
        fail();
        setNotice(
          "Chưa có giọng tiếng Anh trên thiết bị. Hãy cài giọng đọc hoặc chọn bài đọc/viết; bài nghe chưa được đánh giá.",
        );
        return;
      }
      const u = new SpeechSynthesisUtterance(text);
      u.voice = selectedVoice;
      u.lang = u.voice.lang;
      if (u.lang.replace(/_/g, "-").toLowerCase() !== state.voice.toLowerCase())
        setNotice(
          `Thiết bị chưa có giọng ${state.voice === "en-US" ? "Anh–Mỹ" : "Anh–Anh"}; đang dùng giọng tiếng Anh ${u.lang}. Bạn có thể cài thêm giọng đọc trong thiết bị.`,
        );
      u.rate = state.rate;
      u.onend = complete;
      u.onerror = fail;
      speechSynthesis.speak(u);
    };
    if (url) {
      try {
        const u = new URL(url, location.href);
        if (!["http:", "https:"].includes(u.protocol)) throw Error();
        const a = new Audio(u.href);
        audioRef.current = a;
        let usedFallback = false;
        const fallback = () => {
          if (usedFallback || !valid()) return;
          usedFallback = true;
          setNotice("Âm thanh URL lỗi; đang thử giọng tổng hợp.");
          synth();
        };
        a.onended = complete;
        a.onerror = fallback;
        a.play().catch(fallback);
      } catch {
        synth();
      }
    } else synth();
  }
  async function submit(
    result?: boolean,
    hintOverride?: boolean,
    neutralNote?: string,
    confirmMismatch = false,
  ) {
    if (!task || !w || !state.session || lock.current) return;
    if (entry?.archived || !exercise || !canPractice(w, task.skill)) {
      setNotice(
        "Nội dung lượt này chưa đủ điều kiện luyện hoặc đã lưu trữ. Chọn bỏ qua để tiếp tục; không ghi kết quả và không thay đổi lịch ôn.",
      );
      return;
    }
    if (
      !neutralNote &&
      !pendingAssessment &&
      [2, 3].includes(task.skill) &&
      !audioPlayed
    ) {
      setNotice(
        "Hãy nghe hết âm thanh trước khi ghi nhận bài nghe. Nếu không phát được, chọn bỏ qua; lượt này không bị tính sai.",
      );
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      clearTimeout(draftTimer.current);
      await persistDraft();
      const base = current.current;
      const self = [0, 2].includes(task.skill);
      const assessment = neutralNote
        ? { outcome: "ungraded" as const, message: neutralNote }
        : !self && task.skill !== 5
          ? assessLearningAnswer(
              answer,
              exercise,
              task.skill,
              Object.values(base.entries).map((e) => e.word),
              task.context?.alternatives ||
                (getUsage(w)?.example.en === exercise.example_en
                  ? getUsage(w)?.example.alternatives
                  : undefined),
            )
          : undefined;
      if (
        assessment?.outcome === "incorrect" &&
        !pendingAssessment &&
        !confirmMismatch
      ) {
        const snapshot: PendingAssessment = {
          time: Date.now(),
          elapsed: Math.max(0, Date.now() - started.current),
          hint: hintOverride ?? (hint || revealed),
          independent: independence(base, w.id, Date.now(), task.skill),
          audioPlayed,
          contentVersion: contentKey(w, task.skill),
        };
        const draft = {
          key: taskKey,
          answer,
          hint: snapshot.hint,
          revealed: true,
          assessment: snapshot,
        };
        // Revealing feedback is a real exposure even when no grade is saved.
        // It follows the submitted answer, including on millisecond clocks.
        const shown = expose(
          base,
          w.id,
          Math.max(Date.now(), snapshot.time + 1),
        );
        await commit(
          { ...shown, session: { ...shown.session!, draft } },
          undefined,
          base,
        );
        answerDraft.current = draft;
        storeBrowserDraft(draft);
        setPendingAssessment(snapshot);
        setRevealed(true);
        lock.current = false;
        return;
      }
      if (
        pendingAssessment &&
        pendingAssessment.contentVersion !== contentKey(w, task.skill)
      ) {
        throw Error(
          "Nội dung đã thay đổi sau khi kiểm tra. Hãy bỏ qua lượt này để giữ nguyên lịch ôn.",
        );
      }
      const ungraded = task.skill === 5 || assessment?.outcome === "ungraded";
      const correct =
        ungraded || pendingAssessment
          ? false
          : self
            ? !!result
            : assessment?.outcome === "correct";
      const prior = state.history.filter(
        (h) => h.wordId === w.id && h.skill === task.skill,
      );
      const independent =
        !ungraded &&
        (pendingAssessment?.independent ?? independence(base, w.id));
      const r = {
        evidenceVersion: 2 as const,
        independent,
        ...(assessment?.outcome === "ungraded"
          ? { assessmentNote: assessment.message }
          : {}),
        audioPlayed: [2, 3].includes(task.skill)
          ? (pendingAssessment?.audioPlayed ?? audioPlayed)
          : undefined,
        id: state.session.id + ":" + state.session.index,
        wordId: w.id,
        time: pendingAssessment?.time ?? Date.now(),
        skill: task.skill,
        answer,
        correct,
        hint:
          pendingAssessment?.hint ??
          hintOverride ??
          (hint || (!self && revealed)),
        method: ungraded
          ? ("ungraded" as const)
          : self
            ? ("self" as const)
            : ("rule" as const),
        elapsed: pendingAssessment?.elapsed ?? Date.now() - started.current,
        session: state.session.id,
        review: task.review,
        ...(task.skill === 4 && task.context ? { context: task.context } : {}),
        gap: prior.length ? Date.now() - prior[prior.length - 1].time : 0,
        first: !state.history.some(
          (h) =>
            h.session === state.session?.id &&
            h.wordId === w.id &&
            h.skill === task.skill,
        ),
      };
      let next = record(base, r, state.session.scheduled);
      if (neutralNote) {
        const item = next.entries[w.id];
        next = {
          ...next,
          entries: {
            ...next.entries,
            [w.id]: {
              ...item,
              reports: [...(item.reports || []), neutralNote],
            },
          },
        };
      }
      let retryGap: number | undefined;
      if (
        !correct &&
        !ungraded &&
        !state.history.some((h) => h.review === task.review)
      ) {
        retryGap =
          Math.min(next.session!.index + 4, next.session!.queue.length) -
          next.session!.index -
          1;
        next.session!.queue.splice(
          Math.min(next.session!.index + 4, next.session!.queue.length),
          0,
          { ...task },
        );
      }
      await commit(next, undefined, base);
      answerDraft.current = undefined;
      storeBrowserDraft();
      setPendingAssessment(undefined);
      setRevealed(true);
      setFeedback(
        ungraded
          ? assessment?.message ||
              "Đã lưu câu. Chưa được chấm ngữ pháp hoặc mức độ sử dụng."
          : correct
            ? sessionGuide?.isRetry && !self
              ? r.hint
                ? "Đã trả lời lại với hỗ trợ; vẫn cần tự kiểm tra lại. Lượt này chưa phải bằng chứng nhớ lâu."
                : "Đã trả lời lại đúng. Đây là sửa sai trong phiên sau khi xem đáp án, chưa phải bằng chứng nhớ lâu."
              : self
                ? "Đã lưu tự đánh giá."
                : "Chính xác! " +
                  (r.hint
                    ? "Có hỗ trợ — chưa tính là tự nhớ."
                    : next.history.at(-1)?.independent
                      ? "Đã ghi nhận kết quả kiểm tra độc lập."
                      : "Kết quả vừa học/tiếp xúc; chưa tính là bằng chứng nhớ sau khoảng cách.")
            : retryGap === undefined
              ? "Lượt thử lại vẫn cần củng cố. Hãy xem lại cách dùng và kiểm tra ở lần ôn tiếp theo."
              : retryGap > 0
                ? `Cần củng cố. Mục này sẽ xuất hiện lại sau ${retryGap} lượt khác để bạn thử nhớ lại.`
                : "Cần củng cố. Phiên không còn lượt khác để tạo khoảng đệm; bạn sẽ thử lại ở lượt kế tiếp. Đây là sửa sai ngay trong phiên.",
      );
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  }
  async function next() {
    if (!state.session) return;
    stopAudio();
    clearTimeout(draftTimer.current);
    answerDraft.current = undefined;
    storeBrowserDraft();
    const s = state.session;
    if (s.index + 1 >= s.queue.length) {
      const upcoming = Object.values(state.schedules)
        .filter((v) => v.due > Date.now())
        .sort((a, b) => a.due - b.due)[0];
      setSummary(
        [
          ...sessionSummaryLines(s, state.history),
          s.scheduled
            ? upcoming
              ? "Lần ôn kế tiếp: " +
                new Date(upcoming.due).toLocaleString("vi-VN")
              : "Chưa có lịch ôn mới."
            : "Luyện tự do không thay đổi lịch ôn.",
        ].join("\n"),
      );
      await commit({ ...state, session: undefined });
      setPage("today");
    } else
      await commit({
        ...state,
        session: { ...s, index: s.index + 1, draft: undefined },
      });
  }
  const history = state.history.filter(
    (h) => range === 0 || h.time >= now - range * 86400000,
  );
  const inPeriod = (h: State["history"][number]) =>
    range === 0 || h.time >= now - range * 86400000;
  const evidenceHistory = learningEvidence.current.filter(inPeriod);
  const tested = learningEvidence.objective.filter(inPeriod),
    delayed = learningEvidence.delayed.filter(inPeriod);
  const ratio = (h: typeof history) =>
    h.length
      ? `${Math.round((h.filter((r) => r.correct).length / h.length) * 100)}% · ${h.length} lượt`
      : "Chưa đủ dữ liệu";
  const focusOptions = [
    ["studied", "Những mục đã học"],
    ["stable", "Nhớ vững qua nhiều ngày"],
    ["writing", "Tự đánh giá nhìn hiểu, chưa kiểm tra viết đúng"],
    ["listening", "Tự đánh giá đọc hiểu, nghe chưa có bằng chứng"],
    ["forgotten", "Thường quên lại (ít nhất 2 lượt)"],
    ["insufficient", "Chưa đủ dữ liệu để kết luận"],
  ];
  const periodHistory = new Map<string, typeof history>();
  for (const r of evidenceHistory) {
    const list = periodHistory.get(r.wordId) || [];
    list.push(r);
    periodHistory.set(r.wordId, list);
  }
  useEffect(() => setEvidenceLimit(100), [focus, range]);
  const evidenceList =
    page === "progress"
      ? active.filter((e) => {
          const h = periodHistory.get(e.word.id) || [];
          const understands = h.some(
            (r) => r.skill === 0 && r.correct && !r.hint,
          );
          if (focus === "stable")
            return skills.some(
              (_, i) =>
                strength(state, e.word.id, i, learningEvidence) ===
                "Nhớ khá vững",
            );
          if (focus === "writing")
            return (
              understands &&
              !h.some(
                (r) =>
                  r.skill === 1 && r.correct && !r.hint && r.method === "rule",
              )
            );
          if (focus === "listening")
            return (
              understands &&
              !h.some((r) => [2, 3].includes(r.skill) && r.correct && !r.hint)
            );
          if (focus === "forgotten")
            return (
              learningEvidence.attempts.filter(
                (r) =>
                  r.wordId === e.word.id &&
                  inPeriod(r) &&
                  (!r.correct || r.hint),
              ).length >= 2
            );
          if (focus === "insufficient")
            return !skills.some(
              (_, i) =>
                strength(state, e.word.id, i, learningEvidence) ===
                "Nhớ khá vững",
            );
          return h.length > 0;
        })
      : [];
  const modal = (content: React.ReactNode, close: () => void) => (
    <div className="scrim" onClick={close}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={
          backup
            ? "Khôi phục bản sao lưu"
            : pending
              ? "Xem trước cập nhật kho"
              : editor !== undefined
                ? "Biên tập mục từ"
                : settings
                  ? "Cài đặt và sao lưu"
                  : "Chi tiết mục từ"
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-controls">
          <button className="close icon" aria-label="Đóng" onClick={close}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-content" tabIndex={0}>
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button
                className="icon"
                aria-label="Đóng thông báo"
                onClick={() => setNotice("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {content}
        </div>
      </section>
    </div>
  );
  if (!loaded)
    return (
      <main className="loading">
        <Leaf />
        <h2>Đang chuẩn bị góc học của bạn…</h2>
        <p role="alert">{notice}</p>
        {notice && (
          <>
            <button
              onClick={() => {
                setNotice("");
                setLoadAttempt((n) => n + 1);
              }}
            >
              Thử tải lại
            </button>
            <label className="button">
              Khôi phục từ JSON đã sao lưu
              <input
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(e) => file(e, true)}
              />
            </label>
            {backup && (
              <section>
                <h3>Xem trước bản sao lưu</h3>
                <p>
                  {Object.keys(backup.entries).length} mục ·{" "}
                  {backup.history.length} lượt học
                </p>
                <button
                  onClick={() => {
                    clearSyncBinding();
                    commit(backup, { replace: true })
                      .then(() => {
                        setBackup(undefined);
                        setLoaded(true);
                        setPage("today");
                        setNotice("Đã khôi phục bản sao lưu.");
                      })
                      .catch(notifyError);
                  }}
                >
                  Khôi phục bản sao lưu này
                </button>
              </section>
            )}
          </>
        )}
      </main>
    );
  return (
    <div className="app">
      <aside>
        <a
          className="brand"
          aria-label="Jeongyeon — Hôm nay"
          href="#"
          onClick={() => setPage("today")}
        >
          <span className="brand-icon">
            <Leaf size={24} />
          </span>
          Jeongyeon<span className="brand-dot">.</span>
        </a>
        <div className="brand-caption">MỖI TỪ, MỘT BƯỚC TIẾN</div>
        <div className="nav-label">GÓC HỌC CỦA BẠN</div>
        <nav aria-label="Điều hướng học tập">
          {[
            ["today", "Hôm nay", CalendarDays],
            ["library", "Kho từ", BookOpen],
            ["phrasal-verbs", "Cụm động từ", Layers],
            ["slang", "Slang", MessageCircle],
            ["practice", "Luyện tập", Headphones],
            ["progress", "Tiến độ", ChartNoAxesCombined],
            ["grammar", "Tra cứu ngữ pháp", BookText],
          ].map(([key, label, Icon]) => (
            <button
              key={String(key)}
              className={page === key ? "selected" : ""}
              aria-label={String(label)}
              aria-current={page === key ? "page" : undefined}
              onClick={() => setPage(String(key))}
            >
              {React.createElement(Icon as typeof Leaf, { size: 20 })}
              <span>{key === "grammar" ? "Ngữ pháp" : String(label)}</span>
              {key === "today" && due.length > 0 && <b>{due.length}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="little-spark">✧</div>
          <h4>Chậm mà chắc.</h4>
          <p>
            Không cần học thật nhiều.
            <br />
            Chỉ cần nhớ thêm mỗi ngày.
          </p>
          <span>MỤC TIÊU CỦA BẠN</span>
          <strong>
            IELTS 6.0 – 7.0 <Target size={17} />
          </strong>
        </div>
        <button className="settings" onClick={() => setSettings(true)}>
          <Settings2 size={18} /> Cài đặt & sao lưu
        </button>
        <div className="profile">
          <div className="avatar">B</div>
          <div>
            <strong>Góc học cá nhân</strong>
            <small>Dữ liệu trên thiết bị này</small>
          </div>
          <span className="online" />
        </div>
      </aside>
      <div className="workspace">
        <header className="app-header">
          <div>
            <span className="breadcrumb">Góc học của bạn</span>
            <ChevronRight size={14} />
            <strong>
              {
                {
                  today: "Hôm nay",
                  library: "Kho từ",
                  "phrasal-verbs": "Cụm động từ",
                  slang: "Slang",
                  practice: "Luyện tập",
                  progress: "Tiến độ",
                  grammar: "Tra cứu ngữ pháp",
                  learn: "Phiên học",
                }[page]
              }
            </strong>
          </div>
          <div className="header-right">
            <span className="local-tag">
              <span /> Lưu trên thiết bị
            </span>
            <button
              className="avatar"
              onClick={() => setSettings(true)}
              aria-label="Cài đặt"
            >
              B
            </button>
          </div>
        </header>
        <main>
          {notice && !hasModal && (
            <div className="notice" role="status">
              {notice}
              <button
                className="icon"
                onClick={() => setNotice("")}
                aria-label="Đóng thông báo"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {availableWords && !hasModal && (
            <div className="notice source-update" role="status">
              <span>
                Kho mặc định có bản cập nhật. Xem trước để nhận từ mới và giữ
                lịch sử theo ID.
              </span>
              <button
                onClick={() =>
                  setPending({
                    words: availableWords,
                    origin: "default",
                    version: sourceVersion,
                  })
                }
              >
                Xem bản cập nhật
              </button>
            </div>
          )}
          {page === "today" && (
            <>
              <div className="greeting">
                <div>
                  <div className="eyebrow">
                    MỘT CHÚT MỖI NGÀY, MỘT CHẶNG ĐƯỜNG DÀI
                  </div>
                  <h1 tabIndex={-1}>
                    Hôm nay, mình học gì? <span className="wave">☀</span>
                  </h1>
                  <p>
                    Cùng xây nền tảng vững chắc cho hành trình IELTS của bạn.
                  </p>
                </div>
                <span className="date">
                  <CalendarDays size={16} />
                  {new Date().toLocaleDateString("vi-VN", {
                    day: "numeric",
                    month: "long",
                  })}
                </span>
              </div>
              <section className="hero">
                <div className="hero-copy">
                  <span className="pill">
                    <span /> KẾ HOẠCH HÔM NAY
                  </span>
                  <h2>
                    Từng từ nhỏ.
                    <br />
                    Tự tin lớn dần.
                  </h2>
                  <p>
                    Ôn lại điều đã biết, khám phá điều mới.
                    <br />
                    Một buổi học ngắn cũng là một bước tiến.
                  </p>
                  <button
                    className="primary light"
                    onClick={() => (state.session ? setPage("learn") : start())}
                  >
                    {state.session ? "Tiếp tục phiên học" : "Bắt đầu học"}
                    <ArrowRight size={18} />
                  </button>
                  {state.pausedScheduled && (
                    <button
                      className="primary light"
                      onClick={() => start(true)}
                    >
                      Tiếp tục phiên ôn theo lịch <ArrowRight size={18} />
                    </button>
                  )}
                  <small>
                    Ưu tiên ôn từ cũ trước · Khoảng {estimatedMinutes.min}–
                    {estimatedMinutes.max} phút
                    {" · "}
                    {estimatedTasks.length} lượt
                    {resumable ? " còn lại" : " dự kiến"}
                    <br />
                    Ước tính theo dạng bài, chưa gồm thời gian nghỉ hoặc sửa
                    sai.
                  </small>
                </div>
                <div
                  className="hero-art"
                  aria-hidden="true"
                  ref={heroExposureRef}
                >
                  <div className="orbit orbit-one" />
                  <div className="orbit orbit-two" />
                  <span className="art-star star-one">✧</span>
                  <span className="art-star star-two">✦</span>
                  <div className="floating-card back-card">
                    <span>mỗi ngày</span>
                    <small>mỗi ngày một chút</small>
                  </div>
                  <div className="floating-card front-card">
                    <span className="card-label">YOUR NEXT CHAPTER</span>
                    <div className="plant">🌱</div>
                    <strong>
                      {displayWord(fresh[0]?.word) || "Sẵn sàng học"}
                    </strong>
                    <span className="phonetic">
                      {fresh[0]?.word.ipa || "một từ mới, một khởi đầu"}
                    </span>
                    <div className="art-line" />
                    <small data-exposure-id={heroWordId}>
                      {fresh[0]?.word.meaning_vi || "Thêm từ để bắt đầu"}
                    </small>
                  </div>
                  <div className="art-chip">
                    <Check size={14} /> Tiến bộ theo cách của bạn
                  </div>
                </div>
              </section>
              {!resumable &&
                (todayPlan.remainingReviews > 0 ||
                  todayPlan.remainingContinuing > 0) && (
                  <p className="notice" role="status">
                    Phiên mới tối đa {todayPlan.taskLimit} lượt ban đầu, khoảng{" "}
                    {todayPlan.budgetMinutes} phút theo dạng bài. Còn{" "}
                    {todayPlan.remainingReviews} lượt đến hạn và{" "}
                    {todayPlan.remainingContinuing} lượt học tiếp cho phiên sau.{" "}
                    Các lịch này được giữ nguyên; tạm dừng thêm từ mới khi phiên
                    còn đầy lượt ôn.
                  </p>
                )}
              <div className="stats">
                <div className="stat">
                  <span className="stat-icon peach">
                    <CalendarDays size={21} />
                  </span>
                  <span>
                    Đến hạn ôn
                    <strong>
                      {dueWords}
                      <small>mục</small>
                    </strong>
                    <em>
                      {overdue
                        ? `${overdue} mục quá hạn`
                        : "Chưa có mục quá hạn"}
                    </em>
                  </span>
                </div>
                <div className="stat">
                  <span className="stat-icon green">
                    <Sparkles size={21} />
                  </span>
                  <span>
                    Từ mới hôm nay
                    <strong>
                      {planned}
                      <small>mục</small>
                    </strong>
                    <em>Mục tiêu {state.daily} từ / ngày</em>
                  </span>
                </div>
                <div className="stat">
                  <span className="stat-icon purple">
                    <BookOpen size={21} />
                  </span>
                  <span>
                    Đã học hôm nay
                    <strong>
                      {studiedToday.size}
                      <small>mục</small>
                    </strong>
                    <em>Mỗi lần nhớ lại đều có ý nghĩa</em>
                  </span>
                </div>
              </div>
              <div className="panel">
                <label className="setting-row">
                  Cách chọn từ cho phiên mới
                  <select
                    aria-label="Chế độ chọn từ"
                    value={learningMode}
                    onChange={(e) =>
                      changeLearningMode(e.target.value as LearningMode)
                    }
                  >
                    {selectionModes.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="fineprint">
                  {
                    selectionModes.find((m) => m.value === learningMode)
                      ?.description
                  }{" "}
                  Lịch ôn đến hạn và phiên đang dở được giữ nguyên.
                </p>
                <label>
                  Trình độ của từ mới trong kế hoạch hôm nay{" "}
                  <select
                    aria-label="Trình độ từ mới hôm nay"
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                  >
                    <option value="">Mọi trình độ, theo chế độ đã chọn</option>
                    {["A1", "A2", "B1", "B2", "C1", "C2"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <p className="fineprint">
                  {readyCount.toLocaleString("vi-VN")} mục đủ điều kiện luyện ·{" "}
                  {(active.length - readyCount).toLocaleString("vi-VN")} mục còn
                  lại vẫn tra cứu được, chưa tự đưa vào bài học. Bộ lọc trình độ
                  chỉ giới hạn từ mới; các mục đến hạn vẫn được ôn.
                </p>
                {freshRecommendations[0] && (
                  <p className="fineprint" data-testid="recommendation-reason">
                    <strong>
                      Gợi ý tiếp:{" "}
                      {displayWord(freshRecommendations[0].entry.word)}.
                    </strong>{" "}
                    {freshRecommendations[0].reason}
                  </p>
                )}
                {learningMode === "weak" && !fresh.length && (
                  <p>
                    Chưa có từ yếu chưa ghi danh để giới thiệu.{" "}
                    <button onClick={() => setPage("practice")}>
                      Đến luyện củng cố
                    </button>
                    . Lượt đến hạn vẫn được ôn bình thường.
                  </p>
                )}
              </div>
              {learningReport.recommendations[0] && (
                <section className="panel">
                  <h3>Hôm nay tôi nên tập trung vào đâu?</h3>
                  <p>{learningReport.recommendations[0].reason}</p>
                  <button
                    onClick={() => {
                      const r = learningReport.recommendations[0];
                      if (r.action === "writing") openWritingReview();
                      else if (r.action === "conversation")
                        openConversation(r.ids);
                      else start(false, r.ids, r.skill);
                    }}
                  >
                    Luyện ngay
                  </button>{" "}
                  <button
                    className="text-button"
                    onClick={() => setPage("progress")}
                  >
                    Xem phân tích tiến độ
                  </button>
                  {due.length > 0 && (
                    <p className="fineprint">
                      Ưu tiên {due.length} lượt kỹ năng đến hạn ở nút Bắt đầu
                      học; luyện tự do không dời lịch ôn.
                    </p>
                  )}
                </section>
              )}
              {summary && (
                <section
                  className="notice success session-summary"
                  aria-label="Kết quả phiên học"
                >
                  <h3>Phiên này đã hoàn thành</h3>
                  {summary.split("\n").map((line, index) => (
                    <p key={index}>{line}</p>
                  ))}
                </section>
              )}
              {due.length > 20 && (
                <div className="notice">
                  Ưu tiên xử lý lượt ôn trước. Mỗi phiên mới tối đa{" "}
                  {todayPlan.taskLimit} lượt; từ mới chỉ được thêm khi còn chỗ
                  và không bỏ lại lượt ôn đến hạn.
                </div>
              )}
              <div className="dashboard-grid">
                <section className="panel pathway">
                  <div className="section-heading">
                    <h3>Một buổi học, bốn bước nhỏ</h3>
                    <span className="muted">HỌC ĐỂ NHỚ LÂU</span>
                  </div>
                  {[
                    [
                      "01",
                      "Ôn lại từ đến hạn",
                      "Đánh thức những gì bạn đã học.",
                      "peach",
                    ],
                    [
                      "02",
                      "Khám phá từ mới",
                      "Hiểu từ qua nghĩa và ngữ cảnh.",
                      "green",
                    ],
                    [
                      "03",
                      "Thử tự nhớ lại",
                      "Không nhìn đáp án, thử sức mình.",
                      "purple",
                    ],
                    [
                      "04",
                      "Đặt câu của riêng bạn",
                      "Biến từ mới thành điều bạn muốn nói.",
                      "blue",
                    ],
                  ].map(([n, title, sub, color]) => (
                    <div className="path-step" key={n}>
                      <span className={"step-number " + color}>{n}</span>
                      <div>
                        <strong>{title}</strong>
                        <p>{sub}</p>
                      </div>
                      {n !== "04" && <ChevronRight size={16} />}
                    </div>
                  ))}
                </section>
                <section className="panel insight">
                  <div className="section-heading">
                    <h3>Hiểu rõ điều mình đã nhớ</h3>
                    <span className="mini-leaf">
                      <Leaf size={18} />
                    </span>
                  </div>
                  <p>
                    Nhìn hiểu, tự viết và nghe nhận ra là những kỹ năng khác
                    nhau.
                  </p>
                  <div className="empty-chart">
                    <div className="insight-symbol">
                      <Target size={45} strokeWidth={1} />
                      <Leaf size={19} />
                    </div>
                    <span>
                      {state.history.length
                        ? `${state.history.length} lượt học đã lưu`
                        : "Hành trình của bạn bắt đầu từ đây"}
                    </span>
                    <small>
                      {state.history.length
                        ? "Xem bằng chứng theo từng kỹ năng."
                        : "Học buổi đầu để có dữ liệu tiến độ thực tế."}
                    </small>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setPage("progress")}
                  >
                    Khám phá tiến độ <ArrowRight size={16} />
                  </button>
                  <small className="fineprint">
                    Bằng chứng thật · Không quy đổi thành band IELTS
                  </small>
                </section>
              </div>
              <section className="collection-section">
                <div className="section-heading">
                  <div>
                    <h3>Kho từ, theo cách của bạn</h3>
                    <p>Học song song nền tảng và chủ đề bạn quan tâm.</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setPage("library")}
                  >
                    Xem kho từ <ArrowRight size={16} />
                  </button>
                </div>
                <div className="collections">
                  {[
                    [
                      "foundation",
                      "Aa",
                      "Xây nền tảng",
                      "Từng bước làm quen với từ thông dụng.",
                      "green",
                    ],
                    [
                      "ielts",
                      "◎",
                      "IELTS theo chủ đề",
                      "Kết nối từ vựng với thế giới xung quanh.",
                      "peach",
                    ],
                    [
                      "personal",
                      "✎",
                      "Từ của riêng bạn",
                      "Gom những từ bạn gặp trên hành trình.",
                      "purple",
                    ],
                  ].map(([key, icon, title, sub, color]) => (
                    <button
                      className="collection-card"
                      key={key}
                      onClick={() => {
                        resetFilters();
                        setCollection(key);
                        setPage("library");
                      }}
                    >
                      <span className={"collection-icon " + color}>{icon}</span>
                      <h4>{title}</h4>
                      <p>{sub}</p>
                      <div>
                        {
                          active.filter((e) =>
                            (e.word.collections || "").split(",").includes(key),
                          ).length
                        }{" "}
                        mục từ <ArrowRight size={17} />
                      </div>
                    </button>
                  ))}
                </div>
              </section>
              <div className="bottom-note">
                <Leaf size={15} /> Học để sử dụng, không chỉ để đếm số từ. Mỗi
                người có một nhịp đi riêng.
              </div>
            </>
          )}
          {page === "library" && (
            <>
              <div className="page-title">
                <div>
                  <div className="eyebrow">KHÔNG GIAN TỪ VỰNG</div>
                  <h1 tabIndex={-1}>Kho từ của bạn</h1>
                  <p>
                    {
                      new Set(
                        active.map((e) => e.word.word.normalize("NFC").trim()),
                      ).size
                    }{" "}
                    từ/cụm từ ·{" "}
                    {active.filter((e) => !!e.word.meaning_vi?.trim()).length}{" "}
                    mục có nghĩa ·{" "}
                    {
                      active.filter(
                        (e) => e.word.content_status === "reference",
                      ).length
                    }{" "}
                    mục thiếu nghĩa phù hợp
                  </p>
                  <p className="fineprint">
                    Kho mặc định đối chiếu từ/loại từ/CEFR theo bản lưu PDF
                    Oxford. Nghĩa/ngữ liệu từ từ điển mở hoặc biên soạn được ghi
                    riêng theo từng mục.{" "}
                    <a
                      href={import.meta.env.BASE_URL + "data/SOURCES.md"}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Nguồn và phạm vi đối chiếu ↗
                    </a>
                  </p>
                </div>
                <button
                  className="primary add-word"
                  onClick={() =>
                    setEditor(
                      "id: \nword: \nmeaning_vi: \nexample_en: \nexample_vi: \ncollections: personal\n",
                    )
                  }
                >
                  <Plus size={18} /> Thêm từ
                </button>
              </div>
              <div className="notice success">
                Oxford 5000:{" "}
                {new Set(
                  active
                    .filter((e) =>
                      (e.word.collections || "")
                        .split(",")
                        .some((c) => c.startsWith("oxford-")),
                    )
                    .map((e) => e.word.word),
                ).size.toLocaleString("vi-VN")}{" "}
                đầu từ/cách viết. Nội dung đã rà soát:{" "}
                {active
                  .filter(
                    (e) =>
                      e.word.content_status !== "dictionary" &&
                      e.word.content_status !== "reference",
                  )
                  .length.toLocaleString("vi-VN")}{" "}
                mục. {readyCount.toLocaleString("vi-VN")} mục đủ điều kiện
                luyện. Mục chưa rà chất lượng chỉ để tra cứu, không tự đưa vào
                học hoặc chấm bài.
              </div>
              <p className="fineprint" data-testid="library-order">
                Thứ tự: A1 → A2 → B1 → B2 → C1 → C2; trong cùng trình độ, từ
                thông dụng hơn đứng trước theo tần suất tiếng Anh tổng hợp
                wordfreq. Cùng tần suất thì xếp A–Z. Mục chưa có CEFR nằm cuối;
                chưa có tần suất nằm sau các mục có dữ liệu trong cùng trình độ.
                Tần suất gộp cách viết không phân biệt hoa/thường, không xác
                nhận riêng từng nghĩa hoặc từ loại.
              </p>
              <div className="toolbar">
                <label className="search">
                  <Search size={18} />
                  <input
                    aria-label="Tìm từ và nghĩa"
                    aria-describedby="vocabulary-search-help"
                    placeholder="Tìm từ, dạng động từ hoặc cách dùng…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Chủ đề"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                >
                  <option value="">Mọi chủ đề</option>
                  {selectOptions("topics").map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <select
                  aria-label="Bộ từ"
                  value={collection}
                  onChange={(e) => setCollection(e.target.value)}
                >
                  <option value="">Mọi bộ từ</option>
                  {selectOptions("collections").map((t) => (
                    <option key={t} value={t}>
                      {collectionLabels[t] || t}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Trình độ"
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                >
                  <option value="">Mọi trình độ</option>
                  {selectOptions("level")
                    .sort()
                    .map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                </select>
                <select
                  aria-label="Trạng thái"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">Mọi trạng thái</option>
                  <option value="new">Chưa học</option>
                  <option value="studied">Đã học</option>
                  <option value="known">Tự đánh dấu đã biết</option>
                  <option value="usage">
                    Có cách dùng và ngữ cảnh bổ sung
                  </option>
                </select>
              </div>
              <p className="fineprint" id="vocabulary-search-help">
                Tra cả dạng động từ và cách dùng đã đối chiếu; hỗ trợ tiếng Việt
                không dấu. Dạng tìm thấy không tự trở thành đáp án cho mọi câu.
              </p>
              <p className="fineprint">
                Phạm vi hiện tại: {filterSummary}{" "}
                <button onClick={resetFilters}>Xóa mọi bộ lọc</button>
              </p>
              <div className="file-actions">
                <label className="button">
                  <Upload size={16} /> Nhập .txt
                  <input
                    type="file"
                    accept=".txt,text/plain"
                    hidden
                    onChange={(e) => file(e)}
                  />
                </label>
                <button
                  onClick={() =>
                    download(
                      "vocabulary.txt",
                      serialize(active.map((e) => e.word)),
                    )
                  }
                >
                  <Download size={16} /> Tải kho .txt
                </button>
                <button onClick={source}>↻ Cập nhật kho mặc định</button>
                <span>Chỉnh sửa được lưu trên trình duyệt.</span>
              </div>
              <div
                className="word-grid"
                ref={libraryExposureRef}
                data-total-items={filtered.length}
                tabIndex={-1}
                aria-label="Kết quả Kho từ"
              >
                {visibleWords.map((e) => (
                  <button
                    className="word-card"
                    key={e.word.id}
                    onClick={() => openDetail(e.word.id)}
                  >
                    <div>
                      <span className="word-topic">
                        {e.word.topics?.split(",")[0] || "Cá nhân"}
                      </span>
                      <Volume2 size={17} />
                    </div>
                    <h3>{displayWord(e.word)}</h3>
                    <span
                      className="part-of-speech"
                      aria-label={partOfSpeechCaption(e.word.part_of_speech)}
                    >
                      {formatPartOfSpeech(e.word.part_of_speech)}
                    </span>
                    <p data-exposure-id={e.word.id}>{e.word.meaning_vi}</p>
                    <small>
                      {e.word.example_en ||
                        "Nguồn chưa có ví dụ; bài điền ngữ cảnh sẽ không được tạo."}
                    </small>
                    {e.word.content_status === "reference" && (
                      <small className="content-status">
                        Chưa có nghĩa phù hợp · chỉ tra cứu
                      </small>
                    )}
                    {e.word.content_status === "dictionary" && (
                      <small className="content-status">
                        {canPractice(e.word, 0)
                          ? "Đã rà để luyện"
                          : "Chỉ tra cứu · chưa rà chất lượng"}
                      </small>
                    )}
                    <footer>
                      <span>
                        {e.known
                          ? "Tự đánh dấu đã biết"
                          : studiedIds.has(e.word.id)
                            ? "Đang học"
                            : "Chưa học"}
                      </span>
                      <ChevronRight size={16} />
                    </footer>
                  </button>
                ))}
              </div>
              {filtered.length > 60 && (
                <div className="library-pagination">
                  <button
                    disabled={currentLibraryPage === 1}
                    onClick={() => setLibraryPage(currentLibraryPage - 1)}
                  >
                    ← Trang trước
                  </button>
                  <span>
                    Trang {currentLibraryPage}/{pageCount} ·{" "}
                    {filtered.length.toLocaleString("vi-VN")} mục
                  </span>
                  <button
                    disabled={currentLibraryPage === pageCount}
                    onClick={() => setLibraryPage(currentLibraryPage + 1)}
                  >
                    Trang sau →
                  </button>
                </div>
              )}
              {!filtered.length && (
                <div className="empty-state">
                  Không có từ phù hợp. Thử bỏ bộ lọc hoặc thêm từ của bạn.
                </div>
              )}
              <details className="panel">
                <summary>
                  Mục đã lưu trữ (
                  {
                    Object.values(state.entries).filter((e) => e.archived)
                      .length
                  }
                  )
                </summary>
                {Object.values(state.entries)
                  .filter((e) => e.archived)
                  .map((e) => (
                    <p key={e.word.id}>
                      {displayWord(e.word)}{" "}
                      <button
                        onClick={() =>
                          commit({
                            ...state,
                            entries: {
                              ...state.entries,
                              [e.word.id]: {
                                ...e,
                                archived: false,
                                archivedReason: undefined,
                              },
                            },
                          }).catch(notifyError)
                        }
                      >
                        Khôi phục
                      </button>
                    </p>
                  ))}
              </details>
            </>
          )}
          {(page === "slang" || page === "phrasal-verbs") && (
            <CollectionBrowser
              key={page}
              kind={page}
              entries={active}
              onOpen={openDetail}
              onExpose={hasModal ? undefined : exposeIds}
              onPractice={(id) => start(false, id, 1)}
            />
          )}
          {page === "practice" && (
            <>
              <div className="eyebrow">CHỦ ĐỘNG NHỚ LẠI</div>
              <h1 tabIndex={-1}>Luyện một chút, nhớ lâu hơn.</h1>
              <p>Luyện tự do có lưu bằng chứng nhưng không thay đổi lịch ôn.</p>
              <section className="panel">
                <h3>Hội thoại thực tế</h3>
                <p>
                  {dialogues.length} đoạn hội thoại, gồm{" "}
                  {listeningDialogues.length} bài nghe mới B1–C1. Nghe trước khi
                  mở lời thoại, trả lời câu hỏi và xem nghĩa trong ngữ cảnh. Nội
                  dung biên soạn sẵn; âm thanh dùng giọng đọc của thiết bị, ưu
                  tiên Anh–Mỹ. Đọc hoặc nghe không tự tạo bằng chứng thành thạo.
                </p>
                <button
                  className="primary"
                  onClick={() => {
                    setConversationTargetIds([]);
                    setConversationOpen((value) => !value);
                  }}
                >
                  {conversationOpen
                    ? "Thu gọn hội thoại"
                    : "Mở luyện hội thoại"}
                </button>
              </section>
              {conversationOpen && (
                <ConversationPractice
                  state={state}
                  targetIds={conversationTargetIds}
                  onSave={saveConversation}
                  onExpose={exposeIds}
                  onClose={() => setConversationOpen(false)}
                />
              )}
              <label className="setting-row">
                Cách chọn từ luyện
                <select
                  aria-label="Chế độ luyện từ"
                  value={learningMode}
                  onChange={(e) =>
                    changeLearningMode(e.target.value as LearningMode)
                  }
                >
                  {selectionModes.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="practice-grid">
                {skills.map((s, i) => (
                  <button
                    key={s}
                    className={
                      "practice-card " + (practice === i ? "chosen" : "")
                    }
                    onClick={() => setPractice(i)}
                  >
                    <span className="step-number green">0{i + 1}</span>
                    <h3>{s}</h3>
                    <p>
                      {
                        [
                          "Nhìn từ → tự nhớ nghĩa, rồi mở đáp án.",
                          "Nhìn nghĩa → gõ từ tiếng Anh.",
                          "Nghe từ → tự nhớ nghĩa.",
                          "Nghe câu → gõ từ còn thiếu trong ngữ cảnh.",
                          "Điền từ còn thiếu trong câu.",
                          "Viết câu, kiểm tra cấu trúc đã hỗ trợ và lưu bản sửa.",
                        ][i]
                      }
                    </p>
                    <span>
                      {[0, 2].includes(i)
                        ? "Tự đánh giá"
                        : i === 5
                          ? "Phản hồi cấu trúc tại máy"
                          : "Chấm theo đáp án khai báo"}
                    </span>
                  </button>
                ))}
              </div>
              <p>
                Phạm vi hiện tại: {practiceFilterSummary}{" "}
                <button onClick={resetFilters}>Xóa mọi bộ lọc</button>{" "}
                <button onClick={() => setPage("library")}>
                  Chọn bộ lọc trong Kho từ
                </button>
              </p>
              <button
                className="primary"
                disabled={!practiceRecommendations.length}
                onClick={() => start(false)}
              >
                Bắt đầu luyện · {practiceRecommendations.length} mục{" "}
                <ArrowRight size={18} />
              </button>
              <p className="fineprint">
                {practiceEligible.length.toLocaleString("vi-VN")} mục đủ điều
                kiện cho dạng bài đang chọn trong{" "}
                {filtered.length.toLocaleString("vi-VN")} mục khớp bộ lọc. Ưu
                tiên theo chế độ đang chọn; mỗi phiên tối đa 20 mục. Bài nghe
                cần âm thanh hoạt động trên thiết bị.
              </p>
              {practiceRecommendations[0] ? (
                <p className="fineprint">
                  <strong>Lý do ưu tiên lượt đầu:</strong>{" "}
                  {practiceRecommendations[0].reason}
                </p>
              ) : (
                <p>
                  Chưa có mục phù hợp với chế độ này. Bạn có thể đổi chế độ hoặc
                  xóa bộ lọc.
                </p>
              )}
            </>
          )}
          {page === "learn" &&
            w &&
            task &&
            state.session &&
            (entry?.archived || !exercise || !canPractice(w, task.skill)) && (
              <section className="panel study">
                <h2>Nội dung này chưa đủ điều kiện luyện</h2>
                <p>
                  {!exercise
                    ? "Nghĩa hoặc nội dung của câu đã lưu không còn khớp với mục từ hiện tại."
                    : "Mục đã lưu trữ hoặc chưa được rà chất lượng."}{" "}
                  Bạn vẫn có thể tra cứu trong Kho từ; lượt này không được chấm
                  hoặc thay đổi lịch ôn.
                </p>
                <button
                  className="primary"
                  onClick={() => next().catch(notifyError)}
                >
                  Bỏ qua và tiếp tục
                </button>
                <button onClick={() => pause().catch(notifyError)}>
                  Lưu & tạm dừng
                </button>
              </section>
            )}
          {page === "learn" &&
            w &&
            task &&
            state.session &&
            !entry?.archived &&
            exercise &&
            canPractice(w, task.skill) && (
              <>
                <div className="study-top">
                  <button onClick={() => pause().catch(notifyError)}>
                    ← Lưu & tạm dừng
                  </button>
                  <span>
                    {state.session.scheduled ? "Ôn theo lịch" : "Luyện tự do"} ·{" "}
                    {state.session.index + 1}/{state.session.queue.length}
                  </span>
                </div>
                <progress
                  value={state.session.index}
                  max={state.session.queue.length}
                  aria-label="Tiến độ toàn phiên, gồm lượt sửa sai"
                />
                {sessionGuide && (
                  <section
                    className="session-goal"
                    aria-label="Mục tiêu phiên học"
                  >
                    <div>
                      <strong>
                        {sessionGuide.words} từ · {sessionGuide.originalTasks}{" "}
                        lượt ban đầu
                      </strong>
                      <span>
                        Còn {sessionGuide.remaining} lượt ban đầu ·{" "}
                        {sessionGuide.pendingRetries} lượt sửa sai đang chờ
                      </span>
                    </div>
                    {state.session.goal && (
                      <p>
                        {state.session.goal.due} lượt đến hạn ·{" "}
                        {state.session.goal.continuing} lượt kỹ năng cần tiếp
                        tục · {state.session.goal.fresh} lượt từ mới
                      </p>
                    )}
                    <p>
                      Lượt sửa sai được ghi riêng; trả lời lại ngay trong phiên
                      chưa chứng minh nhớ lâu.
                    </p>
                  </section>
                )}
                <section className="study panel">
                  {sessionGuide?.isRetry && (
                    <div className="session-retry" role="note">
                      <strong>Thử lại từ cần củng cố</strong>
                      <span>
                        Bạn đã xem đáp án ở lượt trước. Hãy tự trả lời lại; kết
                        quả này được tách khỏi lần kiểm tra đầu.
                      </span>
                    </div>
                  )}
                  <span className="eyebrow">{skills[task.skill]}</span>
                  <h2>
                    {[2, 3].includes(task.skill)
                      ? "Lắng nghe và thử nhớ lại"
                      : task.skill === 0 || task.skill === 5
                        ? displayWord(w)
                        : task.skill === 4
                          ? "Điền từ đang học vào ngữ cảnh"
                          : w.meaning_vi}
                  </h2>
                  <p
                    className="part-of-speech"
                    aria-label={partOfSpeechCaption(w.part_of_speech)}
                  >
                    {[1, 2, 3, 4].includes(task.skill)
                      ? cloze({
                          ...w,
                          example_en: formatPartOfSpeech(w.part_of_speech),
                        })
                      : formatPartOfSpeech(w.part_of_speech)}
                  </p>
                  {task.skill === 1 && (
                    <div className="recall-cues">
                      {w.definition_en && (
                        <p lang="en">
                          {cloze({ ...w, example_en: w.definition_en })}
                        </p>
                      )}
                      <p className="fineprint">
                        Đây là bài nhớ từ mục tiêu. Xem từ loại và giải nghĩa để
                        phân biệt các từ có cùng nghĩa tiếng Việt.
                      </p>
                    </div>
                  )}
                  {task.skill === 3 && canPractice(w, 4) && (
                    <>
                      <p className="context" lang="en">
                        {cloze(w)}
                      </p>
                      <p>Nghe cả câu rồi gõ từ hoặc cụm từ còn thiếu.</p>
                    </>
                  )}
                  {[2, 3].includes(task.skill) && (
                    <>
                      <button
                        className="audio-big"
                        onClick={() =>
                          task.skill === 3 && canPractice(w, 4)
                            ? speak(w.example_en, w.audio_example, true)
                            : speak(
                                wordPronunciation!.text,
                                wordPronunciation!.url,
                                true,
                              )
                        }
                      >
                        <Volume2 size={28} />{" "}
                        {task.skill === 3 && canPractice(w, 4)
                          ? "Nghe câu"
                          : wordPronunciation?.usesContext
                            ? "Nghe từ trong câu"
                            : "Nghe từ"}
                      </button>
                      <p className="fineprint" aria-live="polite">
                        {audioPlaying
                          ? "Đang phát — hãy nghe hết âm thanh."
                          : audioPlayed
                            ? "Đã phát xong âm thanh cho lượt này."
                            : "Chưa phát xong âm thanh; chưa thể ghi nhận kết quả nghe."}
                      </p>
                      <p className="fineprint">
                        {(
                          task.skill === 3 && canPractice(w, 4)
                            ? w.audio_example
                            : wordPronunciation?.url
                        )
                          ? "Âm thanh khai báo; có thể dùng giọng tổng hợp dự phòng."
                          : "Giọng tổng hợp của trình duyệt"}
                        {wordPronunciation?.usesContext && task.skill === 2
                          ? ". Dùng câu ví dụ để hỗ trợ phân biệt từ loại; giọng tổng hợp vẫn có thể nhấn sai trọng âm."
                          : ""}
                      </p>
                      <button
                        className="text-button"
                        onClick={() => {
                          setNotice(
                            "Đã bỏ qua bài nghe, không ghi nhận kết quả và không thay đổi lịch ôn.",
                          );
                          next().catch(notifyError);
                        }}
                      >
                        Không nghe được? Bỏ qua lượt này
                      </button>
                    </>
                  )}
                  {task.skill === 4 && exercise.example_en && (
                    <>
                      <p className="recall-cues">
                        Nghĩa mục tiêu: {w.meaning_vi}
                      </p>
                      <p className="context" lang="en">
                        {cloze(exercise)}
                      </p>
                      <p className="fineprint">
                        {task.context
                          ? "Ngữ cảnh thứ hai · cùng nghĩa đang học."
                          : "Ngữ cảnh gốc · cùng nghĩa đang học."}{" "}
                        Điền từ mục tiêu; kết quả là luyện truy hồi trong câu,
                        chưa xác nhận khả năng tự dùng từ linh hoạt.
                      </p>
                    </>
                  )}
                  {task.skill === 5 && (
                    <p>
                      Viết một câu sử dụng từ này. Kiểm tra cấu trúc tại máy
                      không xác nhận toàn bộ nghĩa hoặc độ tự nhiên; lưu câu vẫn
                      giữ lịch sử như trước.
                    </p>
                  )}
                  {task.skill === 5 && (
                    <WritingFeedback
                      key={taskKey}
                      state={state}
                      wordId={w.id}
                      initialText={answer}
                      onTextChange={(value) => updateDraft(value)}
                      disabled={!!feedback}
                      onSave={saveWriting}
                    />
                  )}
                  {![0, 2, 5].includes(task.skill) && (
                    <textarea
                      aria-label="Câu trả lời"
                      placeholder={
                        task.skill === 5 ? "Câu của bạn…" : "Gõ câu trả lời…"
                      }
                      value={answer}
                      disabled={!!feedback || !!pendingAssessment}
                      onChange={(e) => updateDraft(e.target.value)}
                    />
                  )}{" "}
                  {!feedback && !revealed && (
                    <div className="study-actions">
                      {![0, 2].includes(task.skill) && (
                        <button
                          className="primary"
                          disabled={
                            !answer.trim() ||
                            busy ||
                            ([2, 3].includes(task.skill) && !audioPlayed)
                          }
                          onClick={() => submit()}
                        >
                          {" "}
                          {task.skill === 5 ? "Lưu câu" : "Kiểm tra"}{" "}
                          <Check size={18} />
                        </button>
                      )}
                      <button
                        disabled={[2, 3].includes(task.skill) && !audioPlayed}
                        onClick={() => {
                          if ([2, 3].includes(task.skill) && !audioPlayed)
                            return;
                          const helped = ![0, 2].includes(task.skill);
                          setHint(helped);
                          setRevealed(true);
                          updateDraft(answer, true, helped);
                          const base = current.current;
                          commit(expose(base, w.id), undefined, base)
                            .then(() => persistDraft())
                            .catch(notifyError);
                        }}
                      >
                        Mở đáp án{" "}
                        {[0, 2].includes(task.skill)
                          ? "để tự đánh giá"
                          : "(có gợi ý)"}
                      </button>
                    </div>
                  )}
                  {revealed && (
                    <div className="answer">
                      <h3>
                        {displayWord(w)}{" "}
                        <button
                          className="icon"
                          aria-label={
                            wordPronunciation?.usesContext
                              ? "Nghe từ trong câu"
                              : "Nghe từ"
                          }
                          onClick={() =>
                            speak(
                              wordPronunciation!.text,
                              wordPronunciation!.url,
                            )
                          }
                        >
                          <Volume2 size={19} />
                        </button>
                      </h3>
                      <p
                        className="part-of-speech"
                        aria-label={partOfSpeechCaption(w.part_of_speech)}
                      >
                        {formatPartOfSpeech(w.part_of_speech)}
                      </p>
                      <p>{w.meaning_vi}</p>
                      {displayWord(w) !== w.word && (
                        <p>
                          Cách viết trong nguồn: <span lang="en">{w.word}</span>
                          . Cả hai cách viết đều được chấp nhận.
                        </p>
                      )}
                      {w.spelling_variants && (
                        <p>
                          Biến thể chính tả được chấp nhận:{" "}
                          {w.spelling_variants.split("|").join(", ")}.
                        </p>
                      )}
                      {exercise.example_en && (
                        <p lang="en">{exercise.example_en}</p>
                      )}
                      <small lang="vi">{exercise.example_vi}</small>
                      <UsageNotes
                        word={w}
                        speak={speak}
                        onExposeWrittenForms={exposeForms}
                        compact
                      />
                      {!feedback &&
                        !pendingAssessment &&
                        ([0, 2].includes(task.skill) ? (
                          <div className="study-actions">
                            <button
                              disabled={
                                busy || (task.skill === 2 && !audioPlayed)
                              }
                              onClick={() => {
                                submit(false, false);
                              }}
                            >
                              Quên
                            </button>
                            <button
                              disabled={
                                busy || (task.skill === 2 && !audioPlayed)
                              }
                              onClick={() => {
                                submit(true, true);
                              }}
                            >
                              Nhớ khó
                            </button>
                            <button
                              className="primary"
                              disabled={
                                busy || (task.skill === 2 && !audioPlayed)
                              }
                              onClick={() => {
                                submit(true, false);
                              }}
                            >
                              Nhớ rõ
                            </button>
                          </div>
                        ) : (
                          <button
                            className="primary"
                            disabled={
                              busy ||
                              !answer.trim() ||
                              ([2, 3].includes(task.skill) && !audioPlayed)
                            }
                            onClick={() => submit()}
                          >
                            Lưu lượt có hỗ trợ
                          </button>
                        ))}
                    </div>
                  )}
                  {pendingAssessment && !feedback && (
                    <div
                      className="notice"
                      role="status"
                      aria-label="Đối chiếu đáp án trước khi chấm"
                    >
                      <strong>Chưa khớp đáp án — chưa ghi kết quả</strong>
                      <p>{assessmentMismatchFeedback(task.skill)}</p>
                      <p>
                        Lịch ôn chưa thay đổi. Câu trả lời ban đầu được giữ
                        nguyên; xem đáp án không tự tạo kết quả đúng.
                      </p>
                      <div className="study-actions">
                        <button
                          className="primary"
                          disabled={busy}
                          onClick={() =>
                            submit(false, undefined, undefined, true)
                          }
                        >
                          Tính sai và ôn lại
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            submit(
                              undefined,
                              undefined,
                              "Bạn chọn lưu không chấm sau khi đối chiếu đáp án. Chưa đủ căn cứ kết luận câu trả lời sai; lượt này không tính đúng/sai, không thay đổi lịch ôn và không xác nhận đã nhớ.",
                              true,
                            )
                          }
                        >
                          Đề chưa rõ — lưu không chấm
                        </button>
                      </div>
                    </div>
                  )}
                  {feedback && (
                    <div className="notice success">
                      {feedback}
                      <button
                        className="primary"
                        onClick={() => next().catch(notifyError)}
                      >
                        Tiếp tục <ArrowRight size={17} />
                      </button>
                    </div>
                  )}
                  {!feedback && [1, 3, 4].includes(task.skill) && (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => {
                        const reason = prompt(
                          "Vì sao câu hỏi chưa rõ? (Có thể để trống.) Lượt này sẽ được lưu chưa chấm, không tính đúng/sai và không thay đổi lịch ôn.",
                        );
                        if (reason === null) return;
                        const explanation =
                          "Bạn đã chọn bỏ qua chấm vì câu hỏi có thể có đáp án khác. " +
                          "Lượt này không tính đúng/sai, không xác nhận đã nhớ và không thay đổi lịch ôn." +
                          (reason.trim()
                            ? ` Ghi chú của bạn: ${reason.trim()}`
                            : "");
                        submit(undefined, undefined, explanation);
                      }}
                    >
                      Bỏ qua chấm câu này
                    </button>
                  )}
                  <button
                    className="text-button report"
                    onClick={() => {
                      const note = prompt("Mô tả điểm chưa rõ trong câu hỏi:");
                      if (note)
                        commit({
                          ...state,
                          entries: {
                            ...state.entries,
                            [w.id]: {
                              ...entry!,
                              reports: [...(entry!.reports || []), note],
                            },
                          },
                        })
                          .then(() =>
                            setNotice(
                              "Đã lưu báo cáo riêng; cập nhật nguồn không xóa báo cáo của bạn.",
                            ),
                          )
                          .catch(notifyError);
                    }}
                  >
                    Báo câu hỏi chưa rõ
                  </button>
                </section>
              </>
            )}
          {page === "grammar" && (
            <GrammarReference
              articles={grammarArticles}
              groups={grammarGroups}
            />
          )}
          {page === "progress" && (
            <>
              <div className="page-title">
                <div>
                  <div className="eyebrow">TIẾN BỘ CÓ BẰNG CHỨNG</div>
                  <h1 tabIndex={-1}>Bạn thực sự nhớ được gì?</h1>
                  <p>
                    Số từ không quy đổi thành band IELTS. Mỗi kỹ năng có bằng
                    chứng riêng.
                  </p>
                </div>
                <select
                  aria-label="Khoảng thời gian"
                  value={range}
                  onChange={(e) => setRange(Number(e.target.value))}
                >
                  <option value={7}>7 ngày</option>
                  <option value={30}>30 ngày</option>
                  <option value={0}>Toàn bộ</option>
                </select>
              </div>
              <LearningInsights
                state={state}
                onPractice={(skill, ids) => {
                  start(false, ids, skill);
                }}
                onWritingReview={openWritingReview}
                onConversation={openConversation}
                onReviewDue={() => {
                  start(true);
                }}
              />
              <div className="stats">
                <div className="stat">
                  <span>
                    Đã tiếp xúc
                    <strong>
                      {new Set(history.map((h) => h.wordId)).size}
                      <small>mục nghĩa</small>
                    </strong>
                    <em>
                      {
                        new Set(
                          history.map(
                            (h) => state.entries[h.wordId]?.word.word,
                          ),
                        ).size
                      }{" "}
                      từ/cụm từ riêng
                    </em>
                  </span>
                </div>
                <div className="stat">
                  <span>
                    Đúng lần đầu, không gợi ý
                    <strong className="metric">{ratio(tested)}</strong>
                    <em>Chỉ kết quả chấm bằng quy tắc</em>
                  </span>
                </div>
                <div className="stat">
                  <span>
                    Nhớ qua các ngày
                    <strong className="metric">{ratio(delayed)}</strong>
                    <em>Cách mọi tiếp xúc đã ghi nhận ít nhất 24 giờ</em>
                  </span>
                </div>
              </div>
              <section className="panel">
                <h3>Bức tranh từng kỹ năng</h3>
                {skills.map((s, i) => {
                  const h = tested.filter((r) => r.skill === i);
                  return (
                    <div className="skill-row" key={s}>
                      <span>{s}</span>
                      <span>{ratio(h)}</span>
                      <small>
                        {
                          evidenceHistory.filter(
                            (r) => r.skill === i && r.method === "self",
                          ).length
                        }{" "}
                        tự đánh giá ·{" "}
                        {
                          evidenceHistory.filter(
                            (r) => r.skill === i && r.method === "ungraded",
                          ).length
                        }{" "}
                        chưa chấm
                      </small>
                    </div>
                  );
                })}
                <p className="fineprint">
                  Tự chọn “Nhớ rõ” khác với gõ đúng chưa xem đáp án. Đúng sau
                  khi vừa học là ghi nhớ tức thời.
                </p>
              </section>
              <section className="panel">
                <h3>Nên tập trung vào đâu?</h3>
                <select
                  aria-label="Nhóm bằng chứng"
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                >
                  {focusOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                {evidenceList.slice(0, evidenceLimit).map((e) => (
                  <div className="weak-row" key={e.word.id}>
                    <button
                      className="text-button"
                      onClick={() => openDetail(e.word.id)}
                    >
                      {displayWord(e.word)}
                    </button>
                    <span>
                      {e.goal === "recognition"
                        ? "Mục tiêu nhận biết"
                        : "Mục tiêu chủ động"}
                    </span>
                    <span>
                      {skills
                        .map(
                          (s, i) =>
                            `${s}: ${strength(state, e.word.id, i, learningEvidence)}`,
                        )
                        .join(" · ")}
                    </span>
                    <button
                      onClick={() =>
                        start(
                          false,
                          e.word.id,
                          focus === "listening"
                            ? 2
                            : focus === "writing"
                              ? 1
                              : (learningReport.words.find(
                                  (item) => item.id === e.word.id,
                                )?.weakSkills[0] ?? 1),
                        )
                      }
                    >
                      Luyện ngay
                    </button>
                  </div>
                ))}
                {evidenceList.length > evidenceLimit && (
                  <button onClick={() => setEvidenceLimit((n) => n + 100)}>
                    Xem thêm · {Math.min(evidenceLimit, evidenceList.length)}/
                    {evidenceList.length} mục
                  </button>
                )}
                {!evidenceList.length && (
                  <div className="empty-state">
                    Chưa đủ dữ liệu để kết luận. Bắt đầu một phiên học để lưu
                    bằng chứng đầu tiên.
                  </div>
                )}
              </section>
              <section className="panel">
                <h3>Câu của bạn để tự rà lại</h3>
                <div id="writing-review">
                  <label className="setting-row">
                    Từ để luyện viết
                    <select
                      aria-label="Từ để luyện viết"
                      value={reviewWordId || ""}
                      onChange={(e) =>
                        setWritingReview({ wordId: e.target.value })
                      }
                    >
                      {active
                        .filter((e) => canPractice(e.word, 5))
                        .map((e) => (
                          <option key={e.word.id} value={e.word.id}>
                            {displayWord(e.word)}
                          </option>
                        ))}
                    </select>
                  </label>
                  {reviewWordId && state.entries[reviewWordId] && (
                    <WritingFeedback
                      key={reviewWordId + (writingReview?.parentId || "review")}
                      state={state}
                      wordId={reviewWordId}
                      initialText={writingReview?.text || ""}
                      parentId={writingReview?.parentId}
                      onSave={saveWriting}
                    />
                  )}
                </div>
                <p className="fineprint">
                  Các câu dưới đây do bạn viết, chưa được chấm ngữ pháp hoặc xác
                  nhận cách dùng. Đọc lại và đối chiếu với nghĩa, cấu trúc của
                  mục từ.
                </p>
                {history
                  .filter(
                    (r) =>
                      r.skill === 5 &&
                      r.method === "ungraded" &&
                      r.answer?.trim(),
                  )
                  .slice(-30)
                  .reverse()
                  .map((r) => (
                    <article key={r.id}>
                      <button
                        className="text-button"
                        onClick={() => openDetail(r.wordId)}
                      >
                        {displayWord(state.entries[r.wordId]?.word) || r.wordId}
                      </button>
                      <p>{r.answer}</p>
                      <button
                        onClick={() => {
                          setWritingReview({
                            wordId: r.wordId,
                            text: r.answer,
                          });
                          requestAnimationFrame(() =>
                            document
                              .getElementById("writing-review")
                              ?.scrollIntoView({ block: "start" }),
                          );
                        }}
                      >
                        Kiểm tra cấu trúc / viết lại
                      </button>
                      <small>
                        {new Date(r.time).toLocaleString("vi-VN")} · Chưa chấm
                        {state.entries[r.wordId] &&
                        r.contentVersion !==
                          contentKey(state.entries[r.wordId].word, r.skill)
                          ? " · Câu viết theo nghĩa trước đây"
                          : ""}
                      </small>
                    </article>
                  ))}
                {!history.some((r) => r.skill === 5 && r.answer?.trim()) && (
                  <p>Chưa có câu đã lưu trong khoảng thời gian này.</p>
                )}
              </section>
              <section className="panel">
                <h3>Lượng ôn sắp tới</h3>
                <p className="fineprint">
                  Hôm nay gồm cả những lượt quá hạn chưa ôn. Mỗi lượt chỉ được
                  tính một lần.
                </p>
                {forecast.map((count, i) => {
                  const d = new Date(now);
                  d.setDate(d.getDate() + i);
                  return (
                    <div className="skill-row" key={i}>
                      <span>
                        {i === 0 ? "Hôm nay" : d.toLocaleDateString("vi-VN")}
                      </span>
                      <b>{count} lượt kỹ năng</b>
                    </div>
                  );
                })}
              </section>
              <details className="panel">
                <summary>Cách ứng dụng xác định “nhớ khá vững”</summary>
                <p>
                  Với từng kỹ năng: ít nhất 3 lần kiểm tra đúng, không gợi ý,
                  lần thử đầu ở 3 ngày địa phương khác nhau, chưa xem lại đáp án
                  hoặc luyện cùng từ trong ít nhất 24 giờ; ít nhất một lần sau 7
                  ngày không tiếp xúc với từ đã được ghi nhận. Đây là quy tắc
                  của ứng dụng, không phải chuẩn chứng nhận ngôn ngữ. Chỉ bằng
                  chứng có kiểm tra điều kiện độc lập của bản hiện tại được
                  dùng; lịch sử cũ vẫn được giữ. Tự đánh giá không đủ để kết
                  luận kỹ năng vững. Sau lần sai hoặc cần gợi ý, cần có lượt
                  kiểm tra đúng độc lập sau ít nhất 24 giờ kể từ lần đó trước
                  khi phục hồi trạng thái nhớ vững. Với bài tự viết lại mặt chữ,
                  việc vừa nhìn thấy cùng chữ ở nghĩa hoặc từ loại khác cũng làm
                  giảm bằng chứng truy hồi độc lập. Ôn trễ không đồng nghĩa với
                  quên.
                </p>
                <p>
                  Lịch riêng bắt đầu từ 1–3–7–14–30 ngày; sai quay về 1 ngày. Kỹ
                  năng có kiểm tra khách quan và đủ bằng chứng sau khoảng nghỉ
                  dài có thể giãn dần 60–90–180 ngày. Tự đánh giá vẫn tối đa 30
                  ngày. Lượt thử lại cùng lần ôn không kéo dài lịch. Mục tự đánh
                  dấu đã biết không có bằng chứng kiểm tra.
                </p>
              </details>
            </>
          )}
        </main>
        <footer className="app-footer">
          Jeongyeon. <span>Một góc nhỏ cho những bước tiến lớn.</span>
          <span>Riêng tư · Lưu tại máy · Đồng bộ tùy chọn</span>
        </footer>
      </div>
      {detail &&
        state.entries[detail] &&
        modal(
          <WordDetail
            entry={state.entries[detail]}
            state={state}
            speak={speak}
            onExposeWrittenForms={exposeForms}
            edit={() => {
              setEditor(serialize([state.entries[detail].word]));
              setDetail(undefined);
            }}
            change={(e) =>
              commit({
                ...state,
                entries: { ...state.entries, [detail]: e },
              }).catch(notifyError)
            }
          />,
          () => setDetail(undefined),
        )}
      {editor !== undefined &&
        modal(
          <>
            <h2>Biên tập mục từ</h2>
            <p>
              Giữ nguyên ID để giữ lịch sử. Đổi nghĩa hoặc đáp án sẽ đặt lại
              lịch ôn liên quan; nếu tạo nghĩa riêng, dùng ID mới.
            </p>
            <textarea
              className="editor"
              aria-label="Nội dung mục từ"
              value={editor}
              onChange={(e) => setEditor(e.target.value)}
            />
            <button
              className="primary"
              onClick={() => {
                try {
                  const words = parse(editor);
                  if (words.length !== 1)
                    throw Error("Chỉ chỉnh sửa một mục mỗi lần.");
                  const word = words[0];
                  const schedules = { ...state.schedules };
                  const old = state.entries[word.id];
                  if (old)
                    skills.forEach((_, skill) => {
                      if (
                        contentKey(old.word, skill) !== contentKey(word, skill)
                      )
                        delete schedules[`${word.id}:${skill}`];
                    });
                  commit({
                    ...state,
                    schedules,
                    entries: {
                      ...state.entries,
                      [word.id]: {
                        ...state.entries[word.id],
                        word,
                        origin: "personal",
                        archived: false,
                        archivedReason: undefined,
                      },
                    },
                  })
                    .then(() => {
                      setEditor(undefined);
                      setNotice(
                        "Đã lưu trên trình duyệt. Xuất .txt để sửa file trong repository.",
                      );
                    })
                    .catch(notifyError);
                } catch (e) {
                  notifyError(e);
                }
              }}
            >
              Lưu trên trình duyệt
            </button>
          </>,
          () => setEditor(undefined),
        )}
      {pending &&
        modal(
          <>
            <h2>Xem trước cập nhật kho</h2>
            <p>
              Nguồn:{" "}
              {pending.origin === "default"
                ? "Kho mặc định trong repository"
                : "File cá nhân"}
            </p>
            <div className="preview-counts">
              {Object.entries(diff(state, pending.words, pending.origin)).map(
                ([key, n]) => (
                  <div key={key}>
                    <strong>{n}</strong>
                    {
                      (
                        {
                          added: "Thêm mới",
                          changed: "Nội dung thay đổi",
                          archived: "Lưu trữ",
                          revived: "Khôi phục từ nguồn",
                        } as Record<string, string>
                      )[key]
                    }
                  </div>
                ),
              )}
            </div>
            <p>
              Không xóa lịch sử. Chỉ lưu trữ mục biến mất khỏi cùng nguồn. File
              cá nhân giữ ưu tiên khi cập nhật mặc định; trùng ID với file cá
              nhân sẽ được bỏ qua.
            </p>
            <div className="preview-list">
              {pending.words.slice(0, 60).map((w) => (
                <p key={w.id}>
                  {displayWord(w)} — {w.meaning_vi}
                </p>
              ))}
            </div>
            {pending.words.length > 60 && (
              <p className="fineprint">
                Xem trước 60/{pending.words.length.toLocaleString("vi-VN")} mục.
                Xác nhận sẽ áp dụng đầy đủ các mục hợp lệ trong file.
              </p>
            )}
            <button
              className="primary"
              onClick={() =>
                commit({
                  ...merge(state, pending.words, pending.origin),
                  sourceVersion:
                    pending.origin === "default"
                      ? pending.version
                      : state.sourceVersion,
                })
                  .then(() => {
                    setPending(undefined);
                    if (pending.origin === "default")
                      setAvailableWords(undefined);
                    setNotice(
                      "Đã cập nhật kho từ, giữ nguyên tiến độ theo ID.",
                    );
                  })
                  .catch(notifyError)
              }
            >
              Xác nhận cập nhật
            </button>
          </>,
          () => setPending(undefined),
        )}
      <div hidden={!settings}>
        {modal(
          <>
            <h2>Góc học của bạn</h2>
            <p className="fineprint" aria-live="polite">
              {import.meta.env.PROD
                ? offlineStatus.message
                : "Bản phát triển lưu dữ liệu tại máy; tải lại ngoại tuyến được bật và kiểm tra trong bản build production."}
            </p>
            <label className="setting-row">
              Từ mới / ngày
              <input
                type="number"
                min={1}
                max={30}
                step={1}
                value={state.daily}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n))
                    commit({
                      ...state,
                      daily: Math.min(30, Math.max(1, Math.round(n))),
                    }).catch(notifyError);
                }}
              />
            </label>
            <label className="setting-row">
              Mức ưu tiên từ mới
              <select
                aria-label="Mức ưu tiên từ mới"
                value={state.learningFloor || "all"}
                onChange={(e) =>
                  commit({
                    ...state,
                    learningFloor: e.target.value as State["learningFloor"],
                  }).catch(notifyError)
                }
              >
                <option value="all">Tất cả trình độ</option>
                <option value="A2">Từ A2 trở lên</option>
                <option value="B1">Từ B1 trở lên</option>
                <option value="B2">Từ B2 trở lên</option>
                <option value="C1">Từ C1 trở lên</option>
              </select>
            </label>
            <fieldset className="study-preferences">
              <legend>Kỹ năng ưu tiên ở phiên mới</legend>
              {skills.map((label, index) => {
                const selected = state.studySkills || [0, 1, 2, 3, 4, 5];
                return (
                  <label key={label}>
                    <input
                      type="checkbox"
                      checked={selected.includes(index)}
                      disabled={
                        selected.length === 1 && selected.includes(index)
                      }
                      onChange={(e) =>
                        commit({
                          ...state,
                          studySkills: e.target.checked
                            ? [...selected, index].sort((a, b) => a - b)
                            : selected.filter((skill) => skill !== index),
                        }).catch(notifyError)
                      }
                    />
                    {label}
                  </label>
                );
              })}
            </fieldset>
            <p className="fineprint">
              Chọn mức phù hợp nếu bạn đã có nền tảng. Mục chưa có CEFR vẫn được
              xét và ghi rõ thiếu dữ liệu. Các lựa chọn áp dụng cho từ mới và kỹ
              năng chưa bắt đầu ở phiên mới; mọi lượt đến hạn vẫn được giữ.
              Phiên đang học và lịch sử không thay đổi.
            </p>
            <label className="setting-row">
              Giọng đọc ưu tiên
              <select
                value={state.voice}
                onChange={(e) =>
                  commit({ ...state, voice: e.target.value }).catch(notifyError)
                }
              >
                <option value="en-US">Anh–Mỹ</option>
                <option value="en-GB">Anh–Anh</option>
              </select>
            </label>
            <p className="fineprint">
              Giọng ưu tiên cũng chọn cách viết Anh–Mỹ đã đối chiếu nếu có. Cài
              đặt đã lưu được giữ nguyên; âm thanh URL và câu ví dụ theo dữ liệu
              của mục từ.
            </p>
            <label className="setting-row">
              Tốc độ đọc
              <select
                value={state.rate}
                onChange={(e) =>
                  commit({ ...state, rate: Number(e.target.value) }).catch(
                    notifyError,
                  )
                }
              >
                <option value={0.65}>Chậm · 0.65×</option>
                <option value={0.85}>Vừa · 0.85×</option>
                <option value={1}>Tự nhiên · 1×</option>
              </select>
            </label>
            <button onClick={() => speak("Ready to learn")}>
              Nghe thử giọng tổng hợp
            </button>
            <hr />
            <h3>Sao lưu dữ liệu</h3>
            <p>
              IndexedDB lưu trên trình duyệt này. Đồng bộ chỉ hoạt động sau khi
              cấu hình và liên kết tài khoản bên dưới. JSON luôn là bản sao dự
              phòng, không chứa thông tin đăng nhập.
            </p>
            <div className="file-actions">
              <button
                onClick={async () => {
                  try {
                    await flushWritingDrafts();
                    clearTimeout(draftTimer.current);
                    await persistDraft();
                    const latest = await read();
                    download(
                      "jeongyeon-backup.json",
                      JSON.stringify(latest, null, 2),
                      "application/json",
                    );
                  } catch (error) {
                    notifyError(error);
                  }
                }}
              >
                <Download size={16} /> Sao lưu toàn bộ JSON
              </button>
              <label className="button">
                <Upload size={16} /> Khôi phục JSON
                <input
                  type="file"
                  accept=".json,application/json"
                  hidden
                  onChange={(e) => file(e, true)}
                />
              </label>
            </div>
            <p className="fineprint">
              JSON chứa kho từ, phiên học, lịch ôn và lịch sử. File .txt chỉ
              chứa nội dung học.
            </p>
            <SyncSettings
              state={state}
              onMerge={async (incoming, expectedBase) => {
                const base = current.current;
                const before = expectedBase || base;
                const next = rebaseState(
                  before,
                  {
                    ...incoming,
                    session: before.session,
                    pausedScheduled: before.pausedScheduled,
                    sourceVersion: before.sourceVersion,
                  },
                  base,
                );
                validateBackup(next);
                await commit(next, undefined, base);
              }}
            />
          </>,
          () => setSettings(false),
        )}
      </div>
      {backup &&
        modal(
          <>
            <h2>Khôi phục bản sao lưu</h2>
            <p>
              {Object.keys(backup.entries).length} mục từ ·{" "}
              {backup.history.length} lượt lịch sử ·{" "}
              {Object.keys(backup.schedules).length} lịch kỹ năng
            </p>
            <label className="setting-row">
              Cách khôi phục
              <select
                value={replace ? "replace" : "merge"}
                onChange={(e) => setReplace(e.target.value === "replace")}
              >
                <option value="merge">Hợp nhất (giữ dữ liệu hiện tại)</option>
                <option value="replace">Thay thế toàn bộ</option>
              </select>
            </label>
            <p>
              {replace
                ? "Cảnh báo: toàn bộ dữ liệu hiện tại sẽ được thay thế. Hãy xuất JSON trước."
                : "Mục trùng ID và lịch ôn dùng bản hiện tại; lịch sử hợp nhất theo ID lượt, không cộng trùng. Phiên hiện tại được giữ."}
            </p>
            <button
              className="primary"
              onClick={async () => {
                try {
                  if (replace && !confirm("Thay thế toàn bộ dữ liệu hiện tại?"))
                    return;
                  await flushWritingDrafts();
                  clearTimeout(draftTimer.current);
                  await persistDraft();
                  const state = await read();
                  if (replace) clearSyncBinding();
                  const combined = replace
                    ? backup
                    : {
                        ...state,
                        entries: { ...backup.entries, ...state.entries },
                        schedules: mergeBackupSchedules(state, backup),
                        exposureEvents: mergeExposureEvents(
                          exposureEventsForSnapshot(state),
                          exposureEventsForSnapshot(backup),
                        ),
                        writingDrafts: {
                          ...backup.writingDrafts,
                          ...state.writingDrafts,
                        },
                        exposures: Object.fromEntries(
                          [
                            ...new Set([
                              ...Object.keys(backup.exposures || {}),
                              ...Object.keys(state.exposures || {}),
                            ]),
                          ].map((id) => [
                            id,
                            Math.max(
                              backup.exposures?.[id] || 0,
                              state.exposures?.[id] || 0,
                            ),
                          ]),
                        ),
                        history: [
                          ...new Map(
                            [...backup.history, ...state.history].map((h) => [
                              h.id,
                              h,
                            ]),
                          ).values(),
                        ].sort((a, b) => a.time - b.time),
                        writing: [
                          ...new Map(
                            [
                              ...(backup.writing || []),
                              ...(state.writing || []),
                            ].map((a) => [a.id, a]),
                          ).values(),
                        ].sort((a, b) => a.time - b.time),
                        conversations: [
                          ...new Map(
                            [
                              ...(backup.conversations || []),
                              ...(state.conversations || []),
                            ].map((a) => [a.id, a]),
                          ).values(),
                        ].sort((a, b) => a.time - b.time),
                      };
                  await commit(combined, { replace }, state);
                  setBackup(undefined);
                  if (replace) {
                    setPage("today");
                    answerDraft.current = undefined;
                    storeBrowserDraft();
                  }
                  setNotice("Đã khôi phục dữ liệu.");
                } catch (error) {
                  notifyError(error);
                }
              }}
            >
              Xác nhận {replace ? "thay thế" : "hợp nhất"}
            </button>
          </>,
          () => setBackup(undefined),
        )}
    </div>
  );
}
registerOffline();
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
