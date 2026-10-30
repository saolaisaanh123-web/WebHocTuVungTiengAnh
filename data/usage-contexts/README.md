# Ngữ cảnh bổ sung theo từng nghĩa

`range-*.json` chứa câu tiếng Anh và bản dịch Việt **tự biên soạn**, kèm một cụm minh họa được lấy từ câu đó. Các mục này mở rộng ngữ cảnh cho đúng ID, từ loại và nghĩa đang học; không tuyên bố bao phủ mọi nghĩa hoặc mọi cấu trúc ngữ pháp của đầu từ.

`evidence.json` tách phiếu nguồn dùng chung khỏi ràng buộc từng nghĩa. Phạm vi của các phiếu mới là `lexical-meaning-only`: xác nhận nghĩa/từ loại được chọn, **không** chứng nhận câu mới hay mọi kết hợp từ. Bài nguồn có thể là Oxford American, Merriam-Webster hoặc OEWN đã khóa phiên bản. Không đổi ngày đọc cũ thành một lần truy cập mới. `verification` phân biệt body cache khớp SHA256 với phiếu đã xác minh từ đợt trước nhưng hiện không còn body.

Mỗi câu có tác giả và người rà độc lập khác nhau (hai lượt biên tập bằng mô hình, không giả là chuyên gia nhà xuất bản). SHA256 ràng buộc lượt rà với chính câu, bản dịch, cụm từ, lời giải thích và nguồn đó. Trình biên dịch kiểm tra tính toàn vẹn/độ phủ; việc kiểm tra cấu trúc dữ liệu không tự chứng minh tiếng Anh đúng.

203 bài sâu cũ ở `data/usage` giữ nguyên, gồm các lưu ý/cấu trúc/lỗi đã đối chiếu. Không tự tạo “lỗi thường gặp”, tính đếm được hoặc quy tắc giới từ cho những mục chỉ có nguồn nghĩa.

Biên dịch nội dung đã biên soạn và rà:

```sh
python3 scripts/compile-usage-contexts.py --authors PATH_AUTHORS --reviews PATH_REVIEWS --packets PATH_PACKETS --require-complete --write
```

Phiếu rà JSONL gồm `wordId`, `reviewerId`, `reviewedAt`, `verdict: "approved"`, `contentSha256`. Hash dùng JSON UTF-8 không escape Unicode, key theo thứ tự chữ cái, dấu phân cách `,` và `:`; chỉ các trường tác giả trong `AUTHOR_KEYS` của script. Không có phiếu khớp thì câu không được xuất thành nội dung sẵn sàng luyện.

Nội dung bổ sung được đóng gói để đọc offline, không ghi đè TXT, đáp án, ID, contentKey, dữ liệu IndexedDB, lịch sử hoặc câu đã đóng băng trong phiên đang dở. Bài điền từ chỉ luân phiên ngữ cảnh trong phiên mới theo lịch sử thực tế; không thay đổi mỗi lần tải lại.
