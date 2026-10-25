import { ExternalLink, Volume2 } from "lucide-react";
import type { Word } from "./core";
import { getUsage } from "./usage";
import "./usage.css";

type Props = {
  word: Word;
  speak: (text: string) => void;
  compact?: boolean;
};

/** Shown in the dictionary or after answering, never as an unmarked hint. */
export default function UsageNotes({ word, speak, compact = false }: Props) {
  const usage = getUsage(word);
  if (!usage) return null;
  const content = (
    <>
      <ul className="usage-patterns">
        {usage.patterns.map((pattern) => (
          <li key={pattern.form}>
            <strong lang="en">{pattern.form}</strong>
            <p>{pattern.explanation}</p>
          </li>
        ))}
      </ul>
      {usage.countability && (
        <p className="usage-countability">{usage.countability}</p>
      )}
      {usage.principalParts && (
        <div className="usage-forms" aria-label="Các dạng động từ đã đối chiếu">
          <p>
            <strong>Các dạng động từ</strong>
          </p>
          <dl>
            <div>
              <dt>Quá khứ</dt>
              <dd lang="en">{usage.principalParts.past}</dd>
            </div>
            {usage.principalParts.pastParticiple && (
              <div>
                <dt>Phân từ quá khứ</dt>
                <dd lang="en">{usage.principalParts.pastParticiple}</dd>
              </div>
            )}
            <div>
              <dt>Dạng -ing</dt>
              <dd lang="en">{usage.principalParts.ing}</dd>
            </div>
            <div>
              <dt>Ngôi thứ ba số ít</dt>
              <dd lang="en">{usage.principalParts.thirdPerson}</dd>
            </div>
          </dl>
        </div>
      )}
      <p>{usage.note}</p>
      <details className="usage-mistake">
        <summary>Lỗi dễ gặp trong cách dùng này</summary>
        <p>
          <span>Cần sửa:</span> <span lang="en">{usage.mistake.incorrect}</span>
        </p>
        <p>
          <span>Gợi ý sửa:</span> <span lang="en">{usage.mistake.correct}</span>
        </p>
        <p>{usage.mistake.explanation}</p>
      </details>
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
          <p className="dict-muted">
            Ví dụ Anh–Việt do Jeongyeon biên soạn; nghe bằng giọng tổng hợp.
          </p>
        </div>
      )}
      <div className="usage-sources">
        <p>Đối chiếu cách dùng:</p>
        <ul>
          {usage.sources.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                {source.title} <ExternalLink size={13} aria-hidden="true" />
              </a>
              <span> · {source.checkedAt.slice(0, 10)}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
  return compact ? (
    <details className="usage-notes usage-compact">
      <summary>Xem lại cách dùng đã đối chiếu</summary>
      {content}
    </details>
  ) : (
    <section
      className="dict-usage usage-notes"
      aria-label="Cách dùng đã đối chiếu"
    >
      <h3>Cách dùng trong nghĩa đang học</h3>
      {content}
    </section>
  );
}
