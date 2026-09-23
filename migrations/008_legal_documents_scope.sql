-- Migration 008: Scope legal documents to the user's administrative level
SET NAMES utf8mb4;
SET @column_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'legal_documents'
    AND COLUMN_NAME = 'hierarchy_level'
);
SET @sql := IF(@column_exists = 0,
  'ALTER TABLE legal_documents ADD COLUMN hierarchy_level VARCHAR(32) NOT NULL DEFAULT ''tinh'' AFTER is_active',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'legal_documents'
    AND INDEX_NAME = 'idx_legal_documents_scope'
);
SET @sql := IF(@index_exists = 0,
  'ALTER TABLE legal_documents ADD INDEX idx_legal_documents_scope (hierarchy_level)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;