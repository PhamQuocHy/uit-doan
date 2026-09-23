-- Migration 020: Loại minh chứng mới + đường dẫn thư mục minh-chung
SET NAMES utf8mb4;

-- Cho phép lưu giay_tam_hoan / giay_mien_goi / giay_kham_suc_khoe (+ legacy)
ALTER TABLE `citizen_nvqs_attachments`
  MODIFY COLUMN `purpose` VARCHAR(64) NOT NULL;
