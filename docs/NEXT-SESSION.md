# Jeongyeon — ghi nhớ cho phiên sửa tiếp theo

Đã hoàn tất yêu cầu ngày 30/10; kiểm thử và bàn giao **31/10/2026**. Báo cáo hiện hành: [whole-vocabulary-contexts-2026-10-30.md](whole-vocabulary-contexts-2026-10-30.md).

- Toàn bộ **5.586 ID/nghĩa/POS** có ngữ cảnh thứ hai: 203 bài sâu cũ giữ nguyên + 5.383 câu Anh–Việt/cụm minh họa mới, đã rà độc lập bằng mô hình và ràng buộc hash. 0 mục thiếu. Không gọi nguồn định nghĩa là chứng nhận mọi quy tắc ngữ pháp.
- 836 phiếu/790 URL cho lớp mới; 4.986 mục có body cache khớp hash, 397 phiếu lịch sử thiếu body hiện tại. 44 tệp OEWN tải lại 30/10 đúng hash; Oxford/Cambridge mẫu vẫn bị proxy403, giữ ngày đọc cũ. TXT 8.916.954 byte/SHA bfedc903… và 203 bài sâu không đổi.
- Thêm lượt hội thoại mới sau ≥24h với lời/đáp án cũ ẩn; retry vẫn có hỗ trợ, không cấp nhớ vững/SRS. Giãn 60/90/180 ngày chỉ với kỹ năng khách quan đã đủ bằng chứng; tự đánh giá ≤30 ngày; queue đang dở không đổi.
- Tìm kiếm ưu tiên đầu từ/cách viết/dạng đã đối chiếu khớp chính xác; các kết quả còn lại và thứ tự học giữ nguyên. Khi sửa nghĩa/POS cá nhân, phần mở rộng nghĩa cũ không được gắn nhầm.
- **517 unit/37 tệp,46 data + audit độ phủ/nguồn,160/160 Chromium toàn lượt, TypeScript/build và production gốc/đường dẫn con offline/UTM đều đạt.** Gói JS 5,33 MB/gzip 1,47 MB do chứa nội dung offline; chưa đo điện thoại thật.
- Giới hạn công bố: TTS thiết bị; không chấm ngữ pháp tổng quát; Supabase thật cần dự án của người dùng; chưa kiểm Safari/iPhone thật. Không biến các giới hạn này thành chức năng giả hoặc tuyên bố đã thử dịch vụ thật.
- CI dùng hai worker và ngân sách 20 giây cho hai phép quét toàn kho; không bỏ mục hoặc assertion. Bản đầu gặp timeout 5 giây trên runner, đã tối ưu quét dữ liệu và điều chỉnh ngân sách. Kết quả triển khai cuối được xác nhận trong thông báo bàn giao.
- Đợt này đã đóng phạm vi. Không tự khởi động thêm vòng rà/mở rộng khi chưa có yêu cầu mới. Người dùng đã cho phép commit/push; xác nhận triển khai trong thông báo bàn giao của phiên.



Mốc lịch sử **28/10/2026 — mở rộng bài nghe theo yêu cầu mới**. Báo cáo: [listening-upgrade-2026-10-28.md](listening-upgrade-2026-10-28.md).

- Thêm 30 bài nghe (10 B1/14 B2/6 C1), tổng44bài;272lượt thoại/120câu hỏi/97IDhiện có được luyện trong bài. Dữ liệu tự biên soạn Anh–Mỹ, giọng TTS thiết bị, không giả bản thu nhà xuất bản. Mức B1–C1 do Jeongyeon gợi ý, không phải chứng nhận độ khó/band.
- Bài mới mặc định nghe trước, ẩn lời/nghĩa/câu hỏi trước khi nghe xong; lỗi/dừng không có kết quả nghe, mở lời/retry đánh dấu hỗ trợ. Nghe/từng câu/toàn bài/tốc độ/tìm Việt không dấu+English/C1, lưu nháp và kết quả. Giữ14bài cũ nguyên byte/version.
- Đáp án chưa khớp ở1/3/4 chờ người học chọn tính sai hoặc lưu không chấm trước khi ghi lịch sử/SRS. Nháp giữ timing/audio/context qua pause/reload/JSON; không hồi tố sửa kết quả cũ, không cấp điểm đúng khi người học cho rằng đề mơ hồ.
- Phiên ôn mới tối đa40lượt/ngân sách cơ sở20phút;oldestdue→học dở→từ mới nguyên nhóm. Phần còn lại giữ nguyên due; dừng từ mới nếu còn backlog chưa vừa. Phiên đã lưu không thay queue. SRS1–3–7–14–30 giữ nguyên.
- Weakmode nhận tự báo quên skill2 đã phát audio, tách theo kỹ năng; không biến self thành objective. Tiến độ tách listen-first/contextmeaning khỏi điểm nhớ lâu; bộ sửa viết không tự sửa literal look-forward-to-see.
- Thêm16supplements B1–C1 vào group-n, tổng203/253URL metadata. Reread16bài Oxford American HTML lưu20–21Oct/hashverified; không nhận đã mở online khi proxy403. TXT5.586mục/SHA bfedc903… và187supplements cũ nguyênbyte.
- Kiểm thử tích hợp:492unit/46data/153caChromiumđãđạt (148lượttoànbộ+5chạylạiđạt); TypeScript/productionroot+subpathonline/offlinebao gồm6C1/nghetrước/44bàiđạt. Kiểm thử audio dùngmockđểxácminhbằngchứng, khônggọilàđãràgiọngthậtcủangườidùng.
- Giới hạn cần công bố: TTS theo thiết bị, chưa chấm nói/viết toàn diện, chưa kiểm Safari/iPhone thật/Supabase thật; đồng bộ thật cần cấu hình bên ngoài. Không tự mở rộng phạm vi hoặc đổi SRS thêm sau bàn giao.

## Mốc ổn định 28/10/2026 (lịch sử, trước yêu cầu thêm bài nghe)

Cập nhật **28/10/2026**: chốt đợt ổn định với phạm vi cố định, theo yêu cầu dừng vòng sửa/mở rộng liên tục của người dùng. Báo cáo hiện hành: [stable-release-2026-10-28.md](stable-release-2026-10-28.md).

