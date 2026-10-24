# Nguồn và phạm vi kho từ Jeongyeon

Kho mặc định hiện chứa **toàn bộ phạm vi Oxford 3000 và phần bổ sung Oxford 5000 theo hai PDF đã đối chiếu**, cộng bộ cụm động từ và Slang/thành ngữ/khẩu ngữ ban đầu, gồm 27 thành ngữ có ngữ cảnh báo chí. Tất cả nội dung học nằm trong file UTF-8 `vocabulary.txt`; không nhúng từ vựng vào mã giao diện.

## Rà toàn bộ nội dung học ngày 21/10/2026

Đợt này đã rà **5.558 mục theo nghĩa/từ loại, đều đủ nội dung để luyện**. Hoàn thiện 4.497 mục trước đây chỉ tra cứu và đối chiếu lại 1.061 mục vốn đã học được; không chỉ đổi cờ `ready`. Mỗi mục có nghĩa Việt, giải nghĩa Anh, câu tiếng Anh hoàn chỉnh và bản dịch Việt. Một mục vẫn chỉ học một nghĩa được chọn, không bao gồm mọi nghĩa của đầu từ. Sau bổ sung hai nghĩa nền tảng ngày 23/10, kho đạt 5.560 mục. Đợt từ loại ngày 24/10 thêm 21 mục động từ có nguồn riêng, tổng hiện tại là 5.581 mục.

- **Open English WordNet**, phiên bản khóa `45fdb60396dc804526b85f21a23c59983c2c396a`: chọn nghĩa và từ loại cụ thể qua synset/lemma. Nguồn này phát triển từ Princeton WordNet, dùng để đối chiếu ngữ nghĩa; không lấy thứ tự nghĩa làm bằng chứng thông dụng, CEFR hoặc ưu tiên Mỹ.
- **Oxford American/Academic/Learner’s**: đọc các nghĩa phù hợp cho từ chức năng, nghĩa WordNet chưa bao phủ tốt, từ loại và khác biệt Anh–Mỹ. **Merriam-Webster** cùng các nguồn từ điển bổ sung được đọc cho tiếng lóng/cách dùng hiện đại; từng nguồn thật nằm trong bằng chứng của từng ID.
- **Cambridge Dictionary Blog**: giữ nguồn trực tiếp và cảnh báo thuật ngữ mới/chuyên biệt. Có ví dụ đã rà để luyện không đồng nghĩa nhà xuất bản xác nhận đó là từ phổ biến hay ổn định trong mọi vùng.
- `definition_source: oewn` chỉ phần giải nghĩa Anh được sử dụng theo **CC BY 4.0**; `authored` là phần diễn giải biên soạn. Nghĩa Việt và ví dụ song ngữ là nội dung Jeongyeon biên soạn, được đối chiếu theo nghĩa cụ thể, không giả là ví dụ nguyên văn của nhà xuất bản.

Giữ nguyên tất cả ID/thứ tự, đầu từ nguồn, đáp án/cách viết đã duyệt, CEFR/tần suất và dữ kiện lịch sử. Sửa công khai `diplomatic` từ nhãn danh từ cũ thành tính từ: bài chi tiết Oxford và danh sách trực tuyến hiện hành ghi adjective/C1; dòng PDF cũ vẫn giữ như dấu vết nguồn. Không tự tạo IPA hoặc âm thanh. Nguồn Cambridge Dictionary chưa đọc được vẫn không được gắn nhãn đã xác minh.

Dữ liệu biên soạn và bằng chứng theo ID nằm trong `data/authoring/full-review-2026-10.json` cùng `full-review/*.json`; provenance công khai ở `full-review-provenance.json`. Mỗi nguồn có URL, ngày thực đọc, HTTP và SHA256 snapshot. Bằng chứng đã đọc ở đợt trước giữ nguyên ngày thật; không giả là vừa tải lại. HTML/YAML toàn văn để nghiên cứu nằm ngoài sản phẩm; chỉ các giải nghĩa WordNet được cấp phép và nội dung biên soạn được đưa vào bài học.

