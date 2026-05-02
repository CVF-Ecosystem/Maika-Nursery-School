# Roadmap — Nhà Trẻ Maika

> Cập nhật: 2026-05-02 | Dựa trên EA audit độc lập

---

## Trạng thái hiện tại ✅

- Supabase migrations 001–014 đã apply
- RLS đầy đủ trên 20+ bảng
- 3 portals: Admin / Teacher / Parent
- Offline sync cho Teacher (attendance + daily reports) + Parent (localStorage fallback)
- Realtime cho Attendance + Notifications + Incidents + Daily Reports
- Optimistic updates toàn bộ (Invoices, Notifications, Teachers, Incidents, Students)
- PWA v2: manifest + service worker với data cache stale-while-revalidate
- Web Push: Edge Function send-push, PushBanner opt-in, trigger từ notifications/incidents
- Photo upload: DailyReports + Incidents (camera capture, 3 ảnh, Supabase Storage)
- Loading skeletons: Students, Invoices, Incidents, DailyReports
- CI/CD: GitHub Actions (test + build + e2e)
- Tests: Vitest + Playwright

---

## Tier 1 — ✅ HOÀN THÀNH

### ✅ T1-1: Web Push Notifications cho Phụ Huynh
- [x] Đăng ký Web Push subscription khi PH login (VAPID keys)
- [x] Supabase Edge Function `send-push`: gửi push khi có notifications/incidents
- [x] Bảng `push_subscriptions` + RLS (migration 013)
- [x] UI: PushBanner "Bật thông báo" sau 2 lần truy cập
- [x] Fallback: nếu browser không support, không hiển thị banner

