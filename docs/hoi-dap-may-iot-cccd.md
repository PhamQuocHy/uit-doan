# Tài liệu hỏi–đáp máy đọc CCCD IoT USB

Dùng để thuyết trình, demo và trả lời câu hỏi về thiết bị trong dự án quản lý nghĩa vụ quân sự. Biên soạn ngày 07/10/2026 theo mã nguồn và tài liệu dự án. Tên cấu hình trên giao diện là **ESP32 · PN532**; cấu hình lắp ráp, firmware và kết quả chạy trên máy thật cần được đối chiếu riêng.

## 1. Bài giới thiệu khoảng một phút

“Thiết bị của chúng tôi là máy đọc CCCD gắn chip, kết nối với máy tính qua USB và tích hợp vào phần mềm quản lý nghĩa vụ quân sự. Mục tiêu là hỗ trợ cán bộ lấy thông tin từ chip để tìm hoặc điền hồ sơ, giảm thao tác nhập tay.

Trên giao diện, người dùng chọn máy IoT USB, kết nối cổng thiết bị, đặt thẻ và nhập số CCCD, ngày sinh, ngày hết hạn để gửi dữ liệu mở chip. Phần mềm nhận thông tin, chuẩn hóa và hiển thị để cán bộ kiểm tra. Dữ liệu chỉ được ghi vào cơ sở dữ liệu khi người dùng thực hiện lưu hồ sơ.

Phiên bản hiện tại hỗ trợ thông tin chữ và ảnh JPEG khi thiết bị trả về đúng giao thức. Phần mềm đã có kiểm thử bằng dữ liệu mô phỏng; khả năng tương thích và tốc độ thực tế còn cần kiểm chứng trên thiết bị, firmware và thẻ thật. Chức năng hiện tại chưa xác thực chữ ký số để kết luận thẻ thật hay giả.”

## 2. Câu hỏi cơ bản

### 1. Máy này dùng để làm gì?

Máy hỗ trợ đọc thông tin chip CCCD và chuyển vào phần mềm để tra cứu, thêm hoặc cập nhật hồ sơ công dân. Lợi ích kỳ vọng là giảm gõ lại thông tin và giảm sai sót nhập liệu; chưa có số liệu đo để khẳng định mức tiết kiệm cụ thể.

### 2. Máy gồm những phần nào?

Theo cấu hình được ghi trên giao diện, thiết bị dùng ESP32 và PN532. Vai trò dự kiến của ESP32 là chạy firmware điều khiển và giao tiếp USB Serial; PN532 là phần giao tiếp với thẻ. Phía máy tính có trình duyệt và ứng dụng quản lý hồ sơ. Chưa có căn cứ trong tài liệu này để chốt biến thể bo mạch, sơ đồ chân, nguồn điện hoặc danh sách linh kiện thực tế.

### 3. Vì sao gọi là IoT trong khi đang cắm USB?

Trong dự án, “IoT USB” là tên của nhánh thiết bị nhúng tích hợp với ứng dụng web. Luồng đã triển khai sử dụng USB Serial. Không nên giới thiệu rằng thiết bị đang truyền dữ liệu qua Wi-Fi, MQTT hoặc kết nối Internet độc lập khi chưa có triển khai và kiểm chứng tương ứng.

### 4. Nguyên lý hoạt động như thế nào?

Luồng chức năng dự kiến là:

```text
CCCD gắn chip ↔ Đầu đọc PN532 ↔ ESP32/firmware
                                      ↕ USB Serial
                             Trình duyệt / Web Serial
                                      ↓
                              Xem trước thông tin
                                      ↓
                         Tìm hồ sơ hoặc điền biểu mẫu
                                      ↓ Người dùng lưu
                              Máy chủ / cơ sở dữ liệu
```

Mã nguồn trong dự án xác nhận phần giao tiếp trình duyệt, xử lý kết quả và tích hợp hồ sơ. Hoạt động bên trong firmware cần kiểm tra trên bản firmware thực tế.

### 5. Vì sao còn phải nhập số CCCD, ngày sinh và ngày hết hạn?

Phiên bản này yêu cầu ba thông tin để gửi cho firmware phục vụ quy trình BAC mở chip. Chưa có OCR camera tự lấy các trường này trong luồng IoT. Người dùng cần nhập đúng theo thẻ; phần mềm không tự suy đoán ngày hết hạn.

### 6. Nếu vẫn nhập tay thì thiết bị có ích gì?

