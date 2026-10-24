# Rà lỗi học tập còn lại — 24/10/2026

Các vấn đề cần sửa trước nằm ở **chấm đáp án và diễn giải bằng chứng nhớ lâu**. Bản kiểm tra vẫn có thể đánh sai một câu trả lời hợp lý, tính lượt vừa thấy đáp án thành nhớ sau nhiều ngày, hoặc khôi phục nhãn nhớ vững ngay sau một lần quên. Những lỗi này có cách tái hiện cụ thể dưới đây; không suy rộng thành toàn bộ lịch ôn hay dữ liệu đều sai.

## Phạm vi và cách đọc bằng chứng

- Mốc rà ban đầu: commit `a918343`, kho **5.560 mục**. Các số dòng mã trong báo cáo đều theo mốc này; liên kết mở tệp tương ứng trong repository hiện tại.
- Đã đọc mã, kiểm tra dữ liệu và chạy probe trực tiếp qua bộ chấm, `core.record`, bộ chọn bằng chứng, phân tích, đồng bộ và service worker. UI dùng Chromium mới; có kiểm tra bản production, dữ liệu giả lập và các kích thước 320×568, 390×844, 844×320, 1440×1000.
- Mốc `a918343` đã đạt **335 unit, 37 kiểm thử dữ liệu, 109 E2E**, TypeScript và production/offline theo [báo cáo lần phát hành trước](usage-expansion-2026-10-23.md). Các ca đạt đó không bao phủ hết những tình huống mới trong báo cáo này và không phải kết quả QA của đợt sửa từ loại hôm nay.
- “Đã tái hiện” nghĩa là đã có đầu vào và kết quả quan sát được. “Giới hạn có điều kiện” nghĩa là vấn đề xuất hiện với dữ liệu/môi trường đã nêu. “Độ phủ sư phạm” là phần nội dung chưa có, không tự động là lỗi chấm hay dữ liệu sai.
- Probe gốc nằm ngoài repository tại `/workspace/scratch/re-audit-2026-10-24/{core,analytics,audio,content,data,ui}`; tên tệp bằng chứng được ghi ở từng mục. Báo cáo giữ các đầu vào và kết quả chính để có thể kiểm tra lại.
- Chưa kiểm tra Supabase thật, Safari/iPhone thật, giọng TTS thực tế trên thiết bị người học hoặc toàn bộ lịch sử cá nhân. Không có kết luận mới về mất dữ liệu, truy cập chéo tài khoản hay chất lượng phát âm của mọi thiết bị.

## Phần đã xử lý trong đợt từ loại hôm nay

Không tính các mục sau là lỗi còn lại. Chi tiết thay đổi và QA cuối đợt nằm ở [báo cáo từ loại](part-of-speech-2026-10-24.md).

- Bổ sung nhãn từ loại Việt–Anh nhất quán ở cả sáu kỹ năng, Kho từ, đáp án đã mở, từ điển, bộ sưu tập, phản hồi viết và phần từ mục tiêu trong transcript hội thoại. Nhãn ở bài truy hồi/nghe không kèm đầu từ để lộ đáp án.
- Hội thoại kiểm tra thêm từ loại kỳ vọng của từng ID: bản sửa cá nhân từ `research` danh từ sang động từ không tiếp tục nhận bài dùng danh từ chỉ vì đầu từ/nghĩa Việt còn giống nhau.
- Thêm **21 ID động từ**, gồm 19 cặp đầu từ–động từ A1: `clean, complete, cost, dress, drink, email, interest, love, match, name, open, park, phone, post, rain, shop, sound, telephone, welcome`; và hai động từ A2 `book, search`. Đây là 21 mục được chọn để học, không phải mọi nghĩa của các đầu từ đó.
- Kho hiện có **5.581 mục**, **367 mục có IPA**; 5.560 mục cũ được giữ nguyên từng byte ở phần đầu TXT. Không thay ID hay nghĩa danh từ/tính từ cũ để biến chúng thành động từ.
- Đã đọc trực tiếp 21 bài **Oxford Advanced American Dictionary**, có HTTP 200, URL, thời điểm, tiêu đề, SHA-256 và phạm vi nghĩa đã đối chiếu trong [dữ liệu biên soạn](../data/authoring/essential-senses-2026-10-24.json). CEFR dựa vào đúng mục từ loại trong American Oxford 3000; bản dịch Việt và ví dụ là nội dung tự biên soạn.
- Cambridge US trả HTTP 403/“Just a moment...” qua HTTP thông thường và Chromium; không đọc được mục từ. Người dùng đã chọn tiếp tục với Oxford American. **Không tuyên bố đợt này đã xác minh trực tiếp Cambridge American**, và không phân phối toàn văn bài từ điển.

