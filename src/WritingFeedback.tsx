import { useEffect, useId, useRef, useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { contentKey, type State, type WritingDraft } from "./core";
import { preferredHeadword } from "./american-english";
import { formatPartOfSpeech, partOfSpeechCaption } from "./part-of-speech";
import type { WritingAttempt, WritingIssue } from "./practice-data";
import {
  WRITING_LIMIT,
  makeWritingAttempt,
  validateWritingText,
  writingCategories,
} from "./writing";
import "./writing-feedback.css";
import {
  clearWritingDraft,
  loadWritingDraft,
  persistWritingDraft,
  findWritingDraft,
  writingDraftFlushEvent,
  type WritingDraftFlushDetail,
} from "./writing-drafts";

export type WritingFeedbackProps = {
  state: State;
  wordId: string;
  initialText?: string;
  parentId?: string;
  onTextChange?: (text: string) => void;
  disabled?: boolean;
  onSave: (attempt: WritingAttempt) => Promise<void>;
};

function HighlightedSentence({
  text,
  issues,
}: {
  text: string;
  issues: WritingIssue[];
}) {
  const parts = [];
  let last = 0;
  for (const issue of issues) {
    parts.push(text.slice(last, issue.start));
    parts.push(
      <mark key={issue.id} title={issue.message}>
        {text.slice(issue.start, issue.end)}
      </mark>,
    );
    last = issue.end;
  }
  parts.push(text.slice(last));
  return (
    <p className="writing-original" lang="en">
      {parts}
    </p>
  );
}

export default function WritingFeedback({
  state,
  wordId,
  initialText = "",
  parentId,
  onTextChange,
  disabled = false,
  onSave,
}: WritingFeedbackProps) {
  const entry = state.entries[wordId];
  const labelId = useId();
  const inputId = useId();
  const [text, setText] = useState(initialText);
  const [parent, setParent] = useState(parentId);
  const [attempt, setAttempt] = useState<WritingAttempt>();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [draftWarning, setDraftWarning] = useState("");
  const edited = useRef(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const revision = useRef(0);
  const durable = !onTextChange;
  const draftTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const pendingDraft = useRef<WritingDraft | undefined>(undefined);
  const activeDraft = useRef<WritingDraft | undefined>(undefined);
  const previousInitial = useRef({ wordId, parentId, initialText });

  function flushDraft() {
    clearTimeout(draftTimer.current);
    const value = pendingDraft.current;
    pendingDraft.current = undefined;
    return value
      ? persistWritingDraft(value).catch((error) => {
          if (
            !pendingDraft.current ||
            pendingDraft.current.updatedAt <= value.updatedAt
          )
            pendingDraft.current = value;
          throw error;
        })
      : Promise.resolve();
  }
  function stageDraft(value: string, from = parent) {
    if (!durable || !entry) return;
    const next: WritingDraft = {
      wordId,
      ...(from ? { parentId: from } : {}),
      text: value,
      updatedAt: Math.max(
        Date.now(),
        (activeDraft.current?.updatedAt || 0) + 1,
      ),
      contentVersion: contentKey(entry.word, 5),
    };
    pendingDraft.current = next;
    activeDraft.current = next;
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      flushDraft().catch(() =>
        setDraftWarning(
          "Chưa lưu được nháp. Hãy giữ trang mở và lưu câu trước khi rời đi.",
        ),
      );
    }, 250);
  }

  useEffect(() => {
    revision.current++;
    setText(initialText);
    setParent(parentId);
    setAttempt(undefined);
    setMessage("");
    setSaving(false);
    edited.current = false;
    activeDraft.current = undefined;
    setDraftWarning("");
    if (durable) {
      const mayRestore = !initialText || !!parentId;
      const cached = findWritingDraft(state, wordId, parentId);
      if (cached?.text && mayRestore) {
        setText(cached.text);
        setParent(cached.parentId || parentId);
        activeDraft.current = cached;
      }
      const generation = revision.current;
      loadWritingDraft(wordId, parentId)
        .then((draft) => {
          if (
            generation !== revision.current ||
            edited.current ||
            !draft ||
            !draft.text ||
            !mayRestore
          )
            return;
          setText(draft.text);
          setParent(draft.parentId || parentId);
          activeDraft.current = draft;
          if (
            draft.text &&
            draft.contentVersion &&
            entry &&
            draft.contentVersion !== contentKey(entry.word, 5)
          )
            setDraftWarning(
              "Nháp được viết theo nghĩa trước đây. Hãy đối chiếu lại nghĩa hiện tại trước khi kiểm tra.",
            );
        })
        .catch(() =>
          setDraftWarning(
            "Không đọc được nháp đã lưu. Các câu đã gửi vẫn được giữ trong lịch sử.",
          ),
        );
    }
    const saveOnPageHide = () => {
      void flushDraft().catch(() => undefined);
    };
    const flushRequested = (event: Event) => {
      const write = flushDraft();
      (event as CustomEvent<WritingDraftFlushDetail>).detail?.waitUntil(write);
      void write.catch(() =>
        setDraftWarning(
          "Chưa lưu được nháp mới nhất. Hãy giữ trang mở và thử lại.",
        ),
      );
    };
    window.addEventListener("pagehide", saveOnPageHide);
    window.addEventListener(writingDraftFlushEvent, flushRequested);
    return () => {
      revision.current++;
      window.removeEventListener("pagehide", saveOnPageHide);
      window.removeEventListener(writingDraftFlushEvent, flushRequested);
      void flushDraft().catch(() => undefined);
    };
  }, [wordId, parentId]);
  useEffect(() => {
    const previous = previousInitial.current;
    previousInitial.current = { wordId, parentId, initialText };
    // Initial restoration belongs to the word/thread effect above. Replacing
    // it again on mount can briefly expose an older saved sentence to editing.
    if (
      previous.wordId !== wordId ||
      previous.parentId !== parentId ||
      previous.initialText === initialText
    )
      return;
    if (!edited.current && (initialText || !durable)) setText(initialText);
  }, [initialText, wordId, parentId]);

  if (!entry || entry.archived)
    return (
      <p className="writing-notice">
        Từ này không còn trong danh sách đang học. Câu viết đã lưu vẫn được giữ
        trong lịch sử.
      </p>
    );
  const saved = (state.writing || [])
    .filter((item) => item.wordId === wordId)
    .sort((a, b) => b.time - a.time);
  const headword = preferredHeadword(entry.word, state.voice);
  const latest =
    (attempt?.wordId === wordId ? attempt : undefined) ||
    (parentId ? saved.find((item) => item.id === parentId) : undefined);

  async function check() {
    if (disabled || saving) return;
    const error = validateWritingText(text);
    if (error) {
      setMessage(error);
      return;
    }
    setSaving(true);
    setMessage("");
    const generation = revision.current;
    const next = makeWritingAttempt(entry.word, text, parent);
    const submittedDraft = activeDraft.current;
    try {
      await flushDraft();
      await onSave(next);
      if (durable && submittedDraft)
        await clearWritingDraft(submittedDraft).catch(() =>
          setDraftWarning(
            "Câu đã lưu; chưa dọn được nháp cũ. Lịch sử câu vẫn được giữ.",
          ),
        );
      if (generation !== revision.current) return;
      activeDraft.current = undefined;
      setAttempt(next);
      setParent(next.id);
      setMessage(
        "Đã lưu câu và phản hồi trên thiết bị. Bản viết lại sẽ được lưu thành lượt riêng.",
      );
    } catch {
      if (generation !== revision.current) return;
      setMessage(
        "Chưa lưu được phản hồi. Câu của bạn vẫn còn ở đây; hãy kiểm tra dung lượng và thử lại.",
      );
    } finally {
      if (generation === revision.current) setSaving(false);
    }
  }

  function retry(value = text, from = latest) {
    if (disabled || saving) return;
    setParent(from?.id || parent);
    setText(value);
    onTextChange?.(value);
    stageDraft(value, from?.id || parent);
    setAttempt(undefined);
    edited.current = true;
    setMessage("Hãy chỉnh sửa câu rồi kiểm tra lại. Bản ban đầu vẫn được giữ.");
    requestAnimationFrame(() => textarea.current?.focus());
  }

  return (
    <section className="writing-feedback" aria-labelledby={labelId}>
      <header className="writing-heading">
        <div>
          <h3 id={labelId}>Viết câu và nhận phản hồi</h3>
          <p>
            Dùng <strong lang="en">{headword}</strong>{" "}
            <span
              className="part-of-speech"
              aria-label={partOfSpeechCaption(entry.word.part_of_speech)}
            >
              {formatPartOfSpeech(entry.word.part_of_speech)}
            </span>{" "}
            theo nghĩa: {entry.word.meaning_vi}
          </p>
        </div>
        <span className="writing-local">Trên thiết bị · miễn phí</span>
      </header>
      <p className="writing-notice">
        Kiểm tra một số cấu trúc ngữ pháp rõ ràng, có giải thích tiếng Việt. Hệ
        thống chưa thể chấm toàn bộ ngữ pháp, nghĩa hoặc độ tự nhiên; không tự
        cộng bằng chứng thành thạo từ câu viết. Với gợi ý phụ thuộc nghĩa, hãy
        đối chiếu ý bạn muốn nói trước khi dùng bản sửa.
      </p>
      <label htmlFor={inputId}>Câu tiếng Anh của bạn</label>
      <textarea
        ref={textarea}
        id={inputId}
        value={text}
        maxLength={WRITING_LIMIT}
        lang="en"
        rows={3}
        disabled={disabled || saving}
        placeholder={`Viết một câu có dùng “${headword}”…`}
        onChange={(event) => {
          edited.current = true;
          setText(event.target.value);
          onTextChange?.(event.target.value);
          stageDraft(event.target.value);
          setAttempt(undefined);
          setMessage("");
        }}
      />
      {draftWarning && (
        <p className="writing-notice" role="status">
          {draftWarning}
        </p>
      )}
      <div className="writing-actions">
        <small>
          {text.length}/{WRITING_LIMIT} ký tự
        </small>
        <button
          type="button"
          onClick={() => void check()}
          disabled={
            disabled ||
            saving ||
            !text.trim() ||
            (attempt?.text === text && attempt.wordId === wordId)
          }
        >
          <Check size={16} />
          {saving ? "Đang lưu…" : "Kiểm tra cấu trúc và lưu"}
        </button>
      </div>
      {message && (
        <p className="writing-message" role="status">
          {message}
        </p>
      )}
      {latest && (
        <div className="writing-review" aria-label="Phản hồi câu viết">
          <h4>
            {latest.issues.length
              ? `${latest.issues.length} điểm cần xem lại`
              : "Chưa thể chấm tự động"}
          </h4>
          <HighlightedSentence text={latest.text} issues={latest.issues} />
          <p className="writing-summary">{latest.summary}</p>
          {latest.issues.length > 0 && (
            <ol className="writing-issues">
              {latest.issues.map((issue) => (
                <li key={issue.id}>
                  <span className="writing-category">
                    {writingCategories[issue.category] || "Điểm cần kiểm tra"}
                  </span>
                  <h4>{issue.message}</h4>
                  <p>{issue.explanation}</p>
                  {issue.suggestion !== undefined && (
                    <p className="writing-replacement">
                      <span lang="en">
                        {latest.text.slice(issue.start, issue.end)}
                      </span>
                      <span aria-label="gợi ý thay bằng"> → </span>
                      <strong lang="en">
                        {issue.suggestion || "bỏ phần này"}
                      </strong>
                    </p>
                  )}
                  {issue.example && (
                    <details>
                      <summary>Ví dụ và cấu trúc tương tự</summary>
                      <p lang="en">{issue.example}</p>
                    </details>
                  )}
                </li>
              ))}
            </ol>
          )}
          {latest.correctedText && latest.correctedText !== latest.text && (
            <div className="writing-proposal">
              <h4>Gợi ý sửa cấu trúc đã nhận diện</h4>
              <p lang="en">{latest.correctedText}</p>
              <small>
                Chưa xác nhận toàn bộ câu hoặc ý định diễn đạt. Hãy đọc lại
                trước khi dùng.
              </small>
              <button
                type="button"
                onClick={() => retry(latest.correctedText, latest)}
                disabled={disabled || saving}
              >
                Dùng gợi ý để viết lại
              </button>
            </div>
          )}
          <p className="writing-assessment">
            Ngữ pháp toàn câu: chưa thể xác nhận · Nghĩa trong ngữ cảnh: chưa
            thể chấm · Độ tự nhiên: chưa thể chấm.
          </p>
          <button
            type="button"
            onClick={() => retry(latest.text, latest)}
            disabled={disabled || saving}
          >
            <RotateCcw size={15} />
            Thử viết lại câu
          </button>
        </div>
      )}
      {saved.length > 0 && (
        <details className="writing-history">
          <summary>
            Lịch sử câu này và các lượt viết cùng từ ({saved.length})
          </summary>
          <ol>
            {saved.slice(0, 20).map((item) => (
              <li key={item.id}>
                <p lang="en">{item.text}</p>
                <small>
                  {new Date(item.time).toLocaleString("vi-VN")} ·{" "}
                  {item.parentId ? "Bản viết lại" : "Bản ban đầu"} ·{" "}
                  {item.issues.length
                    ? `${item.issues.length} điểm cần xem lại`
                    : "Chưa thể chấm tự động"}
                </small>
                <button
                  type="button"
                  disabled={disabled || saving}
                  onClick={() => {
                    setAttempt(item);
                    setText(item.text);
                    setParent(item.id);
                    onTextChange?.(item.text);
                    stageDraft(item.text, item.id);
                    edited.current = true;
                  }}
                >
                  Xem phản hồi
                </button>
              </li>
            ))}
          </ol>
          {saved.length > 20 && (
            <p>
              Hiển thị 20 lượt gần nhất; toàn bộ bản ghi vẫn được giữ trong sao
              lưu.
            </p>
          )}
        </details>
      )}
    </section>
  );
}
