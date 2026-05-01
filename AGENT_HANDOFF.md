# AGENT_HANDOFF — Nhà Trẻ Maika

> **Ngày tạo**: 30/04/2026  
> **Tác giả**: EA Assessment Agent  
> **Trạng thái**: 🟢 PHASE 12 ĐÃ TRIỂN KHAI — Phases 8–12 hoàn thành 01/05/2026. Frontend vẫn fallback static/localStorage khi chưa bật API

## ⚡ Quyết định kiến trúc (đã xác nhận bởi EA)

| Quyết định | Giá trị | Ghi chú |
|-----------|---------|--------|
| **Deploy** | Vercel hoặc Netlify (static hosting) | Custom domain gắn sau khi ổn định |
| **Data** | localStorage fallback + SQLite API khi bật `VITE_API_URL` | Static demo vẫn chạy độc lập |
| **Backend** | Express + SQLite (`node:sqlite`) | JWT/bcrypt/RBAC/upload/migration đã có |
| **Stack** | Vite + React + optional Express API | Netlify static cần deploy API riêng nếu dùng backend |

---

## 1. Bối cảnh dự án

**Nhà Trẻ Maika** là hệ thống quản lý nhà trẻ tư thục gồm 3 module:
- **Landing Page**: Trang giới thiệu + đăng ký tham quan
- **Cổng Phụ Huynh**: Thông báo, hình ảnh, nhật ký ngày, nhắn tin
- **Admin SPA**: 11 modules quản lý (học sinh, GV, điểm danh, tài chính, v.v.)

### Hiện trạng kỹ thuật

| Metric | Giá trị |
|--------|---------|
| **Files** | 17 files + 1 thư mục `uploads/` |
| **Total size** | ~308 KB |
| **Stack** | Vanilla HTML/CSS/JS + React 18 (via Babel Standalone CDN) |
| **Data** | localStorage only — key `maika_v1` |
| **EA Score** | **2.60 / 5.0 (52%)** — Demo only, KHÔNG production-ready |

### Critical Issues phải fix

| # | Vấn đề | Mức độ |
|---|--------|--------|
| 1 | ~~**Không backend** — toàn bộ dữ liệu localStorage, mất khi xóa cache~~ (ĐÃ FIX: optional Express + SQLite API) | 🔴 |
| 2 | **Hardcoded credentials** — frontend demo vẫn có fallback; backend dùng bcrypt + env password | 🔴 |
| 3 | ~~**Monolith** — `index.html` 822 dòng chứa 3 views + CSS + JS~~ (ĐÃ FIX: tách ra 55 ES modules) | 🔴 |
| 4 | ~~**Duplicate code** — Landing + Parent Portal tồn tại 2 bản (standalone + nhúng)~~ (ĐÃ FIX) | 🟠 |
| 5 | **XSS** — user-generated content cần sanitize (ĐÃ FIX phần tin nhắn, tên file, CSV import bằng DOMPurify) | 🟠 |
| 6 | ~~**Global namespace** — tất cả components dùng `window.*`~~ (ĐÃ FIX: dùng JS import/export) | 🟠 |
| 7 | **Không tests, không CI/CD** (Đã tạo .gitignore) | 🟠 |
| 8 | **Ảnh lưu Base64 trong localStorage** — fallback demo vẫn vậy; backend upload server-side đã có | 🟡 |

### Điểm mạnh giữ nguyên

- ✅ UI/UX premium (5/5) — design Indigo/Violet nhất quán, micro-animations
- ✅ Phủ nghiệp vụ tốt — 11 modules admin đầy đủ
- ✅ Font Nunito + responsive < 900px
- ✅ Print PDF nhật ký học sinh

---

## 2. File Inventory (Đã cập nhật sau Phase 1)

```
Nha tre Maika/
├── src/
│   ├── pages/ (landing/, parent/, admin/)
│   ├── data/store.js
│   ├── styles/global.css
│   ├── utils/format.js
│   ├── App.jsx
│   └── main.jsx
├── public/
│   ├── uploads/
│   └── _redirects
├── index.html              (Minimal Vite entry)
├── package.json
├── vite.config.js
├── vercel.json
├── .gitignore
└── AGENT_HANDOFF.md
```
*(Đã loại bỏ các file `bb-*.jsx`, `Maika*.html`, `landing-content.js`, `landing.css` cũ)*

---

## 3. Roadmap 6 Phases

### Phase 0 — CVF Governance (✅ Đã xong)
- [x] Chạy `/cvf-onboard`
- [x] Tạo `.gitignore` (node_modules, dist, .env, uploads)
- [x] Git init + first commit snapshot

### Phase 1 — Tái Cấu Trúc Code (✅ Đã xong)
- [x] Setup Vite: `npm create vite@latest ./ -- --template react`
- [x] Install: `npm install react-router-dom`
- [x] Tách `index.html` monolith → từng file JSX riêng (xem cấu trúc bên dưới)
- [x] Loại bỏ `Maika-Landing.html`, `Maika-Parent.html`, `Maika.html` (duplicate)
- [x] Convert `bb-*.jsx` → ES module imports (bỏ `window.*` exports)
- [x] Setup React Router v6 thay `showView()` + `display:none`
- [x] Extract inline styles → CSS classes hoặc CSS modules

