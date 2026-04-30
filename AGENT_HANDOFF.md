# AGENT_HANDOFF — Nhà Trẻ Maika

> **Ngày tạo**: 30/04/2026  
> **Tác giả**: EA Assessment Agent  
> **Trạng thái**: 🔴 CHỜ TRIỂN KHAI — roadmap đã phê duyệt, chưa bắt đầu code

## ⚡ Quyết định kiến trúc (đã xác nhận bởi EA)

| Quyết định | Giá trị | Ghi chú |
|-----------|---------|--------|
| **Deploy** | Vercel hoặc Netlify (static hosting) | Custom domain gắn sau khi ổn định |
| **Data** | localStorage — giữ nguyên | Backend/DB sẽ làm phase sau khi cần |
| **Backend** | ⏸️ DEFERRED — chưa cần ngay | Chỉ cần khi chuyển production thật |
| **Stack** | Vite + React → static build → deploy | Không cần server runtime |

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
| 1 | **Không backend** — toàn bộ dữ liệu localStorage, mất khi xóa cache | 🔴 |
| 2 | **Hardcoded credentials** — `123456` plaintext trong source | 🔴 |
| 3 | **Monolith** — `index.html` 822 dòng chứa 3 views + CSS + JS | 🔴 |
| 4 | **Duplicate code** — Landing + Parent Portal tồn tại 2 bản (standalone + nhúng) | 🟠 |
| 5 | **XSS** — `innerHTML` với user input không sanitize | 🟠 |
| 6 | **Global namespace** — tất cả components dùng `window.*` | 🟠 |
| 7 | **Không tests, không CI/CD, không .gitignore** | 🟠 |
| 8 | **Ảnh lưu Base64 trong localStorage** — giới hạn ~5MB | 🟡 |

### Điểm mạnh giữ nguyên

- ✅ UI/UX premium (5/5) — design Indigo/Violet nhất quán, micro-animations
- ✅ Phủ nghiệp vụ tốt — 11 modules admin đầy đủ
- ✅ Font Nunito + responsive < 900px
- ✅ Print PDF nhật ký học sinh

---

## 2. File Inventory

```
Nha tre Maika/
├── index.html              62 KB   ← MONOLITH — chứa 3 views, cần tách
├── Maika-Landing.html      14 KB   ← DUPLICATE — xóa sau khi merge
├── Maika-Parent.html       31 KB   ← DUPLICATE — xóa sau khi merge
├── Maika.html              11 KB   ← Admin standalone — gộp vào router
├── landing.css             11 KB   ← Giữ, move → src/styles/
├── landing-content.js       4 KB   ← Nhúng vào Landing.jsx
├── bb-data.js              15 KB   ← Data layer — thay bằng API client
├── bb-sidebar.jsx           6 KB   ← Move → src/pages/admin/Sidebar.jsx
├── bb-dashboard.jsx        11 KB   ← Move → src/pages/admin/Dashboard.jsx
├── bb-students.jsx         19 KB   ← Move → src/pages/admin/Students.jsx
├── bb-teachers.jsx         10 KB   ← Move → src/pages/admin/Teachers.jsx
├── bb-attendance.jsx       18 KB   ← Move → src/pages/admin/Attendance.jsx
├── bb-finance.jsx          13 KB   ← Move → src/pages/admin/Finance.jsx
├── bb-communication.jsx    12 KB   ← Move → src/pages/admin/Communication.jsx
├── bb-calendar.jsx         13 KB   ← Move → src/pages/admin/Calendar.jsx
├── bb-analytics.jsx        12 KB   ← Move → src/pages/admin/Analytics.jsx
├── bb-resources.jsx        19 KB   ← Move → src/pages/admin/Resources.jsx
├── uploads/
│   └── pasted-*.png       236 KB
└── AGENT_HANDOFF.md        ← BẠN ĐANG ĐỌC FILE NÀY
```

---

## 3. Roadmap 6 Phases

