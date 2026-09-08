-- Migration 009: Link candidates and approvals to a recruitment campaign
SET NAMES utf8mb4;
SET @db := DATABASE();
SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'citizens' AND COLUMN_NAME = 'campaign_id'
);
SET @sql := IF(@col = 0,
  "ALTER TABLE citizens ADD COLUMN campaign_id VARCHAR(64) NULL AFTER approval_status",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @index_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'citizens' AND INDEX_NAME = 'idx_citizens_campaign'
);
SET @sql := IF(@index_exists = 0,
  'ALTER TABLE citizens ADD INDEX idx_citizens_campaign (campaign_id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;