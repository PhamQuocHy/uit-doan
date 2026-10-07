-- =================================================================================
-- Migration 003: Kho văn bản pháp lý NVQS (legal_documents)
-- Safe to re-run
-- =================================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `legal_documents` (
  `id` VARCHAR(64) NOT NULL,
  `code` VARCHAR(64) NOT NULL,
  `title` VARCHAR(500) NOT NULL,
  `issuer` VARCHAR(255) NOT NULL,
  `issued_date` DATE NULL,
  `effective_date` DATE NULL,
  `doc_type` VARCHAR(64) NOT NULL DEFAULT 'khac',
  `priority` INT NOT NULL DEFAULT 100,
  `summary` TEXT NULL,
  `source_url` VARCHAR(1000) NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `file_path` VARCHAR(500) NOT NULL,
  `content_text` MEDIUMTEXT NULL,
  `tags_json` JSON NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_legal_documents_code` (`code`),
  KEY `idx_legal_documents_type` (`doc_type`),
  KEY `idx_legal_documents_priority` (`priority`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Kho văn bản luật/thông tư NVQS phục vụ tra cứu và AI';

SET FOREIGN_KEY_CHECKS = 1;
