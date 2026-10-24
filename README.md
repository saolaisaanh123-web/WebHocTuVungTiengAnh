# Jeongyeon — Góc học từ vựng IELTS cá nhân

Website: [Jeongyeon](https://saolaisaanh123-web.github.io/WebHocTuVungTiengAnh/).

Ứng dụng React + TypeScript + Vite, giao diện tiếng Việt. Các phần học, hội thoại và phản hồi cấu trúc viết chạy tại máy, không cần tài khoản hoặc API trả phí. Đồng bộ tùy chọn dùng Supabase Free sau khi tự cấu hình.

Nâng cấp hiện tại: bốn chế độ chọn từ, phân tích bằng chứng ghi nhớ, 12 hội thoại biên soạn sẵn, kiểm tra cấu trúc viết ngoại tuyến, tải lại offline và đồng bộ có xử lý xung đột. Xem [báo cáo chi tiết](docs/nang-cap-jeongyeon-2026-10-19.md) và [thiết lập Supabase Free](docs/services-setup.md). Không có AI chấm câu tổng quát hoặc cơ chế phát sinh phí.

**Tra cứu ngữ pháp** có 52 bài thuộc 8 nhóm: cấu trúc câu/từ loại; danh từ/đại từ; mạo từ/lượng từ; thì/thể; động từ; mệnh đề; so sánh; giới từ/liên từ. Tìm bằng tiếng Việt có/không dấu, tiếng Anh hoặc tên gọi tương đương. Mỗi bài có tóm tắt, cách dùng, cấu trúc, ví dụ Anh–Việt tự viết, phần chi tiết mở rộng và link nguồn đã đọc. Đây là mục đọc lại kiến thức, không thêm bài kiểm tra hay điểm số.

Nguồn chính là **British Council LearnEnglish**, theo lựa chọn của người dùng ngày 20/10/2026; Cambridge English Grammar Today chưa truy cập được do Cloudflare nên không được ghi là đã đối chiếu. Nội dung nằm trong [data/grammar](data/grammar/README.md), tách khỏi giao diện và dữ liệu học riêng. Không cần tài khoản/API, không phát sinh phí; nội dung tra cứu được đóng gói để đọc offline, còn trang nguồn bên ngoài cần mạng.

## Cập nhật nguồn từ vựng, ưu tiên Anh–Mỹ

Kho hiện có **5.581 mục theo nghĩa/từ loại, đều có nội dung để luyện**. Kho gồm 5.558 mục của đợt rà toàn kho, hai nghĩa A1 like/lie và 21 cách dùng động từ bổ sung có nguồn Oxford American. Đợt rà toàn kho ngày 21/10 đối chiếu nghĩa được chọn theo từng ID với Open English WordNet, Oxford và nguồn từ điển Mỹ phù hợp; hoàn thiện 4.497 mục trước đây chỉ tra cứu và rà lại 1.061 mục cũ. Mỗi mục có nghĩa Việt, giải nghĩa Anh và ví dụ Anh–Việt. Giữ toàn bộ ID, đầu từ, dữ kiện CEFR/tần suất và các bản sửa cá nhân; sửa rõ ràng từ loại `diplomatic` theo nguồn hiện hành. Đây là số mục học theo nghĩa/từ loại, không phải 5.581 từ đơn Oxford khác nhau.

- Nền tảng: đã đọc trực tiếp hai PDF **American Oxford 3000/5000** chính thức; mọi đầu từ trong hai bản này có mặt qua mục từ, biến thể đã xác minh hoặc mục bổ sung. Giữ riêng bằng chứng Oxford Anh–Anh cũ, không ép số đếm thành 5.000 thẻ.
- Học thuật: **Oxford OPAL**, phân biệt văn viết và văn nói học thuật. Đã bổ sung các đầu từ và từ loại còn thiếu; nhãn OPAL của mục cũ chỉ xác nhận đầu từ/từ loại, không tự chứng nhận nghĩa Việt đang hiển thị. OPAL spoken dựa trên ngữ liệu học thuật Anh–Anh.
- Ngôn ngữ hiện đại: 23 mục từ **Cambridge Dictionary Blog**, cùng các cách nói đời thường được đối chiếu thêm từ điển Mỹ. Mục mới/chuyên biệt có ví dụ được rà để luyện, đồng thời giữ cảnh báo về sắc thái và mức độ ổn định; không tự coi là từ phổ biến tại Mỹ hay đã được nhận vào mọi từ điển.
- Nghĩa/cách dùng: **Open English WordNet** khóa phiên bản cung cấp các nghĩa từ vựng có giấy phép mở; **Oxford American/Academic** và **Merriam-Webster** đối chiếu từ chức năng, khác biệt vùng và các nghĩa hiện đại. Giải nghĩa Anh chép theo giấy phép WordNet có nhãn riêng; bản dịch và ví dụ Jeongyeon biên soạn được ghi riêng. **Cambridge Dictionary vẫn chặn 403**, nên không gắn nhãn đã xác minh Cambridge cho các mục chưa đọc được.
- Phát âm: hồ sơ mới ưu tiên **Anh–Mỹ**, 61 biến thể của mục cũ có cách viết Mỹ đã đối chiếu; thêm liên kết **YouGlish chọn giọng Mỹ** trong chi tiết từ. Giữ lựa chọn giọng đã lưu. Nếu hồ sơ cũ đang chọn Anh–Anh, có thể đổi trong Cài đặt. Không tự đổi IPA hoặc URL âm thanh chỉ vì đổi giọng tổng hợp.

Trong Kho từ, chọn **Bộ từ** để lọc American Oxford 3000/5000, OPAL hoặc Cambridge Blog. Thiết bị đã có dữ liệu dùng **Cập nhật kho mặc định**, xem trước rồi áp dụng; không xóa dữ liệu học. Cách viết Mỹ mới được chấp nhận dưới ID cũ và không đổi khóa nội dung/lịch ôn. Khi thực sự sửa nghĩa, lịch sử được giữ nhưng bằng chứng của nghĩa cũ không được coi là bằng chứng cho nghĩa mới.

Chi tiết nguồn, phạm vi kiểm tra và giới hạn: [báo cáo rà toàn kho](docs/full-vocabulary-review-2026-10-21.md), [ghi nguồn kho từ](public/data/SOURCES.md). Không có API trả phí hoặc yêu cầu tài khoản mới.

**Cách dùng và ngữ cảnh:** 144 mục dễ dùng sai có cấu trúc/giới từ, ghi chú theo nghĩa, lỗi thường gặp và ví dụ Anh–Việt thứ hai, đối chiếu trực tiếp Oxford Advanced American. Trong **Kho từ → Trạng thái → Có cách dùng đã đối chiếu**, lọc các mục tương thích với ghi chú nguồn; bộ lọc này cũng áp dụng cho phần luyện tập tự do. Bài luyện ngữ cảnh luân phiên hai câu ở phiên mới, giữ nguyên đề/nháp khi tải lại. Mục tiêu và tổng kết phiên tách lần trả lời đầu khỏi sửa sai; trả lời lại ngay không tự được tính là nhớ lâu. Xem [đợt mở rộng và kiểm thử](docs/usage-expansion-2026-10-23.md) và [cơ chế phiên học](docs/usage-and-session-upgrade-2026-10-22.md). Phần cách dùng không ghi đè kho TXT hoặc xóa lịch sử học; 5.437 mục còn lại vẫn chỉ có ngữ cảnh gốc.

**Từ loại:** nhãn Việt–Anh như “Danh từ · noun”, “Động từ · verb” hiện ở Kho từ, cả sáu kỹ năng, đáp án, từ điển, viết câu và phần giải nghĩa hội thoại. Thêm 21 mục động từ còn thiếu theo Oxford American; giữ nguyên từng byte của 5.560 mục trước đó và tiến độ dưới ID cũ. Cambridge US hiện chặn HTTP 403; người dùng đã chọn Oxford American làm nguồn thay thế. Xem [báo cáo từ loại](docs/part-of-speech-2026-10-24.md) và [các lỗi học tập cần sửa tiếp](docs/audit-learning-2026-10-24.md).

**Đợt sửa độ tin cậy 23/10:** bảo vệ lịch theo phiên bản nghĩa, dùng chung bằng chứng ghi nhớ, giãn từ vừa luyện ở chế độ thông dụng, luân phiên kỹ năng đầu phiên, thêm lựa chọn từ mới/kỹ năng, pha hội thoại ẩn transcript và nháp viết bền. Kho bổ sung hai nghĩa A1 của like/lie; 5.558 mục cũ giữ nguyên từng byte. Xem [báo cáo thay đổi, kiểm thử và giới hạn](docs/learning-reliability-2026-10-23.md).

## Chạy trên máy

Cần Node.js 22 trở lên và npm:

```sh
npm ci
npm run dev
npm test
npm run build
npm run test:production
npm run preview
```

Kiểm thử trình duyệt: `npm run test:e2e`. Cấu hình ưu tiên `CHROMIUM_PATH`, sau đó Chromium hệ thống `/usr/bin/chromium`, cuối cùng trình duyệt đã cài bằng Playwright. Trên máy khác, cài Chromium rồi đặt `CHROMIUM_PATH` thành đường dẫn trình duyệt. Có thể dùng Playwright Chromium sau khi `npx playwright install chromium` và chỉ định đường dẫn tương ứng. Không cần trình duyệt để chạy unit test/build.

## Thêm và sửa từ mà không sửa code

Sửa file UTF-8 `public/data/vocabulary.txt`. Mỗi mục cách nhau bởi một dòng `---`; mỗi trường trên một dòng `tên_trường: nội dung`. Hỗ trợ CRLF của Windows, BOM và tiếng Việt. Không dùng dòng xuống hàng bên trong giá trị trường.

Các trường bắt buộc: `id`, `word`, `meaning_vi`, `example_en`, `example_vi`. Những trường khác xem trong file mẫu. `topics` và `collections` dùng dấu phẩy; `accepted_answers` dùng dấu `|` giữa các đáp án hợp lệ. Trường tùy chọn `spelling_variants` cũng dùng `|`, chỉ dành cho cách viết tương đương đã rà theo nghĩa/từ loại (như `neighbour`/`neighbor`); thêm biến thể này không làm đổi phiên bản nghĩa hay xóa lịch ôn. Không dùng nó cho từ đồng nghĩa hoặc nghĩa mới. `audio_word` và `audio_example` nhận URL HTTP/HTTPS; hãy chỉ dùng nội dung có quyền sử dụng.

- Giữ nguyên ID khi sửa cách diễn đạt để giữ lịch sử. Một nghĩa mới nên có ID mới.
- Bộ từ: `foundation`, `ielts`, `personal`; một mục có thể có nhiều nhãn.
- Kho mặc định có 5.581 mục: phạm vi hai PDF Oxford Anh–Anh cũ, các đầu từ Mỹ và OPAL bổ sung, cụm động từ, thành ngữ/khẩu ngữ và Cambridge Blog. Giữ nguyên 5.323 dòng dữ kiện Oxford Anh–Anh và bằng chứng Mỹ riêng; các số dòng/từ loại không được đếm thành các từ đơn khác nhau. Có 27 thành ngữ đối chiếu với bài báo/chương trình Mỹ. Xem [SOURCES.md](public/data/SOURCES.md), [báo cáo rà toàn kho](docs/full-vocabulary-review-2026-10-21.md) và giấy phép dữ liệu.
- Các trường mở rộng: `content_status` (`reviewed`, `dictionary`, `reference`), `example_type`, `register`, `region`, `case_sensitive`. Mục nhập thông thường vẫn bắt buộc nghĩa và ví dụ. `dictionary` cho phép thiếu ví dụ khi nguồn không cung cấp, phải có nghĩa và nguồn; `reference` chỉ tra cứu và bắt buộc ID/từ/nguồn, không tạo bài kiểm tra. Không dùng giá trị giả để qua kiểm tra.
- Mặc định **5.581 mục được phép học** sau đợt rà nội dung toàn kho. `learning_status: ready` cho phép luyện; `lookup` vẫn chặn các mục nhập thêm hoặc mục cá nhân chưa được kiểm tra. Hàng rào chất lượng không bị bỏ: thêm từ vào danh sách không tự xác minh nghĩa/ví dụ. `definition_source: oewn` phân biệt giải nghĩa Anh có giấy phép WordNet với `authored` là phần biên soạn.
- Kho từ phân trang 60 mục, Slang/cụm động từ phân trang 24 mục. Slang có trang riêng và không tự chen vào kế hoạch từ mới Oxford. Cụm từ không được gán CEFR khi chưa có căn cứ.
- Kho từ giữ thứ tự CEFR A1–C2, rồi tần suất giảm dần trong cùng trình độ, rồi A–Z. Việc chọn từ cho phiên mới có bốn chế độ riêng: Thông minh, Ưu tiên thông dụng, Củng cố từ yếu và Trộn từ. CEFR chỉ hỗ trợ chọn; từ đến hạn và phiên đang học không bị chế độ mới xáo trộn. Mục chưa có CEFR/tần suất được ghi rõ, không bị coi là bằng chứng ít dùng. `frequency_zipf` và `frequency_source` ghi ước lượng cách viết tổng hợp từ wordfreq 3.1.1 cho 4.921 mục; không phân biệt nghĩa/từ loại/chữ hoa, không phải điểm Oxford hay tần suất riêng của thời sự Mỹ. Xem [phương pháp và giấy phép](data/frequency/README.md).
- Trong Slang, lọc **Loại cách nói → Thành ngữ** và **Nguồn ngữ cảnh → Bản tin / phỏng vấn** để tìm các cụm dài. `expression_type` phân biệt `idiom`, `slang`, `colloquialism`, `abbreviation`, `term`. Các trường `news_source`, `news_title`, `news_url`, `news_date`, `news_excerpt`, `news_context_vi`, `news_source_type` lưu ngữ cảnh có nguồn; `news_source_type` là `reporting` hoặc `language-lesson`, không gộp bài dạy tiếng Anh thành tin thời sự. Trích dẫn và ví dụ luyện tập được trình bày riêng. Xem [dấu vết đối chiếu 27 bài nguồn](public/data/news-provenance.json). Không tự tải tin mới khi người học mở web.
- Sửa file repository rồi triển khai lại. Chọn **Kho từ → Cập nhật kho mặc định** để xem trước và áp dụng phiên bản mới. Khi tải lại, ứng dụng báo nếu có bản mới và cho xem trước; không tự thay thế bản chỉnh sửa cá nhân.
- Hoặc chọn **Nhập .txt**, kiểm tra số thêm/sửa/lưu trữ rồi xác nhận. File lỗi bị từ chối toàn bộ với số dòng/mục; không ghi đè im lặng.
- Mỗi nguồn cập nhật lưu trữ những mục không còn xuất hiện trong cùng nguồn; lịch sử và lịch ôn vẫn còn. File cá nhân có ưu tiên so với mặc định khi trùng ID. Phần xem trước liệt kê thay đổi nội dung, những xung đột mặc định/cá nhân được giữ bản cá nhân.
- Sửa qua giao diện lưu tại trình duyệt, không sửa repository. **Tải kho .txt** xuất các mục đang hoạt động theo cùng định dạng. Trình duyệt không tự ghi đè file gốc.

## Cách học và đánh giá

**Hôm nay** ưu tiên lượt kỹ năng đến hạn trước các mục mới. Mặc định 5 mục mới/ngày, chỉnh được trong cài đặt; giảm đề xuất còn 2 khi tồn hơn 20 lượt ôn. Số mục đến hạn được đếm theo ID, khác số lượt kỹ năng.

Mỗi kỹ năng có lịch riêng: 1–3–7–14–30 ngày, sai quay về 1 ngày. Lượt đúng lần đầu, không gợi ý và đã đến hạn được tăng bậc, gồm cả tự đánh giá Nhớ rõ; không cần đủ điều kiện bằng chứng nhớ độc lập để điều chỉnh lịch. Lượt đúng có hỗ trợ giữ bậc và hẹn kiểm tra lại ngày mai; đúng trước hạn giữ nguyên lịch. Điều chỉnh lịch không tự chứng nhận thành thạo. Quên được hỏi lại sau tối đa ba câu xen kẽ nếu hàng đợi đủ dài; nếu không đủ thì nằm cuối hàng đợi. Ôn quá hạn không tự tính là quên. Ngày dùng múi giờ địa phương của trình duyệt.

Phiên học và các lượt đã gửi được lưu trong IndexedDB. Tải lại và tiếp tục không gửi lại kết quả đã lưu. Một lần ôn chỉ cập nhật lịch một lần; lượt luyện tự do lưu bằng chứng nhưng không thay đổi lịch. Mục tự đánh dấu đã biết được bỏ khỏi danh sách từ mới, không coi là đã kiểm tra. Luyện tự do không loại từ khỏi lần giới thiệu theo lịch; các phiên ôn đang dở được giữ riêng khi chuyển sang luyện tự do. Câu đang gõ được lưu nháp và phục hồi; kết quả đã gửi không bị gửi trùng.

Sáu kỹ năng được lưu riêng. Hiểu nghĩa và nghe nhớ nghĩa dùng tự đánh giá **Quên / Nhớ khó / Nhớ rõ**; tự đánh giá không được xem như kiểm tra khách quan. Nhớ để viết, nghe chính tả, điền ngữ cảnh được chấm theo đáp án khai báo, bỏ khoảng trắng thừa và không phân biệt hoa thường. Câu tự viết được lưu như trước, có thêm phản hồi về bảy nhóm cấu trúc giới hạn với tô lỗi, giải thích, gợi ý và lưu các bản sửa. Không phát hiện mẫu sai không có nghĩa câu đúng; nghĩa/ngữ cảnh/độ tự nhiên ghi rõ **Chưa thể chấm tự động**. Không có yêu cầu đến dịch vụ ngữ pháp hoặc AI.

Đợt sửa 20/10/2026 bổ sung từ loại/giải nghĩa cho bài nhớ từ và nghe chính tả bằng cả câu khi có ngữ cảnh phù hợp. Một số đáp án mơ hồ đã rà (cùng nghĩa Việt/từ loại, câu che từ cụ thể, nhóm đồng âm) được lưu là **chưa chấm**, kèm lý do; không tính đúng/sai, không đổi lịch hay tạo lượt sai lặp lại. Đây là bài nhớ từ mục tiêu, không phải bộ chấm mọi từ đồng nghĩa/câu tiếng Anh. Các mục phân biệt hoa/thường vẫn theo `case_sensitive`.

Kho từ, bộ sưu tập và thẻ từ trang chủ chỉ ghi tiếp xúc khi chính phần nghĩa hiện ít nhất 60% trong màn hình liên tục 700 ms, tab đang hiển thị và không bị che; không ghi hàng loạt vì tải một trang. Mở đáp án/chi tiết vẫn ghi tiếp xúc. Xem [tiến độ sửa và việc còn lại](docs/NEXT-SESSION.md).

Trong **Luyện tập → Hội thoại thực tế**, chọn nội dung B1/B2, dài 6 hoặc 8 lượt lời. Mỗi đoạn có hai nhân vật và bốn mục từ, bản dịch tùy chọn, nghe từng câu/toàn đoạn, câu hỏi hiểu–điền–nghĩa và trả lời mở chưa chấm. Chỉ ghi “phù hợp từ đã học” khi có ít nhất ba từ khớp dữ liệu học thực tế; trường hợp khác là bài mẫu, không giả cá nhân hóa. Ngữ cảnh đang hiện là hỗ trợ, không được gán bằng chứng nhớ độc lập.

“Nhớ khá vững” cho từng kỹ năng cần ít nhất 3 lần kiểm tra đúng lần đầu, không hỗ trợ, ở 3 ngày khác nhau, có một lần sau ít nhất 7 ngày không tiếp xúc đã ghi nhận, và chưa tiếp xúc lại đáp án ở bất kỳ kỹ năng nào trong 24 giờ trước. `exposureGap` đo từ mọi tiếp xúc đã biết, khác `gap` chỉ đo giữa hai lượt cùng kỹ năng. Dữ liệu cũ thiếu trường mới vẫn giữ nguyên, chưa đủ để suy diễn khoảng nghỉ 7/30 ngày. Kết quả phải khớp nghĩa hiện tại. Kỹ năng chỉ tự đánh giá chưa đủ điều kiện này. Đây là quy tắc của ứng dụng, không phải chứng nhận ngôn ngữ; không quy đổi số từ thành band IELTS. Chỉ số luôn kèm số lượt làm cơ sở; chưa có dữ liệu không tạo kết quả giả.

Bài nghe chỉ cho ghi nhận sau khi âm thanh kết thúc thành công; lỗi hoặc chưa phát không tạo điểm nghe. Phát âm dùng URL nếu có, giọng tổng hợp tiếng Anh của thiết bị là dự phòng, chỉ phát khi bấm. Có ưu tiên Anh–Anh/Anh–Mỹ và tốc độ. Giọng thật phụ thuộc hệ điều hành; không có giọng sẽ thông báo và cho bỏ qua bài nghe mà không lưu điểm.

## Sao lưu

**Cài đặt & sao lưu → Sao lưu toàn bộ JSON** để xuất kho từ (kể cả lưu trữ), bản sửa, câu tự viết và các phản hồi/phiên bản, kết quả hội thoại, tiến độ, lịch ôn, lịch sử, cài đặt và phiên học. JSON không chứa token đăng nhập. JSON khác file TXT chỉ chứa nội dung học.

Khôi phục JSON có xem trước và hai cách:

- **Hợp nhất**: lịch sử gộp theo ID lượt, không cộng trùng; mục và lịch trùng ID giữ bản hiện tại; giữ phiên hiện tại.
- **Thay thế**: ghi đè toàn bộ sau xác nhận rõ ràng. Hãy tải bản sao hiện tại trước.

IndexedDB v2 tách nội dung từ vựng khỏi tiến độ, nâng cấp từ dữ liệu v1 mà không xóa lịch sử. Các tab cùng thiết bị đồng bộ thay đổi; giao dịch phát hiện xung đột cùng phiên và từ chối ghi đè thay vì mất tiến độ. Nếu còn tab chạy bản rất cũ giữ kết nối v1, đóng tab đó rồi tải lại để nâng cấp nơi lưu.

Sau khi cấu hình Supabase Free, đăng nhập và chủ động liên kết, dữ liệu có thể đồng bộ giữa thiết bị bằng hợp nhất ba chiều và ghi có điều kiện theo revision; lịch sử viết/hội thoại/học cộng dồn bằng ID. Xung đột nội dung được chặn và yêu cầu chọn sau khi tải hai bản dự phòng. Không xóa dữ liệu khi đăng xuất; thay toàn bộ JSON hủy liên kết đồng bộ để cần xác nhận lại. Chưa có project nên đồng bộ thật/email/Google/RLS chưa được xác minh. Xem [hướng dẫn cấu hình và giới hạn](docs/services-setup.md).

Service worker bản production lưu ứng dụng và TXT đã đối chiếu hash để tải lại khi offline sau một lần chuẩn bị thành công. Không cache auth/API hoặc dữ liệu riêng. Giọng TTS ngoại tuyến tùy giọng đã cài của thiết bị. Dữ liệu vẫn có thể mất khi xóa dữ liệu trình duyệt, dùng chế độ riêng tư hoặc thay đổi địa chỉ website. Nên sao lưu thường xuyên và trước khi đổi miền. Font được đóng gói cục bộ, không yêu cầu Google Fonts.

## GitHub Pages

Đã có workflow `.github/workflows/pages.yml`, build/test và triển khai khi push lên `main`.

1. Trong repository, vào **Settings → Pages → Build and deployment → Source**, chọn **GitHub Actions** (cần quyền quản trị repository).
2. Push lên `main`, hoặc chạy workflow **Deploy Jeongyeon to GitHub Pages** thủ công từ Actions.
3. Khi job deploy thành công, lấy địa chỉ thật tại **Settings → Pages** hoặc kết quả workflow.

Vite dùng `base: './'`; nội dung lấy theo `import.meta.env.BASE_URL`. Điều hướng nội bộ không thêm đường dẫn nên tải lại trên GitHub Pages không gây 404. Không đưa thư mục `dist` hoặc `node_modules` lên Git.

## Cấu trúc

- `public/data/vocabulary.txt`: toàn bộ dữ liệu từ vựng mẫu, độc lập mã nguồn.
- `src/core.ts`: parser/serializer, hợp nhất, chấm đáp án, lịch ôn, đánh giá bằng chứng và kiểm tra backup.
- `src/storage.ts`: giao dịch IndexedDB v2, nâng cấp v1, tách nội dung/tiến độ và chống ghi đè giữa tab.
- `src/main.tsx`: bảy mục điều hướng hiện có, phiên học, âm thanh, nhập/xuất và tích hợp các nâng cấp.
- `src/recommendations.ts`, `src/analytics.ts`: chọn từ và phân tích bằng chứng riêng với thứ tự Kho từ.
- `src/conversations.ts`, `src/ConversationPractice.tsx`: nội dung hội thoại và bài luyện có kết quả thật.
- `src/writing.ts`, `src/WritingFeedback.tsx`: kiểm tra cấu trúc tại máy, phản hồi và các bản sửa.
- `src/practice-data.ts`: kiểu và kiểm tra dữ liệu bổ sung tương thích sao lưu cũ.
- `src/sync.ts`, `src/SyncSettings.tsx`, `supabase/schema.sql`: kết nối tùy chọn, hợp nhất, xác thực và quyền dữ liệu.
- `src/offline.ts`, `public/sw.js`: tải lại ngoại tuyến cho bản production.
- `src/DictionaryEntry.tsx`: trình bày mục từ kiểu từ điển, phân biệt nguồn Oxford và phần biên soạn.
- `src/style.css`: thiết kế responsive, thanh bên desktop/thanh dưới mobile.
- `src/core.test.ts`: kiểm thử quy tắc dữ liệu và bằng chứng.
- `e2e/app.spec.ts`: luồng Chromium, lưu bền, nhập kho, phục hồi, âm thanh không khả dụng, bố cục điện thoại.

## Giới hạn được biết

- Không chấm tổng quát ngữ nghĩa, độ tự nhiên hoặc phát âm; phản hồi viết chỉ nhận diện các cấu trúc đã hỗ trợ. Đồng bộ cần project Supabase Free; nghe nhớ nghĩa là tự đánh giá. Mỗi mục mới chỉ dạy một nghĩa được chọn; rà nguồn không phải chứng nhận của nhà xuất bản hay bảo đảm đúng tuyệt đối. Không suy CEFR, tần suất hoặc giọng Mỹ từ việc khớp WordNet.
- CEFR đối chiếu đầu từ/loại từ, không xác nhận riêng mọi nghĩa. Bản Anh–Anh cũ được giữ theo PDF đã khóa phiên bản; đợt 20/10 bổ sung hai PDF American Oxford chính thức tải trực tiếp. Xem nguồn, commit, SHA256 và từng dòng đối chiếu trong `public/data/oxford-provenance.json`.
- Trong cùng một phiên và lần ôn, thử lại không được tính như bằng chứng lần đầu. Nên dùng bài ngữ cảnh có đáp án duy nhất; dùng nút báo câu hỏi nếu ví dụ chưa đủ rõ.
- Kiểm thử trình duyệt kiểm tra đường đi giọng đọc không khả dụng, không xác nhận chất lượng âm thanh thực tế hoặc giọng của mọi thiết bị. Thử phát từ/câu trên thiết bị cá nhân trước bài nghe.
- Việc push mã nguồn không tự chứng minh GitHub Pages đã triển khai; cần Source GitHub Actions và workflow thành công.

`npm run test:production` kiểm tra bản `dist` bằng Chromium trên máy chủ tĩnh ở cả đường dẫn gốc và đường dẫn con tương tự GitHub Pages; kiểm tra kho từ, tải lại và thông báo khi JavaScript không tải được. Workflow chạy kiểm tra này trước khi xuất bản. Nếu gặp lỗi ứng dụng, trang hiện thông báo khôi phục thay vì khoảng trắng và không xóa dữ liệu học.

`npm run test:e2e` bao gồm phân trang kho hơn 5.000 mục, trang Slang/cụm động từ, cập nhật giữ tiến độ và bản sửa cá nhân. Các mục không có ngữ liệu không được tạo bài điền câu; mạo từ gộp a/an không tạo bài điền thiếu ngữ cảnh. Những từ phân biệt hoa/thường như May/may dùng quy tắc riêng khi chấm.

## Kiểm tra và tạo lại dữ liệu

`public/data/vocabulary.txt` là bản nội dung chuẩn có thể sửa trực tiếp. Build và dev tự tạo `vocabulary-version.json`; trình duyệt kiểm tra hash nhỏ trước khi tải lại toàn bộ kho. Tải lại hoặc cập nhật có xem trước, không áp dụng nguồn mới lên bản cá nhân im lặng.

`npm run test:data` dùng Python 3 thư viện chuẩn để kiểm tra các lỗi dữ liệu đã sửa, phạm vi và hash nguồn. CI chạy kiểm tra này, unit, toàn bộ E2E và production trước triển khai. Python không cần để chạy ứng dụng hoặc build thông thường.

Các overlay lịch sử (38 sửa ban đầu, đợt nguồn Mỹ/OPAL) được giữ nguyên. Overlay mới `data/authoring/full-review-2026-10.json` và các shard khai báo rõ từng ID đã rà, bằng chứng nguồn theo nghĩa và nội dung song ngữ. `scripts/apply-full-review.py` áp dụng sau các overlay cũ; xem `public/data/full-review-provenance.json`. Nội dung canonical vẫn là TXT và các bản sửa cá nhân giữ ưu tiên.

Các lệnh tạo dữ liệu mặc định chỉ xuất xem trước ra `/tmp`, không ghi đè TXT:

```sh
python3 scripts/apply-full-review.py
python3 scripts/apply-content-review.py
python3 scripts/build-full-corpus.py /workspace/scratch
```

Chỉ thêm `--write` sau khi duyệt diff. Công cụ giữ nội dung, ID, trường bổ sung và sửa tay của mọi mục hiện có. Full rebuild cần các extract nguồn đã đối chiếu ngoài checkout; phát triển/build web thông thường chỉ cần TXT đã commit.

Chín mục thành ngữ có liên kết video PBS do bài nguồn khai báo. Chưa xác minh phát trực tiếp hoặc timestamp của cụm từ, nên không tự tạo mốc thời gian hay biến liên kết đó thành âm thanh bài kiểm tra. Giao diện đã kiểm tra 320–430 px, 768 px và xoay ngang 844×390 bằng Chromium; chưa chứng nhận mọi thiết bị hay Safari iOS thật.
