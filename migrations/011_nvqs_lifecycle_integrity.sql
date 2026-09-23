-- Migration 011: Index hỗ trợ vòng đời NVQS / lưu trữ
SET NAMES utf8mb4;

-- Index tra cứu hồ sơ lưu trữ / chờ duyệt (bỏ qua nếu đã có)
CREATE INDEX idx_citizens_archived_at ON citizens (archived_at);