Ghi công và giấy phép: [OEWN-NOTICE](licenses/OEWN-NOTICE.txt), [CC BY 4.0](licenses/OEWN-CC-BY-4.0.txt), [Princeton WordNet](licenses/Princeton-WordNet.txt). Giữ các giấy phép FVDP/OVDP/Wiktionary và dữ kiện nhập trước đây bên dưới; đợt mới không đổi giấy phép của dữ liệu lịch sử hoặc mã ứng dụng.

`learning_status: lookup` vẫn có tác dụng cho mục tự nhập/chưa rà hoặc mục cá nhân bị tạm ngưng. `ready` mô tả nội dung đủ dùng để luyện, không xác nhận người học đã nhớ, không phải chứng nhận của Oxford/WordNet/Merriam-Webster và không phải bảo đảm chính xác tuyệt đối. Khi sửa nghĩa, cơ chế phiên bản nội dung giữ lịch sử nhưng không dùng bằng chứng của nghĩa cũ cho nghĩa mới; bản sửa cá nhân tiếp tục có ưu tiên.

Các phần dưới lưu phạm vi và số lượng của **những đợt nhập lịch sử**, không phải số lượng học được hiện tại.

## Đợt nguồn ngày 20/10/2026 (lịch sử)

| Mục đích | Nguồn và phạm vi đã kiểm tra |
| --- | --- |
| Nền tảng A1–C1 | American Oxford 3000/5000: hai PDF chính thức tải trực tiếp HTTP 200, 5.325 dòng dữ kiện, 4.954 cách viết khác nhau. Đối chiếu đầu từ/POS/CEFR; không đồng nhất với mọi nghĩa. Bằng chứng Anh–Anh cũ bên dưới giữ nguyên. |
| Nghĩa, ví dụ, cách dùng | Các bài Oxford American/Academic được đọc trực tiếp cho phần bổ sung và bốn mục sửa. Nghĩa Việt, định nghĩa diễn giải và ví dụ Anh–Việt tự biên soạn. Cambridge Dictionary còn chặn HTTP 403, chưa được coi là nguồn đã đọc. |
| Từ mới/cách dùng hiện đại | Sáu bài Cambridge Dictionary Blog đã đọc. Word Watcher/New words ghi nhận cách dùng, không phải chứng nhận đã vào từ điển hoặc phổ biến khắp nước Mỹ. |
| Phát âm/giao tiếp | Liên kết YouGlish có bộ lọc American đã kiểm tra cấu trúc trang bằng URL thật. Không kiểm chứng từng video, không nhập audio hoặc dùng video làm bằng chứng chấm bài. |
| Học thuật/IELTS | Oxford OPAL: danh sách và phương pháp chính thức; 1.511 dòng từ đơn/từ loại, 1.339 nhãn từ. Chỉ bổ sung phần thiếu sau khi đọc mục từ. OPAL spoken dùng ngữ liệu Anh–Anh, không gán tần suất Mỹ hay band IELTS. |

Bản ngày 20/10: **5.558 mục theo nghĩa/từ loại**, **1.061 ready**, **4.497 lookup**. Thêm **396 mục** gồm 57 mục nền tảng Mỹ, 316 mục OPAL theo từ loại (không nhân đôi mục đã có cùng từ loại), 23 mục Cambridge Blog. 12 mục Blog mới/chuyên biệt và danh từ `practical` mang nhãn Anh–Anh được giữ chỉ tra cứu. Các mục cũ chưa rà nghĩa vẫn chỉ tra cứu.

Giữ nguyên ID/thứ tự của 5.162 mục cũ. Chỉ bốn mục có nghĩa/ngữ cảnh được sửa có chủ đích: `hardly` → hầu như không; `sensible` → hợp lý/biết suy xét; `execution` → sự thực hiện/triển khai trong nghĩa đang luyện; `pants` → quần dài trong cách dùng Mỹ, kèm phân biệt Anh–Anh. 61 cách viết Mỹ của mục cũ được lưu ở `preferred_us_spelling`, không đổi đầu từ nguồn hoặc khóa nội dung đã dùng cho lịch học. Có thêm 316 IPA North American đối chiếu trực tiếp các mục mới; không tạo URL audio Oxford.

