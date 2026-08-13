-- Migration 006: Quyền chức năng (Tuyển quân / Nhận quân / Y tế)
SET NAMES utf8mb4;
SET @db := DATABASE();

SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'functional_role'
);
SET @sql := IF(@col = 0,
  "ALTER TABLE `users` ADD COLUMN `functional_role` ENUM('tuyen_quan','nhan_quan','y_te') NOT NULL DEFAULT 'tuyen_quan' COMMENT 'Quyền chức năng đăng nhập' AFTER `unit_code`",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT IGNORE INTO `roles` (`id`, `role_name`, `description`) VALUES
  (3, 'Nhân viên y tế', 'Khám sức khỏe, quản lý đợt khám tuyển');

UPDATE `users` SET `functional_role` = 'tuyen_quan'
WHERE `username` IN ('admin_bo', 'admin_cantho', 'admin_phuloc');

UPDATE `users` SET `functional_role` = 'nhan_quan'
WHERE `username` = 'admin_qk9';

INSERT INTO `users`
  (`id`, `username`, `password_hash`, `full_name`, `email`, `phone`, `role_id`, `unit_code`, `functional_role`, `status`)
VALUES
  ('u-yte-ct', 'admin_yte', '123', 'NV Y tế — Thành phố Cần Thơ', 'yte.cantho@ymsa.vn', '0900000005', 3, '92', 'y_te', 'active')
ON DUPLICATE KEY UPDATE
  `password_hash` = VALUES(`password_hash`),
  `full_name` = VALUES(`full_name`),
  `role_id` = VALUES(`role_id`),
  `unit_code` = VALUES(`unit_code`),
  `functional_role` = VALUES(`functional_role`),
  `status` = 'active';
