# Jeongyeon: ngữ cảnh cho toàn bộ kho và ôn dài hạn — 30/10/2026

Hoàn tất nội dung ngày 30/10; kiểm thử và bàn giao tiếp tục ngày **31/10/2026**.

Yêu cầu: sửa các bất cập đã nêu, ưu tiên chiều sâu cách dùng và ngữ cảnh cho tất cả mục từ hiện có. Phạm vi là **5.586 ID/nghĩa/từ loại đang học**, không phải mọi nghĩa tiếng Anh của 5.352 đầu từ. Không thêm API trả phí, không thay kho TXT, ID hoặc dữ liệu cá nhân.

## Vấn đề và thay đổi

- Trước đợt này chỉ 203 mục có phần mở rộng; 5.383 mục còn lại chỉ có câu gốc. Đã bổ sung đủ 5.383 mục còn thiếu với **câu Anh–Việt thứ hai, một cụm minh họa lấy từ chính câu và lời giải thích theo ngữ cảnh**. 203 bài sâu cũ giữ nguyên. Không biến nguồn định nghĩa thành chứng nhận toàn bộ ngữ pháp; không tự tạo quy tắc giới từ, tính đếm được hoặc “lỗi thường gặp” cho đủ số lượng.
- Phiên hội thoại đã lưu chỉ có cách làm lại được đánh dấu hỗ trợ. Thêm lượt kiểm tra mới sau ít nhất 24 giờ từ tiếp xúc liên quan gần nhất, ẩn lời và đáp án cũ trước khi bắt đầu. Nghe lại trong lượt mới là một phần của bài. Kết quả chỉ gỡ đề xuất yếu của hội thoại khi hợp lệ; không tự cấp bằng chứng nhớ từ/SRS. Tiếp xúc được đồng bộ muộn vẫn được xét khi phân tích lại. Retry cũ tiếp tục là có hỗ trợ.
- Lịch ôn trước đây dừng ở 30 ngày. Giữ 1–3–7–14–30 cho các bước đầu; kỹ năng khách quan 1/3/4 đã ở bước cuối có thể giãn 60→90→180 ngày khi đúng độc lập, đúng hạn, có khoảng nghỉ thật và ít nhất 3 ngày kiểm tra sạch từ sau lỗi/gợi ý gần nhất. Mỗi lần chỉ tăng một mức; không suy từ lịch lâu năm hoặc cờ independent cũ. Tự đánh giá 0/2 vẫn tối đa 30 ngày. Không sửa hồi tố due/queue/history đã lưu. Đây là quy tắc bảo thủ, không phải mô hình xác suất nhớ đã hiệu chuẩn.

Tìm kiếm đầu từ/cách viết/dạng động từ đã đối chiếu khớp chính xác được ưu tiên trước các cụm chỉ chứa từ đó. Khi không tìm kiếm, thứ tự CEFR/tần suất cũ được giữ nguyên; không đổi thuật toán chọn từ hoặc queue đã lưu.

## Nội dung và nguồn

Các câu mới do Jeongyeon biên soạn, có lượt biên tập độc lập thứ hai bằng mô hình cho từng câu/bản dịch/cụm. Không gọi là chuyên gia nhà xuất bản kiểm duyệt. Phiếu rà được ràng buộc SHA256 với nội dung chính xác; sửa nội dung sau rà làm phiếu không còn khớp.

Nguồn tham chiếu nghĩa/từ loại gồm Open English WordNet khóa commit 45fdb60396dc804526b85f21a23c59983c2c396a, Oxford American, Merriam-Webster, Cambridge Blog và các bài từ điển đã xác minh ở đợt trước. Metadata giữ đúng ngày đọc và hash gốc. Ngày 30/10, trang Oxford/Cambridge mẫu vẫn bị proxy403; nguồn OEWN chính thức trên GitHub truy cập được. Không tuyên bố đã mở mới toàn bộ trang nhà xuất bản khi chưa làm được.

Lớp bổ sung có **836 phiếu/790 URL** gắn theo từng nghĩa: 4.617 mục dùng OEWN, 623 Oxford, 118 Merriam-Webster, 23 Cambridge Blog, một Collins và một American Heritage. Có **4.986 mục** được kiểm tra body cache khớp SHA256; **397 mục** dựa vào phiếu xác minh lịch sử khi hiện không còn body. Các số này thuộc 5.383 mục mới, tách khỏi 203 bài sâu được giữ nguyên. Đã tải lại 44 tệp OEWN chính thức ngày 30/10 và xác nhận tất cả hash khớp phiên bản khóa.

`evidence.json` dùng `scope: lexical-meaning-only`. Trên giao diện, các mục mới hiện “Tham chiếu nghĩa và từ loại” và “cụm minh họa trong ví dụ biên soạn”; 203 bài sâu giữ nhãn đối chiếu cách dùng trước đây. OEWN là từ vựng/ngữ nghĩa, không tự chứng nhận tần suất, CEFR, phát âm hoặc cách dùng riêng của Mỹ. Ưu tiên cách viết Mỹ đã có trong dữ liệu; giữ cảnh báo mục có nghĩa/cách dùng riêng Anh–Anh.