Dữ liệu biên soạn: `data/authoring/source-update-2026-10.json`. Dữ kiện danh sách: `data/lexicons/american-oxford-2026-10.json`, `data/lexicons/opal-2026-10.json`. `source-update-provenance.json` ghi 454 URL kèm ngày/HTTP/hash/phạm vi kiểm tra; một số URL là tiểu mục cùng trang. Chỉ lưu dữ kiện/metadata, không phân phối HTML toàn văn. SHA ghi một snapshot đã đọc; HTML động có thể đổi byte trong những lần truy cập khác.

Liên kết OPAL `latter` dẫn nhầm `become` đã được phát hiện; mục mới dùng đúng trang noun `https://www.oxfordlearnersdictionaries.com/definition/english/latter_2`. Với `many`, danh sách gắn nhãn adjective nhưng bài chi tiết dùng determiner/pronoun: giữ phân loại đúng cách dùng, không tạo tính từ giả để khớp bảng. Ghi chú khác biệt được giữ trong input biên soạn.

Hai PDF Mỹ được phát hiện theo href thật từ trang Oxford:

- https://www.oxfordlearnersdictionaries.com/external/pdf/wordlists/oxford-3000-5000/American_Oxford_3000_by_CEFR_level.pdf — SHA256 `393971c674d7eba72b40a77c84bc0b7b350dd4241b26154cfe30d0720f9d303e`.
- https://www.oxfordlearnersdictionaries.com/external/pdf/wordlists/oxford-3000-5000/American_Oxford_5000_by_CEFR_level.pdf — SHA256 `bba5316d4aa23f0e5c3ac08fdb960576d5ab28b882e35075cfba0fe9f27ab571`.

Đợt này không xác nhận thủ công mọi nghĩa của toàn kho, không tuyên bố hỗ trợ đủ mọi nghĩa của mỗi từ, và không nhập toàn bộ mẫu cụm học thuật OPAL khi chưa biên tập. Nội dung ngoại tuyến có sẵn trong TXT sau cập nhật; mở trang nguồn hoặc YouGlish cần Internet.

## Đếm đúng phạm vi Oxford Anh–Anh đã lưu

- Hai PDF có **5.323 dòng đầu mục/từ loại/CEFR**.
- Gộp các từ trùng cách viết, giữ riêng May/may, March/march, IT/it: **4.955 đầu từ/cách viết**.
- Giữ toàn bộ 5.323 dòng nguồn trong `oxford-provenance.json`: 4.955 dòng gắn mục học chính và 368 dòng nguồn bổ sung. Một đầu từ có thể có nhiều loại từ hoặc nghĩa.
- `Oxford 5000` là tên danh sách; ứng dụng không nhân đôi thẻ để ép số đếm thành 5.000. Đây là phạm vi đầy đủ của **bản PDF lưu trữ cụ thể**, không tuyên bố đã xác minh phiên bản mới nhất trực tiếp từ nhà xuất bản.
- Phần Oxford 5000 bổ sung chủ yếu ở B2–C1, không phải toàn bộ là từ sơ cấp. Có thể lọc CEFR khi củng cố nền tảng.

## Ba mức nội dung trong đợt nhập lịch sử

1. **Đã rà soát:** nội dung biên soạn và rà soát ngôn ngữ riêng, giữ các ID cũ. Không đồng nghĩa là Oxford chứng nhận nghĩa hoặc người học đã thuộc.
2. **Từ từ điển mở:** nghĩa Việt cùng từ loại được chọn từ FVDP/OVDP hoặc dữ liệu Wiktionary có nguồn. Chưa rà soát thủ công từng mục; nguồn lịch sử có thể có lỗi hoặc cách diễn đạt cũ. Bản dịch, ví dụ này **không phải định nghĩa/ví dụ Oxford**.
3. **Chỉ tra cứu:** dòng nguồn có xung đột hoặc thiếu nghĩa cùng từ loại đáng tin cậy. Không tạo bài kiểm tra cho mục này. Bản nhập cũ có `diplomatic`: bản PDF lưu ghi `n.`, trong khi nguồn nghĩa phổ biến ghi tính từ. Ứng dụng không sửa âm thầm hoặc dạy một từ loại chưa đối chiếu.

