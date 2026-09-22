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

-- Tài khoản demo — mật khẩu: 123 (hash scrypt, xem src/lib/password.ts)
INSERT INTO `users`
  (`id`, `username`, `password_hash`, `full_name`, `email`, `phone`, `role_id`, `unit_code`, `status`)
VALUES
  ('u-bo',   'admin_bo',     'scrypt$104baa5e11900d7bad4e144af121dcb8$741e911d153e76bf5dde0f38c90272963a79ec80cfbc55de6a3fdc7baabc8a466c2308231f3481d3c6172efae0e7ba7b3271f2f81cae8d46d7fad07080c6e992', 'Quản trị Bộ Quốc phòng',       'admin.bo@ymsa.vn',      '0900000001', 1, 'bo',       'active'),
  ('u-ct',   'admin_cantho', 'scrypt$ad0f2cc817c6d1c7766f9d3ce7d3dc30$43918ecd81f91875148f1f9d187cbbde0887c299d3f38ac2a7cfbd49367713da12800297ea24ef861ab4d8ab980161fafb1fccbd73367c9f99ffbdff6b40e787', 'CHQS Thành phố Cần Thơ',        'admin.cantho@ymsa.vn',  '0900000002', 2, '92',       'active'),
  ('u-pl',   'admin_phuloc', 'scrypt$e95816dcaff28b40db5c9b34582d1e29$423340f06fc48c25f053b68d46249faae3be7c3e318f29c8c1e2eb94ab6282ef55844cb2106cf160c68cc0d20dfbde23d048ce12e8cf6b25ee46f8de05c7750b', 'CHQS Xã Phú Lộc',              'admin.phuloc@ymsa.vn',  '0900000003', 2, '92-31756', 'active'),
  ('u-qk9',  'admin_qk9',    'scrypt$0e6662a8fd04c9ce24c04c67b6a03bb1$d5edad9ea0374c853906ecbf69265603ad0d9e954a436972f1edcfe9ab0f4782ef1fefe0890c67c739c0077029e184f67cd2b00ea51a783bb390586848dfce54', 'Ban nhận quân — Quân khu 9',   'admin.qk9@ymsa.vn',     '0900000004', 2, 'dv-qk9',   'active')
ON DUPLICATE KEY UPDATE
  `full_name` = VALUES(`full_name`),
  `email` = VALUES(`email`),
  `phone` = VALUES(`phone`),
  `role_id` = VALUES(`role_id`),
  `unit_code` = VALUES(`unit_code`),
  `status` = 'active';

SET FOREIGN_KEY_CHECKS = 1;