**Cấu trúc thư mục mới**:
```
src/
├── pages/
│   ├── landing/Landing.jsx + landing.css
│   ├── parent/ParentPortal.jsx, Announcements.jsx, Gallery.jsx, DailyReport.jsx, Messaging.jsx
│   └── admin/AdminApp.jsx, Dashboard.jsx, Students.jsx, Teachers.jsx, Attendance.jsx,
│          Finance.jsx, Communication.jsx, Calendar.jsx, Analytics.jsx, Resources.jsx, Sidebar.jsx
├── components/ui/Button.jsx, Card.jsx, Modal.jsx, Avatar.jsx, Badge.jsx
├── data/api.js (API client), seed.js
├── styles/global.css, landing.css, admin.css
├── utils/format.js (fmtDate, fmtMoney), auth.js
├── App.jsx (root router)
└── main.jsx (entry)
```

### Phase 2 — Deploy Vercel/Netlify (✅ Đã xong)
- [x] Tạo `vite.config.js` với `base: '/'` và output `dist/`
- [x] Chạy `npm run build` → verify `dist/` folder
- [x] Deploy lên Netlify: https://maikaschool.netlify.app
- [x] Verify tất cả routes hoạt động trên URL public (`/`, `/parent`, `/parent/portal`, `/admin`, `/admin/app` đều HTTP 200)
- [x] Cấu hình `_redirects` (Netlify) hoặc `vercel.json` cho SPA routing:

**Netlify** — tạo `public/_redirects`:
```
/*    /index.html   200
```

**Vercel** — tạo `vercel.json`:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

> ⚠️ Data vẫn localStorage — mỗi browser/device có data riêng. Đây là thiết kế có chủ đích cho giai đoạn demo.