Mục `no-cloze` đã có, như thành ngữ đổi đại từ, vẫn có ngữ cảnh đọc/nghe tự nhiên. Không ép giữ nguyên chữ “someone” cho vừa bộ chấm, không thêm đại từ thay thế thành đáp án chung, không tự bật bài điền cho các mục này.

## Lưu trữ và luồng học

- TXT giữ SHA256 `bfedc90307e912b5dd19f2620f92a45e0704b67054ef7a1070273fe2464209bb`; không đổi sourceVersion/ID/contentKey/accepted_answers.
- Dữ liệu bổ sung nằm ngoài TXT và được đóng gói cùng ứng dụng để dùng offline. Ràng buộc ID+đầu từ+POS+nghĩa; sửa nghĩa cá nhân thì không thừa hưởng phần mở rộng của nghĩa cũ.
- Phiên mới luân phiên câu gốc/câu bổ sung theo lần trả lời đầu gần nhất. Phiên đang dở giữ nguyên snapshot, kể cả khi reload/nhập JSON/merge. Đọc ví dụ không được tính là trả lời đúng.
- Bản ghi hội thoại bổ sung metadata tùy chọn; backup cũ vẫn hợp lệ. Kiểm tra liên kết lượt trước/phiên bản/thời gian trước khi nhận bản ghi mới.

## Các file chính

| File | Mục đích |
|---|---|
| `data/usage-contexts/range-*.json` | Câu thứ hai, bản dịch, cụm minh họa, tác giả/lượt rà theo từng nghĩa |
| `data/usage-contexts/evidence.json` | Phiếu nguồn dùng chung và ràng buộc nghĩa, tránh lặp URL dài ở mọi câu |
| `data/usage-contexts/coverage.json` | Báo cáo thực tế theo ID; không tính bản nháp là hoàn tất |
| `src/usage.ts`, `src/UsageNotes.tsx`, `src/main.tsx` | Tách nội dung đủ điều kiện, kiểm tra metadata, gắn nghĩa, nhãn nguồn/bộ lọc trung thực |
| `scripts/compile-usage-contexts.py`, `scripts/check-usage-contexts.py` | Biên dịch bản đã rà; kiểm tra hash, nguồn từng nghĩa và độ phủ; không sinh câu |
| `src/core.ts`, `src/retention-intervals.test.ts` | Giãn lịch cho bằng chứng khách quan nhiều ngày, giữ dữ liệu đang có |
| `src/ConversationPractice.tsx`, `src/conversations.ts`, `src/practice-data.ts` | Lượt kiểm tra hội thoại mới sau khoảng nghỉ và tương thích bản ghi |
| Các test usage/conversation/E2E và `scripts/check-production.mjs` | Ràng buộc nghĩa, đọc trên điện thoại, tính toàn vẹn, offline/production |

## Kiểm thử và giới hạn

- **517 kiểm thử mã/37 tệp** đạt, bao gồm độ phủ từng ID, nội dung được rà, bảo vệ nghĩa/POS, lịch ôn dài hạn, lưu/khôi phục và hợp nhất dữ liệu.
- **46 kiểm thử dữ liệu** đạt; kiểm tra bổ sung xác nhận 5.383 + 203 = 5.586/5.586 mục sẵn sàng và 0 thiếu. Metadata 203 bài cũ/253 URL đạt, không gọi kiểm tra metadata offline là truy cập nguồn mới.
- **160/160 ca Chromium đạt trong một lượt chạy toàn bộ** (3,4 phút), gồm tra cứu offline, ưu tiên đầu từ chính xác, ngữ cảnh mới, lưu nháp, giữ phiên, hội thoại sau khoảng nghỉ và không ghi bằng chứng từ phần đang đóng. Kiểm tra các màn hình 320/390/1.366 px và các kích thước cũ trong bộ hồi quy.
- **TypeScript/build production** đạt; tải đủ 5.586 mục, ngữ pháp, bài nghe và ngữ cảnh bổ sung ở đường dẫn gốc và `/pages-test/`, tải lại offline cả URL chuẩn và bookmark có UTM, không cache API riêng tư. Mất JavaScript hiện thông báo lỗi thay vì trang trắng.
- Kho TXT giữ đúng 8.916.954 byte và SHA256 cũ; 203 bài sâu không đổi. Không kiểm Safari/iPhone thật hoặc Supabase thật.

Các bài kiểm tra metadata/regex không thay thế việc biên tập nội dung. Gói JS hiện khoảng **5,33 MB trước nén, 1,47 MB gzip** do đóng gói toàn bộ ngữ cảnh và dấu vết nguồn để đọc offline; chưa có đo hiệu năng trên điện thoại thật.

Những giới hạn cần giữ rõ: chưa thể chấm ngữ pháp tự do toàn diện miễn phí bằng bộ luật hiện tại; nguồn âm thanh mặc định vẫn TTS thiết bị; một bộ câu hỏi cố định có thể bị học thuộc; đồng bộ thật cần dự án Supabase của người dùng; Chromium mô phỏng điện thoại không thay thế kiểm tra Safari/iPhone thật. Không gọi các phần cần tài khoản/thiết bị bên ngoài là đã kiểm nghiệm hoàn chỉnh.
