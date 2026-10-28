import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Headphones, Pause, Play, Square, Volume2 } from "lucide-react";
import type { State } from "./core";
import type { ConversationAttempt } from "./practice-data";
import { selectEnglishVoice } from "./american-english";
import { formatPartOfSpeech, partOfSpeechCaption } from "./part-of-speech";
import {
  availableDialogues,
  dialogues,
  makeConversationAttempt,
  recommendDialogues,
  type Dialogue,
} from "./conversations";
import "./conversation-practice.css";

export type ConversationPracticeProps = {
  state: State;
  onSave: (attempt: ConversationAttempt) => Promise<void>;
  onExpose: (ids: string[]) => void;
  onClose?: () => void;
  targetIds?: readonly string[];
};
type Draft = {
  version: string;
  mode: "read" | "listen";
  transcriptRevealed: boolean;
  values: Record<string, string>;
  translation: boolean;
  lines: string[];
  complete: boolean;
  retryOf?: string;
  savedId?: string;
  recall: boolean;
  usedHint: boolean;
};
type DraftBank = { selected?: string; drafts: Record<string, Draft> };
const draftKey = "jeongyeon:conversation-drafts:v1";
function readDrafts(): { bank: DraftBank; warning: string } {
  try {
    const raw =
      localStorage.getItem(draftKey) || sessionStorage.getItem(draftKey);
    if (!raw) return { bank: { drafts: {} }, warning: "" };
    const data = JSON.parse(raw) as DraftBank;
    if (
      !data ||
      typeof data !== "object" ||
      !data.drafts ||
      typeof data.drafts !== "object"
    )
      throw Error();
    const drafts: Record<string, Draft> = {};
    for (const d of dialogues) {
      const item = data.drafts[d.id];
      if (
        !item ||
        item.version !== d.version ||
        !item.values ||
        typeof item.values !== "object"
      )
        continue;
      const values: Record<string, string> = {};
      for (const id of [...d.questions.map((q) => q.id), "reply"])
        if (typeof item.values[id] === "string")
          values[id] = item.values[id].slice(0, 6000);
      const lines = Array.isArray(item.lines)
        ? [
            ...new Set(
              item.lines.filter(
                (id) =>
                  typeof id === "string" &&
                  /^line-\d+$/.test(id) &&
                  Number(id.slice(5)) < d.lines.length,
              ),
            ),
          ]
        : [];
      drafts[d.id] = {
        version: d.version,
        mode: item.mode === "listen" ? "listen" : "read",
        transcriptRevealed:
          item.mode === "listen" ? item.transcriptRevealed === true : true,
        values,
        translation: item.translation === true,
        lines,
        complete:
          item.complete === true &&
          (item.mode !== "listen" ||
            d.lines.every((_, index) => lines.includes(`line-${index}`))),
        retryOf: typeof item.retryOf === "string" ? item.retryOf : undefined,
        savedId: typeof item.savedId === "string" ? item.savedId : undefined,
        recall: item.recall === true,
        usedHint: item.usedHint === true,
      };
    }
    return {
      bank: {
        selected: typeof data.selected === "string" ? data.selected : undefined,
        drafts,
      },
      warning: "",
    };
  } catch {
    return {
      bank: { drafts: {} },
      warning:
        "Trình duyệt không đọc được nháp hội thoại. Kết quả đã lưu vẫn nằm trong tiến độ; nháp mới chỉ được giữ khi trang đang mở.",
    };
  }
}
const blankDraft = (d: Dialogue): Draft => ({
  version: d.version,
  mode: d.id.startsWith("listen-") ? "listen" : "read",
  transcriptRevealed: !d.id.startsWith("listen-"),
  values: {},
  translation: false,
  lines: [],
  complete: false,
  recall: false,
  usedHint: false,
});
function highlight(text: string, d: Dialogue): ReactNode[] {
  const escaped = d.targets
    .map((t) => t.lemma.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");
  const result: ReactNode[] = [];
  let start = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index!;
    result.push(text.slice(start, index));
    result.push(<mark key={index}>{match[0]}</mark>);
    start = index + match[0].length;
  }
  result.push(text.slice(start));
  return result;
}

/** Preserve one configured accent for both speakers. A missing second voice
 * is not a reason to switch the second speaker to a different regional accent. */
export function selectConversationVoices<
  T extends { lang: string; voiceURI?: string },
>(voices: T[], preferred: string): [T, T] | undefined {
  const first = selectEnglishVoice(voices, preferred);
  if (!first) return undefined;
  const locale = (value: string) => value.replace(/_/g, "-").toLowerCase();
  const second =
    voices.find(
      (voice) =>
        voice !== first &&
        (!voice.voiceURI ||
          !first.voiceURI ||
          voice.voiceURI !== first.voiceURI) &&
        locale(voice.lang) === locale(first.lang),
    ) || first;
  return [first, second];
}