Một mục học một nghĩa chính; các nghĩa Oxford khác vẫn có dấu vết dòng nguồn, không được tuyên bố đã cung cấp đầy đủ mọi nghĩa của mỗi từ.

Trong lần nhập nguồn lịch sử, nguồn không có ví dụ được để trống và ghi rõ. Đợt rà toàn kho mới dùng câu ví dụ gốc do Jeongyeon biên soạn, có nhãn riêng; không giả là ví dụ trích từ nhà xuất bản. Bài điền ngữ cảnh chỉ tạo khi có ngữ liệu Anh–Việt và đáp án mục tiêu có thể che đúng; cụm trích từ từ điển được ghi là ngữ liệu, không giả là câu mới biên soạn. Các mục có nghĩa vẫn hỗ trợ nhớ nghĩa, nhớ để viết, nghe và tự viết câu. Không đồng nhất nội dung đã xem với bằng chứng đã nhớ.

## Nguồn đầu từ/loại từ/CEFR

PDF có thương hiệu và © Oxford University Press, lấy qua mirror khóa theo commit. Đã kiểm tra SHA256 của bản lưu. Trong lần nhập ban đầu, PDF trực tiếp trả HTTP 403. Ngày 20/10 đã tải được bản chính thức: PDF Anh–Anh 5000 có hash trùng bản lưu; PDF 3000 hiện tại khác hash. Giữ nguyên phiên bản và dữ kiện cũ để không thay ID/CEFR âm thầm; không dùng khác biệt byte làm bằng chứng mọi dòng nội dung đã đổi. CEFR là dữ kiện đầu từ/loại từ, không chứng thực mọi nghĩa, cụm từ hoặc ví dụ ghép với đầu từ.

### Oxford 3000

- Tham chiếu nhà xuất bản: https://www.oxfordlearnersdictionaries.com/external/pdf/wordlists/oxford-3000-5000/The_Oxford_3000_by_CEFR_level.pdf
- Bản lưu thực tế: https://raw.githubusercontent.com/ittuann/The-Oxford-5000-Word-Lists/7dc22b8ff8e5cb3410e962b0511d22cdf74b120c/The_Oxford_3000_by_CEFR_level.pdf
- SHA256: `b81e3f65c976fc93eb342ba34c40f0ff8c3a59646312d09ac50f9c648e461cd3`

### Oxford 5000

- Tham chiếu nhà xuất bản: https://www.oxfordlearnersdictionaries.com/external/pdf/wordlists/oxford-3000-5000/The_Oxford_5000_by_CEFR_level.pdf
- Bản lưu thực tế: https://raw.githubusercontent.com/ittuann/The-Oxford-5000-Word-Lists/7dc22b8ff8e5cb3410e962b0511d22cdf74b120c/The_Oxford_5000_by_CEFR_level.pdf
- SHA256: `6577e6eb8745226ab7ab80912e83d285cf421ec70e61c92d74d5fef5f2c99570`

## Nguồn nghĩa Việt và giấy phép

