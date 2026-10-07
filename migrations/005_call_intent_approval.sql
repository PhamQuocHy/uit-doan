-- Migration 005: Dự kiến gọi + xét duyệt nhập ngũ
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET @db := DATABASE();

SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'citizens' AND COLUMN_NAME = 'call_intent'
);
SET @sql := IF(@col = 0,
  "ALTER TABLE `citizens` ADD COLUMN `call_intent` ENUM('unset','du_kien_goi','khong_goi') NOT NULL DEFAULT 'unset' COMMENT 'Dự kiến tuyển gọi' AFTER `military_status_locked`",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'citizens' AND COLUMN_NAME = 'approval_status'
);
SET @sql := IF(@col = 0,
  "ALTER TABLE `citizens` ADD COLUMN `approval_status` ENUM('none','pending','approved','rejected') NOT NULL DEFAULT 'none' COMMENT 'Trạng thái xét duyệt nhập ngũ' AFTER `call_intent`",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Đồng bộ dữ liệu cũ
UPDATE `citizens`
SET `call_intent` = 'du_kien_goi', `approval_status` = 'pending'
WHERE `military_status` = 'trungtuyen' AND `call_intent` = 'unset';

UPDATE `citizens`
SET `call_intent` = 'du_kien_goi', `approval_status` = 'approved'
WHERE `military_status` = 'nhapngu';

UPDATE `citizens`
SET `call_intent` = 'khong_goi', `approval_status` = 'rejected'
WHERE `military_status` IN ('truottuyen') AND `call_intent` = 'unset';

SET FOREIGN_KEY_CHECKS = 1;
