-- =================================================================================
-- HỆ THỐNG QUẢN LÝ NGHĨA VỤ QUÂN SỰ - PHIÊN BẢN CHUYÊN SÂU (v3.1 - FIXED)
-- Export format: MySQL / MariaDB (phpMyAdmin compatible)
-- Character set: utf8mb4_unicode_ci
-- Target: Security, High Performance Search, Data Integrity
-- =================================================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+07:00";

-- THIẾT LẬP MÔI TRƯỜNG ĐỒNG BỘ
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. DANH MỤC HỆ THỐNG (CHUẨN HÓA DỮ LIỆU)
-- --------------------------------------------------------

-- 1.1. Đơn vị hành chính & quân sự
CREATE TABLE IF NOT EXISTS `hierarchy_units` (
  `code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `level` ENUM('bo', 'tinh', 'huyen', 'xa', 'donvi') NOT NULL,
  `parent_code` VARCHAR(50) DEFAULT NULL,
  `is_active` TINYINT(1) DEFAULT 1,
  PRIMARY KEY (`code`),
  INDEX `idx_parent` (`parent_code`),
  INDEX `idx_level` (`level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1.2. Danh mục Quân hàm / Cấp bậc
CREATE TABLE IF NOT EXISTS `military_ranks` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `rank_name` VARCHAR(100) NOT NULL,
  `rank_group` ENUM('Si quan', 'Ha si quan - Binh si', 'QNCN', 'VCQP'),
  `order_weight` INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1.3. Danh mục chuyên môn kỹ thuật
CREATE TABLE IF NOT EXISTS `technical_skills` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `skill_name` VARCHAR(100) NOT NULL,
  `skill_group` VARCHAR(100) -- CNTT, Dien, Co khi, Lai xe...
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. HỆ THỐNG PHÂN QUYỀN (RBAC SECURITY)
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `roles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `role_name` VARCHAR(100) NOT NULL UNIQUE,
  `description` TEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `permissions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `permission_key` VARCHAR(100) NOT NULL UNIQUE,
  `module` VARCHAR(100),
  `description` TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `role_permissions` (
  `role_id` INT NOT NULL,
  `permission_id` INT NOT NULL,
  PRIMARY KEY (`role_id`, `permission_id`),
  FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. QUẢN LÝ TÀI KHOẢN CÁN BỘ
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(50) NOT NULL,
  `username` VARCHAR(100) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255),
  `phone` VARCHAR(20),
  `role_id` INT,
  `unit_code` VARCHAR(50),
  `rank_id` INT,
  `status` ENUM('active', 'inactive', 'locked') DEFAULT 'active',
  `failed_attempts` INT DEFAULT 0,
  `last_login` DATETIME,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  INDEX `idx_unit` (`unit_code`),
  FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`unit_code`) REFERENCES `hierarchy_units`(`code`) ON DELETE SET NULL,
  FOREIGN KEY (`rank_id`) REFERENCES `military_ranks`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `login_history` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `user_id` VARCHAR(50) NOT NULL,
  `ip_address` VARCHAR(45),
  `user_agent` TEXT,
  `status` ENUM('success', 'failed') NOT NULL,
  `login_time` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. QUẢN LÝ CÔNG DÂN (TỐI ƯU HÓA TÌM KIẾM 3 LỚP)
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `citizens` (
  `id` VARCHAR(50) NOT NULL,
  `full_name` VARCHAR(255) NOT NULL,
  `cccd` VARCHAR(20) NOT NULL,
  `date_of_birth` DATE NOT NULL,
  `gender` ENUM('male', 'female') NOT NULL,
  `nationality` VARCHAR(100) DEFAULT 'Việt Nam',
  `ethnicity` VARCHAR(100) DEFAULT 'Kinh',
  `religion` VARCHAR(100) DEFAULT 'Không',
  `origin_place` VARCHAR(255),
  `permanent_address` VARCHAR(255) NOT NULL,
  `current_address` VARCHAR(255),
  `phone` VARCHAR(20),
  `military_status` ENUM('chuakham', 'dangkham', 'trungtuyen', 'tamhoan', 'miengoi', 'nhapngu') NOT NULL DEFAULT 'chuakham',
  `health_grade` INT(1) DEFAULT NULL, -- Loại sức khỏe 1-6
  `is_blacklisted` TINYINT(1) DEFAULT 0, -- Đối tượng cần theo dõi đặc biệt
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cccd` (`cccd`),
  INDEX `idx_full_name` (`full_name`),
  INDEX `idx_search_dob` (`date_of_birth`),
  INDEX `idx_status` (`military_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4.1. Thông tin Định danh (Bảo mật cao)
CREATE TABLE IF NOT EXISTS `citizen_identities` (
  `citizen_id` VARCHAR(50) PRIMARY KEY,
  `identification_features` TEXT,
  `issue_date` DATE,
  `expiry_date` DATE,
  `old_id_number` VARCHAR(20),
  `avatar_url` TEXT,
  `biometric_data` LONGTEXT, -- Vector đặc trưng khuôn mặt (Dùng cho AI scan)
  FOREIGN KEY (`citizen_id`) REFERENCES `citizens`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4.2. Quan hệ Gia đình (Fixed typo EN KEY -> ENUM)
CREATE TABLE IF NOT EXISTS `citizen_family` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `citizen_id` VARCHAR(50) NOT NULL,
  `rel_name` VARCHAR(255) NOT NULL,
  `relationship` ENUM('Cha', 'Me', 'Vo', 'Chong', 'Anh', 'Chi', 'Em') NOT NULL,
  `birth_year` INT,
  `occupation` VARCHAR(255),
  `political_status` TEXT, 
  `is_party_member` TINYINT(1) DEFAULT 0,
  `address` TEXT,
  INDEX `idx_fam_citizen` (`citizen_id`),
  FOREIGN KEY (`citizen_id`) REFERENCES `citizens`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4.3. Quá trình Học tập (Tối ưu tìm kiếm trình độ)
CREATE TABLE IF NOT EXISTS `citizen_education` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `citizen_id` VARCHAR(50) NOT NULL,
  `school_name` VARCHAR(255),
  `level` VARCHAR(100), -- THPT, Cao dang, Dai hoc...
  `major` VARCHAR(255),
  `graduation_year` INT,
  `gpa` FLOAT,
  INDEX `idx_edu_level` (`level`),
  FOREIGN KEY (`citizen_id`) REFERENCES `citizens`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4.4. Chứng chỉ & Kỹ năng (Driving license, IT, Language)
CREATE TABLE IF NOT EXISTS `citizen_certificates` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `citizen_id` VARCHAR(50) NOT NULL,
  `cert_name` VARCHAR(255) NOT NULL,
  `issue_org` VARCHAR(255),
  `issue_date` DATE,
  `expiry_date` DATE,
  `is_specialized` TINYINT(1) DEFAULT 0, -- Chứng chỉ chuyên môn quân sự cần thiết
  FOREIGN KEY (`citizen_id`) REFERENCES `citizens`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. QUẢN LÝ Y TẾ CHI TIẾT (Medical Analysis)
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `health_exams` (
  `id` VARCHAR(50) PRIMARY KEY,
  `citizen_id` VARCHAR(50) NOT NULL,
  `exam_year` INT NOT NULL,
  `exam_phase` VARCHAR(100),
  `height` FLOAT,
  `weight` FLOAT,
  `blood_pressure` VARCHAR(50),
  `vision_left` VARCHAR(10),
  `vision_right` VARCHAR(10),
  `hearing` VARCHAR(100),
  `heart_rate` INT,
  `conclusions_detail` TEXT, -- Chi tiết bệnh lý
  `medical_grade` ENUM('Loại 1', 'Loại 2', 'Loại 3', 'Loại 4', 'Loại 5', 'Loại 6'),
  `doctor_id` VARCHAR(50),
  `is_qualified` TINYINT(1) DEFAULT 0, -- Kết luận cuối cùng có đủ sức khỏe không
  INDEX `idx_health_year` (`exam_year`),
  FOREIGN KEY (`citizen_id`) REFERENCES `citizens`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. CÔNG VĂN & TÀI LIỆU (LOẠI MẬT)
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `military_documents` (
  `id` VARCHAR(50) PRIMARY KEY,
  `doc_code` VARCHAR(50) NOT NULL UNIQUE,
  `title` VARCHAR(255) NOT NULL,
  `content_encrypted` LONGTEXT, -- Nội dung đã mã hóa
  `file_hash` VARCHAR(64), -- Dùng để verify file nếu bị đổi
  `confidentiality` ENUM('Normal', 'Secret', 'Top Secret') DEFAULT 'Normal',
  `type` ENUM('incoming', 'outgoing') NOT NULL,
  `from_unit` VARCHAR(50),
  `created_by` VARCHAR(50),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`from_unit`) REFERENCES `hierarchy_units`(`code`),
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Luồng công văn (Tracking)
CREATE TABLE IF NOT EXISTS `document_tracking` (
  `document_id` VARCHAR(50),
  `to_unit` VARCHAR(50),
  `received_at` DATETIME NULL,
  `viewed_at` DATETIME NULL,
  `digital_signature` TEXT, -- Chữ ký số xác nhận đã nhận
  PRIMARY KEY (`document_id`, `to_unit`),
  FOREIGN KEY (`document_id`) REFERENCES `military_documents`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`to_unit`) REFERENCES `hierarchy_units`(`code`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. TRUY VẾT & GIÁM SÁT (AUDIT)
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `system_audit_logs` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `user_id` VARCHAR(50),
  `action_type` ENUM('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'EXPORT', 'VIEW_SENSITIVE') NOT NULL,
  `target_table` VARCHAR(100),
  `target_id` VARCHAR(100),
  `data_snapshot` LONGTEXT, -- Lưu JSON của record lúc thao tác
  `ip_address` VARCHAR(45),
  `log_time` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_audit_time` (`log_time`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
COMMIT;
