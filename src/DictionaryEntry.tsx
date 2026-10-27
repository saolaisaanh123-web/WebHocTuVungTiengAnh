import { useEffect, useMemo, useState } from "react";
import { BookOpen, ExternalLink, Volume2 } from "lucide-react";
import {
  type State,
  canPractice,
  frequencyScore,
  skills,
  strength,
} from "./core";
import "./dictionary.css";
import {
  getRegionalUsage,
  preferredHeadword,
  youglishUsUrl,
} from "./american-english";
import UsageNotes from "./UsageNotes";
import { selectLearningEvidence } from "./evidence";
import { pronunciationPrompt } from "./pronunciation";
import { formatPartOfSpeech, partOfSpeechCaption } from "./part-of-speech";

type DictionaryEntryProps = {
  entry: State["entries"][string];
  state: State;
  speak: (text: string, url?: string) => void;
  edit: () => void;
  change: (entry: State["entries"][string]) => void;
  onExposeWrittenForms?: (wordId: string, forms: string[]) => void;
};

function referenceLinks(source: string) {
  const matches = source.match(/https:\/\/[^\s<>"'`]+/g) || [];
  const links = new Set<string>();
  for (const match of matches) {
    try {
      const url = new URL(match.replace(/[.,;:!?)\]。]+$/, ""));
      if (url.protocol === "https:" && !url.username && !url.password) {
        links.add(url.href);
      }
    } catch {
      // Invalid links remain visible as source text, without becoming links.
    }
  }
  return [...links];
}

