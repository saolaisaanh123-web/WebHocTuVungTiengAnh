# Cách dùng, dạng động từ và tra cứu — 27/10/2026

Đợt tiếp theo tập trung vào việc dùng từ chính xác: thêm cách dùng đã đọc nguồn cho 32 động từ, tra cứu được dạng biến đổi và ghi nhận đúng khi người học vừa nhìn thấy một dạng từ. Không thêm trang hoặc dịch vụ trả phí, không thay thiết kế, ID, kho TXT hay câu hỏi của phiên đang diễn ra.

## Nội dung bổ sung

Tổng cách dùng/ngữ cảnh thứ hai tăng **155 → 187 mục**; bảng dạng động từ tăng **7 → 39**. Kho vẫn **5.586 mục / 5.352 đầu từ**, 372 IPA. Đây là bổ sung chiều sâu cho các mục đã có, không tăng số thẻ để tính thành tiến bộ học tập.

| Tệp | Nhóm được bổ sung |
|---|---|
| [group-k.json](../data/usage/group-k.json) | clean, complete, cost, dress, drink, email, interest, love, match, name, open |
| [group-l.json](../data/usage/group-l.json) | park, phone, post, rain, shop, sound, telephone, welcome, book, search |
| [group-m.json](../data/usage/group-m.json) | come, find, give, know, see, bring, leave, lose, feel, think, keep |

Mỗi mục gắn đúng ID, đầu từ, từ loại và nghĩa đang học, gồm cấu trúc/cách dùng, lưu ý, lỗi thường gặp có giải thích, ví dụ Anh–Việt thứ hai và bốn dạng động từ. Ví dụ/bản dịch do Jeongyeon biên soạn, không phân phối toàn văn bài nguồn.

- Đã đọc và rà độc lập **60 URL** dùng làm nguồn: 32 Oxford Advanced American Dictionary cho nghĩa/cách dùng; 28 Oxford Learner bổ sung đối chiếu bảng dạng và lưu ý. Cả 60 URL đều qua kiểm live nhận dạng đúng bài/nội dung. Receipt giữ URL thực, tiêu đề, thời điểm và SHA-256 trong từng mục.
- Metadata toàn bộ **187 mục / 237 URL** đạt. Kiểm HTTP/nhận dạng trang không thay cho việc đọc ngữ nghĩa; nội dung đã được người biên soạn và lượt rà độc lập đối chiếu riêng.
- Giới hạn rõ nghĩa: cost–cost–cost ở nghĩa giá tiền, không phủ nhận costed ở nghĩa tính chi phí; post chỉ đăng mạng; keep chỉ giữ/sở hữu; see chỉ nhìn thấy; think chỉ suy nghĩ/cân nhắc. Không gộp mọi nghĩa của một đầu từ.
- Không tuyệt đối hóa thì tiếp diễn của love/sound/see/think/feel; book không bị dạy thành quy tắc luôn trả trước. Search for the keys khác search the bag; phone/call đều có thể đúng trong giao tiếp Mỹ, telephone được ghi trang trọng.
- Bản dịch và đáp án thay thế được rà để tránh suy diễn. Alternatives chỉ giữ trung tính trong đúng câu, không trở thành đáp án được chấp nhận cho mọi bài của từ đó.

## Tra cứu trong Kho từ

- Ô tìm kiếm hiện tìm cả dạng động từ, mẫu dùng/giải thích và tính đếm được đã đối chiếu: `went` tìm được go, `drank` tìm được drink; tiếng Việt không dấu như `khong dem duoc` cũng dùng được.
- Giữ cách tìm đầu từ/cách viết Mỹ/biến thể/nghĩa cũ và thứ tự CEFR/tần suất hiện tại. Chỉ mở rộng điều kiện lọc; không sắp lại queue hoặc điểm ưu tiên phiên đang học.
- Chỉ lấy dữ liệu cách dùng khi ID/đầu từ/POS/nghĩa còn khớp. Mục cá nhân đổi nghĩa hoặc từ loại không nhận nhầm dạng biến đổi của mục gốc.
- Không dùng câu sai, ví dụ, alternatives hay URL nguồn làm bí danh tìm kiếm. Không thêm went vào accepted_answers của go: một dạng tra được không đồng nghĩa đúng trong mọi câu.
- Chỉ mục có cache theo Word và kiểm các trường để tránh dữ liệu cũ sau sửa/import. Probe tại máy với 5.586 mục: dựng lạnh khoảng 30 ms, dựng lại qua cache khoảng 4 ms, 100 truy vấn khoảng 16 ms; không xem đây là số đo tốc độ trên điện thoại thật.

## Bảo vệ bằng chứng truy hồi khi xem bảng dạng

Khi mở bảng dạng interest và nhìn thấy interested, chữ interested có thể vừa được mớm trước bài tự nhớ tính từ. Bản trước chỉ theo dõi đầu từ/biến thể chính tả nên vẫn có thể tính câu trả lời đó là truy hồi độc lập sau tám ngày.

