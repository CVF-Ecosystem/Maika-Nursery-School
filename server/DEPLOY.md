# Hướng dẫn Deploy Backend API

## Tùy chọn 1: Render.com (Khuyến nghị — free tier có persistent disk)

### Bước 1: Tạo account + New Web Service
1. Đăng ký tại https://render.com
2. **New → Web Service** → Connect GitHub repo
3. Root Directory: `.` (không thay đổi)
4. Build Command: `npm ci --omit=dev`
5. Start Command: `node server/index.js`

### Bước 2: Thêm Persistent Disk
- **New → Disk** → Mount Path: `/data` → Size: 1 GB
- Render sẽ tự mount `/data` vào instance

### Bước 3: Set Secrets (Environment Variables)
Trong Render Dashboard → Environment:

```
MAIKA_JWT_SECRET=<chuỗi ngẫu nhiên >=32 ký tự>
MAIKA_ADMIN_PASSWORD=<mật khẩu admin mạnh>
MAIKA_TEACHER_PASSWORD=<mật khẩu giáo viên mạnh>
```

Các env khác đã có trong `render.yaml`.

### Bước 4: Cập nhật Netlify
Trong Netlify → Site settings → Environment variables:
```
VITE_API_URL=https://maika-api.onrender.com
```
Redeploy Netlify frontend.

---

## Tùy chọn 2: Fly.io

### Cài Fly CLI
```bash
# macOS/Linux
curl -L https://fly.io/install.sh | sh
# Windows
iwr https://fly.io/install.ps1 -useb | iex
```

### Deploy lần đầu
```bash
fly auth login
fly launch --no-deploy   # Đọc fly.toml, tạo app
fly volumes create maika_data --region sin --size 1  # Tạo volume
fly secrets set \
  MAIKA_JWT_SECRET="<random-32-chars>" \
  MAIKA_ADMIN_PASSWORD="<strong-password>" \
  MAIKA_TEACHER_PASSWORD="<strong-password>"
fly deploy
```

### Deploy sau khi có thay đổi
```bash
fly deploy
```

### Xem logs
```bash
fly logs
```

---

## Tùy chọn 3: Railway

1. New Project → Deploy from GitHub
2. Add Variables: `MAIKA_JWT_SECRET`, `MAIKA_ADMIN_PASSWORD`, `MAIKA_TEACHER_PASSWORD`
3. Add Volume → mount `/data`
4. Start Command: `node server/index.js`

---

## Sau khi deploy

### Kiểm tra health
```bash
curl https://your-api-domain.com/api/health
# Expected: {"ok":true,"collections":[...]}
```

### Đổi mật khẩu mặc định
- Đăng nhập Admin → TopBar → "🔐 Đổi MK"
- Hoặc trong Users management → Set `must_change_password = true` cho user mới

### Checklist production
- [ ] `MAIKA_JWT_SECRET` ≥ 32 ký tự, không đoán được
- [ ] `MAIKA_ADMIN_PASSWORD` + `MAIKA_TEACHER_PASSWORD` đổi khỏi mặc định
- [ ] `MAIKA_CORS_ORIGIN` chỉ liệt kê domain Netlify thật, không có wildcard
- [ ] Persistent disk đã mount (SQLite + uploads + backups đều ở `/data`)
- [ ] `VITE_API_URL` trên Netlify trỏ đúng domain API
- [ ] Lịch backup tự động bật (`MAIKA_BACKUP_SCHEDULE_ENABLED=true`)
- [ ] Kiểm tra `/api/health` trả về `{"ok":true}`
