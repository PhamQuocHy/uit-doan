This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## iOS app (Capacitor, cùng codebase Next.js)

Web desktop và app iPhone dùng chung API/MySQL. App là native shell: WebView tải UI `/mobile/*` từ server Next.js, native bridge gọi Core NFC, Camera, Vision OCR.

1. Chạy migration: `npm run db:migrate`
2. Đặt `CAPACITOR_SERVER_URL` (HTTPS production, hoặc `http://LAN_IP:5305` khi dev)
3. Trên **macOS + Xcode**:

```bash
npx cap add ios
npx tsx scripts/patch-ios-plist.ts
npx cap sync ios
npm run cap:assets
npx cap open ios
```

Trong Xcode: bật capability **Near Field Communication Tag Reading**, chọn team signing, gắn `App.entitlements`, đặt app icon từ `resources/icon.png`.

Luồng: PC **Nhận dạng AI** tạo mã → iPhone `/mobile/connect` nhập mã → quét NFC (CAN/PACE) + chụp CCCD → đối chiếu → PC nhận SSE không cần F5.
