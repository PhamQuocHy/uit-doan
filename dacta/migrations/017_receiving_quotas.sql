-- Migration 017: Chỉ tiêu nhận quân theo đợt + địa phương nguồn
SET NAMES utf8mb4;
SET @db := DATABASE();

CREATE TABLE IF NOT EXISTS `receiving_quotas` (
  `id` VARCHAR(64) NOT NULL,
  `campaign_id` VARCHAR(64) NOT NULL COMMENT 'Đợt tuyển quân',
  `receiving_unit_code` VARCHAR(64) NOT NULL COMMENT 'Đơn vị nhận quân (quân khu)',
  `amount` INT NOT NULL DEFAULT 0 COMMENT 'Chỉ tiêu nhận',
  `note` VARCHAR(500) NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_receiving_quota_camp_unit` (`campaign_id`, `receiving_unit_code`),
  KEY `idx_receiving_quota_unit` (`receiving_unit_code`),
  KEY `idx_receiving_quota_campaign` (`campaign_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `receiving_quota_provinces` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `receiving_quota_id` VARCHAR(64) NOT NULL,
  `province_code` VARCHAR(64) NOT NULL COMMENT 'Mã tỉnh/thành nguồn',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_rqp_quota_province` (`receiving_quota_id`, `province_code`),
  KEY `idx_rqp_province` (`province_code`),
  CONSTRAINT `fk_rqp_quota` FOREIGN KEY (`receiving_quota_id`)
    REFERENCES `receiving_quotas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
