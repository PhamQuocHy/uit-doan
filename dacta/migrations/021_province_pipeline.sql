-- Migration 021: Pipeline xét duyệt Xã → Tỉnh → Quân khu
SET NAMES utf8mb4;

SET @db := DATABASE();

-- pipeline_status
SET @has_pipeline := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'citizens' AND COLUMN_NAME = 'pipeline_status'
);
SET @sql := IF(
  @has_pipeline = 0,
  "ALTER TABLE `citizens` ADD COLUMN `pipeline_status` ENUM('none','local_ready','province_pending','province_ok','province_returned','qk_pending') NOT NULL DEFAULT 'none' COMMENT 'Luồng chuyển hồ sơ xã→tỉnh→QK' AFTER `approval_status`",
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- province_comment
SET @has_pcomment := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'citizens' AND COLUMN_NAME = 'province_comment'
);
SET @sql := IF(
  @has_pcomment = 0,
  "ALTER TABLE `citizens` ADD COLUMN `province_comment` TEXT NULL COMMENT 'Lý do tỉnh trả về bổ sung' AFTER `approval_comment`",
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- province_reviewed_at
SET @has_prev := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'citizens' AND COLUMN_NAME = 'province_reviewed_at'
);
SET @sql := IF(
  @has_prev = 0,
  "ALTER TABLE `citizens` ADD COLUMN `province_reviewed_at` DATETIME NULL COMMENT 'Thời điểm tỉnh đồng tình / trả về' AFTER `province_comment`",
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Backfill: hồ sơ đang chờ / đã xử lý ở QK
UPDATE `citizens`
SET `pipeline_status` = 'qk_pending'
WHERE IFNULL(`pipeline_status`, 'none') = 'none'
  AND (
    `approval_status` IN ('pending', 'approved', 'rejected')
    OR (
      IFNULL(`approval_status`, 'none') = 'none'
      AND IFNULL(`military_status_locked`, 0) = 1
      AND IFNULL(`approval_comment`, '') <> ''
    )
  );

-- Index pipeline
SET @has_idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'citizens' AND INDEX_NAME = 'idx_citizens_pipeline'
);
SET @sql := IF(
  @has_idx = 0,
  "CREATE INDEX `idx_citizens_pipeline` ON `citizens` (`pipeline_status`)",
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