- Phạm vi: biến thể chính tả hợp lệ; đáp án mơ hồ đã xác nhận; bộ lọc lộ đáp án; củng cố hội thoại; dự báo/ước lượng phiên; cập nhật cặp TXT/manifest offline an toàn.
- Đã sửa các lỗi trên và thêm hồi quy. Không thêm từ, cách dùng, hội thoại, trang, API trả phí hoặc dependency; giữ nguyên ID, TXT, lịch sử, SRS, queue/context/nháp đang dở và định dạng sao lưu.
- Đáp án okay/Okay và e-mail áp dụng bằng lớp chính tả hẹp theo ID/POS/nghĩa đã rà; không đổi contentKey. close/shut và sick/ill trung tính trong đúng nghĩa/câu đã kiểm, không chấp nhận đồng nghĩa đại trà.
- Hội thoại không gỡ điểm yếu bằng retry/có gợi ý/đúng tức thì; lượt mới không gợi ý sau ≥24h chỉ gỡ đề xuất của hội thoại, không tự chứng nhận nhớ vững.
- Dự báo Hôm nay gồm quá hạn; Home và Start dùng chung kế hoạch cho ước lượng theo kỹ năng. Bộ lọc chi tiết chỉ hiển thị ở Kho từ, không lộ chữ tiếng Anh trước bài nhớ.
- Cache v3 lưu TXT và manifest chung một bản ghi; lỗi cập nhật giữ bản hợp lệ cũ; chuyển cache v2 có xác minh và fallback khi thiếu dung lượng. Không chạm IndexedDB người học.
- Kiểm thử chốt: **468 unit, 46 data, 144 Chromium**, TypeScript/build và production gốc/con/offline/UTM đạt; metadata nguồn 187 mục/237 URL đạt. Nguồn chính tả dùng phiếu đọc trực tiếp ngày 27/10; truy cập lại Oxford ngày 28/10 bị proxy 403, không gọi là lần xác minh mới.
- **Điểm dừng:** đóng các lỗi đã xác nhận trong phạm vi trên, kiểm thử toàn bộ luồng học và triển khai. Không tự biến các giới hạn phát triển dài hạn thành điều kiện chưa hoàn thành, không tự bắt đầu vòng rà toàn kho/tăng nội dung tiếp theo.
- Giới hạn ngoài đợt này: coverage cách dùng, giãn SRS/ngân sách phiên mới, chấm viết tổng quát, kiến trúc delta cloud, Safari/iPhone thật và dịch vụ Supabase thật. Chỉ làm tiếp khi có yêu cầu mới.

## Mốc bàn giao 27/10/2026 (lịch sử)

Tiếp tục chiều sâu cách dùng, tra cứu và bằng chứng mặt chữ. Báo cáo: [usage-expansion-2026-10-27.md](usage-expansion-2026-10-27.md). Các mốc dưới đây là lịch sử.

- Thêm 32 động từ ở group-k/l/m: đủ 21 động từ bổ sung ngày 24/10 và 11 bất quy tắc phổ biến. Usage tăng 155→187, bảng dạng 7→39; đọc/rà độc lập 60 URL Oxford (32 American, 28 British phụ về dạng), live 60/60; metadata toàn bộ 187 mục / 237 URL đạt.
- Không đổi byte TXT/version/155 supplements cũ. Vẫn 5.586 mục, 372 IPA; hash canonical giữ bfedc90307e912b5dd19f2620f92a45e0704b67054ef7a1070273fe2464209bb. Không mở rộng accepted_answers bằng các biến tố.
- Kho từ tìm được dạng như went/go, drank/drink, cấu trúc và tiếng Việt không dấu. Cache theo nội dung hiện tại; không lấy câu sai/ví dụ/URL làm bí danh, không đổi thứ tự học/queue. Mục cá nhân khác nghĩa/POS không nhận supplement gốc.
- ExposureEvent thêm writtenForms tùy chọn, chỉ ghi ô bảng thực sự hiện 60%/700ms. Snapshot mặt chữ giữ qua JSON/merge/compact; skills1/3/4 dùng để giảm tín nhiệm chữ vừa nhìn, không gộp meaning/SRS hoặc tự cho exposed ở ID khác. Không ghi khi bảng ngoài viewport/đóng/tab ẩn. Hybrid forms+resultId bị từ chối, quan sát riêng cùng timestamp vẫn được xét.
- Nội dung và observer đã rà độc lập; không gán lại forms cho lịch sử cũ thiếu dữ kiện. Còn 5.399 mục chưa có usage riêng; nghe vẫn TTS, chưa Safari/iPhone thật hoặc Supabase thật.
- Kiểm thử cuối: **430 unit, 46 data, 138 Chromium**, TypeScript và production root/subpath/offline/UTM đạt. Một selector E2E cũ chọn avoid được cập nhật để không nhầm với collocation avoid bias; kiểm bảo toàn dữ liệu giữ nguyên. Nguồn mới live 60/60; metadata 187 mục / 237 URL đạt.

## Mốc bàn giao 25/10/2026 (lịch sử)

Cập nhật **25/10/2026**: đã sửa đợt audit trên mốc 1657d31, không xây lại website. Báo cáo hiện hành: [learning-integrity-2026-10-25.md](learning-integrity-2026-10-25.md). Các phần 24/10 và trước đó phía dưới là lịch sử, không phải danh sách lỗi còn mở hiện tại.

