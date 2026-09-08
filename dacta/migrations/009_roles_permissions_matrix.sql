-- Migration 009: Ma trận quyền hạn đầy đủ cho quản lý vai trò
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

UPDATE `roles` SET `display_name` = 'Quản trị viên (Admin)' WHERE `role_name` = 'SUPER_ADMIN' AND (`display_name` IS NULL OR `display_name` = '');
UPDATE `roles` SET `display_name` = 'Cán bộ nghiệp vụ' WHERE `role_name` = 'UNIT_OFFICER' AND (`display_name` IS NULL OR `display_name` = '');
UPDATE `roles` SET `display_name` = 'Đơn vị nhận quân' WHERE `role_name` = 'RECEIVING_UNIT' AND (`display_name` IS NULL OR `display_name` = '');

INSERT IGNORE INTO `permissions` (`permission_key`, `module`, `description`) VALUES
  ('CITIZEN_VIEW', 'CITIZEN', 'Xem danh sách / hồ sơ công dân'),
  ('CITIZEN_CREATE', 'CITIZEN', 'Thêm công dân mới'),
  ('CITIZEN_EDIT', 'CITIZEN', 'Chỉnh sửa hồ sơ công dân'),
  ('CITIZEN_DELETE', 'CITIZEN', 'Xóa hồ sơ công dân'),
  ('CITIZEN_EXPORT', 'CITIZEN', 'Xuất danh sách công dân'),
  ('HEALTH_VIEW', 'HEALTH', 'Xem kết quả khám sức khỏe'),
  ('HEALTH_CREATE', 'HEALTH', 'Nhập kết quả khám sức khỏe'),
  ('HEALTH_EDIT', 'HEALTH', 'Sửa kết quả khám sức khỏe'),
  ('HEALTH_DELETE', 'HEALTH', 'Xóa kết quả khám'),
  ('HEALTH_APPROVE', 'HEALTH', 'Duyệt phân loại sức khỏe'),
  ('EDUCATION_VIEW', 'EDUCATION', 'Xem học vấn'),
  ('EDUCATION_EDIT', 'EDUCATION', 'Cập nhật học vấn'),
  ('RESIDENCE_VIEW', 'RESIDENCE', 'Xem cư trú'),
  ('RESIDENCE_EDIT', 'RESIDENCE', 'Cập nhật cư trú'),
  ('RECRUITMENT_VIEW', 'RECRUITMENT', 'Xem đợt tuyển / gọi khám'),
  ('RECRUITMENT_CREATE', 'RECRUITMENT', 'Tạo đợt tuyển'),
  ('RECRUITMENT_EDIT', 'RECRUITMENT', 'Sửa đợt tuyển'),
  ('RECRUITMENT_DELETE', 'RECRUITMENT', 'Xóa đợt tuyển'),
  ('APPROVAL_VIEW', 'APPROVAL', 'Xem danh sách xét duyệt'),
  ('APPROVAL_EDIT', 'APPROVAL', 'Phê duyệt / từ chối'),
  ('DOCUMENT_VIEW', 'DOCUMENT', 'Xem công văn / hồ sơ'),
  ('DOCUMENT_CREATE', 'DOCUMENT', 'Tạo công văn'),
  ('DOCUMENT_EDIT', 'DOCUMENT', 'Sửa công văn'),
  ('DOCUMENT_DELETE', 'DOCUMENT', 'Xóa công văn'),
  ('QUOTA_VIEW', 'QUOTA', 'Xem chỉ tiêu'),
  ('QUOTA_EDIT', 'QUOTA', 'Cập nhật chỉ tiêu'),
  ('USER_VIEW', 'USER', 'Xem danh sách người dùng'),
  ('USER_CREATE', 'USER', 'Thêm người dùng'),
  ('USER_EDIT', 'USER', 'Sửa người dùng / mật khẩu'),
  ('USER_DELETE', 'USER', 'Xóa người dùng'),
  ('ROLE_VIEW', 'ROLE', 'Xem vai trò & quyền hạn'),
  ('ROLE_EDIT', 'ROLE', 'Quản lý vai trò & gán quyền'),
  ('REPORT_VIEW', 'REPORT', 'Xem báo cáo thống kê'),
  ('REPORT_EXPORT', 'REPORT', 'Xuất báo cáo'),
  ('LOG_VIEW', 'LOG', 'Xem nhật ký hệ thống'),
  ('SETTING_VIEW', 'SETTING', 'Xem cấu hình'),
  ('SETTING_EDIT', 'SETTING', 'Sửa cấu hình hệ thống');

INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT 1, p.id FROM `permissions` p;

INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT 2, p.id FROM `permissions` p
WHERE p.permission_key IN (
  'CITIZEN_VIEW','CITIZEN_CREATE','CITIZEN_EDIT','CITIZEN_EXPORT',
  'HEALTH_VIEW','HEALTH_CREATE','HEALTH_EDIT',
  'EDUCATION_VIEW','EDUCATION_EDIT','RESIDENCE_VIEW','RESIDENCE_EDIT',
  'RECRUITMENT_VIEW','RECRUITMENT_CREATE','RECRUITMENT_EDIT',
  'APPROVAL_VIEW','DOCUMENT_VIEW','DOCUMENT_CREATE','QUOTA_VIEW','REPORT_VIEW'
);

INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT 3, p.id FROM `permissions` p
WHERE p.permission_key IN (
  'CITIZEN_VIEW','HEALTH_VIEW','RECRUITMENT_VIEW','APPROVAL_VIEW',
  'DOCUMENT_VIEW','REPORT_VIEW'
);
