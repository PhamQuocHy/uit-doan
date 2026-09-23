-- =================================================================================
-- Migration 002: NVQS status lock, reason, rớt tuyển + PIN địa phương
-- Safe to re-run: uses information_schema checks
-- =================================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

SET @db := DATABASE();

-- 1. citizens.military_status — thêm trạng thái truottuyen (Rớt)
-- --------------------------------------------------------
SET @enum_has_truot := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'citizens'
    AND COLUMN_NAME = 'military_status'
    AND COLUMN_TYPE LIKE '%truottuyen%'
);
SET @sql := IF(@enum_has_truot = 0,
  'ALTER TABLE `citizens` MODIFY COLUMN `military_status` ENUM(''chuakham'',''dangkham'',''trungtuyen'',''truottuyen'',''tamhoan'',''miengoi'',''nhapngu'') NOT NULL DEFAULT ''chuakham''',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. citizens.military_status_reason
-- --------------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'citizens' AND COLUMN_NAME = 'military_status_reason'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `citizens` ADD COLUMN `military_status_reason` TEXT NULL COMMENT ''Lý do rớt / tạm hoãn NVQS'' AFTER `military_status`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. citizens.military_status_locked
-- --------------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'citizens' AND COLUMN_NAME = 'military_status_locked'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `citizens` ADD COLUMN `military_status_locked` TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''Khóa sửa trạng thái NVQS sau khi lưu'' AFTER `military_status_reason`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4. hierarchy_units.edit_pin — mã PIN theo địa phương
-- --------------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'hierarchy_units' AND COLUMN_NAME = 'edit_pin'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `hierarchy_units` ADD COLUMN `edit_pin` VARCHAR(20) NULL COMMENT ''Mã PIN sửa trạng thái NVQS (cấp tỉnh/huyện/xã)'' AFTER `parent_code`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 5. Demo PIN (TP Cần Thơ + Phường Hưng Phú) — chỉ ghi nếu chưa có
-- --------------------------------------------------------
UPDATE `hierarchy_units`
SET `edit_pin` = '123456'
WHERE `code` = '92' AND `level` = 'tinh' AND (`edit_pin` IS NULL OR `edit_pin` = '');

UPDATE `hierarchy_units`
SET `edit_pin` = '654321'
WHERE `code` = '92-31201' AND `level` = 'xa' AND (`edit_pin` IS NULL OR `edit_pin` = '');

SET FOREIGN_KEY_CHECKS = 1;