function safeHttpsUrl(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

const expressionLabels: Record<string, string> = {
  idiom: "Thành ngữ",
  slang: "Tiếng lóng",
  colloquialism: "Cách nói đời thường",
  abbreviation: "Từ viết tắt",
  term: "Thuật ngữ",
};

function sourceDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

export default function DictionaryEntry({
  entry,
  state,
  speak,
  edit,
  change,
  onExposeWrittenForms,
}: DictionaryEntryProps) {
  const w = entry.word;
  const evidence = useMemo(() => selectLearningEvidence(state), [state]);
  const headword = preferredHeadword(w, state.voice);
  const usHeadword = preferredHeadword(w, "en-US");
  const regional = w.region?.trim() ? undefined : getRegionalUsage(w);
  const region = w.region || regional?.label;
  const [confirmedMeaning, setConfirmedMeaning] = useState(false);
  const [confirmedExamples, setConfirmedExamples] = useState(false);
  useEffect(() => {
    setConfirmedMeaning(false);
    setConfirmedExamples(false);
  }, [w.id, w.meaning_vi, w.example_en, w.example_vi]);
  const imported = w.content_status === "dictionary";
  // no-cloze describes exercise suitability, not authorship. The legacy
  // OVDP article entry uses it for a quoted source phrase.
  const legacyDictionarySource =
    w.source_fact_index !== undefined &&
    /Free Vietnamese Dictionary Project|anhviet\.dict/i.test(w.source || "");
  const authoredReference =
    imported &&
    ["authored", "no-cloze"].includes(w.example_type) &&
    !legacyDictionarySource;
  const importedSource = imported && !authoredReference;
  const reference = w.content_status === "reference";
  const collections = (w.collections || "").split(",");
  const opalWritten = collections.includes("opal-written");
  const opalSpoken = collections.includes("opal-spoken");
  const sources = referenceLinks(w.source || "");
  const isOxfordList =
    (w.collections || "")
      .split(",")
      .some((collection) => /^oxford(?:[-_ ]|$)/i.test(collection.trim())) ||
    sources.some((source) => {
      const hostname = new URL(source).hostname;
      return (
        hostname === "oxfordlearnersdictionaries.com" ||
        hostname.endsWith(".oxfordlearnersdictionaries.com")
      );
    });
  const pronunciation = useMemo(
    () => pronunciationPrompt(w, state.entries, state.voice),
    [w, state.entries, state.voice],
  );
  const wordAudio = pronunciation.url;
  const exampleAudio = safeHttpsUrl(w.audio_example);
  const newsUrl = safeHttpsUrl(w.news_url);
  const newsMediaUrl = safeHttpsUrl(w.news_media_url);
  const declaredMediaSeconds = Number(w.news_media_start);
  const newsMediaSeconds =
    /^\d+$/.test(w.news_media_start || "") &&
    Number.isSafeInteger(declaredMediaSeconds)
      ? declaredMediaSeconds
      : undefined;
  const newsMediaTime =
    newsMediaSeconds === undefined
      ? undefined
      : `${Math.floor(newsMediaSeconds / 60)}:${String(newsMediaSeconds % 60).padStart(2, "0")}`;
  const hasBilingualExample = !!w.example_en?.trim() && !!w.example_vi?.trim();
  const canConfirmReady =
    hasBilingualExample && canPractice({ ...w, learning_status: "ready" }, 0);
  const readyForLearning = canPractice(w, 0);
  const hasNewsContext = !!(w.news_source || w.news_title || w.news_excerpt);
  const frequency = frequencyScore(w);
  const history = state.history
    .filter((result) => result.wordId === w.id)
    .slice()
    .reverse();

  return (
    <article className="dict-entry">
      <header className="dict-header">
        <div className="dict-kicker">
          <BookOpen size={15} aria-hidden="true" />
          <span>Jeongyeon · Sổ từ cá nhân</span>
        </div>
        <h2 className="dict-headword" lang="en">
          {headword}
        </h2>
        {usHeadword !== w.word && (
          <p className="dict-spelling-note">
            {headword !== w.word ? (
              <>
                Anh–Mỹ · Cách viết trong nguồn: <span lang="en">{w.word}</span>.
              </>
            ) : (
              <>
                Cách viết Anh–Mỹ: <span lang="en">{usHeadword}</span>.
              </>
            )}{" "}
            Cả hai cách viết đều được chấp nhận khi luyện từ.
          </p>
        )}
        <div className="dict-grammar">
          <span
            className="dict-pos part-of-speech"
            aria-label={partOfSpeechCaption(w.part_of_speech)}
          >
            {reference
              ? "Từ loại nguồn cần đối chiếu"
              : formatPartOfSpeech(w.part_of_speech)}
          </span>
          {w.level && !reference && (
            <span className="dict-level">{w.level}</span>
          )}
        </div>
        {(expressionLabels[w.expression_type] || w.register || region) && (
          <div className="dict-expression-tags">
            {expressionLabels[w.expression_type] && (
              <span>{expressionLabels[w.expression_type]}</span>
            )}
            {w.register && (
              <span>
                <span className="dict-tag-label">Sắc thái: </span>
                {w.register}
              </span>
            )}
            {region && (
              <span>
                <span className="dict-tag-label">Vùng miền: </span>
                {region}
              </span>
            )}
          </div>
        )}
        {regional && (
          <p className="dict-spelling-note">
            {regional.note}{" "}
            <a
              href={regional.source.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Đối chiếu Oxford <ExternalLink size={13} aria-hidden="true" />
            </a>
          </p>
        )}
        <p className="dict-level-note">
          {reference
            ? "Bản nguồn có xung đột hoặc thiếu nghĩa phù hợp; chưa xác nhận nhãn học."
            : w.level
              ? isOxfordList
                ? "Mức từ/loại từ trong danh sách Oxford. Mức này không xác nhận riêng từng nghĩa."
                : "Mức CEFR do nguồn của mục từ khai báo; chưa đối chiếu riêng từng nghĩa."
              : "Chưa đối chiếu mức CEFR."}
        </p>
        {(opalWritten || opalSpoken) && (
          <section className="dict-opal" aria-label="Phạm vi Oxford OPAL">
            <h3>Oxford OPAL · Từ vựng học thuật</h3>
            <p>
              {opalWritten && "Văn viết học thuật"}
              {opalWritten && opalSpoken && " · "}
              {opalSpoken && "Văn nói học thuật"}. Đã đối chiếu đầu từ và từ
              loại trong danh sách; nhãn này không xác nhận riêng nghĩa hoặc ví
              dụ đang hiển thị.
            </p>
            {opalSpoken && (
              <p>
                OPAL spoken dựa trên ngữ liệu văn nói học thuật Anh–Anh, không
                phải thước đo tần suất tiếng Anh–Mỹ.
              </p>
            )}
          </section>
        )}
        {frequency !== undefined && (
          <div className="dict-frequency" aria-label="Mức độ thông dụng">
            <p>
              <strong>
                Độ thông dụng · Zipf{" "}
                {frequency.toLocaleString("vi-VN", {
                  maximumFractionDigits: 2,
                })}
              </strong>{" "}
              — số cao hơn nghĩa là thông dụng hơn trong tiếng Anh nói chung.
            </p>
            <p>
              Tính theo cách viết, gộp chữ hoa/thường; không tách từng nghĩa
              hoặc từ loại. Đây không phải điểm Oxford hay IELTS.
              {w.frequency_source?.trim() && <> Nguồn: {w.frequency_source}.</>}
            </p>
          </div>
        )}
        <div className="dict-pronunciation">
          <span className="dict-ipa" lang={w.ipa ? "en" : "vi"}>
            {w.ipa || "IPA chưa đối chiếu"}
          </span>
          <button
            className="dict-audio"
            aria-label={
              pronunciation.usesContext ? "Nghe từ trong câu" : "Nghe từ"
            }
            title={
              wordAudio
                ? "Phát âm thanh từ URL; dùng giọng tổng hợp nếu phát thất bại"
                : pronunciation.usesContext
                  ? "Phát câu ví dụ của nghĩa này bằng giọng tổng hợp của trình duyệt"
                  : "Phát từ bằng giọng tổng hợp của trình duyệt"
            }
            onClick={() => speak(pronunciation.text, wordAudio)}
          >
            <Volume2 size={17} aria-hidden="true" />
            {wordAudio
              ? "Nghe từ · âm thanh URL"
              : pronunciation.usesContext
                ? "Nghe từ trong câu · giọng tổng hợp"
                : "Nghe từ · giọng tổng hợp"}
          </button>
        </div>
        <p className="dict-muted">
          {wordAudio
            ? "Âm thanh theo URL của mục từ; giọng tổng hợp dự phòng nếu không phát được."
            : "Giọng tổng hợp của trình duyệt; không phải bản ghi phát âm Oxford."}
        </p>
        <p className="dict-muted">
          {pronunciation.usesContext &&
            "Từ này có nhiều từ loại trong kho. Nghe câu ví dụ giúp nhận biết ngữ cảnh của nghĩa đang xem; giọng tổng hợp vẫn có thể đọc sai trọng âm. "}
          IPA và âm thanh URL theo dữ liệu của mục từ; lựa chọn giọng tổng hợp
          không tự xác nhận chúng là phát âm Anh–Mỹ.
        </p>
        <a
          className="dict-youglish-link"
          href={youglishUsUrl(w)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Nghe người Mỹ dùng từ (YouGlish)
          <ExternalLink size={15} aria-hidden="true" />
        </a>
        <p className="dict-muted">
          Mở trang YouGlish bên ngoài, cần Internet. Nội dung và giọng nói tùy
          từng video; đây không phải âm thanh đã được Jeongyeon kiểm chứng.
        </p>
      </header>

      <section className="dict-meaning" aria-label="Nghĩa đang học">
        <div className="dict-sense-number" aria-hidden="true">
          1
        </div>
        <div className="dict-sense-body">
          <p className="dict-label">
            {w.definition_source === "oewn"
              ? "Giải nghĩa tiếng Anh · Open English WordNet (CC BY 4.0)"
              : importedSource
                ? "Giải nghĩa từ nguồn"
                : "Giải nghĩa biên soạn"}
          </p>
          <p className="dict-definition" lang="en">
            {w.definition_en || "Chưa có giải nghĩa tiếng Anh trong dữ liệu."}
          </p>
          <p className="dict-label">
            {importedSource
              ? "Nghĩa tiếng Việt · nguồn từ điển mở"
              : "Nghĩa tiếng Việt · biên soạn"}
          </p>
          <p className="dict-translation" lang="vi">
            {w.meaning_vi ||
              "Chưa có nghĩa cùng từ loại đáng tin cậy; mục này chỉ để tra cứu nguồn."}
          </p>
          <p className="dict-muted dict-sense-note">
            Mục này học một nghĩa; mã {w.id}. Không phải toàn bộ các nghĩa của
            từ.
          </p>

          {w.collocation && (
            <div className="dict-collocation">
              <h3>Cụm từ & cấu trúc</h3>
              <p lang="en">{w.collocation}</p>
            </div>
          )}

          <div className="dict-example">
            <div className="dict-example-heading">
              <h3>
                {importedSource
                  ? "Ngữ liệu từ nguồn (có thể là cụm từ)"
                  : "Ví dụ biên soạn"}
              </h3>
              <button
                className="dict-audio"
                aria-label="Nghe câu"
                disabled={!w.example_en?.trim()}
                title={
                  exampleAudio
                    ? "Phát câu từ URL; dùng giọng tổng hợp nếu phát thất bại"
                    : "Phát câu bằng giọng tổng hợp của trình duyệt"
                }
                onClick={() => speak(w.example_en, exampleAudio)}
              >
                <Volume2 size={16} aria-hidden="true" />
                {exampleAudio
                  ? "Nghe câu · âm thanh URL"
                  : "Nghe câu · giọng tổng hợp"}
              </button>
            </div>
            <p className="dict-example-en" lang="en">
              {w.example_en ||
                (authoredReference
                  ? "Chưa có ví dụ biên soạn cho mục tham khảo này."
                  : "Nguồn chưa cung cấp ví dụ; ứng dụng không tự tạo bài điền ngữ cảnh cho mục này.")}
            </p>
            <p className="dict-example-vi" lang="vi">
              {w.example_vi}
            </p>
            <p className="dict-muted">
              {authoredReference
                ? "Giải nghĩa, bản dịch và ví dụ do Jeongyeon biên soạn theo phạm vi nguồn đã ghi; không phải nội dung trích nguyên văn hoặc toàn bộ mục từ của Cambridge/Oxford."
                : importedSource
                  ? "Nghĩa và ngữ liệu được nhập theo giấy phép của nguồn từ điển mở, chưa rà soát thủ công từng mục. Chúng không phải định nghĩa hoặc ví dụ Oxford."
                  : "Giải nghĩa, bản dịch và ví dụ do Jeongyeon/người nhập biên soạn; không phải nội dung trích nguyên văn từ Oxford."}
            </p>
          </div>
        </div>
      </section>

      <UsageNotes
        word={w}
        speak={speak}
        onExposeWrittenForms={onExposeWrittenForms}
      />

      {hasNewsContext && (
        <section className="dict-news" aria-label="Ngữ cảnh có nguồn">
          <div className="dict-news-heading">
            <h3>Ngữ cảnh có nguồn</h3>
            {w.news_source_type && (
              <span className="dict-news-type">
                {w.news_source_type === "reporting"
                  ? "Bản tin / phỏng vấn"
                  : w.news_source_type === "language-lesson"
                    ? "Chuyên mục học tiếng Anh"
                    : w.news_source_type}
              </span>
            )}
          </div>
          {(w.news_source || w.news_date) && (
            <p className="dict-news-publisher">
              {w.news_source}
              {w.news_source && w.news_date && " · "}
              {w.news_date && (
                <time dateTime={w.news_date}>{sourceDate(w.news_date)}</time>
              )}
            </p>
          )}
          {newsUrl ? (
            <a
              className="dict-news-link"
              href={newsUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>{w.news_title || "Mở bài nguồn"}</span>
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          ) : w.news_title ? (
            <p className="dict-news-title">{w.news_title}</p>
          ) : null}
          {newsMediaUrl && (
            <a
              className="dict-news-media"
              href={newsMediaUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Volume2 size={16} aria-hidden="true" />
              Xem / nghe video nguồn
              {newsMediaTime ? ` · xem từ ${newsMediaTime}` : ""}
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          )}
          {newsMediaUrl && (
            <p className="dict-muted">
              {newsMediaTime
                ? `Mốc bắt đầu đã đối chiếu: ${newsMediaTime}.`
                : "Chưa đối chiếu mốc thời gian của cụm từ."}
              {w.news_media_note && ` ${w.news_media_note}`} Mở trình phát của
              đơn vị xuất bản; bài nghe trong ứng dụng vẫn dùng âm thanh riêng
              hoặc giọng tổng hợp như nhãn nút.
            </p>
          )}
          {w.news_excerpt && (
            <div className="dict-news-quotation">
              <p className="dict-label">Trích ngắn nguyên văn</p>
              <blockquote lang="en">
                <p>{w.news_excerpt}</p>
              </blockquote>
            </div>
          )}
          {w.news_context_vi && (
            <div className="dict-news-context">
              <p className="dict-label">
                Giải thích ngữ cảnh · Jeongyeon biên soạn
              </p>
              <p lang="vi">{w.news_context_vi}</p>
            </div>
          )}
          <p className="dict-muted">
            {w.news_source_type === "language-lesson"
              ? "Đây là bài dạy cách dùng của đơn vị xuất bản, không phải bằng chứng cụm từ xuất hiện trong bản tin thời sự."
              : "Ngữ cảnh này cho thấy một cách dùng thực tế; không dùng một bài nguồn để kết luận tần suất phổ biến."}{" "}
            Ví dụ luyện tập phía trên được trình bày riêng với phần trích nguồn.
          </p>
        </section>
      )}

      <section className="dict-source" aria-label="Nguồn và đối chiếu">
        <h3>Nguồn & đối chiếu</h3>
        <p className="dict-source-text">{w.source || "Chưa khai báo nguồn."}</p>
        {sources.length > 0 && (
          <ul className="dict-reference-list">
            {sources.map((url, index) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  Đối chiếu nguồn {sources.length > 1 ? index + 1 : ""}
                  <span className="dict-reference-host">
                    {new URL(url).hostname}
                  </span>
                  <ExternalLink size={13} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        )}
        {w.note && <p className="dict-source-note">{w.note}</p>}
        {w.topics && <p className="dict-muted">Chủ đề: {w.topics}</p>}
      </section>

      {(imported || reference) && (
        <div className="notice">
          {reference
            ? "Mục nguồn có xung đột hoặc thiếu nghĩa đã đối chiếu; chưa dùng để kiểm tra."
            : authoredReference
              ? readyForLearning
                ? "Bạn đã cho phép học mục tham khảo này trên thiết bị. Phạm vi nguồn tham khảo và mức xác nhận từ nhà xuất bản không thay đổi."
                : "Mục tham khảo có giải nghĩa và ví dụ biên soạn, hiện chỉ để tra cứu. Cần đối chiếu nghĩa và cách dùng theo phạm vi nguồn trước khi tự xác nhận để học."
              : "Nội dung từ điển mở chưa rà soát từng mục. Các mục chưa xác nhận chỉ dùng để tra cứu; đối chiếu nghĩa và ví dụ trước khi đưa vào bài học."}
        </div>
      )}
      <section className="dict-learning" aria-label="Việc học của bạn">
        <h3>Việc học của bạn</h3>
        {w.learning_note && (
          <p className="dict-learning-note">
            Lưu ý về việc học: {w.learning_note}
          </p>
        )}
        {(imported || reference) && (
          <div className="dict-review">
            <h3>
              {readyForLearning
                ? "Đã xác nhận để học trên thiết bị này"
                : "Kiểm tra trước khi đưa vào bài học"}
            </h3>
            <p>
              {readyForLearning
                ? authoredReference
                  ? "Xác nhận học được lưu như bản cá nhân để cập nhật mặc định không ghi đè. Đây là lựa chọn của bạn, không phải xác nhận chất lượng hoặc công nhận mục từ bởi Cambridge/Oxford; phạm vi bài nguồn vẫn giữ nguyên."
                  : "Bạn đã cho phép dùng mục này trong bài học. Xác nhận được lưu như bản cá nhân để cập nhật mặc định không ghi đè. Nhãn nguồn từ điển mở vẫn được giữ; đây không phải chứng nhận của Oxford."
                : authoredReference
                  ? "Đối chiếu nghĩa, từ loại và cách dùng trong đúng phạm vi bài nguồn. Ví dụ Anh–Việt do Jeongyeon biên soạn cần được kiểm tra riêng; nguồn có nhắc đến từ không đồng nghĩa nhà xuất bản đã công nhận mục từ đó. Nếu có lỗi, dùng Sửa mục từ trước."
                  : "Đối chiếu đúng nghĩa, từ loại và bản dịch trong nguồn. Chỉ xác nhận khi cả hai ví dụ diễn đạt cùng nghĩa đang học. Nếu có lỗi, dùng Sửa mục từ trước."}
            </p>
            {readyForLearning ? (
              <button
                type="button"
                onClick={() =>
                  change({
                    ...entry,
                    origin: "personal",
                    word: { ...w, learning_status: "lookup" },
                  })
                }
              >
                Chuyển lại thành chỉ tra cứu
              </button>
            ) : (
              <>
                <label>
                  <input
                    type="checkbox"
                    checked={confirmedMeaning}
                    onChange={(event) =>
                      setConfirmedMeaning(event.target.checked)
                    }
                  />
                  <span>
                    Tôi đã đối chiếu nghĩa và từ loại của mục này với nguồn.
                  </span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={confirmedExamples}
                    onChange={(event) =>
                      setConfirmedExamples(event.target.checked)
                    }
                  />
                  <span>
                    Tôi đã kiểm tra ví dụ tiếng Anh và bản dịch tiếng Việt đúng,
                    cùng nghĩa đang học.
                  </span>
                </label>
                {!canConfirmReady && (
                  <p>
                    Cần sửa nghĩa hợp lệ và bổ sung đủ ví dụ Anh–Việt trước khi
                    xác nhận. Mục có xung đột nguồn cần được sửa và đối chiếu
                    trước.
                  </p>
                )}
                <button
                  type="button"
                  disabled={
                    !confirmedMeaning || !confirmedExamples || !canConfirmReady
                  }
                  onClick={() => {
                    if (
                      !confirmedMeaning ||
                      !confirmedExamples ||
                      !canConfirmReady
                    )
                      return;
                    change({
                      ...entry,
                      origin: "personal",
                      word: { ...w, learning_status: "ready" },
                    });
                    setConfirmedMeaning(false);
                    setConfirmedExamples(false);
                  }}
                >
                  Xác nhận đã kiểm tra · cho phép học
                </button>
              </>
            )}
          </div>
        )}
        {entry.reports && entry.reports.length > 0 && (
          <section className="dict-reports" aria-label="Báo lỗi của bạn">
            <h3>Báo lỗi của bạn</h3>
            <p>
              Được lưu riêng với nội dung nguồn và giữ lại khi cập nhật kho.
            </p>
            <ul>
              {entry.reports.map((report, index) => (
                <li key={index}>{report}</li>
              ))}
            </ul>
          </section>
        )}
        <label className="dict-goal">
          <span>Mục tiêu</span>
          <select
            value={entry.goal || "active"}
            onChange={(event) => change({ ...entry, goal: event.target.value })}
          >
            <option value="active">Sử dụng chủ động</option>
            <option value="recognition">Nhận biết</option>
          </select>
        </label>
        <label className="dict-known">
          <input
            type="checkbox"
            checked={!!entry.known}
            onChange={(event) =>
              change({ ...entry, known: event.target.checked })
            }
          />
          <span>
            Tôi đã biết từ này <small>(tự đánh dấu, chưa kiểm tra)</small>
          </span>
        </label>
        <div className="dict-user-sentence">
          <p className="dict-label">
            Câu của bạn {entry.notes && "· Chưa được chấm"}
          </p>
          <p lang={entry.notes ? "en" : "vi"}>
            {entry.notes || "Chưa có câu tự viết."}
          </p>
        </div>
      </section>

      <details className="dict-details">
        <summary>Tiến độ từng kỹ năng & lịch sử</summary>
        <ul className="dict-skill-list">
          {skills.map((skill, index) => (
            <li key={skill}>
              <strong>{skill}</strong>
              <span>{strength(state, w.id, index, evidence)}</span>
              <small>
                Ôn tiếp:{" "}
                {state.schedules[w.id + ":" + index]
                  ? new Date(
                      state.schedules[w.id + ":" + index].due,
                    ).toLocaleString("vi-VN")
                  : "Chưa có lịch"}
              </small>
            </li>
          ))}
        </ul>
        <h3>Lịch sử học</h3>
        <div className="dict-history">
          {history.length === 0 && (
            <p className="dict-muted">Chưa có lượt học nào cho mục từ này.</p>
          )}
          {history.map((result) => (
            <p key={result.id}>
              <time>{new Date(result.time).toLocaleString("vi-VN")}</time> ·{" "}
              {skills[result.skill]} ·{" "}
              {result.method === "ungraded"
                ? "Chưa chấm"
                : result.correct
                  ? "Đúng / tự nhớ"
                  : "Quên / sai"}{" "}
              ·{" "}
              {result.method === "self"
                ? "Tự đánh giá"
                : result.method === "rule"
                  ? "Chấm quy tắc"
                  : "Tự viết"}
              {result.hint ? " · Có hỗ trợ" : ""}
              <br />
              Trả lời: {result.answer || "(tự đánh giá)"} ·{" "}
              {Math.round(result.elapsed / 1000)}s · cách lần trước{" "}
              {(result.gap / 86400000).toFixed(1)} ngày
            </p>
          ))}
        </div>
      </details>

      <div className="dict-actions">
        <button onClick={edit}>Sửa mục từ</button>
        <button
          onClick={() =>
            change({ ...entry, archived: true, archivedReason: "user" })
          }
        >
          Lưu trữ (giữ lịch sử)
        </button>
      </div>
    </article>
  );
}
