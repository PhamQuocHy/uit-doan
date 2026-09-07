-- Migration 014: Công văn đi/đến + tệp đính kèm
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `official_documents` (
  `id` VARCHAR(64) NOT NULL,
  `code` VARCHAR(64) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `content` MEDIUMTEXT NULL,
  `type` ENUM('incoming', 'outgoing') NOT NULL,
  `from_unit` VARCHAR(64) NOT NULL,
  `to_units_json` JSON NOT NULL,
  `doc_date` DATE NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'sent',
  `urgent` TINYINT(1) NOT NULL DEFAULT 0,
  `created_by` VARCHAR(64) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_official_docs_code` (`code`),
  KEY `idx_official_docs_from` (`from_unit`),
  KEY `idx_official_docs_type` (`type`),
  KEY `idx_official_docs_date` (`doc_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `official_document_attachments` (
  `id` VARCHAR(64) NOT NULL,
  `document_id` VARCHAR(64) NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `file_path` VARCHAR(512) NOT NULL,
  `mime_type` VARCHAR(128) NULL,
  `size_bytes` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_oda_doc` (`document_id`),
  CONSTRAINT `fk_oda_doc`
    FOREIGN KEY (`document_id`) REFERENCES `official_documents` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