## Lỗi còn lại đã tái hiện

### 1. Đáp án hợp lý bị ghi sai và hạ lịch ôn — P1

**Tái hiện:** Nhớ để viết cho `big` (“to; lớn”), nhập `large` (“lớn; to”); hai mục cùng adjective và cùng giải nghĩa Anh nhưng kết quả là `incorrect`. `begin` → `start` cũng vậy. Bài ngữ cảnh `The final question was ________ for most students.` cho mục `difficult`, nhập `hard` vẫn sai; `happy` → `glad` trong `I am ________ to see you.` cũng bị đánh sai.

**Tác động:** khi probe ghi kết quả thật với `scheduled=true`, lịch đang bậc 3 trở về bậc 0, đến hạn ngày mai; lịch sử tạo bằng chứng sai độc lập. Người học có thể bị phạt vì đề không đủ phân biệt từ mục tiêu.

**Mã/bằng chứng:** [src/assessment.ts](../src/assessment.ts), dòng 66, 87–129; [src/core.ts](../src/core.ts), dòng 654; `core/probe.json → grading`.

**Hướng sửa:** đáp án khác đã rà trong đúng nghĩa/câu nên giữ **trung tính**, không tính sai và cũng không cấp điểm nhớ từ đích. Rà nhóm cùng từ loại/nghĩa thay vì chỉ so nghĩa Việt nguyên chuỗi. Không thêm đồng nghĩa vào `accepted_answers` chung cho mọi ngữ cảnh; giữ đường báo đề mơ hồ. Việc xử lý kết quả chấm nhầm cũ cần dấu vết giải thích, không âm thầm viết lại lịch sử.

### 2. Xem trước đáp án không được ghi là tiếp xúc — P1

**Tái hiện trong trình duyệt:** chỉ có `difficult-01` đã tiếp xúc tám ngày trước; vào Luyện tập → Nhớ để viết. Phần trước nút Bắt đầu hiển thị `difficult:`. Sau 1,2 giây, map/sự kiện tiếp xúc vẫn không đổi. Bắt đầu, gõ `difficult` cho câu đầu: kết quả lưu `independent=true`, `exposureGap=691201732` ms; phân tích ghi một lượt nhớ sau khoảng nghỉ, không có lượt nhớ ngay.

**Tác động:** bằng chứng nhớ sau tám ngày thực tế có đáp án vừa được nhìn thấy. Luồng luyện tự do này **không đổi SRS**; lỗi đã chứng minh nằm ở thống kê và độ tin cậy suy luận nhớ lâu.

**Mã/bằng chứng:** [src/main.tsx](../src/main.tsx), dòng 2211–2216; ghi tiếp xúc hiện chỉ gắn ở các vùng khác, dòng 687/693; `core/probe.json → priming`, `ui/ui-audit.json → priming`.

**Hướng sửa:** trước bài cần tự nhớ, hiển thị lý do chọn/số lượng thay cho đầu từ sắp kiểm tra. Nếu cố ý cho xem đáp án thì ghi tiếp xúc và loại tín nhiệm nhớ độc lập cho lượt ngay sau đó. Dữ liệu cũ không đủ thông tin để biết chính xác ai đã nhìn phần xem trước.

### 3. Một câu đúng sau một phút khôi phục “Nhớ khá vững” sau lần quên — P1

