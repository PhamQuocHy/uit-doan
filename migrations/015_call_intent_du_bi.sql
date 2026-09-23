-- Migration 015: Thêm trạng thái dự bị (call_intent)
SET NAMES utf8mb4;

-- Mở rộng ENUM call_intent thêm 'du_bi'
SET @db := DATABASE();
SET @col_type := (
  SELECT COLUMN_TYPE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'citizens' AND COLUMN_NAME = 'call_intent'
  LIMIT 1
);
SET @sql := IF(
  @col_type IS NOT NULL AND @col_type NOT LIKE '%du_bi%',
  "ALTER TABLE `citizens` MODIFY COLUMN `call_intent` ENUM('unset','du_kien_goi','khong_goi','du_bi') NOT NULL DEFAULT 'unset' COMMENT 'Dự kiến tuyển gọi / dự bị'",
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