- **Free Vietnamese Dictionary Project (FVDP):** Hồ Ngọc Đức và cộng tác viên, ©1997–2003, bản cập nhật 2004-07-01. Nguồn GPL, đối chiếu bản text tại `robert-strandh/VietAnh`, commit `7ed4138b1698dd5b8c3170ff7a33a640f81b6f22`, file `anhviet.dict`. Phần nghĩa/ngữ liệu nhập và lọc lại vẫn tuân theo GPL; xem `licenses/GPL-2.0.txt`.
- **Open Vietnamese Dictionary Project (OVDP):** GPL-2.0, bản StarDict lưu tại `dynamotn/stardict-vi`, commit `0f0b46997db2305ccd0cb9e161f25ac73988b0a9`. Chỉ dùng phần từ điển tổng quát, không lấy phụ lục chuyên ngành để ghi đè nghĩa phổ thông.
- **Wiktionary qua MinhQND dictionary:** chỉ chọn đúng đầu từ tiếng Anh, định nghĩa tiếng Việt, nhãn nguồn Wiktionary và từ loại phù hợp. Đóng góp của Wiktionary contributors/MinhQND, CC BY-SA 4.0, release v2.0.0 của `minhqnd/dictionary`, commit `f11b18fcc12dc291eff91dbebbd1f7ffac17aa5b`. Không nhập IPA hoặc ví dụ sinh tự động. Xem `licenses/CC-BY-SA-4.0.txt`.

`oxford-provenance.json` lưu tác giả, bản quyền, commit, URL và hash các nguồn, cùng phạm vi nhập thực tế. Bản TXT là nội dung có thể sửa trực tiếp; khi phân phối lại phần nhập cần giữ ghi nguồn và giấy phép tương ứng. Giấy phép của dữ liệu nhập không được trình bày là giấy phép cho toàn bộ mã ứng dụng hoặc PDF OUP.

Không sao chép định nghĩa, bản dịch hoặc âm thanh có bản quyền của từ điển Oxford. Không gán IPA/URL phát âm Oxford khi chưa đối chiếu. Nút nghe dùng giọng tổng hợp của thiết bị nếu không có URL âm thanh và ghi rõ điều đó.

## Slang và cụm động từ

Hai bộ này được biên soạn riêng, không tự nhận là danh sách Oxford hoặc gán CEFR. Slang bao gồm tiếng lóng, khẩu ngữ và một số thuật ngữ/viết tắt mạng có giải thích rõ. Các nghĩa có thể gây chê bai hoặc thân mật đều có ghi chú; không khuyến khích đưa slang thân mật vào IELTS Writing trang trọng. Thuật ngữ như DM, troll, FOMO cần đánh giá theo chủ đề và văn cảnh, không bị gọi sai là luôn luôn tiếng lóng.

Mỗi cụm động từ có một nghĩa/ID cụ thể, hướng dẫn tân ngữ, tính tách được/không tách và vị trí đại từ khi phù hợp. Những từ có hai nghĩa được đếm thành hai mục nghĩa, không thành hai từ khác nhau.

### Thành ngữ trong ngữ cảnh báo/đài Mỹ

Bổ sung **27 thành ngữ từ 27 bài tin, phỏng vấn, bài chuyên đề hoặc bản chép chương trình** của AP qua PBS, PBS NewsHour và VOA Learning English. Đây là các bài có nội dung tin/phỏng vấn, không lấy bài dạy thành ngữ rồi gọi là bản tin. Một trường hợp dùng trong tiêu đề được ghi rõ. Nguồn gồm bản lưu lịch sử; ngày đăng hiển thị là ngày bài nguồn, không phải lời khẳng định đây là tin mới hoặc các cụm đang thịnh hành.

Ví dụ `feel like a million bucks` được đối chiếu với lời nhân vật trong bài AP/PBS ngày 11/02/2025; `kick the can down the road`, `walk a tightrope`, `a double-edged sword` có ngữ cảnh nguồn riêng. Thành ngữ không đồng nghĩa với tiếng lóng: `expression_type` phân biệt thành ngữ, slang, khẩu ngữ, viết tắt và thuật ngữ; `register` mô tả sắc thái cụ thể.

Mỗi mục có trích đoạn ngắn nguyên văn, tác giả xuất bản, URL, tiêu đề và ngày đăng; phần giải thích/bản dịch/ví dụ luyện tập do Jeongyeon biên soạn nằm riêng. Trích nguồn giữ cách chia động từ, đại từ và mạo từ thực tế nên có thể khác dạng đầu mục học. Lời của người được phỏng vấn không phải sự xác nhận của tòa soạn. Một bài có dùng cụm từ không chứng minh tần suất sử dụng. Bản chép chương trình cũng có thể có lỗi phiên âm.