> **Việc cần làm thủ công:** `npx web-push generate-vapid-keys` → set `VITE_VAPID_PUBLIC_KEY` trong `.env.local` và Supabase secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`

---

### ✅ T1-2: Realtime mở rộng sang Notifications + Incidents + Daily Reports
- [x] `subscribeNotifications(facilityId, onChange)` trong operationalService
- [x] `subscribeIncidents(facilityId, onChange)` trong sensitiveService
- [x] `subscribeDailyReports(date, facilityId, onChange)` trong dailyReportService
- [x] Apply vào Notifications.jsx, Incidents.jsx, DailyReports.jsx
- [x] Migration 014: bật realtime cho 3 bảng

---

### ✅ T1-3: Camera / Photo Attach trong Daily Reports + Incidents
- [x] `<input type="file" accept="image/*" capture="environment">` trong cả 2 form
- [x] Upload lên Supabase Storage bucket `maika-media` via `uploadReportPhoto`
- [x] Thumbnail grid với remove button (existing + new photos)
- [x] Badge đếm ảnh trong card/table row
- [x] Giới hạn 3 ảnh/record, migration 012 thêm cột `photo_paths`

---

### ✅ T1-4: PWA Offline Cache cho Parent
- [x] SW v2: DATA_CACHE stale-while-revalidate (attendance 7 ngày, reports 7 ngày, notifications 30 ngày)
- [x] Offline indicator banner khi mất kết nối
- [x] PWAInstallBanner: "Thêm vào màn hình chính" sau 2 lần truy cập
- [x] Cache danh sách học sinh vào localStorage, fallback khi offline

---

### ✅ T1-5: Loading Skeletons thay "Đang tải..."
- [x] Class `.skeleton` shimmer animation trong global.css
- [x] Apply vào Students (card grid), Invoices (table rows), Incidents (table rows), DailyReports (card grid)

---

## Tier 2 — Impact cao, effort lớn hơn

### ✅ T2-1: Tích hợp Zalo OA

- [x] Supabase Edge Function `send-zalo-zns`: gọi Zalo ZNS API
- [x] Migration 015: cột zalo_oa_token, zalo_zns_*_template, bảng zns_logs
- [x] Settings → tab Zalo: config token + template IDs + nút test
- [x] Gửi ZNS tự động khi tạo hóa đơn mới (Invoices.jsx)
- [x] Gửi ZNS tự động khi tạo sự cố mới (Incidents.jsx)

> **Việc còn lại thủ công:** Đăng ký Zalo Official Account, lấy OA token thật

---

### ✅ T2-2: Dashboard Alerts thông minh

- [x] Alert: hóa đơn quá hạn > 3 ngày
- [x] Alert: sự cố open chưa xử lý > 24h
- [x] Alert: báo cáo ngày chưa nộp hôm nay
- [x] Alert: học sinh vắng 2 ngày liên tiếp
- [x] Skeleton + "Tất cả ổn 🎉" khi không có alert
- [x] Component `SupabaseAlerts` trong Dashboard.jsx

---

### ✅ T2-3: Two-way Chat Realtime PH ↔ GV

- [x] Migration 016: bảng `messages` + RLS + realtime
- [x] `messageService.js`: listMessages, sendMessage, sendReply, markMessageRead, subscribeMessages
- [x] Messages.jsx: Supabase branch với realtime + optimistic send
- [x] Unread badge realtime trong sidebar (AdminApp.jsx)
- [x] Push notification khi reply/broadcast (sendPushForEvent)

---

### ✅ T2-4: Accessibility cho Phụ Huynh lớn tuổi

- [x] CSS class `.parent-portal` với font-size 17px, line-height 1.6
- [x] Focus ring `:focus-visible` toàn cục — 2px solid #7C3AED
- [x] Tất cả button trong parent portal có aria-label
- [x] Tap target ≥ 44×44px via `.parent-portal button` CSS
- [x] Text muted đổi từ #7C6D9B sang #4C4376 (đạt WCAG AA 5.5:1)
- [x] `role="tablist"/"tab"`, `aria-selected`, `role="alert"` cho offline banner
- [x] Tăng font trong header, tab buttons, banners, overview cards

---

### ✅ T2-5: Template báo cáo nhanh cho Giáo Viên

- [x] Dropdown tâm trạng, bữa ăn, sức khỏe, hoạt động (đã có từ trước)
- [x] Nút "✨ Tạo tóm tắt" trong EditModal: tự sinh câu tiếng Việt từ các dropdown vào ô ghi chú
- [x] GV có thể chỉnh sửa sau khi tạo tóm tắt tự động

---

## Tier 3 — Kỹ thuật, gián tiếp cho user

### ✅ T3-1: ESLint + Prettier + Pre-commit hooks

- [x] Cài `eslint@10` + `eslint-plugin-react` + `eslint-plugin-react-hooks`
- [x] Cài `prettier@3` với config: singleQuote, semi:false, tabWidth:4
- [x] `lint-staged` + `husky` pre-commit: chạy `eslint --fix` + `prettier --write` trên staged files
- [x] `eslint.config.js` flat config, 0 errors
- [x] Scripts: `npm run lint`, `npm run format`

> **Lưu ý:** `react-hooks/rules-of-hooks` đã được refactor ở T3-5; các warning còn lại chủ yếu là `exhaustive-deps`/unused cũ.

---

### ✅ T3-2: Tách Invoices.jsx (1113 → 912 dòng)

- [x] `src/pages/admin/invoices/invoiceTypes.js` — STATUS_MAP + TYPE_MAP constants
- [x] `src/pages/admin/invoices/InvoiceModal.jsx` — form modal tạo/sửa hóa đơn
- [x] `src/pages/admin/invoices/ReceiptPrint.jsx` — component in biên lai + QR

> Invoices đã tách component riêng; pattern này được áp dụng tiếp cho các module Supabase/legacy ở T3-5.

---

### ✅ T3-3: Error Boundary log vào audit_logs

- [x] `componentDidCatch` gọi `logClientError()` (fire-and-forget) → insert vào `audit_logs` bảng Supabase
- [x] Log chỉ chạy trong PROD, không trong dev
- [x] Nút "Tải lại" và "Về trang chủ" đã có sẵn

---

### T3-4: TypeScript dần dần
- [ ] Bắt đầu từ `src/features/*/` services — thêm JSDoc types trước
- [ ] Sau đó migrate từng service sang `.ts`
- [ ] Không cần migrate toàn bộ cùng lúc

**Effort:** Ongoing, không chặn production. Làm dần khi đụng vào service để tránh tạo một đợt refactor lớn.

---

### ✅ T3-5: Refactor React Hooks / Split Supabase branches

- [x] Tách wrapper Supabase và component legacy để không gọi hooks sau early return
- [x] Dọn `react-hooks/rules-of-hooks` trong Attendance, Backups, DailyReports, MediaLibrary, Students, Teachers, Users
- [x] Thêm Deno check cho Supabase Edge Functions: `npm run deno:check:functions`

---

## Production focus — ưu tiên hiện tại

Hệ thống hiện đã đủ nền tảng để chạy production sau khi hoàn tất các việc thủ công ở cuối file. Ưu tiên nâng cấp sau production không phải thêm nhiều module mới, mà là giảm thao tác cho giáo viên trong các luồng dùng hằng ngày: điểm danh, nhật ký ngày, báo sự cố, ảnh.

### ✅ P1: Teacher-first UX cho điểm danh / nhật ký

- [x] Nhật ký: thanh tiến độ hôm nay, hiển thị đã ghi/còn thiếu
- [x] Nhật ký: chế độ làm hàng loạt cho nhiều học sinh rồi sửa ngoại lệ
- [x] Nhật ký: cảnh báo trạng thái sync từng học sinh: đang đồng bộ, đã đồng bộ, chờ đồng bộ
- [x] Nhật ký: quick action cập nhật tâm trạng ngay trên card, giảm mở modal
- [x] Nhật ký: lọc nhanh học sinh chưa có nhật ký
- [x] Nhật ký: nén ảnh trước khi upload để giảm thời gian chờ trên mobile
- [x] Nhật ký: tự lưu nháp khi đang nhập form dài, trước khi bấm lưu
- [x] Điểm danh: thao tác một chạm, nút lớn, phản hồi tức thì theo từng bé
- [x] Điểm danh: thanh tiến độ trong ngày: còn bao nhiêu bé chưa điểm danh
- [x] Điểm danh: bộ lọc nhanh Chưa điểm danh, Vắng, Đi trễ
- [x] Điểm danh: trạng thái sync theo từng học sinh, không khóa cả danh sách khi bấm một bé

### ✅ P2: Giám sát vận hành sau go-live

- [x] Offline queue lưu attempts, lastError, failedAt cho các action lỗi
- [x] Nhật ký: tổng kết cuối ngày gửi notification cho admin/hiệu trưởng
- [x] Dashboard hiệu trưởng: lớp nào còn thiếu điểm danh/nhật ký hôm nay
- [x] Dashboard hiệu trưởng: hiển thị sync lỗi trên thiết bị hiện tại để xử lý nhanh
- [x] Báo cáo cuối ngày đầy đủ: điểm danh, nhật ký, sự cố mở trong cùng một bản tổng kết

---

## Tier 4 — Strategic (làm sau khi production ổn định)

| # | Việc | Điều kiện |
|---|---|---|
| T4-1 | AI gợi ý/tóm tắt daily report tự động | Sau khi UX giáo viên ổn định |
| T4-2 | Dictation tiếng Việt trong app cho GV | Khi cần nhập nhanh nhật ký/sự cố trong Maika; không thay thế voice chat Zalo |
| T4-3 | Dự báo doanh thu / tỷ lệ đi học | Khi có đủ dữ liệu 3 tháng |
| T4-4 | Native app (Expo) | Khi mở rộng quy mô hoặc cần iOS push |
| T4-5 | Multi-tenant SaaS cho nhà trẻ khác | Kiến trúc facility đã sẵn |

> Giao tiếp voice với phụ huynh nên tận dụng Zalo/Zalo OA vì Zalo đã có voice message. T4-2 chỉ dành cho nhập liệu có cấu trúc trong hệ thống Maika.

---

## Thứ tự làm tiếp

```
✅ T2-1 (Zalo OA)
✅ T2-2 (Dashboard Alerts)
✅ T2-3 (Chat Realtime)
✅ T2-4 (Accessibility)
✅ T2-5 (Teacher templates)
✅ T3-1 (ESLint + Prettier + Husky)
✅ T3-2 (Split Invoices)
✅ T3-3 (Error Boundary)
✅ T3-5 (React Hooks split)
✅ P1 (Teacher-first UX)
✅ P2 (Giám sát vận hành)
⏳ T3-4 (TypeScript) — làm dần khi sửa service
⏳ Tier 4 — sau khi ổn định production
```

**Còn lại cần làm thủ công:**

- Apply migration 016 lên Supabase production
- Apply migration 017 lên Supabase production
- Generate VAPID keys (`npx web-push generate-vapid-keys`)
- Đăng ký Zalo Official Account, lấy OA token thật
- Deploy lại Edge Functions `send-push`, `send-zalo-zns`, `storage-maintenance`
