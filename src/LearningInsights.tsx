import { useMemo, useState } from "react";
import {
  analyzeLearning,
  knowledgeLabels,
  writingCategoryLabels,
  type ActivityPeriod,
  type EvidenceMetric,
  type KnowledgeStatus,
} from "./analytics";
import { type State } from "./core";
import "./learning-insights.css";

const percent = (value: number) => `${Math.round(value * 100)}%`;
const statuses: KnowledgeStatus[] = [
  "new",
  "exposed",
  "learning",
  "weak",
  "retained",
  "active",
];
function Metric({
  value,
  noun = "lượt",
}: {
  value: EvidenceMetric;
  noun?: string;
}) {
  return (
    <span className="insight-metric">
      <strong>
        {value.rate === null
          ? "Chưa đủ dữ liệu"
          : `${percent(value.rate)} · ${value.correct}/${value.total} ${noun}`}
      </strong>
      {value.interval && (
        <small>
          {value.confidence} · khoảng ước lượng 95%:{" "}
          {percent(value.interval[0])}–{percent(value.interval[1])}
        </small>
      )}
    </span>
  );
}
function ActivityChart({
  periods,
  label,
}: {
  periods: ActivityPeriod[];
  label: string;
}) {
  const max = Math.max(1, ...periods.map((p) => p.total));
  return (
    <div className="insight-activity" role="group" aria-label={label}>
      <p className="insight-note">
        Thanh sáng: lượt luyện từ, viết câu và hội thoại · Thanh đậm: kiểm tra
        từ hợp lệ. Cột cuối là kỳ đang diễn ra, chưa so trực tiếp với kỳ đủ
        ngày.
      </p>
      {periods.map((p, i) => (
        <div className="insight-period" key={p.start}>
          <span>
            {p.label}
            {i === periods.length - 1 ? " (hiện tại)" : ""}
          </span>
          <div className="insight-bars" aria-hidden="true">
            <span style={{ width: `${(p.total / max) * 100}%` }} />
            <b style={{ width: `${(p.valid / max) * 100}%` }} />
          </div>
          <span>
            {p.total} lượt · {p.correct}/{p.valid} kiểm tra đúng
          </span>
        </div>
      ))}
      <p className="insight-note">
        Lượt tự đánh giá, có gợi ý hoặc làm lại vẫn là hoạt động học; chúng
        không được tính vào số kiểm tra hợp lệ.
      </p>
    </div>
  );
}
export function LearningInsights({
  state,
  onPractice,
  onWritingReview,
  onConversation,
  onReviewDue,
}: {
  state: State;
  onPractice: (skill: number, ids: string[]) => void;
  onWritingReview: () => void;
  onConversation: (ids: string[]) => void;
  onReviewDue?: () => void;
}) {
  const report = useMemo(() => analyzeLearning(state), [state]);
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [expandedStatus, setExpandedStatus] = useState<KnowledgeStatus | "">(
    "",
  );
  const words = (ids: string[]) =>
    ids
      .slice(0, 8)
      .map((id) => state.entries[id]?.word.word || id)
      .join(", ");
  return (
    <div className="learning-insights">
      <section
        className="panel insight-priority"
        aria-labelledby="insight-next-title"
      >
        <h3 id="insight-next-title">Hôm nay tôi nên tập trung vào đâu?</h3>
        {report.dueCount > 0 && (
          <div className="insight-due">
            <p>
              <strong>{report.dueCount} lượt kỹ năng đã đến hạn.</strong> Ưu
              tiên ôn theo lịch ở Hôm nay. Các bài luyện tự do bên dưới giữ
              nguyên ngày ôn.
            </p>
            {onReviewDue && <button onClick={onReviewDue}>Ôn đến hạn</button>}
          </div>
        )}
        {report.recommendations.map((r) => (
          <article className="insight-recommendation" key={r.id}>
            <div>
              <h4>{r.title}</h4>
              <p>{r.reason}</p>
            </div>
            <button
              onClick={() =>
                r.action === "writing"
                  ? onWritingReview()
                  : r.action === "conversation"
                    ? onConversation(r.ids)
                    : onPractice(r.skill!, r.ids)
              }
            >
              Luyện ngay
            </button>
          </article>
        ))}
        {!report.recommendations.length && (
          <p>
            Chưa có đủ bằng chứng để chỉ ra điểm yếu cụ thể. Tiếp tục học và ôn
            theo lịch; hệ thống sẽ chỉ đề xuất khi có kết quả thực tế.
          </p>
        )}
      </section>
      <section className="panel" aria-labelledby="insight-level-title">
        <h3 id="insight-level-title">Mức độ ghi nhớ của từng mục nghĩa</h3>
        <p className="insight-note">
          Toàn bộ thời gian · Mỗi mục có một trạng thái ưu tiên lỗi gần đây. Một
          kỹ năng nhớ vững không đồng nghĩa thành thạo mọi kỹ năng.
        </p>
        <div className="insight-status-grid">
          {statuses.map((status) => (
            <button
              aria-expanded={expandedStatus === status}
              className={`insight-status insight-status-${status}`}
              key={status}
              onClick={() =>
                setExpandedStatus((s) => (s === status ? "" : status))
              }
            >
              <strong>{report.counts[status]}</strong>
              <span>{knowledgeLabels[status]}</span>
            </button>
          ))}
        </div>
        {expandedStatus && (
          <div className="insight-word-list" aria-live="polite">
            <h4>{knowledgeLabels[expandedStatus]}</h4>
            {report.words
              .filter((w) => w.status === expandedStatus)
              .slice(0, 8)
              .map((w) => (
                <div key={w.id}>
                  <strong>{state.entries[w.id].word.word}</strong>
                  <p>{w.reasons.join(" ")}</p>
                </div>
              ))}
            {!report.counts[expandedStatus] && (
              <p>
                {expandedStatus === "active"
                  ? "Chưa đủ bằng chứng sử dụng chủ động đã được xác minh."
                  : "Chưa có mục nào đạt tiêu chí này."}
              </p>
            )}
            {report.counts[expandedStatus] > 8 && (
              <p>Hiển thị 8/{report.counts[expandedStatus]} mục đại diện.</p>
            )}
          </div>
        )}
        <details className="insight-method">
          <summary>Tiêu chí và giới hạn của các trạng thái</summary>
          <ul>
            <li>
              <strong>Mới tiếp xúc:</strong> đã xem, nghe hoặc tự đánh giá; chưa
              có lượt kiểm tra hợp lệ cho nội dung hiện tại.
            </li>
            <li>
              <strong>Đang ghi nhớ:</strong> có kiểm tra lần đầu, không gợi ý,
              chấm bằng quy tắc; chưa đủ bằng chứng nhớ lâu.
            </li>
            <li>
              <strong>Cần củng cố:</strong> kiểm tra gần nhất sai hoặc cần gợi
              ý, hoặc có ít nhất 2 lượt sai/cần gợi ý trong 4 kiểm tra gần nhất
              của một kỹ năng.
            </li>
            <li>
              <strong>Ghi nhớ khá vững:</strong> một kỹ năng có ít nhất 3 ngày
              nhớ đúng độc lập, có lượt cách mọi tiếp xúc đã ghi nhận ít nhất 7
              ngày, và không còn dấu hiệu cần củng cố theo tiêu chí trên.
            </li>
            <li>
              <strong>Có bằng chứng dùng chủ động:</strong> ít nhất 2 ngày viết
              độc lập cách nhau 24 giờ, có đánh giá xác minh cách dùng phù hợp.
              Phiên bản hiện tại chỉ phát hiện một số cấu trúc sai tại máy, chưa
              đủ để xác minh tiêu chí dùng chủ động này.
            </li>
          </ul>
          <p>
            Thay đổi nghĩa hoặc ngữ cảnh khiến bằng chứng cũ không còn được dùng
            cho nội dung đã đổi. Lịch sử vẫn được giữ. Đọc hoặc nghe hội thoại
            không tự tăng mức ghi nhớ.
          </p>
        </details>
      </section>
      <section className="panel" aria-labelledby="insight-retention-title">
        <h3 id="insight-retention-title">Nhớ lại sau một khoảng nghỉ</h3>
        <p className="insight-note">
          Ba nhóm không chồng lặp. Khoảng nghỉ tính từ lần tiếp xúc gần nhất
          được ghi nhận với từ, gồm xem từ và các kỹ năng khác; không phải chỉ
          từ bài kiểm tra cùng kỹ năng.
        </p>
        <div className="insight-retention">
          {report.retention.map((r) => (
            <article key={r.key}>
              <h4>{r.label}</h4>
              <Metric value={r.metric} />
              <small>
                Tính cả đúng và sai ở lần trả lời đầu tiên, không gợi ý; bài
                nghe phải phát thành công.
              </small>
            </article>
          ))}
        </div>
        {report.missingExposureGap > 0 && (
          <p className="insight-note">
            {report.missingExposureGap} lượt kiểm tra chưa xác định được khoảng
            nghỉ với mọi tiếp xúc, nên chưa được xếp vào các nhóm này. Chúng vẫn
            có trong lịch sử và thống kê gốc.
          </p>
        )}
        <p className="insight-note">
          Khoảng ước lượng cho thấy độ bất định của mẫu; các lượt của cùng một
          người và cùng từ có thể phụ thuộc nhau. Đây không phải điểm năng lực
          hay band IELTS.
        </p>
      </section>
      <details
        className="panel insight-detail"
        open={report.totals.objective > 0 || report.issues.length > 0}
      >
        <summary>Phân tích kỹ năng và độ tin cậy</summary>
        <p className="insight-note">
          Kiểm tra hợp lệ: nội dung hiện tại, lần đầu, không gợi ý, chấm bằng
          quy tắc và đủ thông tin bằng chứng. Tỷ lệ đúng tức thời được tách khỏi
          nhớ độc lập sau ít nhất 24 giờ.
        </p>
        {report.conversationEvidence.attempts > 0 && (
          <article className="insight-conversation">
            <h4>Kết quả hội thoại, ghi riêng</h4>
            <p className="insight-note">
              Hiểu và điền từ sau khi xem đoạn hội thoại
            </p>
            <Metric value={report.conversationEvidence.answered} />
            <p className="insight-note">
              {report.conversationEvidence.read} lượt đọc ·{" "}
              {report.conversationEvidence.listened} lượt nghe hết ·{" "}
              {report.conversationEvidence.retries} lượt làm lại ·{" "}
              {report.conversationEvidence.replies} câu đáp tự viết chưa chấm.
              Tỷ lệ chỉ tính câu hỏi có đáp án cố định trong lượt không đánh dấu
              làm lại và còn đúng phiên bản từ. Trong đó{" "}
              {report.conversationEvidence.supported.total} câu có nguồn hoặc
              gợi ý hiển thị khi trả lời.
            </p>
            <p className="insight-note">
              Bài tập diễn ra sau khi xem đoạn hội thoại; kết quả này không được
              dùng để chứng nhận nhớ độc lập hay thành thạo.
            </p>
          </article>
        )}
        <div className="insight-skill-list">
          {report.skills.map((s) => (
            <article className="insight-skill" key={s.skill}>
              <h4>{s.label}</h4>
              <div className="insight-skill-metrics">
                <div>
                  <span>Kiểm tra hợp lệ</span>
                  <Metric value={s.objective} />
                </div>
                {s.skill < 5 && (
                  <>
                    <div>
                      <span>Gần thời điểm tiếp xúc</span>
                      <Metric value={s.immediate} />
                    </div>
                    <div>
                      <span>Nhớ độc lập ≥ 24 giờ</span>
                      <Metric value={s.delayed} />
                    </div>
                  </>
                )}
                {s.ai.total > 0 && (
                  <div>
                    <span>
                      {s.skill === 5
                        ? "AI nhận xét dùng từ phù hợp"
                        : "AI không phát hiện lỗi"}
                    </span>
                    <Metric value={s.ai} noun="câu" />
                  </div>
                )}
              </div>
              <p className="insight-note">
                {s.self} tự đánh giá · {s.ungraded} chưa chấm · {s.excluded}{" "}
                lượt lịch sử ngoài mẫu kiểm tra hợp lệ.
                {s.supported > 0 &&
                  ` ${s.supported} lượt có gợi ý vẫn được dùng để nhận diện từ yếu, không cộng vào tỷ lệ đúng không hỗ trợ.`}
                {s.unverified.total > 0 &&
                  ` ${s.unverified.total} lượt chưa đủ bằng chứng về khoảng nghỉ độc lập; không tính là nhớ sau 24 giờ.`}
                {s.localIssues > 0 &&
                  ` ${s.localIssues} câu có lỗi được bộ quy tắc cục bộ phát hiện.`}
                {s.serviceReviews > 0 &&
                  ` ${s.serviceReviews} câu gửi dịch vụ ngữ pháp; ${s.serviceIssues} câu được báo lỗi, phần còn lại chưa thể kết luận đúng.`}
              </p>
              {s.skill >= 5 && (
                <p className="insight-note">
                  Bộ quy tắc tại máy chỉ phát hiện một số lỗi cấu trúc đã biết.
                  Không phát hiện lỗi không đủ để kết luận câu hoàn toàn đúng
                  hoặc tự nhiên; vì vậy chưa có tỷ lệ câu đúng tự động.
                </p>
              )}
            </article>
          ))}
        </div>
      </details>
      <details className="panel insight-detail">
        <summary>Từ cần chú ý và xu hướng học</summary>
        <div className="insight-patterns">
          <div>
            <h4>Thường quên</h4>
            <p>
              {report.frequentlyForgotten.length
                ? words(report.frequentlyForgotten)
                : "Chưa thấy mẫu sai ở ít nhất hai ngày khác nhau và còn lỗi gần đây."}
            </p>
          </div>
          <div>
            <h4>Có tiến bộ</h4>
            <p>
              {report.improving.length
                ? words(report.improving)
                : "Chưa đủ chuỗi ba ngày nhớ đúng độc lập sau lỗi cũ."}
            </p>
          </div>
          <div>
            <h4>Luyện nhiều nhưng còn yếu</h4>
            <p>
              {report.overpracticedWeak.length
                ? words(report.overpracticedWeak)
                : "Chưa có mục luyện từ 8 lượt mà vẫn còn lỗi và thiếu bằng chứng nhớ vững."}
            </p>
          </div>
        </div>
        {report.issues.length > 0 && (
          <div>
            <h4>Các nhóm lỗi được phát hiện khi viết</h4>
            <ul>
              {report.issues.slice(0, 6).map(([issue, count]) => (
                <li key={issue}>
                  {writingCategoryLabels[issue] || issue}: {count} lỗi được ghi
                  nhận
                </li>
              ))}
            </ul>
            <p className="insight-note">
              Mỗi lần sửa và gửi lại là một bản ghi; số lỗi không tương đương số
              câu hay số từ chưa biết.
            </p>
          </div>
        )}
        <label className="insight-period-picker">
          Xem xu hướng{" "}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as "week" | "month")}
          >
            <option value="week">6 tuần gần đây</option>
            <option value="month">6 tháng gần đây</option>
          </select>
        </label>
        <ActivityChart
          periods={period === "week" ? report.weekly : report.monthly}
          label={
            period === "week"
              ? "Số lượt học trong sáu tuần"
              : "Số lượt học trong sáu tháng"
          }
        />
      </details>
    </div>
  );
}
