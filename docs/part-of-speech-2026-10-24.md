# Từ loại rõ ràng khi học — 24/10/2026

## Vấn đề và kết quả

Kho ban đầu có trường từ loại cho cả 5.560 mục, nhưng Kho từ và các kỹ năng nhận biết, nghe, chính tả, viết câu chưa hiện nhất quán. Một số đầu từ chỉ có mục danh từ/tính từ dù cách dùng động từ rất cơ bản cũng cần học.

Đã hiển thị nhãn Việt–Anh như **Danh từ · noun**, **Động từ · verb**, **Tính từ · adjective** tại Kho từ, cả sáu kỹ năng, đáp án đã mở, từ điển, bộ sưu tập, phần viết câu và giải nghĩa từ trong hội thoại. Nhãn bám đúng nghĩa/từ loại của mục đang học. Không ghép tất cả từ loại có thể có của một đầu từ vào cùng một nghĩa.

Bổ sung **21 mục động từ**, nâng kho lên **5.581 mục theo nghĩa/từ loại**, vẫn **5.352 đầu từ/cụm từ**. Tổng có **367 mục IPA**, không phải 367 bản thu âm. Toàn bộ phần TXT của **5.560 mục cũ giữ nguyên từng byte**; ID, nội dung và bằng chứng cũ không bị biến thành một nghĩa động từ khác.

## Nguồn đã đọc

Cambridge US trả HTTP 403/“Just a moment...” qua HTTP thông thường và Chromium, không có nội dung mục từ. Người dùng đã chọn dùng Oxford American. Không ghi đợt này là đã xác minh trực tiếp Cambridge American.

Đã đọc **21 bài Oxford Advanced American Dictionary** đúng động từ: có URL thực tế, tiêu đề, HTTP 200, ngày đọc và SHA256. Metadata cùng nội dung tự biên soạn nằm trong [essential-senses-2026-10-24.json](../data/authoring/essential-senses-2026-10-24.json). Không đưa bản sao toàn văn nhà xuất bản vào repository.

| Trình độ trong danh sách American Oxford | Mục động từ mới |
| --- | --- |
| A1 | clean, complete, cost, dress, drink, email, interest, love, match, name, open, park, phone, post, rain, shop, sound, telephone, welcome |
| A2 | book, search |

CEFR đối chiếu đúng dòng có `v.` trong PDF American Oxford 3000 đã khóa. Một dòng có thể chứa cả `n., v.` hoặc `adj., v.`; giữ nguyên bằng chứng kết hợp, không sửa danh sách nguồn. Mức của đầu từ/từ loại không tự chứng nhận mọi nghĩa của từ đó. Nghĩa Việt, giải nghĩa Anh và ví dụ Anh–Việt là nội dung biên soạn.

Mỗi mục mới có ID riêng dạng `<word>-verb-01`, nghĩa được chọn, ví dụ đủ câu và ghi chú cách dùng. Ví dụ, `drink` danh từ đồ uống vẫn giữ nguyên; `drink-verb-01` là động từ uống với ví dụ và các dạng drink–drank–drunk. `post` mới dùng nghĩa đăng nội dung lên mạng; `telephone` có nhãn trang trọng. Email chấp nhận cả `email` và `e-mail`, đúng hai cách viết được đối chiếu, không thêm từ đồng nghĩa vào đáp án chung.

## Nhãn rõ nhưng không suy đoán

`src/part-of-speech.ts` diễn giải 22 nhãn hiện có, giữ nguyên giá trị trong TXT/IndexedDB. Mục cá nhân thiếu nhãn hiện “Chưa khai báo từ loại”; nhãn riêng hoặc nhãn ghép chưa biết được giữ nguyên, không đoán theo đuôi từ hay nghĩa Việt.

Các nhãn như idiom/phrase/clause/abbreviation được ghi dưới “Dạng từ / cụm”, vì chúng không tự xác định một từ loại ngữ pháp. Phrasal verb vẫn là nhóm động từ. Các viết tắt đơn giản như n./v./adj. chỉ được diễn giải khi đã biết rõ.

Ở bài cần tự nhớ hoặc nghe, nhãn không kèm đầu từ tiếng Anh. Trường hợp đặc biệt đang học chính từ `noun`, phần `noun` trong nhãn cũng được che; sau khi mở đáp án thì hiện đầy đủ. Trong hội thoại ẩn transcript, không đưa danh sách từ hay từ loại mục tiêu ra ngoài phần đang được ẩn.

Hội thoại nay lưu từ loại kỳ vọng cho 48 target và kiểm tra cùng ID/đầu từ/nghĩa. Chỉnh `research-01` từ danh từ sang động từ không tiếp tục nhận bài dùng `the original research` chỉ vì nghĩa Việt còn giống nhau. Không xóa bài làm cũ hoặc đổi phiên bản các câu hội thoại không thay nội dung.

## Bảo toàn dữ liệu và cách cập nhật

Hai manifest essential-senses ngày 22/10 và 24/10 ghép theo thứ tự. Manifest cũ không đổi. Khi còn mục cần thêm, kiểm hash prefix/ID; khi đã áp dụng đủ, replay giữ ghi chú prefix không thuộc đợt bổ sung và giữ nguyên bytes đầu vào. Các mục essential đã khai báo vẫn phải khớp đúng trường và thứ tự. Các pipeline nguồn/full-review/content-review cũ tái áp lớp mới, không làm mất các mục đã thêm.