Người dùng nhập các trường phục vụ mở chip, sau đó phần mềm có thể nhận thêm họ tên, địa chỉ và các thông tin khác mà thiết bị trả về, kể cả ảnh chân dung được hỗ trợ. Giá trị nằm ở việc giảm nhập lại cả bộ hồ sơ; mức hiệu quả phải đo bằng thao tác thực tế.

### 7. Đọc được những thông tin nào?

Bộ xử lý có ánh xạ số CCCD, họ tên, ngày sinh, giới tính, quốc tịch, dân tộc, tôn giáo, quê quán, nơi cư trú, đặc điểm nhận dạng, ngày cấp, ngày hết hạn, tên cha mẹ và số giấy tờ cũ. Có hỗ trợ ảnh chân dung. Không có nghĩa mọi thẻ và firmware đều trả đầy đủ các trường này; cần kiểm tra dữ liệu thực nhận.

### 8. Có lấy được ảnh không?

Có tùy chọn bật hoặc tắt đọc ảnh trước khi quét. Phần mềm hỗ trợ lấy ảnh JPEG từ dữ liệu DG2. Với JPEG2000, phần mềm nhận diện và cảnh báo chưa hỗ trợ hiển thị/chuyển đổi; phần thông tin chữ vẫn có thể sử dụng khi đọc hợp lệ.

### 9. Quét xong có tự lưu hồ sơ không?

Không. Kết quả được đưa vào màn hình xem trước. Người dùng chọn “Sử dụng thông tin” để chuyển vào luồng tra cứu hoặc điền biểu mẫu, sau đó thực hiện thao tác lưu hồ sơ của ứng dụng.

### 10. Có cần Internet không?

Đường truyền từ thiết bị đến trình duyệt là USB. Việc truy cập ứng dụng, tìm và lưu hồ sơ phụ thuộc nơi triển khai máy chủ và kết nối tới máy chủ. Chưa có cơ chế lưu ngoại tuyến rồi tự đồng bộ được xác nhận cho luồng này.

## 3. Câu hỏi kỹ thuật

### 11. Máy giao tiếp với website bằng cách nào?

Nhánh IoT dùng Web Serial để trình duyệt mở cổng USB do người dùng chọn. Cấu hình trong mã nguồn là **921600 baud, 8 bit dữ liệu, không parity, 1 stop bit, không flow control**. Lệnh và phản hồi được phân cách bằng ký tự xuống dòng.

### 12. Làm sao biết máy đang kết nối tốt?

Sau khi mở cổng, ứng dụng chờ 2 giây rồi gửi `PING`, chờ `PONG` và xác nhận cấu hình đọc ảnh cùng `SOD:OFF`. Khi sẵn sàng, ứng dụng gửi `PING` mỗi 5 giây; quá 8 giây không có `PONG` sẽ xử lý mất phản hồi. Lượt đọc có thời hạn 60 giây. Đây là thời hạn xử lý lỗi, không phải tốc độ đọc thực tế.

### 13. DG1, DG13, DG2 và SOD có ý nghĩa gì trong phần mềm này?

| Thành phần | Cách phần mềm hiện tại sử dụng |
|---|---|
| DG13 | Nguồn thông tin định danh, nhận JSON hoặc phân tích BER-TLV |
| DG1 | Phân tích MRZ TD1 làm nguồn thông tin dự phòng |
| DG2 | Trích xuất ảnh JPEG, nhận diện ảnh JPEG2000 chưa hỗ trợ |
| EF.SOD | Đang tắt yêu cầu đọc; chưa thực hiện xác minh chữ ký |

Mapping DG13, đặc biệt dữ liệu lồng nhau, còn cần xác nhận với firmware và thẻ thật.

### 14. Có phát hiện CCCD giả không?

**Phiên bản này chưa có cơ sở để kết luận thẻ thật hay giả.** Đọc được thông tin không đồng nghĩa đã xác minh nguồn gốc dữ liệu. Phần mềm đang gửi `SOD:OFF` và chưa có bước kiểm tra chữ ký số của dữ liệu thẻ.

### 15. Máy có nhận diện khuôn mặt không?

Luồng IoT đang đọc thông tin và ảnh từ chip. Đọc ảnh chân dung không phải là đối chiếu khuôn mặt người đứng trước máy. Dự án có chức năng liên quan đến khuôn mặt ở phần khác; cần đánh giá riêng, không coi đó là khả năng đã kiểm chứng của máy IoT.