Xem `news-provenance.json` để biết từng nguồn, phạm vi đối chiếu, thời điểm truy xuất và SHA256 HTML. `scripts/audit-news-content.py` kiểm tra trích đoạn với HTML lưu cục bộ; không phân phối lại toàn bộ bài báo. Website đọc nội dung đã biên soạn trong TXT, không tự thu thập tin mới khi mở trang. Các 80 mục cũ chưa gắn bài nguồn được ghi riêng trong bộ lọc, không tự nhận đã được báo chí xác minh.

## Sắp xếp theo trình độ và tần suất

Kho từ xếp **A1 → A2 → B1 → B2 → C1 → C2**, rồi theo tần suất tiếng Anh giảm dần trong cùng trình độ; cùng điểm thì A–Z và ID ổn định. Mục chưa có CEFR nằm cuối; mục thiếu điểm nằm sau các mục có điểm trong cùng trình độ. Từ mới trong kế hoạch học dùng cùng thứ tự; lượt ôn đến hạn vẫn đi trước. Slang/cụm động từ ở trang riêng vẫn mặc định A–Z.

Điểm `frequency_zipf` lấy từ **wordfreq 3.1.1, bảng English large** của Robyn Speer và các nguồn được ghi công, gồm dữ liệu tổng hợp ở nhiều miền ngữ liệu. Đã kiểm tra hash gói và bảng nguồn. **4.921 đầu mục Oxford** có điểm trực tiếp; 34 đầu mục khác giữ trống vì thiếu cách viết chính xác hoặc là cụm/đầu mục gộp. Không ước lượng tần suất thành ngữ bằng tích tần suất các từ thành phần, và không gán điểm của nghĩa đen cho slang.

Đây là ước lượng tần suất **cách viết không phân biệt hoa/thường**, gộp các nghĩa/từ loại; nguồn gốc gộp `May/may`, `March/march`, `IT/it`. Kho hiện giữ trống điểm của `May`, `March`, `IT` và `found` (thành lập), có ghi chú vì tần suất nghĩa khác sẽ gây hiểu nhầm. Không phải điểm Oxford, độ khó IELTS hay tần suất riêng trong thời sự Mỹ. Nguồn là bản chụp lịch sử, không phải đo lường thời gian thực. Điểm cao hơn chỉ biểu thị tần suất tổng hợp cao hơn; thiếu dữ liệu không có nghĩa là từ hiếm.

Các giá trị chọn lọc từ wordfreq theo **CC BY-SA 4.0**; giữ giấy phép, `licenses/wordfreq-NOTICE.txt` và `licenses/wordfreq-upstream-attribution.txt` khi phân phối lại. Xem `frequency-provenance.json` cho phương pháp, hash và phạm vi từng mục; `data/frequency/README.md` hướng dẫn tái tạo. Cài Python/wordfreq chỉ cần khi chủ ý tạo lại dữ liệu, không cần cho chạy/build web thông thường.

## Cập nhật và giữ lịch sử

ID của 259 mục đã có được giữ nguyên. Bản sửa cá nhân không bị bản cập nhật mặc định ghi đè. Các mục mẫu không còn trong nguồn được lưu trữ, không xóa lịch sử. File `vocabulary.sample.txt` giữ 20 mục minh họa định dạng cũ; không phải kho chính.

`data/authoring/*.txt` lưu riêng nội dung biên soạn cho các mục bổ sung, cụm động từ và slang. `scripts/build-full-corpus.py` kết hợp chúng với dữ kiện/nguồn trích xuất có ghi provenance; Vite không cần chạy script này, chỉ đọc TXT đã lưu. Người dùng thêm/sửa từ trực tiếp trong `vocabulary.txt` hoặc giao diện như trước.

## Số lượng bản nhập trước đợt nguồn 20/10 (lịch sử)