**Tái hiện:** `appointment`, kỹ năng Nhớ để viết, có ba lượt đúng độc lập ở ngày −50/−40/−30, mỗi lượt cách tiếp xúc mười ngày. Trả lời sai ở lượt đến hạn: nhãn thành yếu, SRS bậc 0. Một phút sau, mở **phiên luyện tự do mới**, trả lời đúng; bản ghi đúng là `independent=false`, `exposureGap=60000`, `scheduled=false`. Phân tích lại trả `retained`, “Nhớ khá vững”; chế độ Củng cố từ yếu loại mục này và chế độ thông dụng giảm ưu tiên.

**Tác động:** bằng chứng cũ trước lần quên được dùng để xác nhận trạng thái hiện tại, dù chưa có lượt kiểm tra sau khoảng nghỉ kể từ lần quên. SRS vẫn bậc 0/ôn ngày mai; không phải lỗi tăng bậc lịch hay lỗi retry cùng phiên đã sửa trước đây.

**Mã/bằng chứng:** [src/evidence.ts](../src/evidence.ts), dòng 34–53; `analytics/probe-results.json → retainedRegression`, `core/retained-selection.json → beforeWeak/afterWeak`.

**Hướng sửa:** giữ bằng chứng đã từng nhớ vững trong lịch sử, nhưng yêu cầu kiểm tra phục hồi độc lập sau khoảng nghỉ kể từ lần sai/cần hỗ trợ mới nhất trước khi phục hồi nhãn hiện tại. Trong thời gian chờ, giữ mục trong nhóm cần củng cố và tránh giảm ưu tiên dựa vào nhãn cũ.

### 4. “Luyện nhiều nhưng còn yếu” đếm cả nghĩa đã thay — P2

**Tái hiện:** có tám kết quả đúng của nghĩa cũ `appointment`; dùng đường nhập/sửa cá nhân đổi cùng ID sang nghĩa bổ nhiệm, rồi trả lời sai một lần. Phân tích đúng là chỉ có một lượt khách quan của nghĩa hiện tại, nhưng vẫn đưa ID vào `overpracticedWeak` vì tổng lịch sử là chín.

**Tác động:** người học được báo luyện nhiều nhưng yếu trong khi nội dung hiện tại mới được kiểm tra một lần. Phần lớn chỉ số khác đã lọc phiên bản nghĩa đúng; không kết luận mọi thống kê đều dùng nghĩa cũ.

**Mã/bằng chứng:** [src/analytics.ts](../src/analytics.ts), dòng 483–490; `analytics/old-sense-results.json`.

**Hướng sửa:** chẩn đoán này đếm lượt cùng phiên bản nội dung, theo kỹ năng đang yếu. Giữ lịch sử nghĩa cũ ở nhật ký hoạt động tổng thể.

### 5. Đề xuất hội thoại không khớp từ được đề xuất; có thể dùng lịch sử nghĩa cũ — P2

**Tái hiện A:** chỉ có kết quả hợp lệ cho `drink` danh từ, `love` danh từ, `open` tính từ. Phân tích gợi ý “Thử dùng từ trong hội thoại” với ba ID đó; nút mở hội thoại bỏ danh sách ID. Cả ba đều ngoài 48 ID mục tiêu; 12 bài trả về đều `studied=0`, `personalized=false`.

**Tái hiện B:** chỉ tạo ba kết quả `contentVersion=obsolete-sense` cho `assignment/deadline/feedback`, chưa enroll. Đề xuất vẫn ghi `assignment-feedback` được cá nhân hóa, `studied=3/4` vì đọc wordId từ lịch sử thô.

**Tác động:** hành động được giải thích bằng các từ không thể luyện ở nơi được mở, hoặc bằng nghĩa cũ. Bài hội thoại vẫn dùng được; không có bằng chứng hai lỗi này tự tăng mastery hay SRS.

**Mã/bằng chứng:** [src/analytics.ts](../src/analytics.ts), dòng 568–578; [src/LearningInsights.tsx](../src/LearningInsights.tsx), dòng 132–133; [src/conversations.ts](../src/conversations.ts), dòng 1155; `analytics/probe-results.json → conversationAction`, `audio/probe.json → oldSensePersonalization`.

