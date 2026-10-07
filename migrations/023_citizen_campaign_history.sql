-- Migration 023: Lịch sử nhiều đợt khám / đợt tuyển quân trên 1 hồ sơ
-- citizens.campaign_id = đợt đang làm việc hiện tại
-- citizen_campaigns = mọi đợt đã gắn (2026 vẫn còn khi thêm 2027)

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS citizen_campaigns (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  citizen_id VARCHAR(64) NOT NULL,
  campaign_id VARCHAR(64) NOT NULL,
  call_intent VARCHAR(32) NULL,
  approval_status VARCHAR(32) NULL DEFAULT 'none',
  military_status VARCHAR(32) NULL,
  military_status_reason VARCHAR(500) NULL,
  pipeline_status VARCHAR(32) NULL DEFAULT 'none',
  source ENUM('manual','ai_sample','backfill','carry_over') NOT NULL DEFAULT 'manual',
  note VARCHAR(500) NULL,
  is_current TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_citizen_campaign (citizen_id, campaign_id),
  KEY idx_cc_campaign (campaign_id),
  KEY idx_cc_citizen (citizen_id),
  KEY idx_cc_current (citizen_id, is_current)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Lịch sử gắn hồ sơ với nhiều đợt khám/tuyển quân';

-- Backfill từ campaign_id hiện có (giữ trạng thái snapshot lúc migrate)
INSERT INTO citizen_campaigns (
  citizen_id, campaign_id, call_intent, approval_status, military_status,
  military_status_reason, pipeline_status, source, note, is_current
)
SELECT
  c.id,
  c.campaign_id,
  c.call_intent,
  c.approval_status,
  c.military_status,
  LEFT(IFNULL(c.military_status_reason, ''), 500),
  IFNULL(c.pipeline_status, 'none'),
  'backfill',
  'Đồng bộ từ campaign_id lúc nâng cấp lịch sử đợt',
  1
FROM citizens c
WHERE c.campaign_id IS NOT NULL
  AND TRIM(c.campaign_id) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM citizen_campaigns cc
    WHERE cc.citizen_id = c.id AND cc.campaign_id = c.campaign_id
  );
