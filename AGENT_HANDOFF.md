# AGENT_HANDOFF — Nhà Trẻ Maika

> **Ngày tạo**: 30/04/2026  
> **Tác giả**: EA Assessment Agent  
> **Trạng thái**: 🟢 PHASE 7 BACKEND ĐÃ TRIỂN KHAI — Frontend vẫn fallback static/localStorage khi chưa bật API

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

### Phase 5 — Polish & PWA (🟡 Đang làm)
- [x] PWA: Service Worker, Web Manifest → installable trên phone
- [ ] Performance: Code splitting (React.lazy đã có), image WebP, font subsetting
- [x] SEO: meta tags, Open Graph cho Landing page
- [ ] `aria-*` attributes, keyboard nav (đã cải thiện label login + student modal, còn cần audit sâu toàn app)

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

#### 1. Lịch Backup Định Kỳ (🟡 Next)
- [x] Backup/restore thủ công đã có.
- [ ] Thêm scheduler trong backend, ví dụ `MAIKA_BACKUP_SCHEDULE_ENABLED=true`.
- [ ] Cấu hình cron/rule qua env, ví dụ `MAIKA_BACKUP_CRON=0 2 * * *`.
- [ ] Thêm retention policy, ví dụ giữ 30 bản gần nhất hoặc 30 ngày.
- [ ] Ghi audit log khi backup tự động thành công/thất bại.
- [ ] Hiển thị trạng thái lịch backup trong trang `Sao lưu`.

#### 2. Hồ Sơ Sức Khỏe Học Sinh (⬜ Pending)
- [ ] Thêm dữ liệu sức khỏe vào student profile hoặc bảng riêng: dị ứng, thuốc, bác sĩ/liên hệ khẩn cấp, lưu ý y tế.
- [ ] UI trong Admin `Học sinh`: tab/section sức khỏe.
- [ ] Parent portal chỉ đọc các thông tin phù hợp.
- [ ] RBAC: admin/teacher được xem theo quyền; parent chỉ xem con mình.
- [ ] Audit log khi thay đổi thông tin sức khỏe.

#### 3. Incident Report (⬜ Pending)
- [ ] Model/API cho sự cố: học sinh, thời gian, mô tả, mức độ, xử lý ban đầu, người ghi nhận, người xác nhận.
- [ ] Upload ảnh/tệp minh chứng nếu cần.
- [ ] Workflow trạng thái: draft/open/resolved/parent_acknowledged.
- [ ] Parent portal xem và xác nhận đã đọc.
- [ ] Audit log toàn bộ thay đổi trạng thái.

#### 4. Học Phí Nâng Cao & Biên Lai (⬜ Pending)
- [ ] Chuẩn hóa invoice/payment/receipt thay vì chỉ dữ liệu tài chính đơn giản.
- [ ] Tạo biên lai thu tiền, mã biên lai, trạng thái thanh toán, lịch sử công nợ.
- [ ] In/xuất PDF biên lai hoặc trang print thân thiện.
- [ ] Parent portal xem công nợ và biên lai.
- [ ] Audit log khi tạo/sửa/xóa khoản thu hoặc xác nhận thanh toán.

#### 5. CI/CD (⬜ Pending)
- [ ] GitHub Actions chạy `npm run test:run`, `npm run build`, `npm audit`.
- [ ] Nếu Playwright chạy ổn trên CI, thêm `npm run test:e2e`.
- [ ] Tách job frontend/backend nếu cần.
- [ ] Chặn merge/deploy khi test hoặc audit fail.
- [ ] Ghi rõ env CI không dùng secret production thật.

#### 6. Backend Deployment (⬜ Pending)
- [ ] Chọn nơi deploy API: Render/Fly.io/Railway/VPS hoặc server nội bộ.
- [ ] Cấu hình persistent disk cho SQLite hoặc chuyển sang Postgres nếu cần scale/backup tốt hơn.
- [ ] Cấu hình `VITE_API_URL` trên Netlify trỏ về API thật.
- [ ] Cấu hình CORS production theo domain thật, không mở wildcard.
- [ ] Kiểm tra upload directory, backup directory và quyền ghi trên server.

#### 7. Security Hardening (⬜ Pending)
- [ ] Bắt buộc đổi mật khẩu mặc định khi production.
- [ ] Set `MAIKA_JWT_SECRET` mạnh, riêng từng môi trường.
- [ ] Thêm rate limit login/API nhạy cảm.
- [ ] Thêm helmet/security headers ở backend.
- [ ] Kiểm soát CORS, upload MIME/size, path traversal, backup restore authorization.
- [ ] Rà lại RBAC từng endpoint bằng test.

#### 8. Chuẩn Hóa Database Schema (⬜ Pending)
- [ ] Tách schema rõ cho users, roles, students, guardians, classes, attendance, reports, finance, audit, backups.
- [ ] Thêm migration versioning thay vì chỉ init schema trực tiếp.
- [ ] Thêm foreign keys/indexes cho các truy vấn chính.
- [ ] Chuẩn hóa soft delete/status nếu cần giữ lịch sử.
- [ ] Viết script migrate từ snapshot/localStorage sang schema mới.

### Ghi Chú API Key / Secrets Khi Test
- Hiện tại **không cần API key thật của bên thứ ba** để test app.
- Backend dùng JWT tự ký bằng `MAIKA_JWT_SECRET`; đây là secret nội bộ, không phải API key external. Local/dev có thể dùng giá trị test trong `.env`, tuyệt đối không dùng secret production trong test/CI.
- Frontend chỉ cần `VITE_API_URL=http://127.0.0.1:8787` nếu muốn bật API local. Nếu không có `VITE_API_URL`, app vẫn chạy static/localStorage trên Netlify.
- Chạy test hiện tại không cần SMS/Zalo/email/payment/cloud key: `npm run test:run`, `npm run build`, và khi cần thì `npm run test:e2e`.
- Chỉ cần API key thật khi sau này tích hợp dịch vụ ngoài như Zalo/SMS, email provider, payment gateway, cloud object storage, hoặc monitoring production.