**Hướng sửa:** giao danh sách ID cho bộ chọn, chỉ hứa cá nhân hóa khi có giao với mục tiêu bài có thật; nếu không thì ghi rõ bài ví dụ chung. Dùng bộ chọn bằng chứng cùng phiên bản nội dung để tính đã học/yếu. Có thể thực hiện bằng nội dung tự biên soạn, không cần dịch vụ AI trả phí.

### 6. Quy tắc `discuss about` vẫn sửa nhầm cấu trúc xấp xỉ — P2

**Tái hiện:** `We discussed about double the usual number of cases.` bị yêu cầu bỏ `about`; `about` ở đây mang nghĩa xấp xỉ, nên sửa làm mất ý. `We discussed about another ten cases before lunch.` cũng bị sửa; `We discussed about noon whether to postpone the meeting.` còn thành `We discussed noon whether to postpone the meeting.`

**Tác động:** phản hồi lỗi cụ thể có thể dạy một lệnh cấm sai, dù giao diện đã nói bộ kiểm tra không chấm toàn câu. Quy tắc né `about as many…` đã sửa trước đây chưa bao phủ các cấu trúc này.

**Mã/bằng chứng:** [src/writing.ts](../src/writing.ts), dòng 75–88; `audio/probe.json → writing`.

**Hướng sửa:** chỉ gắn lỗi khi cấu trúc thuộc phạm vi chắc chắn; với trạng ngữ hoặc xấp xỉ còn mơ hồ, giữ chưa chấm. Thêm hồi quy cho các câu trên.

### 7. Hội thoại chọn giọng Anh–Anh khi ghi cài đặt en-US — P2, phụ thuộc giọng thiết bị

**Tái hiện:** Chromium với danh sách giọng mô phỏng gồm một en-US và một en-GB: sáu câu luân phiên US/GB, nhưng ghi chú vẫn en-US. Khi chỉ có en-GB, cả sáu câu dùng GB, ghi chú vẫn en-US.

**Tác động:** không nhất quán với lựa chọn giọng Mỹ và không báo đã dùng giọng thay thế. Đây là kiểm tra quyết định chọn giọng, **không phải** bản thu để kết luận phát âm thực tế của máy người học sai.

**Mã/bằng chứng:** [src/ConversationPractice.tsx](../src/ConversationPractice.tsx), dòng 259–266, 623–627; `audio/browser.json` ghi `utterance.lang/voice`.

**Hướng sửa:** dùng chung bộ chọn giọng tiếng Anh; ưu tiên cùng vùng cho cả hai người nói, dùng chung một giọng khi thiếu giọng Mỹ thứ hai, và hiển thị vùng/giọng thực tế khi phải thay thế.

### 8. Một số nghĩa Anh–Anh chưa được đánh dấu vùng — P2 về độ tự nhiên

**Tái hiện:** `queue` nghĩa hàng người/xe (`ox-00b109cf1123a5-01`) và `rubbish` nghĩa rác vật chất (`ox-71ca7d932e5a9b-01`) đều để trống `region`. Oxford đã đọc trực tiếp đánh dấu các nghĩa đó là British/especially British, với cách nói Bắc Mỹ `line`, `garbage/trash`. Bài American tương ứng chọn nghĩa máy tính cho queue, nghĩa lời vô lý cho rubbish.

**Tác động:** người học có thể hiểu đây là lựa chọn mặc định trong tiếng Mỹ. Các từ Anh–Anh vẫn đúng; `flat/holiday` đã có ghi chú vùng, còn `pants/biscuit/football` đã được sửa nên không liệt kê lại là lỗi còn tồn tại.

