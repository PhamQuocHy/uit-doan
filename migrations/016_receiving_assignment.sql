-- Migration 016: Phân quân / đơn vị nhận quân
SET NAMES utf8mb4;
SET @db := DATABASE();

-- receiving_status
SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'citizens' AND COLUMN_NAME = 'receiving_status'
);
SET @sql := IF(@col = 0,
  "ALTER TABLE `citizens` ADD COLUMN `receiving_status` ENUM('chua_phan_quan','da_phan_quan','submitted_to_bo','bo_approved','published') NULL DEFAULT NULL COMMENT 'Trạng thái phân đơn vị nhận quân' AFTER `campaign_id`",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- receiving_unit_code
SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'citizens' AND COLUMN_NAME = 'receiving_unit_code'
);
SET @sql := IF(@col = 0,
  "ALTER TABLE `citizens` ADD COLUMN `receiving_unit_code` VARCHAR(64) NULL DEFAULT NULL COMMENT 'Mã đơn vị nhận quân (quân khu)' AFTER `receiving_status`",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Đồng bộ: đã nhập ngũ mà chưa có trạng thái phân quân → chưa phân quân
UPDATE `citizens`
SET `receiving_status` = 'chua_phan_quan'
WHERE `military_status` = 'nhapngu'
  AND (`receiving_status` IS NULL OR `receiving_status` = '')
  AND (`receiving_unit_code` IS NULL OR `receiving_unit_code` = '');

UPDATE `citizens`
SET `receiving_status` = 'da_phan_quan'
WHERE `military_status` = 'nhapngu'
  AND `receiving_unit_code` IS NOT NULL
  AND `receiving_unit_code` <> ''
  AND (`receiving_status` IS NULL OR `receiving_status` = 'chua_phan_quan');

-- Seed thêm quân khu (nếu chưa có)
INSERT IGNORE INTO hierarchy_units (code, name, level, parent_code, is_active)
VALUES
  ('dv-qk1', 'Quân khu 1', 'donvi', 'bo', 1),
  ('dv-qk2', 'Quân khu 2', 'donvi', 'bo', 1),
  ('dv-qk3', 'Quân khu 3', 'donvi', 'bo', 1),
  ('dv-qk4', 'Quân khu 4', 'donvi', 'bo', 1),
  ('dv-qk5', 'Quân khu 5', 'donvi', 'bo', 1),
  ('dv-qk7', 'Quân khu 7', 'donvi', 'bo', 1),
  ('dv-qk9', 'Quân khu 9', 'donvi', 'bo', 1);
