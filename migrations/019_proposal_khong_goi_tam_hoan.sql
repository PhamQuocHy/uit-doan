-- Migration 019: Đề xuất không gọi / tạm hoãn chờ QK + minh chứng + nhận xét
SET NAMES utf8mb4;

SET @db := DATABASE();

-- call_intent: thêm de_xuat_khong_goi
SET @col_type := (
  SELECT COLUMN_TYPE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'citizens' AND COLUMN_NAME = 'call_intent'
  LIMIT 1
);
SET @sql := IF(
  @col_type IS NOT NULL AND @col_type NOT LIKE '%de_xuat_khong_goi%',
  "ALTER TABLE `citizens` MODIFY COLUMN `call_intent` ENUM('unset','du_kien_goi','khong_goi','du_bi','de_xuat_khong_goi') NOT NULL DEFAULT 'unset' COMMENT 'Dự kiến tuyển gọi / đề xuất không gọi / dự bị'",
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Nhận xét Quân khu khi trả về đề xuất
SET @has_comment := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'citizens' AND COLUMN_NAME = 'approval_comment'
);
SET @sql := IF(
  @has_comment = 0,
  "ALTER TABLE `citizens` ADD COLUMN `approval_comment` TEXT NULL COMMENT 'Nhận xét QK khi không chấp nhận đề xuất / tạm hoãn' AFTER `military_status_reason`",
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `citizen_nvqs_attachments` (
  `id` VARCHAR(64) NOT NULL,
  `citizen_id` VARCHAR(64) NOT NULL,
  `purpose` ENUM('khong_goi','tam_hoan') NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `file_path` VARCHAR(512) NOT NULL,
  `mime_type` VARCHAR(128) NULL,
  `size_bytes` INT NOT NULL DEFAULT 0,
  `uploaded_by` VARCHAR(64) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cnvqs_citizen` (`citizen_id`),
  KEY `idx_cnvqs_purpose` (`citizen_id`, `purpose`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