### Phase 3 — Security Cơ Bản (✅ Đã xong)
- [x] Input sanitization: DOMPurify cho user-generated content (tin nhắn, tên file, CSV import)
- [x] File upload: validate MIME type (image/* only), max size 5MB client-side
- [x] Bỏ hiển thị credential gợi ý trong production build (dùng env var `VITE_DEMO_MODE`)
- [x] Thêm CSP meta tag trong `index.html`

### Phase 4 — Testing (✅ Đã xong)
- [x] Unit tests (Vitest): `utils/format.js`, security utils, component route renders (`10 passed`)
- [x] E2E tests (Playwright): Parent login → view report, Admin CRUD student (`2 passed`)
- [x] Lighthouse audit: Performance 94, Accessibility 100, Best Practices 100, SEO 91

### Phase 5 — Polish & PWA (✅ Đã xong)
- [x] PWA: Service Worker, Web Manifest → installable trên phone
- [x] Performance: Code splitting (React.lazy đã có), image WebP, font subsetting
- [x] SEO: meta tags, Open Graph cho Landing page
- [x] `aria-*` attributes, keyboard nav — đã thêm role/aria-label/aria-modal vào tất cả modal, table, button, form inputs quan trọng trong Backups, Incidents, Invoices, HealthRecords

### Phase 6 — Custom Domain (khi sẵn sàng)
- [ ] Mua domain (ví dụ: `maika.edu.vn`)
- [ ] Cấu hình DNS → Vercel/Netlify custom domain
- [ ] Setup SSL (auto bởi Vercel/Netlify)
- [ ] Redirect `www` → non-www (hoặc ngược lại)

### Phase 7 — Backend (✅ Đã xong)
> ĐÃ TRIỂN KHAI theo yêu cầu ngày 30/04/2026. Backend là optional để không phá Netlify static demo hiện tại.

- [x] Express + SQLite backend (`node:sqlite`, DB mặc định `server/data/maika.sqlite`)
- [x] REST API thay localStorage khi bật `VITE_API_URL`; frontend vẫn fallback localStorage nếu không cấu hình API
- [x] JWT auth + bcrypt (`MAIKA_JWT_SECRET`, `MAIKA_ADMIN_PASSWORD`, `MAIKA_TEACHER_PASSWORD`)
- [x] RBAC: Admin / Teacher / Parent (parent snapshot được filter theo student)
- [x] File upload server-side (Multer, image/*, max 5MB, `server/uploads`)
- [x] Migrate data từ localStorage → database qua snapshot import/export scripts

---

## 4. Quy tắc cho Agent tiếp theo

1. **Bắt đầu từ Phase 0** — CVF onboard trước khi code
2. **Commit sau mỗi phase** — mỗi phase là 1 tranche có thể review
3. **Giữ nguyên UI/UX** — design hiện tại đã premium, KHÔNG redesign
4. **Data = localStorage fallback + optional API** — bật backend bằng `VITE_API_URL`; không bật thì demo static vẫn chạy
5. **Deploy = Netlify static cho frontend; API cần deploy riêng** nếu chuyển production thật
6. **Test mỗi module** sau khi migrate — đảm bảo chức năng giống hệt
7. **Chạy `/pre-commit-check`** trước khi commit mỗi tranche
8. **Cập nhật AGENT_HANDOFF** này — tick `[x]` mỗi task hoàn thành

---

## 5. Credentials hiện tại (chỉ dùng cho dev/test, xóa khi lên production)

| Role | Login | Password |
|------|-------|----------|
| Parent | Phone: `0901234567` | — (phone only) |
| Admin | Any role | `123456` hoặc `maika` |

---

## 6. Dependencies hiện tại (CDN)

| Package | Version | URL |
|---------|---------|-----|
| React | 18.3.1 | unpkg.com (có SRI) |
| ReactDOM | 18.3.1 | unpkg.com (có SRI) |
| Babel Standalone | 7.29.0 | unpkg.com (có SRI) |
| Nunito Font | — | Google Fonts |

**Sau Phase 1 (Đã làm)**: Cập nhật sang dùng Vite bundler `npm install react react-dom react-router-dom dompurify`. Loại bỏ hoàn toàn Babel Standalone (đã xóa script trên index.html).

**Sau Phase 4**: Thêm Vitest + Testing Library + jsdom, script `npm run test:run`. Thêm Playwright, script `npm run test:e2e`, test parent login → report và admin CRUD student. Đã nâng Vite lên 8.x để `npm audit` = 0 vulnerability; `manualChunks` đã đổi sang function tương thích Vite 8/Rolldown.

**Sau Phase 5 partial**: Thêm `manifest.webmanifest`, `sw.js`, SVG favicon/icon/OG image, SEO/Open Graph/Twitter meta. Lighthouse trên Vite preview: Performance 94, Accessibility 100, Best Practices 100, SEO 91.

**Sau Phase 7**: Thêm Express API trong `server/`:
- `npm run api:dev` chạy API tại `http://127.0.0.1:8787`
- `POST /api/auth/login`, `GET/PUT /api/snapshot`, REST collections `/api/students`, `/api/daily-reports`, v.v.
- User management/RBAC UI: thêm trang Admin `Tài khoản`; backend có `GET/POST/PUT /api/users`, khóa/mở tài khoản, đổi role/password/status.
- Audit log: thêm bảng `audit_logs`, API `GET /api/audit-logs`, trang Admin `Nhật ký`; ghi login success/fail, user changes, snapshot sync, CRUD, upload.
- Backup/restore: thêm `server/backup.js`, API `GET/POST /api/backups`, `download`, `restore`, trang Admin `Sao lưu`; backup lưu ở `MAIKA_BACKUP_DIR` và audit log khi tạo/khôi phục.
- `server/README.md` ghi cách chạy, auth, migration snapshot
- API tests trong `server/app.test.js`; hiện `npm run test:run` = 4 files / 16 tests passed
- Lưu ý: `node:sqlite` trên Node 22 đang có ExperimentalWarning, nhưng tests/build pass.

### EA Production Roadmap Còn Lại (8 Phần)
> Đây là phần bàn giao chính cho agent tiếp theo. Các mục dưới đây là roadmap để đưa app từ demo mạnh lên production thật cho nhà trẻ.

#### Đã xong trước roadmap này
- [x] User Management + RBAC: trang `Tài khoản`, API `/api/users`, khóa/mở tài khoản, đổi role/password/status.
- [x] Audit log: bảng `audit_logs`, API `/api/audit-logs`, trang `Nhật ký`, ghi login/snapshot/CRUD/upload/user changes.
- [x] Backup/restore thủ công: `server/backup.js`, API `/api/backups`, trang `Sao lưu`, download/restore backup.

#### 1. Lịch Backup Định Kỳ (✅ Đã xong — 01/05/2026)
- [x] Backup/restore thủ công đã có.
- [x] Thêm scheduler trong backend (`server/scheduler.js`, dùng `node-cron`).
- [x] Cấu hình cron qua env: `MAIKA_BACKUP_SCHEDULE_ENABLED=true`, `MAIKA_BACKUP_CRON=0 2 * * *` (Asia/Ho_Chi_Minh).
- [x] Retention policy: `MAIKA_BACKUP_RETENTION_COUNT=30`, `MAIKA_BACKUP_RETENTION_DAYS=30`. Hàm `applyRetentionPolicy()` trong `backup.js`.
- [x] Ghi audit log `backup_scheduled` / `backup_scheduled_failed`.
- [x] Trang `Sao lưu` hiển thị panel scheduler status (bật/tắt, cron, lần chạy cuối, kết quả).

#### 2. Hồ Sơ Sức Khỏe Học Sinh (✅ Đã xong — 01/05/2026)
- [x] Bảng `health_records` trong SQLite: dị ứng, thuốc, ghi chú y tế, liên hệ khẩn cấp, bác sĩ.
- [x] API: `GET/PUT /api/health-records/:studentId` (admin/teacher ghi, parent chỉ đọc con mình).
- [x] Trang Admin `Sức khỏe` (`HealthRecords.jsx`) — chọn học sinh, inline edit.
- [x] Parent portal tab `🏥 Sức khỏe` — read-only, lọc đúng studentId.
- [x] Audit log `health_record_updated`.

#### 3. Incident Report (✅ Đã xong — 01/05/2026)
- [x] Bảng `incidents` trong SQLite: studentId, thời gian, mức độ (minor/moderate/severe), mô tả, xử lý ban đầu, người ghi nhận.
- [x] API: `GET/POST /api/incidents`, `GET/PUT /api/incidents/:id`. Parent chỉ PUT để acknowledge.
- [x] Workflow trạng thái: `draft → open → resolved → parent_acknowledged`.
- [x] Trang Admin `Sự cố` (`Incidents.jsx`) — tạo, cập nhật, lọc theo status.
- [x] Parent portal tab `⚠ Sự cố` — xem và bấm "✓ Đã đọc" để acknowledge.
- [x] Audit log toàn bộ thay đổi trạng thái.

#### 4. Học Phí Nâng Cao & Biên Lai (✅ Đã xong — 01/05/2026)
- [x] Bảng `invoices` trong SQLite: mã biên lai tự động (INV+YYYYMM-XXXX), loại phí, số tiền, hạn nộp, ngày nộp, hình thức, trạng thái.
- [x] API: `GET/POST /api/invoices`, `GET/PUT /api/invoices/:id`. Parent chỉ GET (không thấy cancelled).
- [x] In biên lai PDF (print popup) từ `Invoices.jsx` bằng nút 🖨️.
- [x] Trang Admin `Hóa đơn` + Parent portal tab `🧾 Học phí`.
- [x] Audit log khi tạo/sửa hóa đơn.

#### 5. CI/CD (✅ Đã xong — 01/05/2026)
- [x] `.github/workflows/ci.yml` — 2 jobs: `test-and-build` + `lint-check`.
- [x] Job `test-and-build`: `npm ci` → `vitest run` → `npm audit --audit-level=high` → `vite build` → verify dist/.
- [x] Env CI dùng secret test, không dùng secret production (`MAIKA_JWT_SECRET=ci-test-secret-not-production`).
- [x] Chặn merge khi test hoặc audit fail (GitHub Actions required checks).
- [x] Playwright E2E trên CI — `npx playwright install --with-deps chromium` + `npm run test:e2e` step (continue-on-error).

#### 6. Backend Deployment (✅ Config sẵn — 01/05/2026)
- [x] `render.yaml` — Render.com web service + persistent disk 1GB mount `/data`.
- [x] `fly.toml` — Fly.io config: Singapore region, shared-cpu-1x, volume `maika_data` mount `/data`.
- [x] `server/DEPLOY.md` — Hướng dẫn chi tiết cho Render, Fly.io, Railway; checklist production.
- [x] Cấu hình CORS production qua env `MAIKA_CORS_ORIGIN` (chỉ domain Netlify, không wildcard).
- [ ] **Thực tế deploy**: cần chọn platform và chạy theo hướng dẫn trong `server/DEPLOY.md`.

#### 7. Security Hardening (✅ Đã xong — 01/05/2026)
- [x] Rate limit: `express-rate-limit` — login 20 req/15min, API 300 req/min, upload 20 req/min.
- [x] `helmet` headers: `crossOriginResourcePolicy: cross-origin` cho uploads.
- [x] RBAC từng endpoint: health/incidents/invoices đều kiểm tra role.
- [x] Path traversal: `backup.js` dùng `basename()` + check `.json` extension.
- [x] `must_change_password` column trong users — flag trong login response + sessionStorage.
- [x] `POST /api/auth/change-password` — xác thực mật khẩu hiện tại, bcrypt hash mới, audit log.
- [x] `ChangePassword.jsx` — modal force (không thoát được) hoặc optional; nút "🔐 Đổi MK" trên TopBar.
- [x] AdminLogin lưu `maika_must_change_password` vào sessionStorage → AdminApp chặn giao diện cho đến khi đổi xong.
- [x] RBAC tests tự động cho endpoint mới: consents, notifications, attendance, school-settings.

#### 8. Chuẩn Hóa Database Schema (✅ Phần lớn đã xong — 01/05/2026)
- [x] Migration versioning: bảng `schema_migrations` + hàm chạy từng version (idempotent).
- [x] 3 bảng mới với schema rõ ràng: `health_records`, `incidents`, `invoices`.
- [x] Indexes: `idx_incidents_student`, `idx_incidents_status`, `idx_incidents_occurred`, `idx_invoices_student`, `idx_invoices_status`, `idx_invoices_due`, `idx_collection_records_collection`.
- [ ] Chuẩn hóa soft delete cho collection_records (hiện chỉ hard delete).
- [ ] Migrate finance → invoices (tùy chọn — finance cũ vẫn chạy song song).

### Ghi Chú API Key / Secrets Khi Test
- Hiện tại **không cần API key thật của bên thứ ba** để test app.
- Backend dùng JWT tự ký bằng `MAIKA_JWT_SECRET`; đây là secret nội bộ, không phải API key external. Local/dev có thể dùng giá trị test trong `.env`, tuyệt đối không dùng secret production trong test/CI.
- Frontend chỉ cần `VITE_API_URL=http://127.0.0.1:8787` nếu muốn bật API local. Nếu không có `VITE_API_URL`, app vẫn chạy static/localStorage trên Netlify.
- Chạy test hiện tại không cần SMS/Zalo/email/payment/cloud key: `npm run test:run`, `npm run build`, và khi cần thì `npm run test:e2e`.
- Chỉ cần API key thật khi sau này tích hợp dịch vụ ngoài như Zalo/SMS, email provider, payment gateway, cloud object storage, hoặc monitoring production.

---

## 7. Roadmap EA Phần Còn Lại Sau 01/05/2026
> Roadmap này dành cho Claude/agent tiếp theo sau khi đã hoàn tất 8 phần production rút gọn. Mục tiêu là lấp các khoảng trống còn lại so với đánh giá EA đầy đủ, theo thứ tự ưu tiên để đưa app đến production thật.

### Nguyên tắc thực hiện
- Giữ nguyên UI/UX hiện tại, chỉ mở rộng module theo style sẵn có.
- Backend API là nguồn dữ liệu production; localStorage chỉ là fallback demo.
- Mỗi phase phải có migration DB idempotent, audit log cho thao tác nhạy cảm, RBAC rõ ràng, và test tương ứng.
- Không dùng API key thật khi test. Với email/SMS/Zalo/payment, tạo adapter/mock trước; chỉ đọc key từ env khi deploy production.
- Sau mỗi phase chạy tối thiểu: `npm run test:run`, `npm run build`, `npm audit --audit-level=high`. Nếu có UI flow mới, thêm/chạy Playwright.

### Phase 8 — Cấu Hình Trường Học + Privacy/Consent (✅ Đã xong — 01/05/2026)

**Mục tiêu:** biến app từ dữ liệu demo cứng thành hệ thống có cấu hình vận hành thật cho từng trường.

- [x] DB/API `school_settings`: tên trường, logo, địa chỉ, điện thoại, email, giờ học, giờ đón/trả, timezone, năm học hiện tại.
- [x] DB/API `academic_years`, `school_holidays`, `tuition_plans` cấu hình phí mặc định theo lớp/khối.
- [x] Trang Admin `Cấu hình` (`Settings.jsx`): 4 tab — thông tin trường, năm học & ngày nghỉ, mức phí, đồng ý dữ liệu.
- [x] DB/API `student_consents`: đồng ý nhận ảnh, đồng ý nhận thông báo, kênh liên lạc, quyền chia sẻ ảnh, thời hạn lưu.
- [x] Parent portal tab `🔒 Quyền riêng tư` (`ConsentPanel.jsx`) để phụ huynh cập nhật consent của con mình.
- [x] Consent áp vào media: parent `forParent=true` chỉ thấy ảnh published.
- [x] Audit log cho mọi thay đổi settings/consent.

### Phase 9 — Notification Center + Notification Adapters (✅ Đã xong — 01/05/2026)

**Mục tiêu:** thay thông báo tĩnh bằng hệ thống notification thật, nhưng chưa cần key SMS/Zalo thật.

- [x] DB/API `notifications`: title, body, type, priority, target role/class/student, channel, status, scheduled_at, sent_at.
- [x] DB/API `notification_reads`: user/student đã đọc lúc nào, `getUnreadCount`.
- [x] Trang Admin `Thông báo` (`Notifications.jsx`): tạo thông báo, lưu draft, gửi ngay/lên lịch.
- [x] Parent notification center (`NotificationCenter.jsx`): badge chưa đọc, filter theo type, auto mark-read.
- [x] Adapter layer (`server/notificationAdapters.js`): `mock`, `email`, `sms`, `zalo` — fail graceful nếu thiếu env key.
- [x] Audit log khi tạo/gửi/hủy notification.

### Phase 10 — Điểm Danh Nâng Cao + Teacher Mobile Mode (✅ Đã xong — 01/05/2026)

**Mục tiêu:** hỗ trợ nghiệp vụ hằng ngày trên điện thoại của giáo viên.

- [x] DB/API `attendance_records`: check-in/out, status, arrival_time, pickup_time, pickup_person, pickup_phone, late_reason, early_pickup_reason, note. UNIQUE(student_id, date).
- [x] UI `AttendanceAdvanced.jsx`: nút emoji lớn (✅❌⏰🚗), lọc lớp, daily summary stats, date picker.
- [x] Mobile-first slide-up detail modal: check-in/out times, pickup person/phone, ghi chú.
- [x] Parent portal tab `📲 Điểm danh` (read-only, lọc đúng studentId).
- [x] Audit log khi sửa điểm danh.

### Phase 11 — Thực Đơn + Media Library Theo Quyền (✅ Đã xong — 01/05/2026)

**Mục tiêu:** hoàn thiện hai trải nghiệm phụ huynh dùng thường xuyên nhất.

- [x] DB/API `meal_menus`: UPSERT per `(week_start, day_of_week, meal_type)`, dishes JSON, allergen notes, published flag.
- [x] Admin `Thực đơn` (`MealMenu.jsx`): weekly grid 5×3, cell editor slide-up, week navigation, publish toggle.
- [x] Parent portal tab `🍱 Thực đơn` (readOnly mode, tuần hiện tại).
- [x] DB/API `media_albums`, `media_assets`: workflow draft→published→archived.
- [x] Admin `Thư viện ảnh` (`MediaLibrary.jsx`): tạo album, upload ảnh, publish/archive asset.
- [x] Parent gallery (`forParent=true`): chỉ thấy ảnh published.
- [x] Upload validate MIME/size, Multer server-side.

### Phase 12 — Observability + CI/E2E/RBAC Hardening (✅ Đã xong — 01/05/2026)

**Mục tiêu:** có tín hiệu vận hành và test đủ tin cậy trước khi deploy thật.

- [x] Request logging middleware: correlation id, status code, duration, actor (role:id). Chỉ log khi `status >= 400` hoặc `duration > 2000ms`.
- [x] Error middleware chuẩn hóa JSON error; ẩn stack trace ở production (`NODE_ENV=production`).
- [x] `/api/health` mở rộng: db ping, upload dir writable, backup dir writable, scheduler state object. HTTP 503 nếu db hoặc upload dir không ok.
- [x] `/api/ready` cho deploy platform (readiness probe). HTTP 503 nếu db chưa sẵn sàng.
- [x] `BACKUP_DIR` export từ `backup.js` để health check dùng.
- [x] CI: `npx playwright install --with-deps chromium` + `npm run test:e2e` (continue-on-error khi chưa headless server).
- [x] 8 RBAC integration tests mới: health/ready without auth, parent consent isolation (own=200 / other=403), parent cannot create notifications, admin school-settings CRUD, teacher cannot write settings, admin send notification, attendance upsert + teacher read.
- [x] Tất cả 24 tests pass, build clean 0 vulnerability.

### Phase 13 — Chuẩn Hóa DB Core Tables + Reports (🟠 Nâng cấp nền tảng)
**Mục tiêu:** giảm phụ thuộc `collection_records` JSON cho dữ liệu core.

- [ ] Tách bảng production cho `students`, `guardians/parents`, `classes`, `teachers`, `teacher_class_assignments`.
- [ ] Tách bảng `daily_reports`, `messages`, `events`, `resources/uploads` thay vì collection JSON.
- [ ] Migration từ collection JSON sang bảng mới, idempotent và có backup trước migration.
- [ ] Soft delete/status cho dữ liệu nghiệp vụ quan trọng.
- [ ] Index/foreign key cho truy vấn theo student/class/date/status.
- [ ] Báo cáo tháng/quý: chuyên cần, học phí/công nợ, incident, tăng trưởng học sinh.
- [ ] Export CSV/PDF cho báo cáo chính.

**Acceptance criteria:**
- Existing snapshot/localStorage import vẫn migrate được.
- Không mất dữ liệu demo hiện có.
- Dashboard và parent portal đọc từ API/schema mới khi có `VITE_API_URL`.

### Phase 14 — Production Launch + Integrations Thật (🟡 Sau khi core ổn)
**Mục tiêu:** đưa vào vận hành thật sau khi đã đủ guardrails.

- [ ] Chọn và deploy backend thật theo `server/DEPLOY.md` với persistent volume.
- [ ] Set env production: `MAIKA_JWT_SECRET`, password bootstrap, CORS domain, backup dir, upload dir, scheduler.
- [ ] Netlify set `VITE_API_URL` trỏ backend production.
- [ ] Custom domain + email domain.
- [ ] Tích hợp email thật trước SMS/Zalo: SMTP/provider env, retry, failure log.
- [ ] Tích hợp payment sau cùng: QR ngân hàng hoặc VNPay/Momo/Stripe qua adapter, webhook verify signature.
- [ ] PWA offline teacher mode: offline queue cho attendance/daily report, sync khi online, conflict handling.
- [ ] Multi-branch/multi-school chỉ làm khi có nhu cầu thật; chuẩn bị bằng `school_id` trong schema mới nếu refactor DB.

**Acceptance criteria:**
- Không commit secret/key thật.
- Production smoke pass sau deploy.
- Backup tự động chạy và restore thử nghiệm trên bản backup staging trước khi dùng thật.

### Thứ Tự Giao Việc Khuyến Nghị Cho Claude

1. ~~Phase 8 trước: `school_settings` + `student_consents`.~~ ✅ Xong
2. ~~Phase 9 tiếp: notification center với mock adapter, chưa cần SMS/Zalo thật.~~ ✅ Xong
3. ~~Phase 10: attendance nâng cao + teacher mobile mode.~~ ✅ Xong
4. ~~Phase 11: menu + media permissions.~~ ✅ Xong
5. ~~Phase 12: observability + CI e2e + RBAC tests.~~ ✅ Xong
6. **Phase 13 tiếp theo**: normalize DB core tables (students/classes/teachers ra bảng riêng, soft delete, báo cáo tháng/quý).
7. **Phase 14 cuối**: deploy thật + email/SMS integration + payment gateway.

### Test Bắt Buộc Sau Mỗi Phase
- `npm run test:run`
- `npm run build`
- `npm audit --audit-level=high`
- `npm run test:e2e` nếu có thay đổi route/UI chính
- Smoke API bằng DB tạm cho endpoint mới, không dùng DB production/local thật.

---

## 8. Roadmap Refactor Supabase Theo Layer (Quyết Định Mới)
> Quyết định mới: frontend vẫn deploy Netlify, backend/data/auth chuyển sang Supabase. Roadmap này **ưu tiên thay Phase 13/14 cũ**. Express + SQLite hiện tại giữ tạm làm fallback/migration helper, không mở rộng thêm nghiệp vụ mới trên SQLite.

### Guardrails Chống Code Phình To
- Không gọi Supabase trực tiếp trong JSX page/component. Chỉ gọi qua service/hook.
- SQL/RLS đặt trong `supabase/migrations/*.sql`, không rải SQL trong frontend.
- Supabase client chỉ nằm ở `src/lib/supabaseClient.js`.
- Data access theo domain: `src/features/students/studentService.js`, `attendanceService.js`, v.v.
- UI theo domain: `src/features/students/components/*`, hooks ở `src/features/students/useStudents.js`.
- Mỗi file mục tiêu dưới ~250 dòng; quá 300 dòng phải tách.
- Component chỉ render và xử lý form state nhẹ; business rule ở service/helper.
- Không commit dữ liệu thật, file Excel, service role key, Supabase secret. Chỉ dùng anon key trong frontend.
- Mỗi phase phải nhỏ, có test, build pass, và commit riêng.

### Portal & Domain Architecture (Không Chỉ Riêng Supabase)
> Tách portal theo vai trò là quyết định kiến trúc chính, chuẩn bị cho domain riêng sau này. Không gom tất cả vào một admin app rồi ẩn/hiện menu.

**Route trên Netlify hiện tại / trước custom domain:**
- `/admin` và `/admin/app`: quản trị, chủ trường, kế toán.
- `/teacher` và `/teacher/app`: giáo viên/nhân viên cơ sở, mobile-first.
- `/parent` và `/parent/app`: phụ huynh xem thông tin của con.

**Khi mua domain riêng:**
- Có thể giữ path-based routing: `https://maikaschool.vn/admin`, `/teacher`, `/parent`.
- Hoặc nâng cấp sau thành subdomain nếu cần: `admin.maikaschool.vn`, `teacher.maikaschool.vn`, `parent.maikaschool.vn`.
- Ưu tiên path-based trước vì đơn giản với Netlify SPA, ít cấu hình DNS hơn.

**Role redirect bắt buộc sau đăng nhập:**
- `admin` → `/admin/app`.
- `teacher` → `/teacher/app`.
- `parent` → `/parent/app`.
- User thiếu role/facility hoặc bị khóa → trang trạng thái riêng, không vào portal.

**Code layout mục tiêu:**
```
src/
  app/
    routes.jsx
    RoleGate.jsx
  portals/
    admin/
    teacher/
    parent/
  features/
    auth/
    facilities/
    students/
    attendance/
    media/
    notifications/
```

**Nguyên tắc portal:**
- `portals/*` chỉ chứa layout, navigation, page composition theo vai trò.
- `features/*` chứa nghiệp vụ dùng chung, service, hook, mapper, component nhỏ.
- Teacher portal phải mobile-first: ít menu, nút lớn, thao tác nhanh.
- Admin portal ưu tiên bảng/filter/export/report.
- Parent portal ưu tiên read-only, thông báo, ảnh, học phí, điểm danh của con.
- UI role gate chỉ là trải nghiệm; quyền thật vẫn do Supabase RLS kiểm soát.

### Layer 1 — Supabase Schema + RLS MVP (🔴 First)
**Scope:** tạo nền database chuẩn cho 2 cơ sở, user, học sinh, điểm danh.

- [x] Thêm `supabase/migrations/001_core_schema.sql`.
- [x] Tạo bảng `facilities`, `profiles`, `students`, `attendance`.
- [x] `profiles.id` FK tới `auth.users(id)`.
- [x] `students.facility_id` FK tới `facilities(id)`.
- [x] `attendance.student_id` + `facility_id` FK đúng student/cơ sở.
- [x] RLS: admin xem tất cả; teacher chỉ xem dữ liệu thuộc `profiles.facility_id`.
- [x] Seed 2 cơ sở: CS1, CS2 trong SQL seed/dev note.
- [x] Chạy migration vào Supabase project `czxoozwydvmjisydyims` ngày 01/05/2026; verify 4 bảng tồn tại qua publishable key.
- [x] Tạo Supabase Auth test users/profiles: `admin@maika.test`, `teacher.cs1@maika.test`, `teacher.cs2@maika.test`.
- [x] Import 64 học sinh CS1 từ file Excel private vào bảng `students` Supabase; dữ liệu thiếu giữ `null`/`unknown`.
- [x] Verify RLS bằng login thật sau seed CS2: admin thấy CS1+CS2 và 76 học sinh; teacher CS1 thấy CS1 và 64 học sinh; teacher CS2 thấy CS2 và 12 học sinh demo.
- [ ] Rotate lại Supabase secret/service key trước production vì key đã được dùng trong quá trình setup local.

**Done when:** chạy SQL trong Supabase Dashboard không lỗi; teacher CS1 không đọc được student CS2.

### Layer 2 — Frontend Supabase Foundation (🔴)
**Scope:** thêm kết nối Supabase nhưng chưa refactor toàn app.

- [x] Cài `@supabase/supabase-js`.
- [x] Thêm env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_DATA_BACKEND=supabase|api|local`.
- [x] Tạo `src/lib/supabaseClient.js`.
- [x] Tạo `src/features/auth/authService.js`: get current user/profile, sign in/out.
- [x] Tạo `src/features/students/studentService.js`: `listStudentsForCurrentTeacher()`.
- [x] Tạo route shell rõ ràng cho `/admin`, `/teacher`, `/parent` và role-based redirect.
- [x] Không sửa UI lớn ở phase này; chỉ thêm service, route shell và teacher portal tối thiểu.

**Done when:** frontend lấy được profile hiện tại và danh sách học sinh theo cơ sở qua RLS.

### Layer 3 — Data Adapter Cutover Cho Students/Facilities (✅ Đã làm bước nền — 01/05/2026)
**Scope:** chuyển module học sinh/lớp/cơ sở sang Supabase theo adapter, không đập toàn app.

- [x] Tạo `src/features/facilities/facilityService.js`.
- [ ] Tạo hook `useFacilityStudents(facilityId?)`.
- [x] Refactor màn `Students` đọc từ Supabase panel khi user đăng nhập Supabase thật (`maika_data_backend=supabase`).
- [x] Admin có thể thêm/sửa dữ liệu học sinh trực tiếp: cơ sở, tên, ngày sinh, giới tính, lớp, phụ huynh, điện thoại, email, trạng thái, ghi chú.
- [x] Teacher chỉ xem dữ liệu theo cơ sở qua RLS, không có nút sửa.
- [ ] Giữ fallback local/API cũ qua adapter, không nhân đôi component.
- [x] Giữ fallback local/API cũ cho login demo/e2e, không ép toàn app vào Supabase khi chưa đăng nhập Auth.
- [x] Map dữ liệu Excel hiện tại: tên học sinh/phụ huynh thật; thông tin thiếu để `null`/`unknown`/empty rõ ràng.
- [x] Import Excel đi qua script riêng, không hardcode vào React.

**Done when:** Admin/Teacher xem danh sách học sinh từ Supabase; build không tăng component phức tạp.

### Layer 4 — Attendance Supabase Cutover (🟠)
**Scope:** chuyển điểm danh hàng ngày sang Supabase.

- [x] Tạo `src/features/attendance/attendanceService.js`.
- [x] API frontend: list by date/facility, upsert attendance, hỗ trợ check-in/out, người đón, lý do trễ/đón sớm, ghi chú.
- [x] Migration `002_parent_attendance_media.sql` thêm cột attendance nâng cao.
- [x] RLS: admin all, teacher theo cơ sở, parent chỉ xem con được liên kết.
- [x] Refactor `AttendanceAdvanced` có nhánh Supabase khi login Supabase thật; fallback API/local vẫn giữ cho demo/e2e.

**Done when:** teacher điểm danh được học sinh cơ sở mình; không thấy cơ sở khác; ảnh bữa ăn lưu đúng bucket/path.

### Layer 5 — Auth/Roles UX (✅ Đã xong nền — 01/05/2026)
**Scope:** thay login demo/JWT local bằng Supabase Auth.

- [x] Tạo luồng login Supabase chung `/login` cho admin/teacher/parent.
- [x] Sau login, load `profiles` để điều hướng theo role.
- [x] Parent portal Supabase nền: parent user xem học sinh được link qua `parent_student_links`.
- [x] Khóa demo login ở production khi không bật `VITE_DEMO_MODE=true`.
- [ ] Thêm màn trạng thái khi profile chưa được gán cơ sở/role.

**Done when:** admin/teacher login bằng Supabase Auth và app tự lọc theo role/facility.

### Layer 6 — Migration & Import Dữ Liệu Thật (✅ Bước đầu đã làm — 01/05/2026)
**Scope:** chuẩn hóa đường nhập Excel đầy đủ sau này.

- [x] Viết script import Supabase linh hoạt: `scripts/import-supabase-students.py "Danh sach tre CS1.xlsx" CS1`.
- [x] Script hỗ trợ các cột/alias phổ biến: facility, student, parent, phone, email, dob, gender, class, notes; thiếu cột thì để trống rõ ràng.
- [x] Validate duplicate theo tên học sinh + facility ở mức import memory; cần bổ sung kiểm tra duplicate phone/parent nâng cao trước production.
- [ ] Không ghi đè dữ liệu production nếu chưa có `--confirm`.
- [x] Import hiện tại: giữ tên học sinh/phụ huynh thật; các trường thiếu giả lập/empty rõ ràng.
- [x] Seed demo CS2 bằng `scripts/seed-supabase-cs2-demo.mjs` để test UI/RLS: 12 học sinh demo, có marker ghi chú để seed lại sạch.
- [x] Thêm `SUPABASE_OPERATIONS.md` ghi lệnh import Excel, tạo/link user bằng service-role local.
- [ ] Ghi batch import log để rollback/soát lỗi.

**Done when:** import thử vào Supabase staging được, không commit PII.

### Layer 7 — Test, CI, Deploy Cutover (🟡)
**Scope:** bảo đảm Netlify + Supabase chạy ổn trước khi bỏ SQLite khỏi production.

- [ ] Unit test service mapping.
- [ ] Integration smoke bằng Supabase test project hoặc mock Supabase client.
- [x] Smoke Supabase thật ngày 01/05/2026: admin 76 students, teacher CS1 64, teacher CS2 12, parent 1 linked student; parent xem được attendance của con.
- [ ] Playwright chính thức: `/login` teacher → xem học sinh cơ sở mình → điểm danh.
- [ ] Netlify env dùng Supabase anon key, không dùng service role.
- [ ] Khi Supabase ổn: đặt `VITE_DATA_BACKEND=supabase` cho production.
- [ ] Express/SQLite chuyển thành legacy/migration-only, không thêm tính năng mới.

**Done when:** production Netlify dùng Supabase; test/build/audit/e2e pass.

### Thứ Tự Làm Khuyến Nghị
1. Layer 1: SQL schema + RLS.
2. Layer 2: Supabase client + auth/profile/student service.
3. Layer 3: cutover Students/Facilities.
4. Layer 4: cutover Attendance.
5. Layer 5: Supabase Auth UX.
6. Layer 6: import Excel thật đầy đủ.
7. Layer 7: CI/deploy cutover.
