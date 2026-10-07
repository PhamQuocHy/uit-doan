# Dung lượng DB — kiểm tra chỉ đọc ngày 07/10/2026

MariaDB 10.4.32; `innodb_file_per_table=ON`, `log_bin=OFF`.

Theo `information_schema.TABLES`: DATA_LENGTH 300,83 MiB, INDEX_LENGTH 131,08 MiB, DATA_FREE báo cáo 177 MiB. Đây là thống kê cấp phát/ước lượng, không phải kích thước dữ liệu logic hay cam kết thu hồi được đúng 177 MiB. Chưa đo toàn bộ thư mục máy chủ DB, redo/undo log hoặc ibdata1.

| Bảng | Dữ liệu + chỉ mục (MiB) | DATA_FREE (MiB) |
|---|---:|---:|
| citizens | 96,06 | 16 |
| citizen_family | 95,16 | 11 |
| health_exams | 79,75 | 111 |
| citizen_campaigns | 54,64 | 5 |
| citizen_residence | 53,13 | 23 |
| citizen_education | 33,10 | 7 |
| citizen_identities | 17,56 | 4 |

Sau khi giảm số hồ sơ, InnoDB có thể giữ phần dung lượng đã cấp phát để tái sử dụng. Không thể cam kết thu nhỏ tệp DB khi không được tác động bảng. `OPTIMIZE TABLE`/rebuild có thể thu hồi vùng trống nhưng tác động lưu trữ bảng, nên **không thực hiện** theo yêu cầu hiện tại. Không chạy ANALYZE, ALTER, UPDATE, DELETE, TRUNCATE hoặc đổi cấu hình máy chủ trong đợt dọn này.

Nguồn: [MariaDB — OPTIMIZE TABLE](https://mariadb.com/docs/server/ha-and-performance/optimization-and-tuning/optimizing-tables/optimize-table).

Để vận hành trong phạm vi không sửa bảng: theo dõi dung lượng định kỳ; giữ ảnh/tệp mới trong kho riêng đã mã hóa; tránh chạy lại seed/reset DB; lưu bản sao lưu đã nén ở nơi an toàn khác nếu cần giảm dung lượng thư mục dự án. Không xóa trực tiếp `.ibd`, `ibdata1` hoặc log DB.

Chạy báo cáo chỉ đọc khi cần: `node --import tsx scripts/db-storage-report.ts`. Script chỉ SELECT metadata và SHOW, không gọi các hàm khởi tạo/migration bảng của ứng dụng.

Các bản sao lưu mã hóa trong `storage/backups` khoảng 19,87 MiB, nằm ngoài DB; giữ nguyên vì còn phục vụ khôi phục và đối chiếu dữ liệu cũ. Khóa giải mã nằm trong `UPLOADS_ENCRYPTION_KEY`; phải sao lưu khóa cùng quy trình bảo quản dữ liệu.