- Chấm trung tính cho các cặp/câu đã rà, thêm đường bỏ qua chấm đề chưa rõ; không phạt SRS hay cấp điểm nhớ từ đích. Không tuyên bố chấm mọi đồng nghĩa/ngữ pháp.
- Ẩn đáp án preview; ghi sự kiện tiếp xúc bất biến cả khi đọc nhiều từ; priming cùng mặt chữ khác ID/POS làm giảm bằng chứng truy hồi chữ. Không gộp nghĩa/SRS. Sau lần quên/gợi ý phải có phục hồi độc lập sau ít nhất 24 giờ; sửa ngay không hồi sinh retained.
- Chẩn đoán dùng đúng phiên bản nghĩa; 21 động từ mới dùng tần suất exact-spelling có provenance; từ yếu tự báo Hiểu nghĩa được luyện với nhãn riêng; tính lại due/hạn mức ngay khi lập phiên mới. Giữ queue đang học.
- Ô nhập tránh fixed nav, có kiểm chạm thật ở 390 px và ngang; nút Thêm từ không ngắt chữ. Hội thoại truyền đúng ID, không cá nhân hóa theo nghĩa cũ, dùng đúng vùng giọng/fallback. Hai bài mới, tổng 14 bài / 55 ID mục tiêu; 12 bài cũ nguyên dữ liệu.
- Kho **5.586 mục / 5.352 đầu từ**, **372 IPA**. Thêm work noun, fast/hard adverb, present gift, miss transport; 155 mục cách dùng, 42 ghi chú tính đếm được, 7 bảng dạng động từ. Đã đọc 15 URL Oxford (13 cho cách dùng và 2 cho vùng); 13/13 URL live và metadata của 155 mục / 177 URL đạt. Cambridge vẫn không được tự nhận đã đối chiếu. Năm mục mới có manifest/fact/receipt và giữ nguyên 5.581 mục cũ từng byte.
- Hash TXT `bfedc90307e912b5dd19f2620f92a45e0704b67054ef7a1070273fe2464209bb`; prefix 5.581 mục có hash `7b7f899ff643473eb48e80d3d64a3cfaa8293c7c27571151dd52a613f30aae2e`. Loader/Python kiểm đúng từ loại và tiêu đề nguồn và cách viết được khai báo, các manifest 22/10 và 24/10 không đổi.
- Bookmark UTM mở offline; dọn cache giữ asset cho tab cũ. Cloud dùng compact lossless + gzip, 50.000 Result kèm Exposure roundtrip đạt. Vẫn là snapshot CAS có giới hạn, chưa phải delta; client cũ cần cập nhật để đọc transport mới. JSON backup và schema State giữ nguyên, không cần API trả phí.
- **Còn lại:** mở rộng coverage theo nghĩa/cấu trúc đã đọc (5.431 mục chưa có cách dùng bổ sung), nghe vẫn phần lớn dựa TTS, chưa kiểm Safari/iPhone thật, chưa có Supabase thật. Bundle chưa tách gói; cần thiết kế cache offline tương thích trước khi chia.
- Kiểm thử cuối: **417 unit, 46 data, 131 Chromium E2E**, TypeScript và production root/subpath/offline/UTM đạt. Nguồn usage mới live 13/13; metadata 155 mục / 177 URL đạt. Người dùng đã cho phép commit/push sau kiểm tra; không hỏi lại.

## Mốc bàn giao 24/10/2026 (lịch sử)

Cập nhật **24/10/2026**: người dùng yêu cầu rà lỗi học tập, sau đó yêu cầu từ loại theo Cambridge American. Cambridge bị 403; họ đã đồng ý dùng Oxford American. Đã bổ sung nhãn Việt–Anh nhất quán và 21 mục động từ có nguồn. Kho hiện **5.581 mục / 5.352 đầu từ**, **367 IPA**; prefix 5.560 mục cũ giữ nguyên từng byte. Manifest mới `essential-senses-2026-10-24.json` nối tiếp manifest 22/10 bất biến. Hash hiện `7b7f899ff643473eb48e80d3d64a3cfaa8293c7c27571151dd52a613f30aae2e`.

Báo cáo mới: [từ loại](part-of-speech-2026-10-24.md) và [audit các lỗi học tập](audit-learning-2026-10-24.md). Các phần 23/10 bên dưới là lịch sử. Người dùng đã cho phép commit/push sau khi nguồn và kiểm thử đạt; không hỏi lại. Không gắn nhãn Cambridge cho nguồn Oxford.

**Ưu tiên sửa tiếp theo theo audit:**

1. Đáp án đồng nghĩa hợp ngữ cảnh bị đánh sai và hạ lịch ôn.
2. Preview tiếng Anh trước Start không ghi tiếp xúc, làm sai bằng chứng nhớ sau tám ngày.
3. Nhãn retained phục hồi từ bằng chứng cũ sau một lần quên rồi đúng lại 60 giây sau ở phiên mới; chế độ từ yếu cũng bị ảnh hưởng.
4. Chẩn đoán luyện nhiều còn yếu lấy cả lịch sử nghĩa cũ; đề xuất hội thoại bỏ danh sách ID và dùng lịch sử cũ.
5. Quy tắc discuss-about còn sửa nhầm lượng xấp xỉ; giọng hội thoại có thể trộn US/GB dù ghi en-US.
6. Offline với query URL, cache build cũ và trần snapshot 20 MiB cần xử lý theo bằng chứng trong báo cáo.

Đợt từ loại **chưa sửa** các lỗi này. Đừng nhầm chúng với các lỗi đã sửa ở mốc 23/10.

**Phần từ loại đã làm:** helper cho 22 nhãn; hiển thị ở Kho từ, sáu kỹ năng, đáp án, từ điển, bộ sưu tập, viết và giải nghĩa hội thoại. Che chữ English trong nhãn nếu nó trùng chính đáp án đang cần nhớ (ví dụ noun). Hội thoại kiểm thêm POS kỳ vọng. Nhãn cá nhân lạ giữ nguyên, thiếu nhãn hiện chưa khai báo, idiom/phrase có caption dạng từ/cụm.

21 ID động từ mới gồm 19 mục A1 và book/search A2. Email chấp nhận e-mail. Không đổi schema hoặc ID cũ. Nguồn là PDF American Oxford và 21 bài Oxford American đã đọc trực tiếp. Khi append, kiểm hash prefix; khi replay đủ các đợt, giữ ghi chú prefix không thuộc lớp bổ sung và bytes đầu vào. Source-update phải gắn lại tail đã xác minh, không bỏ các đợt cũ. Xem kiểm thử Python về ghi chú riêng và replay CLI.

Kiểm thử bản mới: **343 unit, 45 data, 114 Chromium**, TypeScript/build và production gốc/con/offline đạt; nguồn mới21/21 khớp body/receipt/NAmE IPA. Các test cũ vẫn giữ điều kiện dữ liệu/chấm bài, chỉ chuyển vị trí kiểm nhãn POS. Xem báo cáo đợt mới cho giới hạn kiểm thử.

## Mốc bàn giao 23/10/2026

Cập nhật 23/10/2026. Đợt sửa theo kiểm tra tổng thể đã triển khai các lỗi lịch khác nghĩa, thống kê không thống nhất, lựa chọn từ lặp, thứ tự kỹ năng, chấm đáp án mơ hồ, phản hồi discuss, nháp viết và mobile. Đã bổ sung hai nghĩa A1 của like/lie theo Oxford American, kho hiện có 5.560 mục sẵn học và 346 IPA. Giữ nguyên 5.558 mục cũ từng byte. Không cần rà lại nguồn từ đầu. Người dùng đã cho phép commit/push sau khi nguồn và kiểm thử đạt.