**Mã/nguồn:** [src/DictionaryEntry.tsx](../src/DictionaryEntry.tsx), dòng 172–186; [queue](https://www.oxfordlearnersdictionaries.com/definition/english/queue_1), [rubbish](https://www.oxfordlearnersdictionaries.com/definition/english/rubbish_1), bài [American queue](https://www.oxfordlearnersdictionaries.com/definition/american_english/queue_1) và [American rubbish](https://www.oxfordlearnersdictionaries.com/definition/american_english/rubbish), đều HTTP 200 ngày 24/10; metadata tại `content/queue*.json`, `content/rubbish*.json`.

**Hướng sửa:** thêm nhãn vùng và từ tương ứng thông dụng tại Mỹ. Không đưa các cặp khác từ này vào `spelling_variants`.

### 9. Bookmark có query không mở lại được offline — P2

**Tái hiện:** dùng build production, chuẩn bị cache rồi tắt mạng: `/` mở lại được; `/?utm_source=bookmark` báo `net::ERR_INTERNET_DISCONNECTED` vì service worker bỏ mọi URL có `url.search` trước nhánh navigation.

**Tác động:** cùng ứng dụng đã sẵn sàng offline nhưng link chia sẻ/bookmark kèm query không vào được. Không phải lỗi chung của URL chuẩn.

**Mã/bằng chứng:** [public/sw.js](../public/sw.js), dòng 232; `data/offline-query.json`.

**Hướng sửa:** nhận diện navigation tới app shell theo pathname và dùng shell cache chuẩn với query phù hợp. Giữ kiểm tra không cache token, API hay request riêng tư.

### 10. Snapshot đồng bộ chạm trần khi lịch sử tích lũy — P2, giới hạn có điều kiện

**Tái hiện:** bộ mã hóa thật với kho 5.560 mục và mỗi lượt gồm một Result hợp lệ, một ExposureEvent liên kết, cùng bảng exposures: 0 lượt = **9,470 MiB** raw; 10.000 = **15,032 MiB**; 15.000 = **17,750 MiB**; 20.000 = **20,470 MiB**, bị từ chối vượt 20 MiB. Trần áp trước nén; con số chưa cộng bài viết/hội thoại và nhiều lượt mở thẻ.

**Tác động:** khi đạt dung lượng đó, học cục bộ vẫn chạy và dữ liệu không bị xóa, nhưng snapshot mới không tải lên thiết bị khác. Đây là khả năng dài hạn đã đo trên dữ liệu tổng hợp, **không phải sự cố cloud hiện tại**; chưa có project Supabase thật để kiểm tra. Không quy đổi 20.000 lượt thành một mốc ngày cố định.

**Mã/bằng chứng:** [src/sync.ts](../src/sync.ts), dòng 547–605; `data/measure-with-exposure.json`.

**Hướng sửa:** nội dung mặc định đồng bộ bằng ID+version, chỉ gửi override cá nhân; chia lịch sử/sự kiện bất biến thành record/chunk và đồng bộ phần thay đổi. Giữ khóa phiên bản nghĩa, merge an toàn và khả năng xuất JSON; chỉ tăng trần không giải quyết nguyên nhân.

### 11. Asset của các build cũ tích lũy trong cache — P3

**Tái hiện:** chạy chính `cacheShell` với ba shell lần lượt dùng JS hash `aaaaaa/bbbbbb/cccccc`; shell cuối trỏ `cccccc` nhưng cache `v1` vẫn giữ cả ba tệp. Activate chỉ dọn tên cache khác, không dọn hash cũ trong cùng cache.

**Tác động:** dung lượng cache tăng qua các lần phát hành; chưa có bằng chứng làm mất IndexedDB hay chạm quota trên máy người học.

**Mã/bằng chứng:** [public/sw.js](../public/sw.js), dòng 4, 85–107, 168–173; `data/cache-growth.json`.

**Hướng sửa:** cache theo phiên bản build, có quy tắc giữ asset tab cũ đang dùng và dọn phiên bản hết client. Không xóa tiến độ học để giải phóng cache.

### 12. Nút “Thêm từ” bị ngắt giữa chữ — P3

**Tái hiện:** Kho từ thật ở 844×320: nút 77,84×74 px, chữ thành ba dòng `Th` / `êm` / `từ`; ở 1440×1000 thành hai dòng. 320/390 px giữ một dòng; không thấy tràn ngang hay lỗi JavaScript trong bốn kích thước đã thử.

**Tác động/hướng sửa:** giảm khả năng đọc nhưng nút vẫn bấm được. Ngăn nút co và ngắt chữ (`flex-shrink: 0`, `white-space: nowrap`), cho phần mô tả xuống dòng sớm hơn. [src/main.tsx](../src/main.tsx), dòng 1830–1874; [src/style.css](../src/style.css), dòng 763, 1631, 1863; `ui/ui-audit.json → library`.

## Độ phủ sư phạm và lựa chọn thiết kế cần ưu tiên tiếp

- **Có đầu từ chưa có nghĩa là đủ từ loại/nghĩa.** 21 động từ trên đã bổ sung; vẫn nên rà `work` danh từ, `fast` trạng từ, nghĩa “quà tặng” của `present` và “lỡ xe” của `miss`. Bộ lọc tại mốc cũ cho ra **718 ứng viên** thiếu cặp đầu từ–từ loại sau loại một sửa chữa đã biết; đây không phải 718 lỗi đã xác minh hay 718 thẻ bắt buộc thêm. Có khác biệt quy ước phân loại, alias và nghĩa cần người rà.
- **Cách dùng còn hẹp:** 144 mục có bổ sung cấu trúc/câu thứ hai; sau thêm từ là **144/5.581 (~2,58%)**, còn **5.437** mục chỉ có ví dụ gốc. Có 40 mục usage có trường tính đếm được; không được hiểu là toàn kho chỉ có 40 mục dạy tính đếm được, vì ghi chú canonical cũng có nội dung này.
- **Dạng động từ/cụm từ cần lộ trình riêng:** chưa có trường principal parts/biến tố có cấu trúc cho toàn kho; các từ phổ biến như `go/get/take/buy/run/teach/write` chưa được bao phủ đầy đủ bằng ghi chú dạng quá khứ/phân từ. Một số mục như `lie` và vài động từ mới đã có lưu ý, nên không nói mọi động từ đều thiếu. Nghiên cứu OPAL có 586 đầu mục pattern nhưng nhiều mục là khung mở; nên chọn cụm hữu ích, không nhập tự động tất cả thành thẻ đáp án cố định.
- **Nghe/hội thoại:** vẫn 12 bài, 48 ID mục tiêu và không có URL audio nguồn mặc định; 367 IPA không tương đương có bản thu đã kiểm chứng. Bài điền từ hội thoại hiện khớp nguyên đáp án: `study` trong `So the ____ isn't necessarily wrong, but the headline goes too far?` bị coi sai vì bài muốn `source`. Cần ghi rõ mục tiêu khôi phục lời gốc, hoặc giữ trung tính các cách điền hợp lý đã rà; không tự coi mọi từ đồng nghĩa đều đúng.
- **Tự đánh giá/viết:** ba lần tự báo “Không nhớ” vẫn hạ lịch đúng nhưng không vào bằng chứng khách quan hay chế độ từ yếu; có thể thêm nhóm yếu tự báo riêng. Bộ kiểm tra viết miễn phí chỉ có bảy nhóm quy tắc, không phát hiện lỗi không có nghĩa là câu đúng; câu chưa dùng từ mục tiêu vẫn được lưu `ungraded`, không tạo mastery giả. Chứng nhận tự dùng cần bằng chứng đã xác minh và hiện không đạt qua bộ kiểm tra tại máy; UI đã nói rõ, nên không gọi đây là tuyên bố thành thạo sai.
- **Chọn từ mới:** hồ sơ trống ở chế độ Thông minh vẫn ưu tiên nhiều từ chức năng rất cơ bản. Đã có cài đặt ngưỡng CEFR cho từ mới; nên giúp người đã có nền tảng chọn ngưỡng/đánh dấu đã biết. Không cần chuyển ứng dụng thành khóa học nhập môn.

Thứ tự xử lý đề nghị: sửa ba lỗi P1 để bảo vệ chấm bài và bằng chứng nhớ; tiếp theo là các chẩn đoán/cá nhân hóa P2, phản hồi viết và nhãn vùng/giọng; xử lý offline query; thiết kế đồng bộ dài hạn trước khi lịch sử lớn. Mở rộng nội dung theo nghĩa/từ loại/cấu trúc đã xác minh, giữ ID cũ và mức độ chắc chắn của phản hồi.
