-- Migration 007: Mobile pairing sessions + CCCD scan results (Capacitor iOS)
SET NAMES utf8mb4;
SET @db := DATABASE();

CREATE TABLE IF NOT EXISTS `mobile_sessions` (
  `id` VARCHAR(36) NOT NULL,
  `connection_code` VARCHAR(8) NOT NULL,
  `status` ENUM(
    'WAITING',
    'CONNECTED',
    'SCANNING',
    'PROCESSING',
    'COMPLETED',
    'ERROR',
    'EXPIRED',
    'DISCONNECTED'
  ) NOT NULL DEFAULT 'WAITING',
  `session_token_hash` CHAR(64) NOT NULL,
  `created_by_user_id` VARCHAR(50) DEFAULT NULL,
  `device_platform` VARCHAR(32) DEFAULT NULL,
  `last_error` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` DATETIME NOT NULL,
  `connected_at` DATETIME DEFAULT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_connection_code` (`connection_code`),
  INDEX `idx_status_expires` (`status`, `expires_at`),
  INDEX `idx_created_by` (`created_by_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mobile_scans` (
  `scan_id` VARCHAR(36) NOT NULL,
  `session_id` VARCHAR(36) NOT NULL,
  `nfc_json` JSON DEFAULT NULL,
  `ocr_json` JSON DEFAULT NULL,
  `verification_json` JSON DEFAULT NULL,
  `device_json` JSON DEFAULT NULL,
  `citizen_id` VARCHAR(50) DEFAULT NULL,
  `personal_id_hash` CHAR(64) DEFAULT NULL,
  `matched` TINYINT(1) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`scan_id`),
  UNIQUE KEY `uk_scan_id` (`scan_id`),
  INDEX `idx_session` (`session_id`),
  CONSTRAINT `fk_mobile_scans_session`
    FOREIGN KEY (`session_id`) REFERENCES `mobile_sessions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