### 16. Khác máy HN-212 như thế nào?

| Nội dung | Nhánh IoT USB | Nhánh HN-212 trong dự án |
|---|---|---|
| Kết nối ứng dụng | Web Serial trực tiếp từ trình duyệt | WebSocket qua ComQ ID Reader/HN212Plugin |
| Cấu hình | Chọn cổng USB; firmware phải đúng giao thức | Plugin tại `ws://127.0.0.1:8000` theo tài liệu dự án |
| Dữ liệu mở chip | Nhập tay ba trường trên giao diện IoT | Theo luồng xử lý của máy/plugin |
| Tích hợp hồ sơ | Xem trước rồi dùng kết quả | Dùng kết quả trong luồng hồ sơ hiện có |

Chưa có phép đo đối chứng để kết luận máy nào nhanh hơn, chính xác hơn hoặc bền hơn.

### 17. Tại sao không kết nối được trên một số máy tính?

Theo hướng dẫn triển khai hiện có, sử dụng Chrome/Edge trên HTTPS hoặc localhost và chọn đúng cổng USB. Trang HTTP qua địa chỉ mạng LAN không đáp ứng điều kiện secure context của luồng này. Cổng cũng có thể đang bị Serial Monitor hoặc ứng dụng khác chiếm giữ. Nhánh IoT không cần plugin HN-212; yêu cầu driver USB cụ thể phụ thuộc bo mạch thực tế.

### 18. Khi rút USB hoặc rút thẻ thì sao?

Khi mất USB hoặc mất phản hồi, ứng dụng đóng kết nối và yêu cầu người dùng kết nối lại. Khi nhận sự kiện rút thẻ hoặc lỗi đọc, phần mềm xóa kết quả tạm của lượt đọc. Không tự chọn một cổng khác hoặc tự gửi lại dữ liệu BAC. Xóa trạng thái tạm không phải cam kết xóa an toàn mọi bản sao trong bộ nhớ hay trên firmware.

### 19. Có tránh nhận kết quả trùng hoặc dữ liệu quá lớn không?

Bộ phân tích chỉ phát một kết quả cho mỗi lượt khi nhận `SUCCESS`/`SCAN_DONE`, kiểm tra các trường định danh bắt buộc và giới hạn kích thước đầu vào: 5 MiB/khối, JSON 64 KiB và bộ đệm dòng 1 MiB. Các biện pháp này hỗ trợ kiểm soát lỗi giao thức, không thay thế việc kiểm thử firmware thật.

## 4. Bảo mật, mức hoàn thiện và câu hỏi phản biện

### 20. Thông tin và ảnh CCCD được bảo vệ thế nào?

Theo triển khai uploads của dự án, ảnh từ chip khi lưu hồ sơ được chuyển thành tệp mã hóa AES-256-GCM trong `storage/uploads`, ngoài thư mục công khai; cơ sở dữ liệu lưu URL ảnh. Route tải ảnh kiểm tra phiên và trạng thái tài khoản. Luồng IoT không chủ động ghi log thông tin CCCD hoặc ảnh.

Cần nói rõ giới hạn hiện tại: tài khoản đăng nhập hợp lệ biết URL vẫn có thể tải ảnh; chưa phân quyền tải theo từng hồ sơ/đơn vị. Mã hóa tệp không có nghĩa toàn bộ dữ liệu định danh trong cơ sở dữ liệu hoặc đường USB đều được mã hóa. Quản lý khóa, dữ liệu cũ và bản sao lưu cũng cần thực hiện đúng tài liệu triển khai.

### 21. Đã chạy ổn định trên máy thật chưa?

Câu trả lời theo tài liệu dự án: “Phần mềm đã được kiểm thử bằng dữ liệu mô phỏng. Chúng tôi còn cần xác nhận trên thiết bị, firmware và thẻ thật, đặc biệt mapping DG13 và xử lý ảnh. Vì vậy chưa khẳng định tương thích phần cứng hoàn toàn.”

Tài liệu này không ghi nhận một lần chạy kiểm thử mới hoặc một lần demo phần cứng mới.

### 22. Tốc độ đọc và độ chính xác bao nhiêu?

Chưa có số liệu đo thực tế trong tài liệu dự án. Cần đo thời gian từ lúc gửi dữ liệu mở chip đến lúc nhận đủ kết quả, tách trường hợp bật/tắt ảnh, ghi số lượt thành công trên tổng lượt thử và đối chiếu từng trường. Không dùng thời hạn 60 giây hoặc tốc độ cổng Serial làm số liệu tốc độ quét.

