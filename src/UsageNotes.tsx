import { ExternalLink, Volume2 } from "lucide-react";
import type { Word } from "./core";
import { getUsage, getUsageReference, inspectUsageEntry } from "./usage";
import { useVisibleExposure } from "./useVisibleExposure";
import "./usage.css";

type Props = {
  word: Word;
  speak: (text: string) => void;
  compact?: boolean;
  onExposeWrittenForms?: (wordId: string, forms: string[]) => void;
};

/** Shown in the dictionary or after answering, never as an unmarked hint. */
export default function UsageNotes({
  word,
  speak,
  compact = false,
  onExposeWrittenForms,
}: Props) {
  const usage = getUsage(word);
  const formExposureRef = useVisibleExposure(
    onExposeWrittenForms && usage?.principalParts
      ? (forms) => onExposeWrittenForms(word.id, forms)
      : undefined,
    JSON.stringify([
      word.id,
      word.word,
      word.part_of_speech,
      word.meaning_vi,
      usage?.principalParts,
    ]),
  );
  if (!usage) {
    if (compact) return null;
    const reference = getUsageReference(word);
    const review = inspectUsageEntry(reference, word);
    return (
      <section
        className="dict-usage-status usage-notes"
        aria-label="Mức độ bổ sung cách dùng"
      >
        <h3>Cách dùng trong nghĩa đang học</h3>
        <p>
          {review.status === "reference"
            ? "Tài liệu tham chiếu đã được ghi nhận; phần cách dùng và ngữ cảnh bổ sung chưa hoàn tất đối chiếu nên chưa đưa vào bài luyện."
            : "Nghĩa này chưa có phần cách dùng mở rộng đã đối chiếu. Ví dụ gốc và các thông tin hiện có vẫn nằm ở trên."}
        </p>
      </section>
    );
  }
  const content = (
    <>
      {usage.patterns.some(
        (pattern) => pattern.origin === "authored-illustration",
      ) && (
        <p className="dict-muted">
          Cụm từ minh họa trong ví dụ biên soạn dưới đây; không phải quy tắc
          dùng từ đầy đủ.
        </p>
      )}
      {usage.patterns.length > 0 && (
        <ul className="usage-patterns">
          {usage.patterns.map((pattern) => (
            <li key={pattern.form}>
              <strong lang="en">{pattern.form}</strong>
              <p>{pattern.explanation}</p>
            </li>
          ))}
        </ul>
      )}
      {usage.countability && (
        <p className="usage-countability">{usage.countability}</p>
      )}
      {usage.principalParts && (
        <div
          ref={formExposureRef}
          className="usage-forms"
          aria-label="Các dạng động từ đã đối chiếu"
        >
          <p>
            <strong>Các dạng động từ</strong>
          </p>
          <dl>
            <div>
              <dt>Quá khứ</dt>
              <dd lang="en" data-exposure-id={usage.principalParts.past}>
                {usage.principalParts.past}
              </dd>
            </div>
            {usage.principalParts.pastParticiple && (
              <div>
                <dt>Phân từ quá khứ</dt>
                <dd
                  lang="en"
                  data-exposure-id={usage.principalParts.pastParticiple}
                >
                  {usage.principalParts.pastParticiple}
                </dd>
              </div>
            )}
            <div>
              <dt>Dạng -ing</dt>
              <dd lang="en" data-exposure-id={usage.principalParts.ing}>
                {usage.principalParts.ing}
              </dd>
            </div>
            <div>
              <dt>Ngôi thứ ba số ít</dt>
              <dd lang="en" data-exposure-id={usage.principalParts.thirdPerson}>
                {usage.principalParts.thirdPerson}
              </dd>
            </div>
          </dl>
        </div>
      )}
      {usage.note && <p>{usage.note}</p>}
      {usage.mistake && (
        <details className="usage-mistake">
          <summary>Lỗi dễ gặp trong cách dùng này</summary>
          <p>
            <span>Cần sửa:</span>{" "}
            <span lang="en">{usage.mistake.incorrect}</span>
          </p>
          <p>
            <span>Gợi ý sửa:</span>{" "}
            <span lang="en">{usage.mistake.correct}</span>
          </p>
          <p>{usage.mistake.explanation}</p>
        </details>
      )}
      {!compact && (
        <div className="dict-example usage-second-example">
          <div className="dict-example-heading">
            <h3>Ngữ cảnh thứ hai</h3>
            <button
              className="dict-audio"
              aria-label="Nghe ngữ cảnh thứ hai"
              onClick={() => speak(usage.example.en)}
            >
              <Volume2 size={16} aria-hidden="true" /> Nghe câu
            </button>
          </div>
          <p className="dict-example-en" lang="en">
            {usage.example.en}
          </p>
          <p className="dict-example-vi" lang="vi">
            {usage.example.vi}
          </p>
          {word.example_type === "no-cloze" && (
            <p className="dict-muted">
              Ngữ cảnh để đọc và nghe tham khảo; mục này không dùng câu làm bài
              điền nguyên văn.
            </p>
          )}
          <p className="dict-muted">
            {usage.example.origin === "licensed-source"
              ? "Ví dụ tiếng Anh từ nguồn có giấy phép được ghi bên dưới; bản dịch Việt được ghi riêng, nghe bằng giọng tổng hợp."
              : "Ví dụ Anh–Việt do Jeongyeon biên soạn; nghe bằng giọng tổng hợp."}
          </p>
        </div>
      )}
      <div className="usage-sources">
        <p>
          {usage.patterns.some(
            (pattern) => pattern.origin === "authored-illustration",
          )
            ? "Tham chiếu nghĩa và từ loại:"
            : "Đối chiếu cách dùng:"}
        </p>
        <ul>
          {usage.sources.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                {source.title} <ExternalLink size={13} aria-hidden="true" />
              </a>
              <span> · {source.checkedAt.slice(0, 10)}</span>
              {source.license && (
                <p>
                  {source.license.attribution}
                  {" · "}
                  <a
                    href={source.license.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {source.license.name}
                  </a>
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
  return compact ? (
    <details className="usage-notes usage-compact">
      <summary>
        {usage.patterns.some(
          (pattern) => pattern.origin === "authored-illustration",
        )
          ? "Xem lại cách dùng và ngữ cảnh"
          : "Xem lại cách dùng đã đối chiếu"}
      </summary>
      {content}
    </details>
  ) : (
    <section
      className="dict-usage usage-notes"
      aria-label={
        usage.patterns.some(
          (pattern) => pattern.origin === "authored-illustration",
        )
          ? "Cách dùng và ngữ cảnh biên soạn"
          : "Cách dùng đã đối chiếu"
      }
    >
      <h3>Cách dùng trong nghĩa đang học</h3>
      {content}
    </section>
  );
}
