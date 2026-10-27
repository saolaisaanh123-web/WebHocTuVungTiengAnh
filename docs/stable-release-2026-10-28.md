# Jeongyeon — chốt đợt ổn định 28/10/2026

Mốc đầu vào: `3223bb1cf789bb7372ec90bed0121328aa57a7e3`. Phạm vi được giữ cố định theo trao đổi cuối với người dùng: sửa những lỗi đã tái hiện, kiểm tra luồng học cũ và bảo toàn dữ liệu, rồi bàn giao. Đợt này không mở rộng nội dung hoặc tính năng.

## Lỗi đã đóng và hành vi sau sửa

| Vấn đề đã tái hiện                                                                                        | Hành vi sau sửa                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `okay`/`Okay` bị tính sai cho `OK`; `e-mail` bị tính sai cho danh từ `email`, làm hạ lịch ôn              | Chấp nhận đúng các cách viết tương đương đã đối chiếu, ràng buộc ID/đầu từ/từ loại/nghĩa/trạng thái rà. Không đổi đáp án gốc hoặc phiên bản nội dung. Quan sát cách viết tương đương cũng ngăn cấp bằng chứng nhớ sau nhiều ngày ngay sau khi vừa thấy chữ đó.                              |
| `shut` cho nghĩa đóng cửa sổ của `close`, `ill` cho nghĩa ốm của `sick` bị phạt dù đề chưa phân biệt được | Trung tính ở đúng cặp nghĩa Việt và bốn câu đã rà: không phạt lịch ôn, không cấp điểm nhớ từ mục tiêu. Ngữ cảnh khác không tự nhận đồng nghĩa.                                                                                                                                              |
| Nhãn bộ lọc như `Chủ đề: study` hiện trước bài nhớ từ, nhưng không ghi nhận đã nhìn thấy đáp án           | Trang Luyện tập chỉ hiện loại bộ lọc đang dùng, giữ giá trị cụ thể trong Kho từ. Không tạo tiếp xúc giả; người thật sự xem nghĩa trong Kho từ vẫn theo cơ chế quan sát cũ.                                                                                                                  |
| Đúng ngay ở lượt hội thoại sửa lại/có gợi ý làm mất đề xuất cần củng cố                                   | Giữ tín hiệu yếu đến lượt trả lời mới không gợi ý, không phải retry, đúng phiên bản hiện tại và cách tiếp xúc trả lời liên quan gần nhất ít nhất 24 giờ. Chỉ gỡ đề xuất hội thoại, không cấp thành thạo hay đổi SRS. Tín hiệu yếu khách quan của từ vẫn được giữ riêng.                     |
| Tiến độ báo Hôm nay bằng 0 khi vẫn còn lượt quá hạn                                                       | Bộ chọn lịch hợp lệ dùng chung cho Home, lập phiên và dự báo. Hôm nay gộp quá hạn và lịch trong ngày, mỗi lượt một lần; bỏ mục mất/đã lưu trữ/không luyện được/lịch khác phiên bản.                                                                                                         |
| Home luôn tính bốn bài trên mỗi từ dù người học chọn một hoặc sáu kỹ năng                                 | Home và Start dùng chung kế hoạch gồm đến hạn, kỹ năng dở và từ mới. Ước lượng thành khoảng theo dạng bài; phiên đang dở dùng các task còn lại. Ghi rõ chưa gồm nghỉ hoặc sửa sai; không giả là tốc độ cá nhân đã đo.                                                                       |
| Ghi TXT thành công rồi ghi manifest thất bại làm cache lệch phiên bản                                     | Cache v3 lưu nội dung và metadata đã xác minh trong một `Cache.put`. Ghi lỗi giữ bản cũ hoàn chỉnh. Cache v2 chỉ chuyển khi cặp cũ khớp hash/byte/số mục; có fallback khi thiếu dung lượng và giữ cache cho tab cũ. Quy tắc không cache dữ liệu cá nhân, auth callback hoặc API giữ nguyên. |

## Nguồn và độ tin cậy

Hai sửa chính tả dựa trên trang Oxford Advanced American đã được đọc trực tiếp ngày 27/10, HTTP 200, đúng bài và có nội dung định nghĩa:

- [OK, exclamation](https://www.oxfordlearnersdictionaries.com/definition/american_english/ok_1): khai báo `also okay`, có cách viết đầu câu `Okay`. SHA256 bản đọc: `a192c1f420751e072db9b17cc911dc0cf8da7634fbc92444817ecdd20f1265f7`.
- [e-mail, noun](https://www.oxfordlearnersdictionaries.com/definition/american_english/e-mail_2): khai báo `also email`, gồm nghĩa một thư điện tử. SHA256 bản đọc: `72d8f0e7db797be6d1c6a3d1085d29ae3a223b7d805413f731758a3a6f8d1601`.

Thử mở lại hai URL ngày 28/10 bị proxy môi trường từ chối kết nối 403; không coi đây là lần đọc nguồn mới. Phiếu kiểm chứng và nội dung đã đọc ngày 27/10 được dùng lại. Không gắn nhãn Cambridge cho nguồn Oxford. Các cặp trung tính là xử lý đề mơ hồ trong nghĩa/câu hiện có, không phải chứng nhận mọi cách dùng thay thế.

## Bảo toàn và tệp thay đổi

- `src/reviewed-spellings.ts` mới: hai hiệu chỉnh chính tả nhỏ, có nguồn và kiểm tra đúng nghĩa; `core.ts` và `exposure-events.ts` dùng cùng lớp này. Không ghi lại dữ liệu người học.
- `assessment.ts`: bổ sung các cặp/câu trung tính đã xác nhận; các đáp án khác vẫn theo quy tắc cũ.
- `conversations.ts`: sửa điều kiện gỡ khó khăn theo từng từ, không sửa bản ghi gốc, dữ liệu hội thoại hoặc định dạng lưu.
- `session-planning.ts`: tập trung bộ chọn lịch, dự báo, kế hoạch và ước lượng để tránh ba nơi tính khác nhau; `main.tsx` nối các helper và che giá trị bộ lọc trên trang luyện.
- `public/sw.js`: cache cặp dữ liệu nguyên vẹn và chuyển đổi từ phiên bản cũ; không đổi IndexedDB.
- Các kiểm thử tương ứng và `e2e/stable-release.spec.ts`: bảo vệ đúng lỗi chấm, không lộ chữ, gợi ý/sửa sai, lỗi cache, dự báo và dữ liệu phiên cũ. `docs/NEXT-SESSION.md` ghi rõ điểm dừng.

Kho giữ nguyên **5.586 mục**, 187 cách dùng bổ sung, 14 hội thoại và 52 bài tra cứu ngữ pháp. Không đổi bất kỳ byte TXT nào: 8.916.954 byte, SHA256 `bfedc90307e912b5dd19f2620f92a45e0704b67054ef7a1070273fe2464209bb`. Không đổi ID, nội dung cũ, bậc/khoảng SRS, định dạng TXT/JSON, lịch sử hoặc queue/context/nháp đã lưu. Không thêm dependency hay dịch vụ trả phí. Không hồi tố sửa những kết quả cũ từng bị chấm sai.

## Kiểm thử bàn giao

Kết quả trên mã đã tích hợp, trước khi commit/push:

| Kiểm tra                                           | Kết quả                                                                                                                                                                            |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                                         | 468/468, 34 tệp                                                                                                                                                                    |
| `npm run test:data`                                | 46/46 (21 + 25)                                                                                                                                                                    |
| `python3 scripts/check-usage-sources.py --offline` | 187 supplements / 237 URL có metadata hợp lệ, 0 lỗi gắn nghĩa; không phải lượt tải nguồn mới                                                                                       |
| `npm run test:e2e -- --workers=3`                  | 144/144 Chromium, gồm 6 hồi quy mới                                                                                                                                                |
| `npm run test:production`                          | TypeScript/build đạt; đường dẫn gốc và đường dẫn con tải 5.586 mục, ngữ pháp/cách dùng và reload offline cả URL thường/UTM; không cache private/API; thiếu JavaScript có thông báo |
| Kiểm tra bảo toàn                                  | Hash TXT giữ nguyên; phiên cũ, context, nháp, lịch, lịch sử và xuất/nhập JSON đạt                                                                                                  |

Các ca mới về chính tả/đề mơ hồ đã tái hiện 20 lỗi trước khi sửa. Hội thoại có 3 hồi quy tái hiện lỗi cũ. Bộ worker kiểm 22 tình huống, gồm lỗi ghi/quota/phiên bản không khớp và chuyển cache cũ. Bộ browser kiểm điện thoại 320/390 px, màn hình ngang và máy tính qua các luồng học mới, ôn, sửa sai, tiếp tục phiên, tra cứu và khôi phục dữ liệu. Luồng nhiều ngày được mô phỏng bằng thời gian kiểm soát và dữ liệu phiên hợp lệ, không giả là đã quan sát người dùng trong nhiều tuần.

Build còn cảnh báo kích thước bundle chính (~1,07 MB, gzip ~302 kB), không lỗi TypeScript hoặc lỗi build. Tách gói là hạng mục tối ưu riêng, không thay đổi trong bản này để giữ phạm vi và cache ổn định.

## Giới hạn ngoài phạm vi đợt ổn định

Không tuyên bố tự chấm được mọi đồng nghĩa/câu tiếng Anh, đã phủ mọi nghĩa hoặc không bao giờ phát sinh lỗi mới. Những nội dung mới, chia phiên lớn/giãn SRS, tách bundle và lưu lịch sử theo sự kiện là công việc riêng về sau. Giữ nguyên TTS và phần phản hồi viết giới hạn, không gọi là phát âm nguồn hay chấm ngữ pháp tổng quát.

Chưa có cấu hình Supabase thật, chưa kiểm tra đăng nhập/RLS/hai thiết bị trên dịch vụ thật; không gọi kiểm thử mô phỏng là cloud đã chạy. Chưa thử Safari/iPhone thật. Các giới hạn này được công bố để xác định phạm vi sử dụng, không tự kéo dài đợt sửa đang đóng.