export function ConversationPractice({
  state,
  onSave,
  onExpose,
  onClose,
  targetIds = [],
}: ConversationPracticeProps) {
  const [initial] = useState(readDrafts);
  const bank = useRef(initial.bank);
  const available = useMemo(() => availableDialogues(state), [state]);
  const [level, setLevel] = useState("");
  const [length, setLength] = useState("");
  const [weakOnly, setWeakOnly] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");
  const [rate, setRate] = useState(state.rate);
  const [spokenLine, setSpokenLine] = useState<number>();
  const requestedIds = showAll ? undefined : targetIds;
  const recommendations = useMemo(
    () =>
      recommendDialogues(state, {
        level,
        length,
        weakOnly,
        targetIds: requestedIds,
      }).filter(({ dialogue }) => {
        const fold = (text: string) =>
          text
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[đĐ]/g, "d")
            .toLowerCase();
        return fold(
          [
            dialogue.title,
            ...dialogue.targets.map((target) => target.lemma),
          ].join(" "),
        ).includes(fold(query.trim()));
      }),
    [state, level, length, weakOnly, requestedIds, query],
  );
  const [selected, setSelected] = useState(() =>
    targetIds.length
      ? recommendations[0]?.dialogue.id || ""
      : available.some((d) => d.id === initial.bank.selected)
        ? initial.bank.selected!
        : recommendations[0]?.dialogue.id || "",
  );
  const d = available.find((item) => item.id === selected);
  const britishTerms = d
    ? ["railway", "revision", "neighbour"].filter((term) =>
        d.lines.some((line) => new RegExp(`\\b${term}\\b`, "i").test(line.en)),
      )
    : [];
  const usesPounds = !!d?.lines.some((line) => /\bpounds?\b/i.test(line.en));
  const [draft, setDraft] = useState<Draft>(() =>
    d
      ? bank.current.drafts[d.id] || blankDraft(d)
      : {
          version: "",
          mode: "read",
          transcriptRevealed: true,
          values: {},
          translation: false,
          lines: [],
          complete: false,
          recall: false,
          usedHint: false,
        },
  );
  const [warning, setWarning] = useState(initial.warning);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingAttempt, setPendingAttempt] = useState<ConversationAttempt>();
  const [playing, setPlaying] = useState<string>();
  const [paused, setPaused] = useState(false);
  const [audioStatus, setAudioStatus] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const playback = useRef(0);
  const rejectPlayback = useRef<(() => void) | undefined>(undefined);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const exposed = useRef("");
  const saveBusy = useRef(false);
  const report = state.conversations?.find((a) => a.id === draft.savedId);
  const transcriptHidden =
    draft.mode === "listen" ? !draft.transcriptRevealed : draft.recall;
  const needsListening = draft.mode === "listen" && !draft.complete;
  const allRecommendation = useMemo(
    () =>
      recommendDialogues(state, { targetIds: requestedIds }).find(
        (r) => r.dialogue.id === selected,
      ),
    [state, selected, requestedIds],
  );
  const speakerVoices = useMemo(
    () => selectConversationVoices(voices, state.voice),
    [voices, state.voice],
  );
  const actualVoice = speakerVoices?.[0];
  const usingVoiceFallback =
    !!actualVoice &&
    actualVoice.lang.replace(/_/g, "-").toLowerCase() !==
      state.voice.toLowerCase();

  function persist(next: Draft, current = d) {
    if (!current) return;
    bank.current = {
      selected: current.id,
      drafts: { ...bank.current.drafts, [current.id]: next },
    };
    try {
      localStorage.setItem(draftKey, JSON.stringify(bank.current));
      // Preserve same-tab migration/fallback for older app versions.
      sessionStorage.setItem(draftKey, JSON.stringify(bank.current));
    } catch {
      setWarning(
        "Chưa lưu được đầy đủ nháp trên trình duyệt này. Giữ trang mở cho đến khi bấm Lưu và xem phản hồi; kết quả chỉ an toàn sau khi lưu thành công.",
      );
    }
  }
  function updateDraft(next: Draft) {
    draftRef.current = next;
    setDraft(next);
    persist(next);
    setPendingAttempt(undefined);
  }
  function stopAudio() {
    playback.current++;
    rejectPlayback.current?.();
    rejectPlayback.current = undefined;
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    setPlaying(undefined);
    setSpokenLine(undefined);
    setPaused(false);
  }
  function choose(nextId: string) {
    const next = available.find((item) => item.id === nextId);
    if (!next || saveBusy.current) return;
    persist(draft);
    stopAudio();
    setAudioStatus("");
    setError("");
    setPendingAttempt(undefined);
    setSelected(next.id);
    const savedDraft = bank.current.drafts[next.id] || blankDraft(next);
    setDraft(savedDraft);
    persist(savedDraft, next);
  }

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const load = () => setVoices(speechSynthesis.getVoices());
    load();
    speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      playback.current++;
      rejectPlayback.current?.();
      speechSynthesis.cancel();
      speechSynthesis.removeEventListener("voiceschanged", load);
    };
  }, []);
  useEffect(() => {
    if (!d || transcriptHidden || exposed.current === d.version) return;
    exposed.current = d.version;
    onExpose(d.targets.map((t) => t.id));
  }, [d, transcriptHidden, onExpose]);
  useEffect(() => {
    if (d) persist(draft);
  }, [draft, selected]);

  async function play(indices: number[]) {
    if (!d || !indices.length) return;
    stopAudio();
    if (!("speechSynthesis" in window) || !speakerVoices) {
      setAudioStatus(
        "Thiết bị chưa có giọng đọc tiếng Anh khả dụng. Bạn vẫn đọc và làm bài được; chưa ghi nhận đã nghe.",
      );
      return;
    }
    if (draftRef.current.mode === "read" && draftRef.current.recall) {
      updateDraft({ ...draftRef.current, usedHint: true });
      onExpose(d.targets.map((t) => t.id));
    }
    const token = playback.current;
    const dialogueAtStart = d;
    const [voice, otherVoice] = speakerVoices;
    const speakers = [...new Set(d.lines.map((l) => l.speaker))];
    setPlaying(
      indices.length === d.lines.length ? "all" : `line-${indices[0]}`,
    );
    setAudioStatus(
      "Đang phát giọng tổng hợp của thiết bị; cần nghe hết mới ghi nhận hoàn tất.",
    );
    try {
      const completed: string[] = [];
      for (const index of indices) {
        if (token !== playback.current) return;
        setSpokenLine(index);
        await new Promise<void>((resolve, reject) => {
          rejectPlayback.current = () => reject(Error("cancelled"));
          const utterance = new SpeechSynthesisUtterance(
            dialogueAtStart.lines[index].en,
          );
          utterance.voice =
            speakers.indexOf(dialogueAtStart.lines[index].speaker) % 2
              ? otherVoice
              : voice;
          utterance.lang = utterance.voice.lang;
          utterance.rate = rate;
          utterance.onend = () => {
            if (token === playback.current) rejectPlayback.current = undefined;
            resolve();
          };
          utterance.onerror = (event) => {
            if (token === playback.current) rejectPlayback.current = undefined;
            reject(
              Error(
                event.error === "canceled" || event.error === "interrupted"
                  ? "cancelled"
                  : "Không phát được âm thanh. Hãy kiểm tra giọng tiếng Anh và kết nối của thiết bị.",
              ),
            );
          };
          speechSynthesis.speak(utterance);
        });
        if (token !== playback.current) return;
        completed.push(`line-${index}`);
        if (draftRef.current.mode === "listen") {
          const heardText = dialogueAtStart.lines[index].en.toLowerCase();
          const heardIds = dialogueAtStart.targets
            .filter((target) => heardText.includes(target.lemma.toLowerCase()))
            .map((target) => target.id);
          if (heardIds.length) onExpose(heardIds);
        }
        const next = {
          ...draftRef.current,
          lines: [...new Set([...draftRef.current.lines, `line-${index}`])],
        };
        draftRef.current = next;
        setDraft(next);
        persist(next, dialogueAtStart);
      }
      if (token !== playback.current) return;
      const next = {
        ...draftRef.current,
        lines: [...new Set([...draftRef.current.lines, ...completed])],
        complete:
          draftRef.current.complete ||
          indices.length === dialogueAtStart.lines.length,
      };
      draftRef.current = next;
      setDraft(next);
      persist(next, dialogueAtStart);
      setAudioStatus(
        indices.length === d.lines.length
          ? "Đã nghe hết đoạn hội thoại. Đây là lượt nghe, không phải bằng chứng trả lời đúng."
          : "Đã phát hết câu đã chọn.",
      );
    } catch (e) {
      if (token === playback.current)
        setAudioStatus(
          e instanceof Error && e.message !== "cancelled"
            ? e.message
            : "Đã dừng nghe; chưa ghi nhận hoàn tất.",
        );
    } finally {
      if (token === playback.current) {
        setPlaying(undefined);
        setSpokenLine(undefined);
        setPaused(false);
      }
    }
  }

  async function submit() {
    if (!d || saveBusy.current || report) return;
    if (needsListening) {
      setError(
        "Hãy nghe hết đoạn trước khi lưu bài nghe. Nếu âm thanh không hoạt động, bạn có thể chuyển sang Đọc và đối chiếu.",
      );
      return;
    }
    if (d.questions.some((q) => !draft.values[q.id]?.trim())) {
      setError(
        `Hãy trả lời đủ ${d.questions.length} câu hỏi có đáp án trước khi lưu. Câu trả lời mở không bắt buộc.`,
      );
      return;
    }
    saveBusy.current = true;
    setSaving(true);
    setError("");
    const attempt =
      pendingAttempt ||
      makeConversationAttempt(
        state,
        d,
        draft.values,
        {
          lines: draft.lines,
          complete: draft.complete,
          hidden: transcriptHidden,
          usedHint: draft.usedHint,
          mode: draft.mode,
          transcriptRevealed: draft.transcriptRevealed,
        },
        draft.retryOf,
      );
    setPendingAttempt(attempt);
    try {
      await onSave(attempt);
      const next = { ...draft, savedId: attempt.id };
      setDraft(next);
      persist(next);
      setPendingAttempt(undefined);
    } catch (e) {
      setError(
        `Chưa lưu được kết quả. Câu trả lời vẫn được giữ để thử lại. ${e instanceof Error ? e.message : ""}`,
      );
    } finally {
      saveBusy.current = false;
      setSaving(false);
    }
  }
  function retry(onlyWrong: boolean) {
    if (!d || !report) return;
    const values = onlyWrong
      ? Object.fromEntries(
          Object.entries(draft.values).filter(
            ([id]) =>
              report.answers.find((a) => a.questionId === id)?.correct === true,
          ),
        )
      : {};
    updateDraft({
      ...draft,
      values,
      savedId: undefined,
      retryOf: report.id,
      usedHint: true,
      ...(draft.mode === "listen" ? { complete: false, lines: [] } : {}),
    });
    setError("");
  }

  return (
    <section
      className="panel conversation-practice"
      aria-label="Hội thoại thực tế"
    >
      <div className="section-heading">
        <h2>Hội thoại thực tế</h2>
        {onClose && (
          <button
            onClick={() => {
              persist(draft);
              stopAudio();
              onClose();
            }}
            disabled={saving}
          >
            Đóng
          </button>
        )}
      </div>
      <p className="conversation-intro">
        {dialogues.length} bài hội thoại do Jeongyeon biên soạn, gồm nghe trước
        khi xem lời và đọc đối chiếu. Giọng đọc tổng hợp của thiết bị, không
        phải bản thu của nhà xuất bản. Nội dung dùng được sau khi tải; một số
        giọng đọc cần mạng. Kết quả được lưu riêng, không tự đổi lịch ôn hoặc
        xác nhận nhớ vững.
      </p>
      {warning && (
        <p className="notice" role="status">
          {warning}
        </p>
      )}
      {!!requestedIds?.length && (
        <p className="conversation-note" role="status">
          Đang ưu tiên đoạn có từ được đề xuất:{" "}
          {draft.mode === "listen"
            ? `${requestedIds.length} từ đang học (ẩn chữ trong chế độ nghe)`
            : requestedIds
                .filter(
                  (id) => state.entries[id] && !state.entries[id].archived,
                )
                .map((id) => state.entries[id].word.word)
                .join(", ")}
          . Danh sách chỉ gồm bài có ít nhất một từ trong nhóm này.{" "}
          <button onClick={() => setShowAll(true)}>Xem mọi hội thoại</button>
        </p>
      )}
      <div className="conversation-filters">
        <label>
          Mức độ
          <select
            aria-label="Mức độ hội thoại"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            <option value="">B1, B2 và C1</option>
            <option value="B1">B1 · trao đổi trực tiếp</option>
            <option value="B2">B2 · giải thích, cân nhắc</option>
            <option value="C1">C1 · lập luận, sắc thái</option>
          </select>
        </label>
        <label>
          Độ dài
          <select
            aria-label="Độ dài hội thoại"
            value={length}
            onChange={(e) => setLength(e.target.value)}
          >
            <option value="">Mọi độ dài</option>
            <option value="short">Ngắn · tối đa 6 lượt lời</option>
            <option value="long">Dài · 8–12 lượt lời</option>
          </select>
        </label>
        <label className="conversation-check">
          <input
            type="checkbox"
            checked={weakOnly}
            onChange={(e) => setWeakOnly(e.target.checked)}
          />
          Ưu tiên bài có từ trả lời sai
        </label>
      </div>
      <label className="conversation-search">
        Tìm bài nghe hoặc từ muốn luyện
        <input
          type="search"
          aria-label="Tìm bài nghe"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ví dụ: cong viec, research…"
        />
      </label>
      <p className="conversation-note">
        {recommendations.length}/{available.length} bài phù hợp · B1–C1 là mức
        độ gợi ý do Jeongyeon biên soạn theo ngôn ngữ và từ mục tiêu, không phải
        chứng nhận độ khó của nhà xuất bản hoặc band IELTS.
      </p>
      <label className="conversation-picker">
        Chọn đoạn được đề xuất
        <select
          aria-label="Chọn hội thoại"
          value={
            recommendations.some((r) => r.dialogue.id === selected)
              ? selected
              : ""
          }
          disabled={saving || !recommendations.length}
          onChange={(e) => choose(e.target.value)}
        >
          {!recommendations.some((r) => r.dialogue.id === selected) && (
            <option value="">
              {recommendations.length
                ? "Chọn bài phù hợp bộ lọc"
                : "Chưa có bài phù hợp bộ lọc"}
            </option>
          )}
          {recommendations.map((r) => (
            <option key={r.dialogue.id} value={r.dialogue.id}>
              {r.dialogue.title} · {r.studied}/{r.dialogue.targets.length} từ đã
              chọn học/luyện{r.weak ? ` · ${r.weak} từ cần củng cố` : ""}
            </option>
          ))}
        </select>
      </label>
      {!recommendations.length && (
        <p className="conversation-note">
          Chưa có đoạn phù hợp bộ lọc và các nghĩa từ đang dùng. Hãy bỏ bớt bộ
          lọc. Chỉ nhận các mục còn hoạt động, đã đủ điều kiện học và cùng nghĩa
          với bản biên soạn.
        </p>
      )}
      {!d ? (
        <p className="notice">
          {available.length
            ? "Đoạn trước không còn phù hợp sau khi kho từ thay đổi. Chọn một đoạn khác; nháp cũ vẫn được giữ trên trình duyệt này."
            : "Kho hiện tại chưa có đủ nhóm từ đã rà tương ứng với các đoạn hội thoại. Bạn vẫn có thể dùng các bài luyện từ cũ."}
        </p>
      ) : (
        <>
          <div className="conversation-title">
            <h3>{d.title}</h3>
            <span>
              {d.level} · {d.lines.length} lượt lời · {d.targets.length} từ
            </span>
          </div>
          <p className="conversation-reason">{allRecommendation?.reason}</p>
          {(britishTerms.length > 0 || usesPounds) && (
            <p className="conversation-note">
              {usesPounds && "Tình huống này dùng bảng Anh (pounds). "}
              {britishTerms.length > 0 && (
                <>
                  Bản gốc có cách viết/cách dùng Anh–Anh:{" "}
                  <span lang="en">{britishTerms.join(", ")}</span>.{" "}
                </>
              )}
              Giọng đọc Mỹ không tự đổi nội dung gốc; hãy đối chiếu ghi chú của
              từng từ.
            </p>
          )}
          <label className="conversation-mode">
            Cách luyện
            <select
              aria-label="Cách luyện hội thoại"
              value={draft.mode}
              disabled={saving || !!report || !!playing}
              onChange={(event) => {
                stopAudio();
                const mode = event.target.value as "read" | "listen";
                updateDraft({
                  ...draft,
                  mode,
                  recall: false,
                  transcriptRevealed: mode === "read",
                  usedHint:
                    draft.usedHint ||
                    draft.mode === "read" ||
                    Object.values(draft.values).some((value) => !!value.trim()),
                  ...(mode === "listen" ? { complete: false, lines: [] } : {}),
                });
              }}
            >
              <option value="listen">Nghe trước · ẩn lời và nghĩa từ</option>
              <option value="read">Đọc và đối chiếu</option>
            </select>
          </label>
          <div className="conversation-audio">
            {draft.mode === "listen" ? (
              !draft.transcriptRevealed ? (
                <button
                  disabled={saving}
                  onClick={() => {
                    exposed.current = d.version;
                    updateDraft({
                      ...draft,
                      transcriptRevealed: true,
                      usedHint: true,
                    });
                    onExpose(d.targets.map((target) => target.id));
                  }}
                >
                  Mở lời và nghĩa từ · tính là gợi ý
                </button>
              ) : (
                <span className="conversation-note">
                  Đã mở lời hoặc nghĩa từ trong lượt này; kết quả được ghi có hỗ
                  trợ.
                </span>
              )
            ) : !draft.recall ? (
              <button
                disabled={saving || !!report}
                onClick={() => {
                  stopAudio();
                  updateDraft({
                    ...draft,
                    recall: true,
                    translation: false,
                    usedHint:
                      draft.usedHint ||
                      Object.values(draft.values).some(
                        (value) => value.trim().length > 0,
                      ),
                  });
                }}
              >
                Ẩn đoạn để tự thử nhớ
              </button>
            ) : (
              <button
                disabled={saving}
                onClick={() => {
                  updateDraft({ ...draft, recall: false, usedHint: true });
                  onExpose(d.targets.map((target) => target.id));
                }}
              >
                Xem lại đoạn · tính là gợi ý
              </button>
            )}
          </div>
          {transcriptHidden && (
            <p className="conversation-note" role="status">
              {draft.mode === "listen"
                ? "Đang ẩn lời và nghĩa từ. Nghe toàn bộ để mở câu hỏi; có thể nghe lại hoặc từng câu. Mở văn bản sẽ được ghi là có gợi ý."
                : "Đang ẩn đoạn và phần giải nghĩa. Mở lại đoạn hoặc nghe lại sẽ được ghi là có gợi ý. Đây vẫn là luyện ngay sau đọc/nghe, chưa phải bằng chứng nhớ lâu."}
            </p>
          )}
          {!recommendations.some((r) => r.dialogue.id === selected) && (
            <p className="conversation-note">
              Đang giữ bài và câu trả lời hiện tại. Chọn bài trong danh sách để
              áp dụng bộ lọc mới; nháp mỗi bài được giữ riêng.
            </p>
          )}
          <div className="conversation-audio">
            <button
              onClick={() => play(d.lines.map((_, i) => i))}
              disabled={!!playing}
            >
              <Headphones size={16} />
              Nghe toàn bộ
            </button>
            {playing && (
              <>
                <button
                  onClick={() => {
                    if (paused) speechSynthesis.resume();
                    else speechSynthesis.pause();
                    setPaused(!paused);
                  }}
                >
                  {paused ? <Play size={16} /> : <Pause size={16} />}
                  {paused ? "Tiếp tục nghe" : "Tạm dừng"}
                </button>
                <button
                  onClick={() => {
                    stopAudio();
                    setAudioStatus(
                      "Đã dừng nghe; lượt phát bị dừng không được ghi là nghe hết.",
                    );
                  }}
                >
                  <Square size={15} />
                  Dừng
                </button>
              </>
            )}
            <label className="conversation-check">
              <input
                type="checkbox"
                disabled={transcriptHidden}
                checked={draft.translation}
                onChange={(e) =>
                  updateDraft({ ...draft, translation: e.target.checked })
                }
              />
              Bản dịch tiếng Việt
            </label>
          </div>
          <label className="conversation-speed">
            Tốc độ nghe
            <select
              aria-label="Tốc độ nghe hội thoại"
              value={rate}
              disabled={!!playing}
              onChange={(event) => setRate(Number(event.target.value))}
            >
              {[0.65, 0.75, 0.85, 1, 1.1].map((value) => (
                <option key={value} value={value}>
                  {value}×
                </option>
              ))}
              {![0.65, 0.75, 0.85, 1, 1.1].includes(rate) && (
                <option value={rate}>{rate}×</option>
              )}
            </select>
          </label>
          {spokenLine !== undefined && (
            <p className="conversation-note" role="status">
              Đang nghe câu {spokenLine + 1}/{d.lines.length} ·{" "}
              {d.lines[spokenLine]?.speaker}
            </p>
          )}
          {transcriptHidden && (
            <div
              className="conversation-sentence-audio"
              aria-label="Nghe từng câu khi ẩn lời"
            >
              {d.lines.map((line, index) => (
                <button
                  key={index}
                  disabled={!!playing}
                  onClick={() => play([index])}
                >
                  Nghe câu {index + 1} · {line.speaker}
                </button>
              ))}
            </div>
          )}
          <p
            className="conversation-note"
            data-testid="conversation-voice-status"
          >
            {actualVoice ? (
              <>
                Giọng tổng hợp đang dùng: {actualVoice.lang}, tốc độ {rate}.{" "}
                {usingVoiceFallback && (
                  <>
                    Thiết bị chưa có giọng {state.voice}; đang dùng giọng tiếng
                    Anh thay thế {actualVoice.lang}.{" "}
                  </>
                )}
                {speakerVoices?.[0] === speakerVoices?.[1]
                  ? "Hai nhân vật dùng chung một giọng để giữ cùng vùng phát âm. "
                  : "Hai nhân vật dùng hai giọng cùng vùng phát âm. "}
              </>
            ) : (
              <>
                Chưa có giọng tiếng Anh khả dụng trên thiết bị; cài đặt mong
                muốn {state.voice}.{" "}
              </>
            )}
            Không phải bản thu của người bản ngữ. Một số giọng cần Internet.
            Lịch sử ghi nhận trạng thái nghe tại thời điểm lưu bài.
          </p>
          <p role="status" className="conversation-audio-status">
            {audioStatus ||
              (draft.complete
                ? "Đã có một lượt nghe hết được giữ trong nháp."
                : "Chưa ghi nhận lượt nghe hết đoạn.")}
          </p>
          {!transcriptHidden && (
            <ol className="conversation-lines">
              {d.lines.map((l, i) => (
                <li className={i % 2 ? "speaker-b" : "speaker-a"} key={i}>
                  <div className="conversation-line-top">
                    <strong>{l.speaker}</strong>
                    <button
                      aria-label={`Nghe câu ${i + 1} của ${l.speaker}`}
                      onClick={() => play([i])}
                      disabled={!!playing}
                    >
                      <Volume2 size={17} />
                    </button>
                  </div>
                  <p lang="en">{highlight(l.en, d)}</p>
                  {draft.translation && (
                    <p className="conversation-translation">{l.vi}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
          {!transcriptHidden && (
            <details className="conversation-context">
              <summary>Nghĩa của {d.targets.length} từ trong đoạn</summary>
              <dl>
                {d.targets.map((t) => (
                  <div key={t.id}>
                    <dt>
                      <span lang="en">{t.lemma}</span>{" "}
                      <span
                        className="part-of-speech"
                        aria-label={partOfSpeechCaption(t.partOfSpeech)}
                      >
                        {formatPartOfSpeech(t.partOfSpeech)}
                      </span>
                    </dt>
                    <dd>{t.context}</dd>
                  </div>
                ))}
              </dl>
              <p className="conversation-note">
                Giải thích theo tình huống do ứng dụng biên soạn; không phải
                trích dẫn lời giải nghĩa của Oxford.
              </p>
            </details>
          )}
          <div className="conversation-exercises">
            <h3>Thử hiểu và trả lời</h3>
            <p className="conversation-note">
              {draft.mode === "listen"
                ? "Câu hỏi kiểm tra nội dung và nghĩa trong đoạn vừa nghe. Nghe lại vẫn là luyện trong phiên; không tự chứng minh nhớ lâu hoặc sử dụng thành thạo."
                : draft.recall
                  ? "Bạn đang thử trả lời khi ẩn đoạn. Kết quả ghi riêng việc mở lại gợi ý, chưa chứng minh nhớ sau nhiều ngày."
                  : "Văn bản vẫn ở trên để đối chiếu. Điểm dưới đây đo bài luyện có hỗ trợ, không đo trí nhớ độc lập hay ngữ pháp câu tự viết."}
            </p>
            {needsListening && (
              <p className="notice" role="status">
                Nghe hết đoạn để mở các câu hỏi. Nếu thiết bị không phát được,
                hãy chuyển sang Đọc và đối chiếu; không ghi kết quả đó thành bài
                nghe.
              </p>
            )}
            {!needsListening &&
              d.questions.map((q, i) => {
                const answer = report?.answers.find(
                  (a) => a.questionId === q.id,
                );
                return (
                  <fieldset key={q.id} disabled={saving || !!report}>
                    <legend>
                      {i + 1}. {q.prompt}
                    </legend>
                    {q.kind === "cloze" && (
                      <p className="conversation-note">
                        Điền lại từ đã dùng trong đoạn. Bài này đối chiếu lời
                        gốc; một cách điền khác có thể đúng ngữ pháp nhưng chưa
                        khôi phục đúng từ đang luyện.
                      </p>
                    )}
                    {q.options ? (
                      q.options.map((option) => (
                        <label className="conversation-option" key={option}>
                          <input
                            type="radio"
                            name={`${d.id}-${q.id}`}
                            value={option}
                            checked={draft.values[q.id] === option}
                            onChange={() =>
                              updateDraft({
                                ...draft,
                                values: { ...draft.values, [q.id]: option },
                              })
                            }
                          />
                          {option}
                        </label>
                      ))
                    ) : (
                      <input
                        aria-label={`Câu ${i + 1}: điền từ`}
                        value={draft.values[q.id] || ""}
                        maxLength={200}
                        autoComplete="off"
                        spellCheck={false}
                        onChange={(e) =>
                          updateDraft({
                            ...draft,
                            values: { ...draft.values, [q.id]: e.target.value },
                          })
                        }
                      />
                    )}
                    {answer && (
                      <div
                        className={`conversation-feedback ${answer.correct ? "is-correct" : "needs-work"}`}
                      >
                        <strong>
                          {answer.correct
                            ? "Đúng trong bài này"
                            : "Cần xem lại"}
                        </strong>
                        <p>{answer.explanation}</p>
                        {!answer.correct && (
                          <p>
                            Đáp án của bài:{" "}
                            <span lang="en">{q.accepted.join(" / ")}</span>
                          </p>
                        )}
                      </div>
                    )}
                  </fieldset>
                );
              })}
            {!needsListening && (
              <label className="conversation-reply">
                {d.questions.length + 1}. {d.reply}
                <textarea
                  value={draft.values.reply || ""}
                  maxLength={6000}
                  rows={3}
                  disabled={saving || !!report}
                  onChange={(e) =>
                    updateDraft({
                      ...draft,
                      values: { ...draft.values, reply: e.target.value },
                    })
                  }
                  placeholder="Viết câu trả lời bằng tiếng Anh (không bắt buộc)…"
                />
              </label>
            )}
            <p className="conversation-note">
              Chưa thể chấm tự động câu trả lời mở tại đây. Bản gốc được lưu để
              xem lại; các cách trả lời hợp lý khác nhau đều được giữ.
            </p>
            {error && (
              <p className="notice" role="alert">
                {error}
              </p>
            )}
            {!report ? (
              <button
                className="primary"
                onClick={submit}
                disabled={saving || needsListening || !!playing}
              >
                {saving ? "Đang lưu…" : "Lưu và xem phản hồi"}
              </button>
            ) : (
              <div className="conversation-report" role="status">
                <p>
                  Đã lưu:{" "}
                  {report.answers.filter((a) => a.correct === true).length}/
                  {d.questions.length}
                  câu có đáp án đúng.{" "}
                  {report.mode === "listen" &&
                    "Bài nghe có phát âm thanh hoàn tất. "}
                  {report.answers.every((a) => !a.hint)
                    ? "Đã trả lời khi ẩn đoạn, không mở lại gợi ý; đây là luyện trong phiên. "
                    : "Lượt có hỗ trợ hoặc phản hồi trước. "}
                  {report.answers.some((a) => a.kind === "reply")
                    ? "Câu trả lời mở đã lưu, chưa chấm tự động."
                    : "Chưa viết câu trả lời mở."}
                </p>
                <div className="conversation-actions">
                  {report.answers.some((a) => a.correct === false) && (
                    <button onClick={() => retry(true)}>
                      Làm lại phần chưa đúng
                    </button>
                  )}
                  <button onClick={() => retry(false)}>Làm lại toàn bài</button>
                </div>
              </div>
            )}
          </div>
          <details className="conversation-history">
            <summary>
              Lịch sử đoạn này (
              {state.conversations?.filter((a) => a.dialogueId === d.id)
                .length || 0}
              )
            </summary>
            {[...(state.conversations || [])]
              .filter((a) => a.dialogueId === d.id)
              .sort((a, b) => b.time - a.time)
              .slice(0, 10)
              .map((a) => (
                <article key={a.id}>
                  <strong>{new Date(a.time).toLocaleString("vi-VN")}</strong>
                  <p>
                    {
                      a.answers.filter((answer) => answer.correct === true)
                        .length
                    }
                    /
                    {
                      a.answers.filter((answer) => answer.correct !== undefined)
                        .length
                    }{" "}
                    câu có đáp án ·{" "}
                    {a.listenedComplete ? "đã nghe hết" : "chưa nghe hết"}
                    {a.mode === "listen"
                      ? " · bài nghe trước"
                      : " · bài đọc/đối chiếu"}
                    {a.transcriptRevealed && a.mode === "listen"
                      ? " · đã mở lời"
                      : ""}
                    {a.retryOf ? " · lượt làm lại có phản hồi trước" : ""}
                  </p>
                  {a.answers
                    .filter(
                      (answer) =>
                        answer.kind === "reply" || answer.correct === false,
                    )
                    .map((answer) => (
                      <p key={answer.questionId}>
                        {answer.kind === "reply"
                          ? "Bạn đã viết"
                          : "Câu cần xem lại"}
                        : <span lang="en">{answer.answer}</span>
                        {answer.kind !== "reply" && (
                          <small>{answer.explanation}</small>
                        )}
                      </p>
                    ))}
                </article>
              ))}
            <p className="conversation-note">
              Hiện tối đa 10 lượt gần nhất của đoạn này; bản sao lưu giữ toàn bộ
              lịch sử.
            </p>
          </details>
        </>
      )}
    </section>
  );
}
export default ConversationPractice;