- Thêm trường tùy chọn `writtenForms` trong sự kiện tiếp xúc bất biến, lưu **mặt chữ thực sự đã nhìn thấy tại thời điểm đó**, không suy ngược từ bảng dữ liệu hiện tại.
- Quan sát từng ô dạng từ: ít nhất 60% nhìn thấy liên tục 700 ms, tab đang hiển thị và không bị che. Mở từ điển nhưng bảng còn ngoài màn hình, phần chi tiết còn đóng hoặc tab ẩn không tự ghi các dạng.
- Ví dụ kiểm độc lập tại 320×568: chỉ ô interested hiện thì chỉ lưu interested, không tự lưu interesting/interests. Không cập nhật exposure của mục tính từ, không tạo kết quả hoặc sửa lịch ôn cho nghĩa đó.
- Bằng chứng truy hồi chữ ở kỹ năng 1/3/4 dùng thêm các quan sát mặt chữ này; hiểu nghĩa/nghe nhận biết vẫn theo ID riêng. ID, nghĩa, SRS và phát âm của các mục không bị gộp.
- Merge giữ các sự kiện trước/sau câu trả lời từ thiết bị khác, không chỉ thời điểm cuối. Dữ liệu cũ thiếu trường này vẫn đọc được; không bịa lại việc người học từng nhìn những dạng nào.
- Kiểm dữ liệu giới hạn số lượng/độ dài dạng, giữ snapshot khi clone/merge, phát hiện ID sự kiện trùng mà khác nội dung. Quan sát bảng dạng tách khỏi sự kiện tự động của câu trả lời; không cho gắn resultId để vô tình loại một lần nhìn thật ở cùng thời điểm.
- JSON và transport compact/gzip giữ trường mới; lịch sử đáp án đã lưu không bị viết lại. Đây là điều chỉnh cách suy luận bằng chứng, không phạt SRS vì người học tra cứu.

## Giữ dữ liệu và phiên học

Toàn bộ TXT/version và 155 supplements cũ giữ nguyên byte/SHA-256. Hash TXT vẫn `bfedc90307e912b5dd19f2620f92a45e0704b67054ef7a1070273fe2464209bb`.

Ngữ cảnh thứ hai chỉ được gắn khi tạo phiên mới theo lượt trước đó; câu/đáp án nháp đang làm vẫn giữ qua reload và JSON. Các dạng quá khứ/phân từ chỉ để tra cứu, không mở rộng accepted_answers hay làm thay đổi contentKey. Không thay thuật toán SRS, phiên bản nghĩa, tài khoản hoặc cấu hình backend.

## Tệp chính

- `data/usage/group-k/l/m.json`: 32 mục có nguồn, bảng dạng, câu thứ hai.
- `usage.ts`, `main.tsx`: chỉ mục tra cứu, hướng dẫn tìm kiếm và callback ghi nhận các dạng đã thấy.
- `UsageNotes.tsx`, `DictionaryEntry.tsx`: quan sát từng ô dạng từ ở từ điển và phần giải thích sau đáp án.
- `core.ts`, `exposure-events.ts`: snapshot mặt chữ, kiểm dữ liệu, merge và diễn giải tiếp xúc; không gộp nghĩa hoặc đáp án.
- Unit/E2E và `check-production.mjs`: nội dung, tìm kiếm, câu lưu, vị trí nhìn thấy, dữ liệu cũ và offline. Không thêm thư viện ứng dụng.

## Kiểm chứng

- **430 unit / 33 tệp**, **46 kiểm thử dữ liệu** (21 quality + 25 full review), TypeScript và production đều đạt.
- **138 ca Chromium đạt** trên mã ứng dụng cuối: 137 ca đạt trong lượt toàn bộ; một ca source-update cũ phải chọn đúng thẻ avoid vì tra cứu mới còn khớp collocation avoid bias, sau cập nhật selector đã chạy lại và đạt. Các kiểm tra bảo toàn dữ liệu của ca đó được giữ nguyên.
- Có kiểm thử tra cứu tại 320/1280 px, bảng dạng ngoài màn hình/đóng/tab ẩn, chỉ ô thật sự đọc được, truy hồi interested ngay sau khi xem, các sự kiện cùng thời điểm và merge hai thiết bị. Unit xác nhận JSON/compact roundtrip, lịch sử cũ, snapshot sau sửa nghĩa, future events và xung đột ID.
- Hai ca ngữ cảnh mới drink/search/think tại 320/390 px kiểm câu thứ hai, phiên/nháp qua reload và JSON dự phòng; các ca cũ spend/paper/familiar vẫn đạt.
- Production root và subpath tải đủ 5.586 mục, lọc đủ 187 usage, mở nội dung mới, tìm drank và đọc dạng từ cả online/offline; bookmark UTM, ngữ pháp, bảo vệ cache riêng tư và thông báo khi thiếu JS đều đạt.
- Nguồn mới live 60/60; metadata toàn bộ 187 mục / 237 URL đạt. Hash của TXT/version và 155 supplements cũ không đổi.
- Log/probe lưu tại `/workspace/scratch/usage-expansion-2026-10-27/`. Chưa kiểm Safari/iPhone hoặc Supabase thật.

## Giới hạn còn lại

Còn **5.399 mục** chưa có supplement/câu thứ hai riêng; đợt này không tuyên bố đã phủ toàn bộ cách dùng hay mọi nghĩa của Oxford 5000. Nghe vẫn phần lớn là TTS thiết bị; nguồn Anh–Anh phụ chỉ đối chiếu hình thức, không đổi ưu tiên giọng Mỹ. Chưa thử Safari/iPhone thật hoặc Supabase thật. Ghi nhận tiếp xúc chỉ dựa vào các lần quan sát được trong ứng dụng, không thể biết việc người học đã xem từ ở nơi khác.
