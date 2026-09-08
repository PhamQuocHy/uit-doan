-- Migration 010: Đánh dấu hồ sơ đã duyệt chuyển lưu trữ
SET NAMES utf8mb4;

ALTER TABLE `citizens`
  ADD COLUMN `archived_at` DATETIME NULL DEFAULT NULL
    COMMENT 'Thời điểm duyệt chuyển hồ sơ lưu trữ'
    AFTER `updated_at`;