### Phase 0 — CVF Governance (~0.5 ngày)
- [ ] Chạy `/cvf-onboard`
- [ ] Tạo `.gitignore` (node_modules, dist, .env, uploads)
- [ ] Git init + first commit snapshot

### Phase 1 — Tái Cấu Trúc Code (~4 ngày)
- [ ] Setup Vite: `npm create vite@latest ./ -- --template react`
- [ ] Install: `npm install react-router-dom`
- [ ] Tách `index.html` monolith → từng file JSX riêng (xem cấu trúc bên dưới)
- [ ] Loại bỏ `Maika-Landing.html`, `Maika-Parent.html`, `Maika.html` (duplicate)
- [ ] Convert `bb-*.jsx` → ES module imports (bỏ `window.*` exports)
- [ ] Setup React Router v6 thay `showView()` + `display:none`
- [ ] Extract inline styles → CSS classes hoặc CSS modules

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

### Phase 2 — Deploy Vercel/Netlify (~1 ngày)
- [ ] Tạo `vite.config.js` với `base: '/'` và output `dist/`
- [ ] Chạy `npm run build` → verify `dist/` folder
- [ ] Deploy lên Vercel: `npx vercel --prod` HOẶC Netlify: `npx netlify deploy --prod --dir=dist`
- [ ] Verify tất cả routes hoạt động trên URL public
- [ ] Cấu hình `_redirects` (Netlify) hoặc `vercel.json` cho SPA routing:

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

### Phase 3 — Security Cơ Bản (~1 ngày)
- [ ] Input sanitization: DOMPurify cho user-generated content (tin nhắn, tên file)
- [ ] File upload: validate MIME type (image/* only), max size 5MB client-side
- [ ] Bỏ hiển thị credential gợi ý trong production build (dùng env var `VITE_DEMO_MODE`)
- [ ] Thêm CSP meta tag trong `index.html`

### Phase 4 — Testing (~2 ngày)
- [ ] Unit tests (Vitest): `utils/format.js`, component renders
- [ ] E2E tests (Playwright): Parent login → view report, Admin CRUD student
- [ ] Lighthouse audit: Performance ≥ 90, Accessibility ≥ 90

### Phase 5 — Polish & PWA (~2 ngày)
- [ ] PWA: Service Worker, Web Manifest → installable trên phone
- [ ] Performance: Code splitting (React.lazy), image WebP, font subsetting
- [ ] SEO: meta tags, Open Graph cho Landing page
- [ ] `aria-*` attributes, keyboard nav

### Phase 6 — Custom Domain (khi sẵn sàng)
- [ ] Mua domain (ví dụ: `maika.edu.vn`)
- [ ] Cấu hình DNS → Vercel/Netlify custom domain
- [ ] Setup SSL (auto bởi Vercel/Netlify)
- [ ] Redirect `www` → non-www (hoặc ngược lại)

### Phase 7 — Backend (DEFERRED — khi cần scale)
> Chỉ triển khai khi cần: multi-device sync, data lớn, hoặc chuyển production thật

- [ ] Express + SQLite/PostgreSQL backend
- [ ] REST API thay localStorage
- [ ] JWT auth + bcrypt
- [ ] RBAC: Admin / Teacher / Parent
- [ ] File upload server-side (Multer)
- [ ] Migrate data từ localStorage → database

---

## 4. Quy tắc cho Agent tiếp theo

1. **Bắt đầu từ Phase 0** — CVF onboard trước khi code
2. **Commit sau mỗi phase** — mỗi phase là 1 tranche có thể review
3. **Giữ nguyên UI/UX** — design hiện tại đã premium, KHÔNG redesign
4. **Data = localStorage** — KHÔNG tạo backend. Giữ `bb-data.js` pattern, chỉ refactor thành ES module
5. **Deploy = Vercel hoặc Netlify** — static hosting, KHÔNG cần server
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

**Sau Phase 1**: Chuyển sang `npm install react react-dom` + Vite bundle. Bỏ Babel Standalone.
