-- =================================================================================
-- Migration 001: Analytics-ready schema (Data Mining layer)
-- Safe to re-run: uses IF NOT EXISTS / information_schema checks where needed
-- =================================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. citizens.unit_code + deferment_reason
-- --------------------------------------------------------
SET @db := DATABASE();

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'citizens' AND COLUMN_NAME = 'unit_code'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `citizens` ADD COLUMN `unit_code` VARCHAR(50) NULL AFTER `phone`, ADD INDEX `idx_citizen_unit` (`unit_code`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'citizens' AND CONSTRAINT_NAME = 'fk_citizen_unit'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE `citizens` ADD CONSTRAINT `fk_citizen_unit` FOREIGN KEY (`unit_code`) REFERENCES `hierarchy_units`(`code`) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'citizens' AND COLUMN_NAME = 'deferment_reason'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `citizens` ADD COLUMN `deferment_reason` ENUM(''hoc_tap'',''suc_khoe'',''gia_dinh'',''chua_du_tuoi'',''khac'') NULL AFTER `military_status`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. exam_rounds
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `exam_rounds` (
  `id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `year` INT NOT NULL,
  `phase` VARCHAR(100) DEFAULT NULL,
  `unit_code` VARCHAR(50) DEFAULT NULL,
  `start_date` DATE DEFAULT NULL,
  `end_date` DATE DEFAULT NULL,
  `status` ENUM('draft','open','closed') NOT NULL DEFAULT 'draft',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_exam_year` (`year`),
  INDEX `idx_exam_unit` (`unit_code`),
  CONSTRAINT `fk_exam_round_unit` FOREIGN KEY (`unit_code`) REFERENCES `hierarchy_units`(`code`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. exam_participants
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `exam_participants` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `round_id` VARCHAR(50) NOT NULL,
  `citizen_id` VARCHAR(50) NOT NULL,
  `result` ENUM('pending','passed','failed','deferred','exempted','enlisted') NOT NULL DEFAULT 'pending',
  `notes` TEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_round_citizen` (`round_id`, `citizen_id`),
  INDEX `idx_ep_citizen` (`citizen_id`),
  INDEX `idx_ep_result` (`result`),
  CONSTRAINT `fk_ep_round` FOREIGN KEY (`round_id`) REFERENCES `exam_rounds`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ep_citizen` FOREIGN KEY (`citizen_id`) REFERENCES `citizens`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. quotas
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `quotas` (
  `id` VARCHAR(50) NOT NULL,
  `year` INT NOT NULL,
  `from_unit` VARCHAR(50) NOT NULL,
  `to_unit` VARCHAR(50) NOT NULL,
  `amount` INT NOT NULL DEFAULT 0,
  `filled` INT NOT NULL DEFAULT 0,
  `note` TEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_quota_year` (`year`),
  INDEX `idx_quota_to` (`to_unit`),
  CONSTRAINT `fk_quota_from` FOREIGN KEY (`from_unit`) REFERENCES `hierarchy_units`(`code`) ON DELETE CASCADE,
  CONSTRAINT `fk_quota_to` FOREIGN KEY (`to_unit`) REFERENCES `hierarchy_units`(`code`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Feature mart (materialized table for AI phase later)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `analytics_citizen_features` (
  `citizen_id` VARCHAR(50) NOT NULL,
  `age` INT DEFAULT NULL,
  `unit_code` VARCHAR(50) DEFAULT NULL,
  `unit_level` ENUM('bo','tinh','huyen','xa','donvi') DEFAULT NULL,
  `education_level` VARCHAR(100) DEFAULT NULL,
  `job_proxy` VARCHAR(255) DEFAULT NULL,
  `health_grade` INT DEFAULT NULL,
  `is_qualified_last` TINYINT(1) DEFAULT NULL,
  `height` FLOAT DEFAULT NULL,
  `weight` FLOAT DEFAULT NULL,
  `bmi` FLOAT DEFAULT NULL,
  `military_status` VARCHAR(50) DEFAULT NULL,
  `deferment_reason` VARCHAR(50) DEFAULT NULL,
  `exam_count` INT DEFAULT 0,
  `years_since_last_exam` INT DEFAULT NULL,
  `is_blacklisted` TINYINT(1) DEFAULT 0,
  `refreshed_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`citizen_id`),
  INDEX `idx_acf_unit` (`unit_code`),
  INDEX `idx_acf_status` (`military_status`),
  INDEX `idx_acf_edu` (`education_level`),
  CONSTRAINT `fk_acf_citizen` FOREIGN KEY (`citizen_id`) REFERENCES `citizens`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='AI-ready feature mart. Phase AI: train ML from this table. Endpoint stub: POST /api/admin/ai/risk-score';

SET FOREIGN_KEY_CHECKS = 1;