**Kiểm thử bàn giao mới nhất:** 335 unit, 37 data và 109 E2E Chromium đạt; TypeScript/build, production đường dẫn gốc/con, offline và thông báo thiếu JavaScript đạt. Báo cáo hiện hành: [usage-expansion-2026-10-23.md](usage-expansion-2026-10-23.md). Đợt sửa độ tin cậy trước hai đợt mở rộng có 333 unit/100 E2E, xem [learning-reliability-2026-10-23.md](learning-reliability-2026-10-23.md). Không coi Supabase mô phỏng là kiểm thử cloud thật.

**Phần còn lại thực sự:** cách dùng/ngữ cảnh thứ hai hiện có 144 mục; 5.416 mục còn lại vẫn một câu, 12 hội thoại/48 ID mục tiêu, phần lớn phát âm còn dựa TTS. Chưa có Supabase thật; snapshot cloud vẫn chứa toàn kho và giới hạn 20 MiB, chưa chuyển sang delta. Chưa chấm ngữ pháp tổng quát hoặc tự nhận đã phủ mọi nghĩa của mỗi đầu từ. Đây là các giới hạn phát triển tiếp, không phải những lỗi đã sửa bên dưới còn đang tồn tại.

## Mở rộng cách dùng — đợt 2, 23/10/2026

- Tiếp tục sau commit 8eac9c4: thêm 48 mục ở group-f/g/h.json, nâng tổng 96→144; 40 mục có ghi chú tính đếm được. Kho TXT vẫn 5.560 mục, không đổi byte/ID/phiên bản nội dung/lịch sử/lịch ôn. Mục cũ a-e giữ nguyên.
- Nhóm mới: 16 động từ cấu trúc/giới từ; 16 danh từ phân biệt C/U theo nghĩa; 16 tính từ giới từ và cấu trúc dễ nhầm. Search chỉ có noun nên dùng permit; rely có bài điều hướng tới rely-on thay vì định nghĩa tại bài chính nên dùng concentrate. Không sửa canonical để lấp nhóm.
- Đã đọc/rà nguồn trực tiếp và rà nội dung độc lập. 48 mục dẫn 65 URL Oxford American, 62 URL chưa có ở a-e, 3 nguồn dùng lại. Live65/65, receipt65/65 khớp cache gốc, offline toàn bộ144mục/164URL đạt. Nhận dạng nguồn không tự chứng nhận quy tắc/ví dụ.
- Sửa draft tránh kết luận sai với attend to, enter into, grateful for hoặc insist+indicative vốn có thể hợp lệ ở ngữ cảnh khác. different from/than có lưu ý vùng; business/room/glass/chicken/paper/time/success bám đúng nghĩa. Câu mới của mỗi mục khác bối cảnh câu canonical; synonym chỉ trung tính theo đúng câu.
- Bổ sung hai ca UI320/390 thật trong e2e/usage-expansion.spec.ts: tạo các snapshot câu2 spend/paper/familiar từ lịch sử câu1, giữ nháp qua reload và xuất/validate JSON thật; lịch sử và lịch ôn không đổi. scripts/check-production.mjs kiểm suggest và cả3nhóm mới, filter144, online/offline ở gốc/con.
- Giữ thiết kế và schema lưu trữ, không thêm dependency/API. Dùng bộ lọc đã có Kho từ → Trạng thái → Có cách dùng đã đối chiếu. Báo cáo hiện hành: [usage-expansion-2026-10-23.md](usage-expansion-2026-10-23.md).
- Bản đã chốt đạt 335 unit, 37 data, 109 E2E; TypeScript/build và production gốc/con/offline đạt. Bundle chính khoảng958kB/gzip272kB; trước khi tăng nội dung quy mô lớn nên xem xét cách chia gói/cache, giữ getUsage và snapshot tương thích.

- Kiểm tra live sau commit45e39fd phát hiện .close sticky che chữ khi cuộn. Đã tách .modal-controls/.modal-content để nút đóng không chồng vùng đọc; content nhận focus và cuộn riêng. Focus trap nhận summary/tabindex0 và lọc descendants của closed details để không thoát ra nền sau khi mở/đóng cấu hình. Ba hồi quy thật 320×568/844×320/1440×1000 đo chữ, cuộn, Tab nguồn và settings disclosure; có baseline fail trước sửa.

## Mở rộng cách dùng — đợt 1, 23/10/2026

- Đã bổ sung 16 động từ + 16 danh từ + 16 tính từ ở data/usage/group-c/d/e.json, nâng tổng 48→96 mục; có 24 ghi chú tính đếm được. Đã đọc trực tiếp 52 URL Oxford American mới và rà nội dung độc lập, live 52/52 đúng bài; offline toàn bộ 96 mục/102 URL đạt.
- Gắn đúng ID/đầu từ/POS/nghĩa; manage/tired/worth chỉ kiểm tra nghĩa canonical, có giải thích ngoại lệ danh từ và khác biệt vùng. Giữ behaviour/behavior cùng ID cũ. Ví dụ bổ sung tự biên soạn, đáp án thay thế theo đúng câu vẫn trung tính/chưa chấm.
- Kho từ → Trạng thái → Có cách dùng đã đối chiếu: chỉ lọc mục tương thích; áp dụng cho luyện tập tự do và giữ lịch/phiên đang dở. Nhãn bộ lọc hiển thị tiếng Việt. Không đổi TXT, 5.560 mục và SHA256 phía dưới giữ nguyên.
- scripts/check-usage-sources.py có --offline cho CI và live theo --files; xác minh đúng bài có định nghĩa, không chỉ HTTP200. Nhận dạng nguồn không thay lượt đọc quy tắc. Raw HTML không đưa vào repository.
- Phạm vi, tệp thay đổi, kiểm thử và giới hạn trong [usage-expansion-2026-10-23.md](usage-expansion-2026-10-23.md). Không cần rà lại 48 bài mới từ đầu; mở rộng tiếp các từ có lợi ích học tập cao, không thêm hàng loạt bằng quy tắc suy đoán.
- Kiểm thử bản đóng băng: 335 unit, 37 data, 104 E2E đạt; TypeScript/build và production gốc/con/offline đạt. Mốc 333/100 phía trên là đợt sửa độ tin cậy trước khi mở rộng này, không phải số ca hiện tại.

## Mục tiêu và giới hạn phải giữ

