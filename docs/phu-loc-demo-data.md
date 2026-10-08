# Dữ liệu mẫu ưu tiên Phú Lộc

Phạm vi được xác nhận ngày 07/10/2026: đợt `camp1`, xã Phú Lộc, TP Cần Thơ (`92-31756`). Tổng 300 hồ sơ bao gồm 52 hồ sơ cũ (có 2 hồ sơ lưu trữ) và 248 hồ sơ bổ sung. Giữ nguyên toàn bộ trường dữ liệu của 52 hồ sơ cũ, đặc biệt CCCD và 5 hồ sơ đã gửi Bộ. Vì có 2 hồ sơ lưu trữ, danh sách đang hoạt động sẽ có 298 hồ sơ.

Các xã/phường khác có dữ liệu giữ 10 hồ sơ mỗi nơi; chọn luân phiên theo trạng thái và dự định gọi để không chỉ còn một loại hồ sơ. Hồ sơ mới ở Phú Lộc có ID `demo-pl-2026-*`. Theo yêu cầu sau đó, hậu tố `(Demo)` và ghi chú kiểm thử đã được dọn khỏi DB. Nguồn dữ liệu bổ sung vẫn là giả lập; 7 trường còn thiếu đã được điền dữ liệu mẫu theo xác nhận của người dùng.

248 hồ sơ mới: 40 chưa khám, 35 đang khám, 45 trúng tuyển dự kiến gọi, 40 dự bị, 30 trượt tuyển, 30 tạm hoãn, 15 miễn gọi, 13 nhập ngũ chưa phân đơn vị. Có học vấn, lịch sử tham gia đợt và kết quả sức khỏe giả lập cho các hồ sơ đã có phân loại sức khỏe. Không tự tạo công văn, minh chứng hoặc hồ sơ đã gửi Bộ.

## CCCD giả lập

Số mẫu gồm mã nơi khai sinh 3 chữ số, mã giới tính/thế kỷ 1 chữ số, năm sinh 2 chữ số và 6 chữ số ngẫu nhiên. Kiểm tra trùng trên toàn DB. Đây chỉ là số giả lập đúng cấu trúc, không xác nhận số được cấp thật hoặc không trùng với người ngoài hệ thống.

Nguồn cấu trúc và bảng mã: [Báo Chính phủ](https://xaydungchinhsach.chinhphu.vn/cach-nho-12-so-can-cuoc-cong-dan-gan-chip-cuc-de-119220914161814354.htm).

Không dùng trực tiếp mã hành chính sau sáp nhập làm mã khai sinh. Hồ sơ mẫu địa phương khác giả định khai sinh tại tỉnh có tên tương ứng trong bảng mã lịch sử; script ánh xạ các mã thay đổi. Hồ sơ mới ở Phú Lộc giả định nơi khai sinh Sóc Trăng, dùng `094`, phần giới tính và năm sinh thay đổi theo ngày sinh. 52 CCCD cũ được giữ nguyên theo yêu cầu, không được tuyên bố đã chuẩn hóa theo ngày sinh.

## Lịch sử và sao lưu

Đợt cập nhật đã hoàn tất. Script chỉnh dữ liệu dùng một lần và các script tạm đã được xóa khi dọn dự án, tránh chạy lại nhầm trên DB hoàn chỉnh. Giữ tài liệu và bản sao lưu để truy nguyên khi cần.

Trước khi thay đổi, script sao lưu toàn bộ `citizens` và các bảng có `citizen_id` vào `storage/backups/rebalance-phu-loc-<timestamp>`. Mỗi phần là JSON nén gzip, mã hóa AES-256-GCM bằng `UPLOADS_ENCRYPTION_KEY`, được đọc giải mã kiểm tra trước khi xóa dữ liệu. Thư mục này nằm ngoài đường tải `/uploads`.

`manifest.enc` ghi danh sách bảng, số dòng, các tệp và kế hoạch. Đọc bằng `decryptUpload(buffer, 'manifest')`, rồi giải nén gzip. Từng phần dùng tên tệp bỏ `.enc` làm AAD. Dữ liệu sao lưu là JSON toàn bộ dòng trước thay đổi; khi cần khôi phục phải đối chiếu DB hiện tại, phục hồi bảng cha trước bảng con và tránh ghi đè thay đổi phát sinh sau này. Không chạy lại script seed toàn quốc để phục hồi.

Thay đổi DB nằm trong một giao dịch, giữ kiểm tra khóa ngoại; dọn cả liên kết không có khóa ngoại cho hồ sơ bị bỏ. Không xóa tệp đính kèm trên đĩa. Chỉ tiêu giao quân và cấu hình đợt không bị sửa theo số hồ sơ mẫu; đó là dữ liệu nghiệp vụ riêng.
