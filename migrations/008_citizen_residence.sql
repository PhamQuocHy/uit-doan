-- Migration 008: Lịch sử cư trú công dân
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `citizen_residence` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `citizen_id` VARCHAR(50) NOT NULL,
  `residence_type` ENUM('Que quan', 'Thuong tru', 'Tam tru', 'Chuyen di') NOT NULL,
  `address` VARCHAR(500) NOT NULL,
  `start_year` INT DEFAULT NULL,
  `end_year` INT DEFAULT NULL,
  `status` ENUM('current', 'past', 'pending') NOT NULL DEFAULT 'past',
  `decision_no` VARCHAR(100) DEFAULT NULL,
  `note` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_residence_citizen` (`citizen_id`),
  CONSTRAINT `fk_citizen_residence_citizen`
    FOREIGN KEY (`citizen_id`) REFERENCES `citizens` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
