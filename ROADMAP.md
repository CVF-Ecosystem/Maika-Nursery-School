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

### T2-1: Tích hợp Zalo OA
**Vấn đề:** PH VN dùng Zalo nhiều hơn email. Hóa đơn, thông báo gửi qua Zalo = tỷ lệ đọc cao hơn.

Việc cần làm:
- [ ] Đăng ký Zalo Official Account
- [ ] Supabase Edge Function: gọi Zalo API gửi ZNS (Zalo Notification Service) khi hóa đơn mới
- [ ] Settings: admin config Zalo OA token
- [ ] Lưu `zalo_user_id` trong profiles khi PH liên kết tài khoản
- [ ] Fallback sang app notification nếu PH chưa liên kết

**Effort:** ~1 tuần | **Impact:** Rất cao cho tỷ lệ thanh toán đúng hạn

---

### T2-2: Dashboard Alerts thông minh
**Vấn đề:** Dashboard hiện chỉ hiển thị số tổng, không có alerts hành động.

Việc cần làm:
- [ ] Alert: hóa đơn quá hạn > 3 ngày (danh sách + liên hệ nhanh)
- [ ] Alert: học sinh vắng ≥ 3 ngày liên tiếp (chưa có phép)
- [ ] Alert: sự cố status = 'open' chưa xử lý > 24h
- [ ] Alert: báo cáo ngày chưa nộp (GV nào chưa gửi hôm nay)
- [ ] Widget "Việc cần làm hôm nay" trên Dashboard

**Effort:** ~3 ngày | **Impact:** Cao cho admin

---

### T2-3: Two-way Chat Realtime PH ↔ GV
**Vấn đề:** Messages module đã có nhưng chưa realtime. PH phải reload để thấy tin mới.

Việc cần làm:
- [ ] Supabase realtime subscription cho bảng `messages`
- [ ] Optimistic send (tin hiển thị ngay, không chờ server)
- [ ] Unread badge realtime trên tab/sidebar
- [ ] Push notification khi có tin nhắn mới (dùng T1-1)
- [ ] Typing indicator (tùy chọn)

**Effort:** ~3 ngày | **Impact:** Cao — giảm gọi điện

---

### T2-4: Accessibility cho Phụ Huynh lớn tuổi
**Vấn đề:** Ông bà đưa cháu đi học, font nhỏ, contrast yếu, khó nhìn.

Việc cần làm:
- [ ] Parent portal: font-size mặc định 17px (hiện 13-14px)
- [ ] Kiểm tra contrast ratio — tất cả text đạt WCAG AA (4.5:1)
- [ ] Focus ring rõ ràng (outline 2px solid)
- [ ] Tất cả button/icon có aria-label
- [ ] Tăng tap target size ≥ 44×44px trên mobile

**Effort:** ~2 ngày | **Impact:** Trung bình nhưng quan trọng cho UX thực tế

---

### T2-5: Template báo cáo nhanh cho Giáo Viên
**Vấn đề:** GV phải gõ tay từng báo cáo ngày. Mobile rất mất thời gian.

Việc cần làm:
- [ ] Dropdown "Tâm trạng hôm nay": Vui vẻ / Bình thường / Quấy khóc / Ốm
- [ ] Dropdown "Bữa sáng/trưa": Ăn hết / Ăn được / Không ăn
- [ ] Dropdown "Giấc ngủ": Ngủ tốt / Ngủ ít / Không ngủ
- [ ] Text "Ghi chú thêm" cho GV tùy chỉnh
- [ ] Auto-generate summary từ dropdowns (hiển thị cho PH)

**Effort:** ~2 ngày | **Impact:** Cao cho GV, PH thấy thông tin chuẩn hơn

---

## Tier 3 — Kỹ thuật, gián tiếp cho user

### T3-1: ESLint + Prettier + Pre-commit hooks
- [ ] Cài `eslint` + `eslint-plugin-react` + `eslint-plugin-react-hooks`
- [ ] Cài `prettier` với config chuẩn
- [ ] `lint-staged` + `husky` pre-commit
- [ ] Sửa các lỗi lint hiện có

**Effort:** ~4 giờ

---

### T3-2: Tách Invoices.jsx (1083 dòng)
- [ ] `InvoiceList.jsx` — table + filter
- [ ] `InvoiceModal.jsx` — form tạo/sửa (đã tách)
- [ ] `InvoiceSummary.jsx` — 3 ô tổng tiền
- [ ] `InvoiceImportExport.jsx` — logic import/export Excel
- [ ] `ReceiptPrint.jsx` — component in biên lai (đã có)

**Effort:** ~3 giờ

---

### T3-3: Error Boundary log vào audit_logs
- [ ] Khi ErrorBoundary catch, gọi `insertAuditLog({ action: 'client_error', ... })`
- [ ] Hiển thị "Đã có lỗi, đang báo cáo..." thay vì màn hình trắng
- [ ] Nút "Tải lại trang"

**Effort:** ~2 giờ

---

### T3-4: TypeScript dần dần
- [ ] Bắt đầu từ `src/features/*/` services — thêm JSDoc types trước
- [ ] Sau đó migrate từng service sang `.ts`
- [ ] Không cần migrate toàn bộ cùng lúc

**Effort:** Ongoing

---

## Tier 4 — Strategic (sau khi Tier 1-3 xong)

| # | Việc | Điều kiện |
|---|---|---|
| T4-1 | AI tóm tắt daily report tự động (Claude API) | Sau khi T1-3 xong ✅ |
| T4-2 | Voice-to-text tiếng Việt cho GV | Sau T4-1 |
| T4-3 | Dự báo doanh thu / tỷ lệ đi học | Khi có đủ dữ liệu 3 tháng |
| T4-4 | Native app (Expo) | Khi mở rộng quy mô hoặc cần iOS push |
| T4-5 | Multi-tenant SaaS cho nhà trẻ khác | Kiến trúc facility đã sẵn |

---

## Thứ tự làm tiếp (sprint hiện tại)

```
T2-1 (Zalo OA)          ~1 tuần  ← đang làm
T2-2 (Dashboard Alerts) ~3 ngày
T2-3 (Chat Realtime)    ~3 ngày
T2-4 (Accessibility)    ~2 ngày
T2-5 (Teacher templates)~2 ngày
T3-1 (ESLint)           ~4 giờ
T3-2 (Split Invoices)   ~3 giờ
T3-3 (Error Boundary)   ~2 giờ
```
