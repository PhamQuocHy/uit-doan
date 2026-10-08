# Máy quét CCCD IoT USB

Ở màn hình Hồ sơ công dân hoặc form thêm/sửa hồ sơ, chọn loại máy cạnh nút quét:

- HN212: dùng module và plugin hiện có, không đổi giao thức.
- IoT USB · ESP32: mở Web Serial, chọn đúng cổng của thiết bị tự làm. Có thể cắm cả hai máy và chọn loại muốn sử dụng; chỉ một phiên IoT được mở trong cùng trang.

Dùng Chrome/Edge trên HTTPS hoặc localhost. Địa chỉ HTTP mạng LAN không phải secure context sẽ không dùng được Web Serial. Đóng Serial Monitor hoặc ứng dụng khác đang giữ cổng. Xem [tài liệu Web Serial của Chrome](https://developer.chrome.com/docs/capabilities/serial).

## Thao tác

1. Chọn IoT và bấm kết nối, chọn đúng cổng USB. Chờ ESP32 ổn định 2 giây và xác nhận PONG, DG2, SOD.
2. Bật/tắt đọc ảnh chân dung trước khi bắt đầu đọc.
3. Đặt thẻ, nhập số CCCD, ngày sinh, ngày hết hạn theo thẻ; bấm Gửi khóa & đọc thẻ. Đây là dữ liệu BAC, không tự suy đoán ngày hết hạn. Phiên bản này nhập khóa bằng tay; chưa tích hợp OCR camera cho thiết bị IoT.
4. Thông tin chip tự điền vào phần xem trước. Bấm Sử dụng thông tin để chuyển vào luồng tìm hồ sơ/tự điền form hiện có. Chưa ghi DB cho đến thao tác lưu hồ sơ của ứng dụng.

Ảnh JPEG dùng luồng portraitBase64 hiện có và được lưu mã hóa khi lưu hồ sơ. JPEG2000 được nhận diện nhưng chưa chuyển đổi: chỉ nhập thông tin chữ, cảnh báo rõ ảnh chưa hỗ trợ. EF.SOD được tắt; chức năng đọc không xác nhận chữ ký/xác thực thẻ thật.

## Giao thức và giới hạn

Theo đặc tả `CCCD_NFC_USB_WEB_SPEC (1).md` người dùng cung cấp: 921600 baud, 8N1, không flow control; newline; PING mỗi 5 giây, timeout PONG 8 giây. Mất kết nối đóng cổng và yêu cầu chọn kết nối lại, không tự chọn cổng bất kỳ hoặc tự gửi lại khóa BAC.

Hỗ trợ DG13 JSON (một hoặc nhiều dòng), DG13 BER-TLV, DG1 MRZ TD1 dự phòng, DG2 JPEG/nhận diện JPEG2000. Giải mã từng dòng Base64 riêng trước khi ghép bytes. Giới hạn 5 MiB/khối, 64 KiB JSON, 1 MiB dòng. Không ghi log thông tin CCCD hoặc ảnh. Rút thẻ/xảy ra lỗi xóa dữ liệu tạm; SUCCESS và SCAN_DONE chỉ sinh một kết quả mỗi lần đọc.

Đã kiểm thử phần mềm bằng dữ liệu mô phỏng; cần xác nhận trên firmware/thẻ thật, đặc biệt mapping DG13 lồng nhau, thời điểm gửi JSON và ảnh JPEG2000. Chưa có thiết bị thực trong phiên phát triển để khẳng định tương thích phần cứng.

Kiểm thử: `node --import tsx --test src/lib/cccd-iot/*.test.ts`.
