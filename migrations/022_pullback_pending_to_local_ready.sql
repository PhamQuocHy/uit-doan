-- Migration 022: Kéo hồ sơ chờ QK (chưa qua tỉnh) về chờ xã gửi tỉnh
-- Áp dụng cho dự kiến gọi / đề xuất không gọi / tạm hoãn
SET NAMES utf8mb4;

UPDATE `citizens`
SET `pipeline_status` = 'local_ready',
    `approval_status` = 'none'
WHERE `pipeline_status` = 'qk_pending'
  AND `approval_status` = 'pending'
  AND `province_reviewed_at` IS NULL
  AND (
    `military_status` = 'tamhoan'
    OR `call_intent` = 'de_xuat_khong_goi'
    OR `call_intent` = 'du_kien_goi'
  );
