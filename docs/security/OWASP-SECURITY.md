# 10 lớp bảo mật OWASP — triển khai và kiểm thử

Ngày kiểm tra: 17/09/2026. Dự án Next.js + MySQL.

OWASP Top 10 là **10 nhóm rủi ro**, không phải chứng nhận “thêm 10 bước là an toàn tuyệt đối”. Bản tham chiếu là [OWASP Top 10:2025](https://top10.owasp.org/2025/). Các thay đổi dưới đây giảm rủi ro cụ thể; phần cuối ghi rõ giới hạn còn lại.

## Những điều cần làm khi chạy lại

1. Dừng tiến trình Next.js cũ và khởi động lại bằng `npm run dev` (cổng 5305). Thư viện Next đã được nâng phiên bản; không nên giữ tiến trình cũ.
2. Đăng nhập lại. Khóa JWT local đã được tạo ngẫu nhiên thay cho khóa mặc định; token cũ không còn hợp lệ. Không đưa `.env` lên Git.
3. MySQL phải hoạt động. Mặc định ứng dụng không chuyển sang tài khoản demo khi DB lỗi. `ALLOW_DEMO_AUTH=true` chỉ dành cho môi trường phát triển và không có hiệu lực ở production.
4. Khi triển khai máy khác, sao chép `.env.example`, điền cấu hình và tạo khóa bằng `openssl rand -hex 48`. Không dùng giá trị `REPLACE_…` trong file mẫu.
5. Production phải dùng HTTPS vì cookie có `Secure`. Origin của ứng dụng và cấu hình reverse proxy phải khớp; không dùng `Origin: *` để sửa lỗi CSRF.

## Đã làm gì, ở đâu và test ra sao

| # | Biện pháp và OWASP liên quan | Vị trí chính | Cách kiểm thử / kết quả mong đợi |
|---|---|---|---|
| 1 | Kiểm soát truy cập, kiểm tra trạng thái/quyền mới từ DB; kiểm tra chủ sở hữu phiên CCCD (A01) | `src/lib/auth.ts`, `src/proxy.ts`, API `mobile/session/status`, `mobile/session/events`, `nfc/session`, `nfc/submit` | Không cookie gọi API admin hoặc `/uploads/...` → 401. Dùng cookie tài khoản B đọc phiên của A → bị từ chối. Khóa tài khoản trong DB → API dùng `getSession()` không chấp nhận phiên cũ. |
| 2 | HTTP headers, chống nhúng iframe, giảm rò rỉ cache, CSP (A02) | `next.config.ts`, `src/lib/security/api-guard.ts` | DevTools → Network: có `nosniff`, `DENY`, CSP, `no-referrer`; API có `Cache-Control: no-store`; không có `X-Powered-By`. Production có HSTS. |
| 3 | Vá dependency và thêm lệnh audit có ngưỡng thất bại (A03) | `package.json`, `package-lock.json` | `npm run security:audit` phải exit 0. Next 16.3.5 và SheetJS 0.20.3 từ CDN chính thức. `npm audit` đầy đủ còn cảnh báo công cụ native, xem bên dưới. |
| 4 | Loại khóa JWT mặc định; kiểm issuer/audience/expiry/signature; mật khẩu mới 12–256 ký tự, luôn băm phía server (A04, A07) | `src/lib/auth.ts`, `src/lib/password.ts`, API `admin/users` và `admin/users/[id]`, `.env.example` | Token bị sửa/hết hạn/sai issuer → không xác thực; khóa mặc định → không tạo token. Tạo/đổi mật khẩu ngắn → 400; không nhận chuỗi hash client như hash đã tin cậy. |
| 5 | Kiểm kiểu/độ dài đăng nhập, JSON hợp lệ, định dạng CCCD; giữ truy vấn tham số hóa (A05) | `src/lib/security/controls.ts`, API `auth/login`, `public/tra-cuu`; SQL qua `src/lib/db.ts` | Username dạng object → 400. CCCD chứa `OR`, chữ hoặc ký tự lạ → 400. Đăng nhập dùng `' OR 1=1 --` không được vượt xác thực. Không có thao tác tự nối username/CCCD vào SQL. |
| 6 | Chặn CSRF cho API ghi dữ liệu (A01, A06) | `src/proxy.ts`, `isSameOrigin()` trong `controls.ts` | POST có Origin khác ứng dụng hoặc `null` → 403. Request có cookie nhưng thiếu Origin và không có `Sec-Fetch-Site: same-origin` → 403. Native/curl không cookie, không Origin vẫn được đi tiếp tới kiểm tra token của từng API. |
| 7 | Hạn chế thử mật khẩu/PIN/mã ghép đôi/tra cứu; tắt fallback đăng nhập mặc định (A06, A07) | `src/proxy.ts`, API `auth/login`, `src/lib/unit-pin.ts`, `consumeLimit()` | Cùng username: quá 10 lần/15 phút → 429 với `Retry-After`. PIN: quá 10 lần/đơn vị/15 phút → không xác thực ở mọi nơi gọi `verifyEditPinAsync`. Mất MySQL → đăng nhập 503 thay vì mở tài khoản demo. |
| 8 | Kiểm tra PDF và toàn vẹn luồng CCCD (A08) | API `admin/document-archive`, `src/lib/mobile/sessions.ts`, API `mobile/scan-result` | Đổi đuôi HTML thành `.pdf` → 400; PDF quá 10 MB → 400. Mã ghép đôi chỉ đổi WAITING → CONNECTED một lần bằng UPDATE có điều kiện. Server tự tính lại `verification`, không tin `matched:true` client gửi. |
| 9 | Nhật ký bảo mật có cấu trúc và mã truy vết (A09) | `securityEvent()` trong `controls.ts`, `api-guard.ts`, `auth/login`, `src/proxy.ts` | Terminal có JSON sự kiện đăng nhập thành công/thất bại, CSRF, rate limit, API lỗi. Response qua guard có `X-Request-Id`; lỗi không được xử lý bên trong có thêm requestId trong JSON. Log mới không ghi password, cookie, token, CCCD hay nội dung request. |
| 10 | Biên xử lý lỗi chung và giới hạn JSON theo byte thực tế (A10) | `src/lib/security/api-guard.ts`, `readJson()`; mọi `src/app/api/**/route.ts` dùng guard | JSON vỡ → 400; JSON quá 12 MiB → 413 kể cả không có Content-Length; đăng nhập giới hạn riêng 4 KiB. Lỗi không dự kiến → thông báo chung, không trả stack/SQL. Các API AI/analytics đã bỏ trả nguyên `error.message`. |

Chi tiết thêm: endpoint tra cứu chỉ chấp nhận CCCD 9 hoặc 12 chữ số và tên tối đa 150 ký tự; phản hồi che CCCD, chỉ để 4 số cuối. Tên PDF ghi/xóa trên ổ đĩa được kiểm tra để loại đường dẫn `../`. Endpoint tương thích `PATCH /api/nfc/session` trả 410; client phải dùng `/api/mobile/session/connect` để nhận token.

## Chạy test tự động

Tại thư mục gốc dự án:

```bash
npm run test:security
node --import tsx --test src/lib/user-management.test.ts src/lib/print-exam-selection.test.ts src/lib/citizen-health-print.test.ts
npx tsc --noEmit
npm run security:audit
npm run build -- --webpack
```

- `src/lib/security/security.test.ts`: 10 test với nhiều tình huống con: CSRF, rate limit, JSON, lỗi API, PDF, password, JWT, mobile token, proxy và log injection.
- Ba file test nghiệp vụ có sẵn: 13 test hồi quy.
- Dùng `npm ci` trên máy/CI sạch để cài đúng lockfile; không dùng `npm audit fix --force` một cách tự động.
- `npm run security:check` gộp test bảo mật, TypeScript và audit production.

Test HTTP thực tế, không ghi DB và không cần tài khoản:

```bash
# Terminal 1, sau khi build:
npm run start -- -H 127.0.0.1 -p 5316

# Terminal 2:
npm run test:security:http

# Hoặc kiểm tra dev đang chạy ở cổng 5305:
SECURITY_TEST_URL=http://localhost:5305 npm run test:security:http
```

Script `scripts/security-smoke.mjs` kiểm tra 9 request và nhóm HTTP headers. Kết quả mong đợi: tất cả dòng `PASS`.

## Test thủ công với dữ liệu thử nghiệm

Chỉ dùng tài khoản/dữ liệu thử; các bước khóa tài khoản hoặc tạo hồ sơ sẽ thay đổi DB thử nghiệm.

### Truy cập trái phép và CSRF

```bash
curl -i http://localhost:5305/api/admin/citizens
# 401

curl -i http://localhost:5305/uploads/avatars/test.jpg
# 401 trước khi phục vụ tệp

curl -i http://localhost:5305/api/auth/login \
  -H 'Origin: https://evil.example' \
  -H 'Content-Type: application/json' \
  --data '{"username":"security-test","password":"wrong"}'
# 403

curl -i http://localhost:5305/api/auth/login \
  -H 'Content-Type: application/json' --data '{'
# 400
```

Khi gọi API ghi dữ liệu bằng cookie trong curl/Postman, gửi `Origin: http://localhost:5305` khớp đúng URL. Nếu đang dùng `127.0.0.1`, Origin cũng phải là `http://127.0.0.1:5305`.

### Thử mật khẩu liên tục

Với MySQL đang chạy, gửi 11 POST tới `/api/auth/login` cùng username thử nghiệm và mật khẩu sai. 10 lần đầu trả 401 nếu thông tin có kiểu hợp lệ; lần 11 trả 429. Dùng username mới cho lần chạy lại, hoặc chờ 15 phút. Bộ đếm tính cả đăng nhập thành công để đơn giản hóa giới hạn tài nguyên; không thử trên tài khoản sử dụng thật.

### Quyền sở hữu và tính toàn vẹn CCCD

1. Đăng nhập tài khoản A, tạo phiên quét; ghi lại `sessionId`/`connectionCode` bằng Network.
2. Trong trình duyệt khác, đăng nhập B; gọi `/api/mobile/session/status?sessionId=...` của A, không gửi bearer token. Không được trả kết quả CCCD.
3. Dùng mã của A ghép đôi điện thoại lần đầu → thành công và nhận token. Dùng cùng mã ghép đôi lần nữa → 404, không thay token cũ. Tạo phiên mới nếu cần ghép lại.
4. Gửi scan-result có NFC/OCR không khớp nhưng `verification.matched=true`. Phản hồi phải sử dụng kết quả máy chủ tự tính lại.
5. Dùng token sai, token của phiên khác hoặc phiên hết hạn → không truy cập được.
6. Các luồng này cần MySQL và dữ liệu mẫu hợp lệ; unit test không thay thế kiểm thử end-to-end trên thiết bị NFC.

### PDF, tài khoản và giao diện

- Tải PDF thật dưới 10 MB ở Kho văn bản → thành công; chọn file HTML đổi đuôi `.pdf`, file rỗng hoặc quá 10 MB → bị từ chối.
- Tạo tài khoản với mật khẩu 6 ký tự → bị từ chối; mật khẩu dài 12–256 ký tự → tiếp tục các kiểm tra nghiệp vụ.
- Đăng nhập một tài khoản thử, khóa tài khoản đó bằng tài khoản có quyền; API có `getSession()` phải từ chối cookie cũ.
- Kiểm tra lại xuất Excel, mở PDF, camera, micro và trang tra cứu trong trình duyệt. CSP cho phép font Google, worker blob và camera/micro cùng origin để giữ các chức năng này.

## Giới hạn còn lại và triển khai production

- Không tuyên bố đã pentest toàn hệ thống hoặc “đạt chuẩn OWASP”. Chưa audit toàn bộ quyền theo đơn vị của mọi nghiệp vụ.
- Rate limit hiện ở bộ nhớ từng tiến trình, mất khi restart; khi chạy nhiều instance cần Redis/gateway chung. Khi `TRUST_PROXY=false`, các request dùng chung bucket theo endpoint; không tin IP do client tự gửi. Chỉ bật biến này khi reverse proxy xóa/ghi đè X-Forwarded-For và chặn truy cập trực tiếp backend.
- `getSession()` đọc trạng thái/quyền mới từ DB; JWT chưa có danh sách thu hồi từng token. Logout xóa cookie phía client; đổi password chưa vô hiệu hóa mọi JWT đã phát hành. Nếu cần thu hồi toàn bộ phiên ngay lập tức, phải bổ sung session version hoặc kho phiên server-side.
- `/uploads` đã yêu cầu JWT hợp lệ tại proxy, nhưng tệp vẫn nằm trong `public`. Chưa bổ sung ACL từng tệp hay di chuyển sang kho riêng. Reverse proxy/CDN tuyệt đối không phục vụ `/uploads` trực tiếp để bỏ qua Next proxy. Người đã có token hợp lệ vẫn cần lớp phân quyền theo tài liệu nếu dùng để lưu hồ sơ mật.
- CSP vẫn có `unsafe-inline` cho script/style để tương thích Next hiện tại, chưa phải CSP dùng nonce. PDF kiểm tra MIME/đuôi/magic bytes, không phải antivirus hay phân tích toàn bộ cấu trúc PDF.
- JSON có giới hạn đọc thực tế; multipart hiện dựa vào Content-Length và giới hạn từng file ở handler. Reverse proxy cần chặn body lớn kể cả truyền chunked, timeout kết nối và giới hạn request đồng thời. Giới hạn Content-Length chung hiện 12 MiB có thể khiến gửi nhiều file lớn cùng lúc bị 413; chia nhỏ lượt gửi.
- Mật khẩu legacy và PIN DB còn hỗ trợ dữ liệu cũ; chưa thực hiện migration hàng loạt hay mã hóa dữ liệu CCCD/health trên ổ đĩa. Dùng tài khoản DB tối thiểu quyền, TLS, mã hóa ổ đĩa/backup và chính sách lưu giữ dữ liệu khi triển khai.
- Log bảo mật mới là JSON trên stderr, chưa có hệ thống cảnh báo tự động hoặc kho log chống sửa. Cần thu thập và đặt cảnh báo cho nhiều `login_failed`, `csrf_rejected`, `api_error`; các log/audit cũ cần đánh giá riêng về dữ liệu cá nhân.
- Audit production ngày 17/09/2026: **0 cảnh báo**. Audit đầy đủ còn **7 cảnh báo** trong cây công cụ `@capacitor/assets`: 1 critical, 3 high, 3 moderate (tar/sharp/uuid và các gói phụ thuộc). `npm audit fix` tương thích chưa giải quyết hết; không ép thay major để tránh phá tạo asset iOS. Không dùng công cụ này với nguồn asset/tar không tin cậy; cần nâng/thay riêng và kiểm thử native trước khi coi chuỗi công cụ sạch.
- Build Turbopack bị môi trường kiểm tra chặn thao tác bind cổng (`EPERM`). Build Webpack là cách kiểm chứng thay thế; không thay cấu hình bundler mặc định của dự án.

Nguồn: [OWASP Top 10:2025](https://top10.owasp.org/2025/), [Next.js advisories](https://github.com/vercel/next.js/security/advisories), [SheetJS hướng dẫn cài bản chính thức](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/).

## Kết quả thực tế của lần triển khai này

- Test bảo mật: **10/10 đạt**.
- Test hồi quy nghiệp vụ: **13/13 đạt**.
- Smoke test HTTP trên production server tại `127.0.0.1:5316`: **9/9 request đúng mã mong đợi và nhóm headers đạt**.
- TypeScript: không lỗi.
- ESLint các file API/security đã kiểm tra: không lỗi; còn 8 warning unused variable có sẵn ở API citizens và approval.
- Build production `next build --webpack`: thành công. Build Turbopack: không kiểm chứng được do EPERM của môi trường như đã nêu.
- `npm audit --omit=dev`: **0 lỗ hổng được registry báo cáo tại thời điểm chạy**; không đồng nghĩa không còn lỗ hổng chưa được công bố.
- Chưa thực hiện các test ghi DB với hai tài khoản thật, tải PDF qua giao diện hay NFC trên iPhone. Các bước đó đã được hướng dẫn riêng ở trên để chạy trên dữ liệu thử nghiệm.
