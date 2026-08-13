-- =================================================================================
-- Migration 004: Roles, đơn vị nhận quân, tài khoản demo đủ 4 cấp
-- Bộ → Cần Thơ → Xã Phú Lộc → Quân khu 9
-- Safe to re-run: INSERT IGNORE / ON DUPLICATE KEY UPDATE
-- =================================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Roles
INSERT IGNORE INTO `roles` (`id`, `role_name`, `description`) VALUES
  (1, 'Quản trị hệ thống', 'Admin toàn hệ thống'),
  (2, 'Cán bộ NVQS', 'Cán bộ cấp Bộ/Tỉnh/Xã/Đơn vị nhận quân');

-- Đơn vị hành chính & nhận quân
INSERT INTO `hierarchy_units` (`code`, `name`, `level`, `parent_code`, `is_active`) VALUES
  ('bo', 'Bộ Quốc phòng', 'bo', NULL, 1),
  ('92', 'Thành phố Cần Thơ', 'tinh', 'bo', 1),
  ('92-31756', 'Xã Phú Lộc', 'xa', '92', 1),
  ('dv-qk9', 'Quân khu 9', 'donvi', 'bo', 1)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `level` = VALUES(`level`),
  `parent_code` = VALUES(`parent_code`),
  `is_active` = 1;

-- PIN demo (xã Phú Lộc)
UPDATE `hierarchy_units`
SET `edit_pin` = '654321'
WHERE `code` = '92-31756' AND `level` = 'xa'
  AND (`edit_pin` IS NULL OR `edit_pin` = '');

-- Tài khoản demo — mật khẩu: 123 (plaintext, demo)
INSERT INTO `users`
  (`id`, `username`, `password_hash`, `full_name`, `email`, `phone`, `role_id`, `unit_code`, `status`)
VALUES
  ('u-bo',   'admin_bo',     '123', 'Quản trị Bộ Quốc phòng',       'admin.bo@ymsa.vn',      '0900000001', 1, 'bo',       'active'),
  ('u-ct',   'admin_cantho', '123', 'CHQS Thành phố Cần Thơ',        'admin.cantho@ymsa.vn',  '0900000002', 2, '92',       'active'),
  ('u-pl',   'admin_phuloc', '123', 'CHQS Xã Phú Lộc',              'admin.phuloc@ymsa.vn',  '0900000003', 2, '92-31756', 'active'),
  ('u-qk9',  'admin_qk9',    '123', 'Ban nhận quân — Quân khu 9',   'admin.qk9@ymsa.vn',     '0900000004', 2, 'dv-qk9',   'active')
ON DUPLICATE KEY UPDATE
  `password_hash` = VALUES(`password_hash`),
  `full_name` = VALUES(`full_name`),
  `email` = VALUES(`email`),
  `phone` = VALUES(`phone`),
  `role_id` = VALUES(`role_id`),
  `unit_code` = VALUES(`unit_code`),
  `status` = 'active';

SET FOREIGN_KEY_CHECKS = 1;
