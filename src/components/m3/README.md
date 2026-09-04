# Material 3 Expressive kit (`components/m3`)

Spec tham chiếu: [m3.material.io/components](https://m3.material.io/components)  
(Site chủ yếu là ảnh/spec — **không có code React**. MUI cũng **chưa** cover đủ Expressive.)

## Chiến lược 2 lớp

| Lớp | Dùng khi | Cách |
|-----|----------|------|
| **A. Ghi đè MUI** | `Button`, `Chip`, `Fab`, `TextField`, `Dialog`… sẵn có | `createM3MuiTheme()` → `ThemeProvider` trong `providers.tsx` |
| **B. Component thuần M3** | Morph / connected group / float pill / FAB squircle | Import từ `@/components/m3` |

Không “thay thế” được hết MUI bằng ảnh trên m3.material.io — phải **map token + custom widget**.

## Dùng theme MUI (lớp A)

Đã gắn sẵn trong `src/theme.ts`. Mọi `<Button>`, `<Chip>`… tự theo:

- Pill radius (`9999`)
- Primary brand `#1a73e8`
- Motion Expressive (curve + duration từ `tokens.ts`)
- Font weight vừa (500)

Đổi brand:

```ts
import { createM3MuiTheme } from "@/components/m3";
const theme = createM3MuiTheme("#0b57d0");
```

## Dùng widget Expressive (lớp B)

```tsx
import {
  M3ThemeProvider,
  M3SelectionGroup,
  M3Fab,
  M3FloatPillField,
} from "@/components/m3";

<M3ThemeProvider mode="light" primary="#1a73e8">
  <M3SelectionGroup options={...} value={...} onChange={...} />
  <M3Fab />
</M3ThemeProvider>
```

Demo: `/m3-demo`

## Token nguồn

`tokens.ts` — port từ end4-pC `Appearance.qml` (rounding, curves, palette roles).  
Brand remap: `withPrimaryAccent(palette, primary)`.

## Khi nào viết thêm vào `components/m3`

- Spec Expressive có **shape morph / connected radii** mà MUI chưa có
- Cần parity với demo [Button groups](https://m3.material.io/components/button-groups/overview)

Còn lại: ưu tiên **styleOverrides trong `createM3MuiTheme`** để không fork toàn bộ MUI.
