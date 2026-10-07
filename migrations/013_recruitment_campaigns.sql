-- Migration 013: Bảng đợt khám tuyển (recruitment campaigns)
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `recruitment_campaigns` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `year` INT NOT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `status` ENUM('planning', 'ongoing', 'completed') NOT NULL DEFAULT 'planning',
  `target_quota` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_campaigns_year` (`year`),
  KEY `idx_campaigns_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed 2 đợt mẫu (giữ id cũ để khớp citizens.campaign_id nếu đã gán)
INSERT INTO `recruitment_campaigns`
  (`id`, `name`, `year`, `start_date`, `end_date`, `status`, `target_quota`, `created_at`, `updated_at`)
VALUES
  (
    'camp1',
    'Đợt gọi nhập ngũ đợt 1 năm 2026',
    2026,
    '2026-02-01',
    '2026-03-15',
    'ongoing',
    1500,
    '2025-11-01 00:00:00',
    '2026-02-05 00:00:00'
  ),
  (
    'camp2',
    'Đợt gọi nhập ngũ đợt 1 năm 2025',
    2025,
    '2025-02-01',
    '2025-03-15',
    'completed',
    1450,
    '2024-11-01 00:00:00',
    '2025-03-20 00:00:00'
  )
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `year` = VALUES(`year`),
  `start_date` = VALUES(`start_date`),
  `end_date` = VALUES(`end_date`),
  `status` = VALUES(`status`),
  `target_quota` = VALUES(`target_quota`);