- Kho mới: **5.581 mục**, **8.909.210 byte**.
- SHA256 hiện tại: `7b7f899ff643473eb48e80d3d64a3cfaa8293c7c27571151dd52a613f30aae2e`.
- SHA256 prefix 5.560 mục: `10392288d69ba11cc6e5fc74e02e0cc3654bea50cda229254236848d2d3a87f4`.
- Định dạng TXT và schema IndexedDB không thay đổi. Không thêm thư viện, API hay chi phí dịch vụ.

Thiết bị đang có dữ liệu chọn **Kho từ → Cập nhật kho mặc định**, xem trước rồi áp dụng để nhận 21 mục mới. Các bản sửa cá nhân giữ ưu tiên như trước. Giao diện từ loại vẫn dùng được với dữ liệu đang có trước khi cập nhật kho. Xuất/nhập JSON và TXT được giữ nguyên.

## Tệp thay đổi chính

| Nhóm tệp | Mục đích |
| --- | --- |
| `src/part-of-speech.ts` và bài kiểm tra | Diễn giải nhãn Việt–Anh, phân biệt dạng cụm và fallback |
| `src/main.tsx`, `src/style.css` | Nhãn ở Kho từ/sáu kỹ năng/đáp án, che đầu từ khi cần và bố cục hẹp |
| `DictionaryEntry.tsx`, `CollectionBrowser.tsx`, `WritingFeedback.tsx`, `ConversationPractice.tsx` | Hiển thị nhất quán trong các thành phần hiện có |
| `src/conversations.ts` và bài kiểm tra | Ràng buộc từ loại của target, từ chối bài sai sau chỉnh sửa cá nhân |
| Manifest essential-senses mới, TXT, version và provenance | 21 mục có nguồn, kiểm prefix và nguồn từng đợt |
| `scripts/apply-essential-senses.py`, `scripts/apply-source-update.py` | Thêm theo đợt và replay an toàn, giữ phần đã áp dụng |
| Kiểm thử full-review/source-update/Python | Kiểm dữ kiện nguồn, byte prefix, drift/collision và ghi chú riêng |
| `e2e/part-of-speech.spec.ts`, hai nhãn trong `phase-one-learning.spec.ts` | Kiểm luồng thật và cập nhật vị trí nhãn; giữ các điều kiện bảo toàn dữ liệu/chấm bài cũ |
| README, SOURCES, NEXT-SESSION và hai báo cáo 24/10 | Phạm vi, cách sử dụng và lỗi cần sửa tiếp |

## Kết quả kiểm thử

- **343 kiểm thử đơn vị** đạt trong 28 tệp, gồm nhãn 22 loại, nhãn cá nhân/thiếu dữ liệu, các đợt nguồn và bảo vệ POS hội thoại.
- **45 kiểm thử dữ liệu** đạt: 20 ca chất lượng cũ giữ nguyên và 25 ca full-review/pipeline, gồm giữ ghi chú riêng khi replay, prefix byte-identical, ID collision và các nguồn thực tế.
- **114 ca Chromium** đạt. Năm ca mới kiểm sáu kỹ năng ở 320/390 px trước/sau mở đáp án; phân biệt noun/verb cùng đầu từ; nhập TXT cá nhân thiếu/nhãn lạ; che chính chữ noun trong nhãn; giữ ID/lịch sử/lịch ôn/queue/nháp qua tải lại và JSON thật. Hai điều kiện cũ về POS được chuyển tới vị trí nhãn mới; các điều kiện chấm bài và bảo toàn dữ liệu giữ nguyên.
- TypeScript, build và **production gốc/đường dẫn con, online/offline** đạt với 5.581 mục, 52 bài ngữ pháp và nội dung cách dùng hiện có. Trạng thái thiếu JavaScript vẫn đạt.
- Đã kiểm độc lập **21/21 body nguồn đã đọc**: SHA256 khớp receipt, đúng Oxford American/đầu từ/verb, có định nghĩa thực tế, IPA nằm nguyên dạng trong vùng NAmE. Đây là kiểm cache nguồn thật, không giả thêm một lượt tải mạng mới. Metadata 144 mục cách dùng/164 URL cũ tiếp tục đạt.

## Giới hạn còn lại

Nâng cấp này bổ sung nhãn cho mọi mục hiện có và 21 cách dùng đã xác minh, chưa bao phủ mọi từ loại/nghĩa có thể có của mọi đầu từ. Vẫn có 144 mục với cách dùng/ngữ cảnh thứ hai; 5.437 mục còn lại dùng câu gốc. Nhãn động từ không tự cung cấp đầy đủ ngoại động/tự động, dạng bất quy tắc hoặc danh từ đếm được/không đếm được ở mọi nghĩa.

Các lỗi chấm đáp án, suy luận nhớ lâu, cá nhân hóa và giới hạn đồng bộ đã ghi trong [báo cáo audit](audit-learning-2026-10-24.md). Ngoài bảo vệ từ loại hội thoại, đợt này chưa sửa các mục audit đó. Chưa thử Supabase thật hoặc Safari/iPhone thật; không gọi bộ chấm miễn phí là bộ chấm tiếng Anh tổng quát.
