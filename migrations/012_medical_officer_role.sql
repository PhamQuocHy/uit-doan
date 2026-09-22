-- Migration 012: Tách vai trò Cán bộ y tế riêng khỏi Cán bộ nghiệp vụ
SET NAMES utf8mb4;
SET @db := DATABASE();

SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'roles' AND COLUMN_NAME = 'display_name'
);
SET @sql := IF(@col = 0,
  "ALTER TABLE `roles` ADD COLUMN `display_name` VARCHAR(150) NULL COMMENT 'Tên hiển thị' AFTER `role_name`",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Chuẩn hóa tên cũ
UPDATE `roles`
SET `role_name` = 'MEDICAL_OFFICER',
    `display_name` = 'Cán bộ y tế',
    `description` = 'Cán bộ y tế — nhập khám sức khỏe, theo dõi đợt khám tuyển'
WHERE `role_name` IN ('Nhân viên y tế', 'Nhan vien y te', 'HEALTH_STAFF')
   OR `display_name` IN ('Nhân viên y tế', 'Nhan vien y te');

INSERT INTO `roles` (`role_name`, `display_name`, `description`)
SELECT 'MEDICAL_OFFICER', 'Cán bộ y tế', 'Cán bộ y tế — nhập khám sức khỏe, theo dõi đợt khám tuyển'
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM `roles`
  WHERE `role_name` = 'MEDICAL_OFFICER'
     OR `display_name` = 'Cán bộ y tế'
);

UPDATE `roles`
SET `display_name` = 'Cán bộ y tế',
    `description` = COALESCE(NULLIF(`description`, ''), 'Cán bộ y tế — nhập khám sức khỏe, theo dõi đợt khám tuyển')
WHERE `role_name` = 'MEDICAL_OFFICER';

-- Quyền mặc định
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
JOIN `permissions` p ON p.permission_key IN (
  'CITIZEN_VIEW',
  'HEALTH_VIEW', 'HEALTH_CREATE', 'HEALTH_EDIT', 'HEALTH_APPROVE',
  'EDUCATION_VIEW', 'RESIDENCE_VIEW', 'RECRUITMENT_VIEW', 'REPORT_VIEW'
)
WHERE r.role_name = 'MEDICAL_OFFICER';

-- Chuyển user y tế sang vai trò riêng
UPDATE `users` u
JOIN `roles` r ON r.role_name = 'MEDICAL_OFFICER'
SET u.role_id = r.id
WHERE u.functional_role = 'y_te'
  AND (u.role_id IS NULL OR u.role_id <> r.id);