- oxfordHeadwords: 4955
- entryCount: 5162
- reviewed: 674
- dictionary: 4487
- reference: 1
- phrasalSenses: 100
- slangSenses: 107
- newsIdioms: 27
- frequencyScored: 4921
- withBilingualContext: 3631
- missingContext: 1531

## Chất lượng bài học sau rà soát 2026-10

Giữ đủ 5.162 ID; **674 mục `learning_status: ready`** dùng được trong bài học và **4.488 mục `lookup`** giữ để tra cứu, không tự vào quiz. Nhãn `content_status` vẫn mô tả nguồn/độ rà nội dung, không đồng nhất với người học đã nhớ. Chỉ xác nhận cá nhân sau khi kiểm tra đúng nghĩa/từ loại và ví dụ Anh–Việt; bản cá nhân được giữ khi cập nhật mặc định.

Đã biên soạn lại 38 mục lỗi hoặc nghĩa chính không phù hợp, có nghĩa Việt, giải nghĩa Anh, ví dụ, collocation và chủ đề cụ thể. `lie` nghĩa nói dối được gắn đúng sourceFactIndex 2175, B1; dòng `lie1` A1 vẫn giữ trong dấu vết nguồn. Các nghĩa lịch sử chưa rà khác không bị giả thành nội dung đã kiểm chứng. Xem `content-review-provenance.json` và `data/authoring/content-review-2026-10.txt`.

Chín mục có `news_media_url` theo VideoObject của bài PBS đã đối chiếu. URL được ghi như liên kết nhà xuất bản khai báo, chưa chứng minh phát trực tiếp thành công và chưa xác minh thời điểm cụm từ; `news_media_start` để trống. Không sao chép video hoặc tự thêm timestamp.

TXT đã commit là nội dung chuẩn; sửa trực tiếp không cần viết lại ứng dụng. Các script tạo corpus/áp dụng review mặc định chỉ tạo bản xem trước, `--write` mới cập nhật; full builder bảo toàn mọi mục và trường đã có trong TXT. Kiểm tra `npm run test:data` bảo vệ các sửa lỗi, ID, phạm vi nguồn và hash. Không cần chạy full builder để dùng web.

### Biến thể chính tả được chấp nhận

Trường tùy chọn `spelling_variants` ghi các cách viết tương đương đã rà riêng theo nghĩa và từ loại, phân cách bằng `|`. Đợt rà ban đầu có 10 mục, gồm `neighbour` → `neighbor`, động từ `practise` → `practice`, `characterize` → `characterise` và các cách ghép từ như `healthcare` → `health care`. Danh từ `practice` không nhận `practise`. Không suy ra tự động biến thể `-ise/-ize`, bỏ dấu gạch nối, từ đồng nghĩa hay cách chia động từ.

Danh sách biên tập nằm trong `scripts/corpus_policy.py`, được áp dụng lại qua `scripts/apply-content-review.py`; full builder giữ trường này như các chỉnh sửa canonical khác. Đây là phần rà chính tả của ứng dụng, không phải sự chứng nhận của Oxford. `accepted_answers`, ID, nghĩa, lịch sử nội dung và các quyết định `lookup`/`ready` không đổi chỉ vì bổ sung trường này. Ban đầu 10 mục có biến thể mới xuất trường mới; định dạng TXT cũ vẫn được hỗ trợ.

## Bổ sung nghĩa nền tảng ngày 23/10/2026

