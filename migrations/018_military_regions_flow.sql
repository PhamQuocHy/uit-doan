-- Migration 018: Cây đơn vị nhận quân + map tỉnh ↔ quân khu + cascade chỉ tiêu
SET NAMES utf8mb4;

-- unit_kind trên hierarchy_units
SET @db := DATABASE();
SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'hierarchy_units' AND COLUMN_NAME = 'unit_kind'
);
SET @sql := IF(@col = 0,
  "ALTER TABLE `hierarchy_units` ADD COLUMN `unit_kind` VARCHAR(32) NULL DEFAULT NULL COMMENT 'quankhu|sudoan|trungdoan|btl|...' AFTER `level`",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `military_region_provinces` (
  `region_code` VARCHAR(64) NOT NULL,
  `province_code` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`region_code`, `province_code`),
  KEY `idx_mrp_province` (`province_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cascade chỉ tiêu: QK → tỉnh (theo đợt)
CREATE TABLE IF NOT EXISTS `receiving_sub_quotas` (
  `id` VARCHAR(64) NOT NULL,
  `campaign_id` VARCHAR(64) NOT NULL,
  `from_unit` VARCHAR(64) NOT NULL COMMENT 'Quân khu',
  `to_unit` VARCHAR(64) NOT NULL COMMENT 'Mã tỉnh',
  `amount` INT NOT NULL DEFAULT 0,
  `note` VARCHAR(500) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_rsq_camp_from_to` (`campaign_id`, `from_unit`, `to_unit`),
  KEY `idx_rsq_to` (`to_unit`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
