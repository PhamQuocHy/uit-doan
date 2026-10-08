# Bảo vệ uploads

Ảnh CCCD/ảnh thẻ, công văn và minh chứng được mã hóa AES-256-GCM trong `storage/uploads`, ngoài `public`. URL `/uploads/...` giữ nguyên; route kiểm tra phiên và trạng thái tài khoản trước khi giải mã. Phản hồi không được cache. Hiện mọi tài khoản đăng nhập hợp lệ đều có thể tải nếu biết URL; đây chưa phải phân quyền theo từng hồ sơ/đơn vị.

Ảnh base64 từ chip khi lưu hồ sơ mới/cập nhật cũng được chuyển thành tệp mã hóa, DB chỉ lưu URL. Lệnh chuyển đổi bên dưới chỉ xử lý tệp trong `public/uploads`, không chuyển đổi các giá trị base64 đã tồn tại trong DB; chúng được chuyển khi hồ sơ gửi lại ảnh để lưu.

## Triển khai

1. Dừng ứng dụng để tránh ghi tệp trong lúc chuyển đổi.
2. Chạy `npm run uploads:migrate -- --init-key` lần đầu. Lệnh sinh khóa riêng trong `.env` nếu chưa có; không in khóa. Các máy chạy chung kho phải dùng cùng `UPLOADS_ENCRYPTION_KEY` (64 ký tự hex).
3. Lệnh mã hóa từng tệp cũ, đọc giải mã kiểm tra nội dung rồi mới xóa bản gốc trong `public/uploads`. Có thể chạy lại; nếu đích đã tồn tại phải khớp nội dung mới xóa nguồn. Không đổi URL trong DB.
4. Build và khởi động lại ứng dụng. Kiểm tra `public/uploads` không còn tệp. Xóa bản triển khai/CDN/cache cũ có chứa tệp công khai. Không cấu hình nginx/IIS/CDN phục vụ trực tiếp `/uploads` hoặc `storage`; mọi yêu cầu phải đến Next.js.

Sao lưu khóa riêng an toàn cùng quy trình sao lưu dữ liệu. Mất/đổi khóa sẽ khiến tệp cũ không giải mã được. Không đưa khóa hoặc `storage` vào Git; không dùng khóa JWT để mã hóa tệp. Trên Linux tệp mới dùng quyền 0600, thư mục mới 0700; trên Windows cấu hình NTFS ACL chỉ cho tài khoản dịch vụ và quản trị viên. Mã hóa không ngăn quản trị viên máy chủ có cả khóa và dữ liệu đọc tệp, và không thu hồi bản đã tải trước đó.

Kho PDF pháp luật `public/documents/nvqs` nằm ngoài phạm vi `uploads` của thay đổi này.

Một số tệp uploads trước đây đã được Git theo dõi. Việc chuyển chúng ra khỏi `public` không xóa bản còn trong lịch sử Git hoặc bản sao lưu cũ; cần hạn chế quyền truy cập các bản đó.