### 23. Giá thành bao nhiêu và có rẻ hơn máy thương mại không?

Chưa có bảng kê linh kiện và chi phí thực tế để chốt giá. Cần tính bo mạch, đầu đọc, nguồn/cáp, vỏ, lắp ráp, phát triển firmware và bảo trì. Chỉ nên đưa ra so sánh sau khi có chi phí và kết quả thử nghiệm tương ứng.

### 24. Điểm đóng góp của giải pháp là gì?

Điểm có thể trình bày từ mã nguồn là tích hợp thiết bị USB vào ứng dụng web, quản lý phiên kết nối, phân tích và chuẩn hóa dữ liệu chip, xem trước thông tin và đưa vào quy trình hồ sơ sẵn có. Tránh tuyên bố phát minh công nghệ NFC hoặc đã tự xây dựng toàn bộ firmware nếu chưa có căn cứ.

### 25. Hạn chế hiện tại và hướng phát triển là gì?

Hạn chế đã ghi nhận gồm nhập dữ liệu BAC bằng tay, chưa hiển thị JPEG2000, chưa xác thực chữ ký thẻ và chưa xác nhận tương thích phần cứng thật. Hướng phát triển đề xuất là kiểm thử thực tế trước, sau đó bổ sung OCR, chuyển đổi ảnh và xác minh dữ liệu thẻ; đồng thời hoàn thiện phân quyền ảnh theo hồ sơ. Đây là đề xuất, chưa phải tính năng hoàn thành.

## 5. Kịch bản demo ngắn

1. Mở phần mềm, vào Hồ sơ công dân hoặc biểu mẫu thêm/sửa hồ sơ.
2. Chọn Quét CCCD → IoT USB; kết nối đúng cổng và chờ báo sẵn sàng.
3. Chọn bật/tắt đọc ảnh trước khi bắt đầu.
4. Đặt thẻ được phép sử dụng cho demo, nhập đúng số CCCD, ngày sinh và ngày hết hạn.
5. Bấm “Gửi khóa & đọc thẻ”; giữ thẻ ổn định và chờ kết quả.
6. Kiểm tra thông tin xem trước; giải thích cảnh báo ảnh nếu có.
7. Bấm “Sử dụng thông tin” để minh họa tìm hồ sơ hoặc điền biểu mẫu. Chỉ lưu khi có chủ đích tạo/cập nhật hồ sơ.

Nếu demo chưa thành công, mô tả đúng trạng thái trên màn hình và bước đang lỗi; không lấy dữ liệu mô phỏng để tuyên bố máy thật đã đọc thành công.

## 6. Xử lý nhanh khi được hỏi về lỗi

| Hiện tượng | Hướng kiểm tra |
|---|---|
| Không mở được chọn cổng | Trình duyệt, HTTPS/localhost, quyền truy cập thiết bị |
| Cổng không mở được | Cáp/cổng USB và ứng dụng khác đang giữ Serial |
| Không nhận PONG hoặc xác nhận cấu hình | Chọn đúng cổng; đối chiếu baud rate và giao thức firmware |
| Mở chip thất bại | Kiểm tra ba trường nhập, vị trí thẻ và thông báo firmware |
| Có chữ nhưng thiếu ảnh | Tùy chọn ảnh, dữ liệu DG2 và cảnh báo JPEG2000 |
| Báo xong nhưng dữ liệu chưa đầy đủ | Kiểm tra dữ liệu trả về và mapping DG13/DG1 |
| Mất kết nối | Kết nối lại thủ công, kiểm tra thẻ rồi gửi lại khi sẵn sàng |

## 7. Tài liệu đối chiếu trong dự án

- [Hướng dẫn IoT USB](cccd-iot-usb.md).
- [Kết nối HN-212](hn212.md).
- [Bảo vệ uploads và giới hạn phân quyền](private-uploads.md).
- [Quản lý kết nối và lệnh USB](../src/lib/cccd-iot/reader.ts).
- [Phân tích dữ liệu chip](../src/lib/cccd-iot/protocol.ts).
- [Các ca kiểm thử bộ phân tích](../src/lib/cccd-iot/protocol.test.ts).
- [Giao diện chọn máy và quét IoT](../src/components/admin/CccdScanButton.tsx).