- Ưu tiên học từ vựng đúng và hiệu quả; không mở rộng tính năng chỉ để tăng số lượng.
- Giữ giao diện/bản sắc Jeongyeon, ID từ, dữ liệu TXT, lịch sử, lịch ôn, phiên học và khả năng học offline. Không xây lại website.
- Người học đã có nền tảng; không cần khóa học cho người mới. Không dùng dịch vụ phát sinh phí. Chấm ngữ pháp toàn diện có thể bỏ; ngoài phạm vi phải ghi chưa thể chấm tự động.
- Người dùng đã đồng ý commit/push khi mục ngữ pháp có nguồn đã đọc và kiểm thử đạt. Chưa thỏa điều kiện thì không xuất bản phần đang dở; không hỏi lại việc đã được ủy quyền khi điều kiện đã đáp ứng.
- Chưa có dự án Supabase thật; chỉ có mã và cấu hình chuẩn bị. Không tuyên bố đã kiểm thử cloud thực tế.

## Tra cứu ngữ pháp — đã hoàn thành

- Người dùng đã cho phép British Council LearnEnglish làm nguồn chính sau khi Cambridge English Grammar Today trả HTTP 403/Cloudflare. Không có bài nào được ghi là đã đọc hoặc đối chiếu Cambridge; không tắt kiểm tra TLS hoặc vượt challenge.
- 52 bài thực tế trong 8 nhóm, 5 tệp JSON tại data/grammar. Phủ cấu trúc câu/từ loại, danh từ/đại từ/hòa hợp, mạo từ/lượng từ, thì/thể, động từ khuyết thiếu/bị động/V-ing/nguyên mẫu, gián tiếp/điều kiện/ước/quan hệ, so sánh, giới từ/liên từ và các chủ điểm liên quan.
- Mỗi bài có tóm tắt, cách dùng, cấu trúc, ví dụ Anh–Việt tự viết, lưu ý, lỗi thường gặp, phần chi tiết mở rộng và nguồn đúng trang. Trường mistakes.context phân biệt lỗi phụ thuộc ý định diễn đạt với lỗi ngữ pháp chung. Đã rà chéo để loại ví dụ vẫn đúng trong ngữ cảnh khác và các quy tắc tuyệt đối hóa.
- Đã đọc trực tiếp 80 trang nguồn chính thức; kiểm tra live toàn bộ trả HTTP 200 và có nội dung bài. research/*-sources.json chỉ lưu URL/tiêu đề/ngày/hash, không lưu bản sao toàn văn nguồn. Có scripts/check-grammar-sources.py để kiểm tra lại. Bình luận của người học không được dùng làm quy tắc.
- src/grammar-data.ts nạp JSON tĩnh, src/grammar-reference.ts xử lý schema/tìm kiếm, src/GrammarReference.tsx và grammar-reference.css hiển thị. Đã nối menu/breadcrumb trong main.tsx. Mobile có 7 nút điều hướng tối thiểu 44 px, không thêm hàng đè nội dung.
- Tìm Việt/Anh/không dấu/aliases, xếp ổn định. Ranh giới từ tránh bi dong khớp nhầm biệt+dòng; prefix tiêu đề/aliases từ 3 ký tự hỗ trợ pass→passive. Danh mục nhóm, trạng thái không có kết quả, quay lại giữ bộ lọc/focus.
- Không bài tập, điểm số, AI, dịch vụ trả phí hoặc thay đổi IndexedDB. Đọc/tìm kiếm offline sau khi đã tải bản production; mở website nguồn cần Internet. Không thêm trường hay thay ID trong kho từ cho phần ngữ pháp.
- Kiểm thử mới: 13 tìm kiếm/schema + 10 dữ liệu; 3 UI độc lập + 5 tích hợp. Tích hợp kiểm tra toàn bộ 52 bài/chi tiết/nguồn, dữ liệu học và phiên/nháp không đổi, offline và 320/390/768/1440 px. Kiểm tra production có mở/tìm bài tại đường dẫn gốc và đường dẫn con cả online/offline.
- Nguồn được người dùng chấp thuận và ủy quyền xuất bản đã có; không hỏi lại. Báo cáo bàn giao và kết quả cuối ở docs/grammar-reference-2026-10-20.md.

## Cập nhật nguồn từ vựng Anh–Mỹ — đã hoàn thành

- Yêu cầu: Oxford 3000/5000 cho nền tảng, Cambridge/Oxford cho nghĩa, Cambridge Blog cho cách dùng hiện đại, YouGlish cho phát âm/giao tiếp và OPAL cho học thuật; ưu tiên Anh–Mỹ. Đã hoàn tất sau bản ngữ pháp 73a85dc. Báo cáo: docs/vocabulary-sources-2026-10-20.md.
- Có 5.558 mục, 1.061 ready/4.497 lookup. Thêm 396 mục: 57 American Oxford, 316 OPAL theo từ loại, 23 Blog. Giữ 5.162 ID/thứ tự cũ. Bốn nghĩa sửa có chủ đích: hardly, sensible, execution, pants. 61 cách viết Mỹ cho mục cũ lưu preferred_us_spelling, không đổi contentKey/lịch; nội dung học khác có hash bảo vệ.
- Hai PDF American Oxford chính thức đã đọc trực tiếp và bao phủ toàn bộ đầu từ. Bằng chứng Anh–Anh 5.323 dòng/4.955 cách viết giữ nguyên, không đổi CEFR/ID âm thầm. OPAL có 1.339 nhãn đầu từ/1.511 dòng từ loại: bổ sung phần thiếu, không coi khác POS là nghĩa cũ sai. OPAL spoken là ngữ liệu văn nói học thuật Anh–Anh, không phải tần suất Mỹ.
- Có 454 URL với metadata phạm vi/ngày/HTTP/hash; raw HTML chỉ ở /tmp. Cambridge Dictionary còn 403, không tự nhận đã xác minh; Blog/Oxford/YouGlish đọc được. Thêm 316 IPA Mỹ trực tiếp từ nguồn. 12 thuật ngữ Blog mới/chuyên biệt và practical noun Anh–Anh giữ lookup. Ghi đúng nguồn ví dụ biên soạn; giữ ghi nguồn OVDP của a, an no-cloze.
- Hồ sơ mới dùng en-US, giữ lựa chọn đã lưu. Hồ sơ cũ có thể chọn Anh–Mỹ trong Cài đặt. Tìm kiếm, hiển thị và TTS dùng cách viết ưu tiên; chấm nhận hai dạng. YouGlish là liên kết ngoài chọn giọng Mỹ, không embed/cache/chấm. Giữ ví dụ, IPA và audio theo dữ liệu nguồn.
- Pipeline: data/authoring/source-update-2026-10.json và scripts/apply-source-update.py; preview mặc định, --write mới cập nhật. apply-content-review.py tương thích giữ overlay/cảnh báo mới. data/lexicons chứa dữ kiện PDF/OPAL. Không đổi IndexedDB hoặc dependency.
- Kiểm thử cuối: 242 unit, 20 data, 75 E2E đạt; TypeScript/build, production root/subpath/offline tải 5.558 mục và 52 bài ngữ pháp đạt. SHA256 TXT: 19fb2f4dd2ffab355ac9fe59abf1442bfad79fbe036e7262d90197132667d004.
- Chưa công bố toàn bộ nghĩa Việt cũ được rà. Chưa nhập toàn bộ mẫu cụm OPAL; chưa có tần suất đo cho mục mới; chưa xác minh từng video YouGlish, Safari hoặc Supabase thật. Giữ các nhóm sửa 2–5 bên dưới để tiếp tục.

## Rà toàn kho và so sánh website — hoàn thành 22/10/2026

- Toàn bộ 5.558 mục hiện đủ nội dung để luyện; 0 mục mặc định chỉ tra cứu. Hoàn thiện 4.497 mục lookup cũ và đối chiếu lại 1.061 mục đã ready. Không đổi ID/thứ tự/đầu từ, đáp án/biến thể, CEFR/tần suất/source_fact_index; nghĩa của 1.061 ready giữ nguyên. Hai cặp ví dụ league/match làm rõ môn thể thao, chỉ lịch ngữ cảnh có thể thay đổi theo contentKey. Không xóa lịch sử hay bản cá nhân.
- Nguồn nghĩa: OEWN khóa 45fdb60396dc804526b85f21a23c59983c2c396a, Oxford American/Academic, Merriam-Webster, một ít American Heritage/Collins; Cambridge Blog giữ sắc thái thuật ngữ mới. Cambridge Dictionary vẫn chặn. Đã sửa bee, clock, classroom, nghĩa cũ cast/flow/advertise/file và các redirect. Diplomatic sửa noun→adjective bằng nguồn bài chi tiết + danh sách trực tuyến adjective/C1; dữ kiện PDF noun vẫn giữ lịch sử.
- 4.205 giải nghĩa Anh dùng theo giấy phép WordNet; 1.353 tự biên soạn. Metadata theo từng ID: 4.777 bằng chứng WordNet khớp chính xác ID/synset/URL/hash, 28 IPA mới literal NAmE, tổng344IPA. Phần lớn từ vẫn dùng TTS; không chế audio/IPA. 405 bằng chứng nhà xuất bản có body cache kiểm tra, 387 kế thừa phiếu đã xác minh trước khi /tmp bị xóa; không giả lượt tải mới.
- Manifest data/authoring/full-review-2026-10.json +13shards; scripts/apply-full-review.py preview mặc định và --write rõ ràng. Old source-update/content-review replay áp dụng lớp mới sau cùng và giữ idempotence. public/data/full-review-provenance.json, giấy phép OEWN/Princeton và nhãn definition_source phân biệt Englishgloss được cấp phép với nội dung biên soạn. Mọi nghĩa chỉ là nghĩa được chọn, không phải tất cả nghĩa hay chứng nhận tuyệt đối.
- Kiểm thử bàn giao: 251 unit, 30 data, 76 E2E đạt; sau chuẩn hóa URL nguồn chạy lại 2 E2E dữ liệu thật và production root/subpath/offline đều đạt. TypeScript/build đạt; chưa thử Safari/iPhone hoặc Supabase thật.
- SHA256 canonical: 86a5b8d2a4a907b2ce7d3d8997972494ff35621dad870a765bc665dcee744eb4, 5.558 mục. Báo cáo docs/full-vocabulary-review-2026-10-21.md. Mã ứng dụng chỉ thêm trường nguồn định nghĩa/nhãn đúng; không thay thiết kế, cơ sở dữ liệu hoặc thuật toán ôn.
- Đã mở và thử thật ForumFlashStudy sau khi mạng truy cập được: bài khách10thẻ, lật/đánh giá, cần ôn quay lại cuối lượt, reload cùngtab giữ phiên; bài kiểm tra chặn đăng nhập nên chưa thử chấm. Hai ví dụ + mẫu dùng/tính đếm được trên thẻ là điểm đáng tham khảo. Có lỗi logo/menu320px, reloadofflinekhách thất bại; không phán toàn bộ5.000từ hay backend. Báo cáo docs/forumflashstudy-comparison-2026-10-21.md; chưa triển khai các đề xuất mới chỉ từ việc so sánh.
- Hướng tiếp: thống nhất bằng chứng và chống hồi sinh lịch nghĩa cũ (nhóm2); bổ sung mẫu dùng và ngữ cảnh thứ hai cho từ dễ nhầm; mục tiêu phiên ngắn cá nhân, sửa sai có khoảng đệm; kiểm tra mobile bằng va chạm/thao tác thực. Không xây khóa nhập môn/chủ đề bắt buộc, XP hay bài tập ngữ pháp.

## Thứ tự thực hiện

### Cách dùng/ngữ cảnh và mục tiêu phiên — đã triển khai 22/10

- Đã thực hiện ba đề xuất người dùng chọn từ báo cáo ForumFlash: 48 mục có mẫu dùng/giới từ/ghi chú/lỗi thường gặp/câu thứ hai, 7 mục có tính đếm được; 50 trang Oxford Advanced American đã đọc trực tiếp và kiểm tra HTTP/body/hash.
- Dữ liệu bổ sung ở data/usage, không thay byte TXT/ID/contentKey/lịch sử/lịch ôn. getUsage chỉ gắn khi ID/đầu từ/POS/nghĩa khớp; task/context là snapshot tùy chọn, giữ nguyên câu đang làm qua reload/backup. Chỉ phiên mới luân phiên câu dựa trên lần đầu gần nhất; các mục còn lại vẫn một câu.
- Mục tiêu phiên và tổng kết tách lượt ban đầu, có hỗ trợ, tự đánh giá, chưa chấm, bỏ qua và sửa sai. Retry giữ review/câu và khoảng đệm cũ; record chặn first/independent nếu cùng review hoặc cùng phiên/từ/kỹ năng. Không tự kết luận nhớ lâu từ sửa sai.
- 268 unit, 30 data, 81 E2E; production gốc/đường dẫn con online/offline có đọc nội dung mới. Báo cáo docs/usage-and-session-upgrade-2026-10-22.md. Các việc nhóm 2–5 dưới đây vẫn còn trừ phạm vi đã ghi rõ ở mục này.

### 1. Chấm bài và lịch ôn — đã sửa, có hồi quy

- core.record đã tách lịch khỏi independent cho cả self/rule: đúng lần đầu, không hint và đến hạn tăng bậc 1/3/7/14/30; đúng trước hạn giữ lịch; đúng có hint giữ bậc, hẹn ngày mai; sai thật về một ngày. Duplicate review, free practice và ungraded không sửa lịch. Quy tắc chứng nhận nhớ vững vẫn cần bằng chứng độc lập, không cấp bằng lịch ôn.
- Đã kiểm tra ba phiên đủ sáu kỹ năng qua ngày 0/1/4: các kỹ năng có lịch tăng bình thường dù kỹ năng trước đó làm exposure gần. Không còn vòng kẹt một ngày do dùng điều kiện quiet gap toàn từ để quyết định lịch.
- useVisibleExposure áp dụng Kho từ, bộ sưu tập và thẻ trang chủ: chính đoạn nghĩa hiện ít nhất 60% liên tục 700 ms, tab đang hiển thị/không bị che; không ghi toàn trang 60/24 mục, không ghi lại liên tục khi rerender. Kỹ năng 0 chỉ thấy từ chưa ghi exposure; mở đáp án/chi tiết vẫn ghi.
- Thêm trường TXT tùy chọn spelling_variants cho 10 mục được rà (gồm practice/practise động từ, neighbor/neighbour, characterise/characterize). grade/cloze dùng chung answerForms; không fuzzy, không thêm synonym. accepted_answers và contentKey cũ giữ nguyên nên thêm cách viết tương đương không reset lịch/kết quả. Danh từ practice không nhận practise. Policy ở scripts/corpus_policy.py; xem public/data/SOURCES.md.
- assessment.ts dùng outcome correct/incorrect/ungraded. Một số đáp án khác cùng nghĩa Việt+POS ready, ba ngữ cảnh cloze đã rà và 10 nhóm đồng âm được giữ trung lập: lưu lý do assessmentNote, không tính đúng/sai, không retry/reset/mastery. Mục đã archive vẫn được xét làm đáp án thay thế hợp lệ, không được đưa lại vào queue. Đây không phải bộ chấm mọi từ đồng nghĩa.
- Bài nhớ để viết có từ loại/giải nghĩa (che mục từ nếu xuất hiện). Nghe chính tả nghe cả câu và điền phần thiếu khi có context; chỉ nhận sau playback thành công. Giữ tương thích từ cá nhân thiếu context bằng nghe từ, nhóm đồng âm vẫn có phản hồi trung lập. Kết quả mới là nghe/viết có ngữ cảnh, không tuyên bố nghe từ rời.

### 2. Thống nhất bằng chứng và bảo vệ dữ liệu — đã triển khai 23/10

- `evidence.ts` là bộ chọn chung cho phân tích, chi tiết từ, đề xuất và thống kê cũ. Chỉ dùng nghĩa hiện tại, thời gian hợp lệ, lần đầu không trùng review/phiên/từ/kỹ năng; giữ nguyên lịch sử gốc.
- Sai hoặc cần gợi ý vẫn là tín hiệu yếu; không đưa lượt có gợi ý vào tỷ lệ đúng độc lập. Chỉ tính nhớ sau ≥24 giờ khi có khoảng nghỉ đã biết; không suy từ dữ liệu thiếu. Giữ tiêu chí nhớ vững nhiều ngày và khoảng nghỉ dài.
- `schedule-state.ts` ràng buộc lịch với phiên bản nội dung theo kỹ năng tại record, đọc/ghi IndexedDB, nhập backup, tab cũ và merge cloud. Lịch legacy còn hợp lệ được giữ nguyên; không dùng lịch của snapshot nghĩa cũ cho nghĩa mới.
- `exposure-events.ts` hợp nhất tiếp xúc bằng ID bất biến; chuyển timestamp legacy thành sự kiện trước khi merge. Nếu thiết bị khác đã xem nghĩa 30 giây trước câu trả lời, bằng chứng dẫn xuất không còn nhận khoảng nghỉ 8 ngày; kết quả gốc vẫn giữ.
- Bổ sung hồi quy thực tế cho backup cũ, tab cũ, đồng bộ tiếp xúc và cùng nháp bị sửa cạnh tranh. Chưa tự sửa lại lịch sử bất biến của những lượt cũ từng chấm nhầm.

### 3. Nội dung chính xác và phù hợp trình độ

- Kho hiện có 5.560 mục ready. Đợt bổ sung này thêm `like-verb-enjoy-01` (thích, A1) và `lie-horizontal-01` (nằm, A1), đối chiếu trực tiếp Oxford American cùng dữ kiện American Oxford; có nguồn, receipt/hash, IPA Mỹ literal và lưu ý lay/lain/lying. Không gọi nghĩa like/lie cũ sai.
- 5.558 mục cũ là tiền tố byte không đổi của TXT mới; các pipeline preview/replay áp dụng thêm lớp essential-senses được khai báo, không đổi ID hoặc ghi đè bản cá nhân. SHA256 canonical: `10392288d69ba11cc6e5fc74e02e0cc3654bea50cda229254236848d2d3a87f4`.
- 144 mục có cách dùng và ngữ cảnh thứ hai sau hai đợt mở rộng 23/10; 5.416 mục còn lại vẫn một câu. 346 IPA, chưa có audio nguồn mặc định. Không coi đủ đầu từ là đủ mọi nghĩa, không coi bản dịch/ví dụ biên soạn là được Oxford chứng nhận.
- TTS ở từ cùng đầu mục khác từ loại có thể dùng câu song ngữ đã biên soạn cho đúng nghĩa; hiển thị “Nghe từ trong câu” và cảnh báo giới hạn trọng âm. Audio HTTPS do người dùng cấu hình vẫn được ưu tiên. Không chế IPA hoặc ghi âm Oxford.

### 4. Năng suất và đề xuất đúng bài — đã triển khai 23/10

- Chế độ thông dụng tạm nhường từ vừa trả lời đúng/tự đánh giá/viết trong 24 giờ khi còn từ khác; từ yếu và lượt đến hạn không bị bỏ qua. Không coi tự đánh giá hoặc câu chưa chấm là bằng chứng nhớ vững.
- Phiên mới luân phiên kỹ năng khách quan đứng trước theo từng từ giữa nhớ để viết, nghe chính tả và ngữ cảnh. Giữ nguyên task/review/context và điều kiện độc lập; phiên đang dở/retry không bị đổi thứ tự.
- Cài đặt thêm mức ưu tiên từ mới và kỹ năng cho phiên mới. Chỉ lọc giới thiệu mới hoặc kỹ năng chưa học; không lọc lịch đã đến hạn, không thay queue đang chạy, mục chưa biết CEFR vẫn hợp lệ. Đây là lựa chọn cá nhân, không phải kết quả kiểm tra trình độ.
- Nút “Luyện ngay” của nhóm thường quên cũ truyền kỹ năng yếu thực tế thay vì dùng lựa chọn luyện trước đó.

### 5. Hội thoại, viết câu, mobile và cloud

- Hội thoại có pha ẩn transcript để tự nhớ; mở lại ghi có gợi ý, retry vẫn có hỗ trợ. Kết quả đọc/nghe/tự nhớ ngay không tự tăng lịch hoặc chứng nhận nhớ lâu. Thêm nhãn ngữ liệu vùng; giọng Mỹ không biến câu Anh–Anh thành tiếng Mỹ. Phạm vi vẫn 12 đoạn/48 từ mục tiêu, chưa tạo hội thoại cho mọi nhóm từ.
- Các đáp án recommend/advise/suggest đã đối chiếu trong ngữ cảnh cụ thể được lưu trung lập; metadata đóng băng theo đề, không thêm synonym chung cho mọi câu. Phần ngữ cảnh hiển thị nghĩa và từ loại mục tiêu.
- Quy tắc discuss thu hẹp để không sửa sai about chỉ số lượng xấp xỉ/as many. Phản hồi viết vẫn giới hạn, miễn phí; không phát hiện mẫu sai không đồng nghĩa câu đúng.
- Nháp viết ngoài phiên lưu IndexedDB theo từ và luồng sửa, lưu phiên bản nghĩa. Lưu thành công chỉ xóa đúng bản nháp đã gửi bằng tombstone, không xóa bản sửa mới từ tab khác. Sao lưu chờ flush rồi đọc dữ liệu bền mới nhất; nháp trong phiên học vẫn theo session hiện có.
- Scope header ứng dụng để không đè header phản hồi viết, chỉnh kích thước ghi chú và vùng thao tác. Bổ sung kiểm tra giao nhau của chữ ở 320/390 px, không chỉ scrollWidth.
- Cloud đã sửa hợp nhất tiếp xúc/lịch/nháp nhưng **chưa thay kiến trúc snapshot**. Chưa có project thật để thử auth/RLS và hai thiết bị. Trước khi lịch sử lớn cần thiết kế delta cá nhân/sự kiện, không tự xóa lịch sử để né giới hạn 20 MiB.

## Bằng chứng và kiểm thử các đợt trước

Kết quả cuối của đợt 23/10 cần ghi trong báo cáo learning-reliability, sau khi chạy lại trên mã đã tích hợp; các số sau là lịch sử.

- Baseline đã kiểm tra: 8c013e95cb39948cdbab5f53b6fafb40ee442a8c, repo saolaisaanh123-web/WebHocTuVungTiengAnh.
- Sau sửa nhóm 1 và thêm ngữ pháp: `npm test`: 219 đạt (15 file); `npm run test:data`: 12 đạt; Playwright: 67 đạt; `npm run test:production`: TypeScript/build, đường dẫn gốc/con và reload offline gồm tra cứu ngữ pháp đạt. Sau bổ sung citation đã chạy lại 23 unit ngữ pháp, 8 E2E ngữ pháp và production đều đạt. Test bảo toàn trạng thái giữ sourceVersion từ lần nạp đầu để tránh nhầm cập nhật metadata nền với thay đổi do đọc bài.
- Regression mới: src/scheduling-regression.test.ts (13), src/assessment.test.ts (26), src/spelling-variants.test.ts (14), e2e/phase-one-learning.spec.ts (6), e2e/visible-exposure.spec.ts (8); cập nhật assertion lịch cũ và nhãn nút nghe câu ở hai E2E cũ. Data thêm2 tests, kiểm tra pipeline preview giữ nguyên corpus.
- Đã xác nhận update chỉ thêm spelling_variants cho 10 mục; vẫn 5.162 ID/thứ tự/nghĩa, 674 ready/4.488 lookup, không đổi immutable seed. Hash TXT mới b6f7f03d076425de1763975835266588780ab34032ca1c9148ab8f98594ee9a6.
- Các phản ví dụ nêu trên dùng hàm thật/trình duyệt riêng. Test có sẵn chưa bảo vệ đủ tính đúng ngôn ngữ và chuỗi học nhiều tuần. Khi sửa, thêm kiểm thử hồi quy đúng lỗi, không chỉ chạy lại bộ đang đạt.
- Đã kiểm tra UI tại 320×568, 390×844, 844×390, 1440×1000; chưa thử Safari/iPhone thật hay TTS thiết bị người dùng. Chưa thử auth/RLS/merge trên Supabase thật.
- Báo cáo chi tiết trong cùng workspace: /workspace/JEONGYEON-DANH-GIA-HOC-TU-VUNG-2026-10-19.md. Nếu file ngoài checkout không còn ở phiên sau, nội dung ưu tiên trong ghi nhớ này vẫn đủ để bắt đầu.

## Tiêu chí cho đợt tiếp theo

Giữ các hồi quy lịch theo nghĩa, tiếp xúc nhiều thiết bị, bằng chứng có hỗ trợ/không rõ khoảng nghỉ, đáp án trung lập, nháp và tùy chọn phiên mới. Sau khi bàn giao đợt 23/10, ưu tiên mở rộng cách dùng/ngữ cảnh cho từ thực sự yếu, rà nghĩa nền tảng còn thiếu theo từ loại/nghĩa và chuẩn bị đồng bộ delta trước khi dữ liệu lớn. Không coi toàn bộ các giới hạn nội dung/dịch vụ đã hoàn thành chỉ vì các lỗi trọng điểm đã sửa. Không yêu cầu AI trả phí. Khi sửa tiếp, giữ các tiêu chí kiểm thử đã bàn giao và kiểm tra trạng thái phát hành theo commit trong workflow Pages.