Hai nghĩa có ID mới được thêm sau đợt rà 5.558 mục: `like-verb-enjoy-01`
(động từ thích) và `lie-horizontal-01` (động từ nằm). Giữ nguyên từng byte
của 5.558 mục cũ; không thay nghĩa giới từ `like` hoặc nghĩa nói dối của `lie`.
Kho tại mốc đó có 5.560 mục. Hai bài Oxford Advanced American đã được đọc trực tiếp
ngày 22/10; URL, ngày, HTTP và SHA256 nằm trong
`essential-senses-provenance.json`. IPA Mỹ được đối chiếu literal từ bài nguồn.
Nguồn bài đúng từ loại: [like verb](https://www.oxfordlearnersdictionaries.com/definition/american_english/like_3), [lie¹ verb](https://www.oxfordlearnersdictionaries.com/definition/american_english/lie_1).
Nghĩa Việt, giải nghĩa tiếng Anh và ví dụ Anh–Việt là nội dung biên soạn.
Nhãn A1 dựa trên đúng dòng từ loại/nghĩa trong PDF American Oxford 3000 đã khóa;
không tạo `source_fact_index` Anh–Anh giả và không suy đoán thêm tần suất.

Lớp authoring: `data/authoring/essential-senses-2026-10-22.json`.
`scripts/apply-essential-senses.py` mặc định chỉ xem trước; `--write` mới áp dụng.
Các pipeline nguồn, full-review và content-review cũ đều tái áp lớp bổ sung
sau cùng, giữ nguyên ID/thứ tự và kết quả canonical. Đây là bổ sung hai nghĩa
đã xác định thiếu, không phải tuyên bố đã nhập mọi nghĩa của mọi đầu từ.


## Bổ sung cách dùng động từ và hiển thị từ loại — 24/10/2026

Đã đọc trực tiếp 21 bài Oxford Advanced American Dictionary để thêm các mục động từ riêng cho clean, complete, cost, dress, drink, email, interest, love, match, name, open, park, phone, post, rain, shop, sound, telephone, welcome (19 mục A1) và book, search (A2). Mỗi mức CEFR đối chiếu đúng dòng gồm động từ trong American Oxford 3000; không suy mức của mọi nghĩa từ nhãn đầu từ. 21 IPA Mỹ được chép đúng dữ kiện phát âm trong bài nguồn, tổng kho có 367 mục IPA.

Các mục mới có ID dạng `<word>-verb-01`, nghĩa Việt/giải nghĩa Anh/ví dụ song ngữ tự biên soạn và note phân biệt với từ loại cũ. Không đổi danh từ drink thành động từ uống, không gộp mọi từ loại vào cùng một nghĩa. Toàn bộ 5.560 mục trước đợt này giữ nguyên từng byte; tổng mới 5.581 mục theo nghĩa/từ loại, vẫn 5.352 đầu từ/cụm từ.

Manifest mới `data/authoring/essential-senses-2026-10-24.json` giữ URL thực tế, HTTP, ngày đọc, tiêu đề, SHA256 và bản ghi nguồn PDF chính xác. Manifest ngày 22/10 giữ nguyên. Pipeline ghép các đợt theo thứ tự, kiểm baseline khi bổ sung và giữ tail đã áp dụng khi replay; không tự ghi vào bản chỉnh sửa trong trình duyệt. `essential-senses-provenance.json` ghi rõ từng đợt thay vì thay nguồn cũ bằng nguồn mới.

Email được Oxford American hiển thị là e-mail; nguồn PDF dùng email. Mục động từ mới chấp nhận cả hai cách viết qua `spelling_variants: e-mail`. Đây là biến thể chính tả của cùng động từ, không phải từ đồng nghĩa. Kho hiện có 11 mục có trường biến thể được rà. Không tự gán tần suất cho 21 ID mới.

Cambridge US đã thử bằng HTTP thường và Chromium nhưng trả HTTP 403/“Just a moment...”, không đọc được mục từ. Người dùng cho phép dùng Oxford American. Không mục nào của đợt này được ghi là đã xác minh trực tiếp Cambridge. Nội dung từ điển toàn văn chỉ được dùng trong kho nghiên cứu tạm ngoài repository; repository chỉ chứa dữ kiện nguồn và nội dung tự biên soạn.

Nhãn từ loại trên giao diện diễn giải các trường hiện có, không thay dữ liệu TXT: ví dụ “Danh từ · noun”, “Động từ · verb”. Các nhãn phrase/idiom/clause được trình bày là dạng từ/cụm, không tự suy thành một từ loại khác. Bản cá nhân thiếu nhãn vẫn ghi chưa khai báo, nhãn lạ được giữ nguyên.
