# Analytics & Data Mining (MySQL)

Lớp phân tích đọc **MySQL** — không dùng mock. AI/ML để phase sau.

## Setup

1. Copy `.env.example` → `.env` và điền thông tin MySQL.
2. Một lệnh đầy đủ (tạo DB + schema gốc + migration + seed):

```bash
npm run db:setup
```

Hoặc từng bước:

3. `npm run db:migrate` — tạo DB nếu thiếu + migration analytics
4. `npm run db:seed-analytics` — seed nếu `citizens` trống (`--force` để tạo lại)
5. `npm run db:refresh-features` — refresh feature mart

## API

| Endpoint | Mô tả |
|----------|--------|
| `GET /api/admin/reports?year=&unitCode=` | Dashboard analytics (UI dùng) |
| `GET /api/admin/analytics` | Cùng payload |
| `POST /api/admin/analytics` `{ "action": "refresh-features" }` | Refresh mart (admin) |
| `POST /api/admin/ai/risk-score` | **Stub 501** — phase AI |

## Feature mart → AI

Bảng `analytics_citizen_features` là hợp đồng dữ liệu cho Logistic Regression / Random Forest / XAI.

Xem `ai-contract.ts` cho danh sách cột và endpoint dự kiến.
