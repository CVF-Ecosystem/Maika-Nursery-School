# Hướng Dẫn Deploy Ứng Dụng Maika

Production hiện dùng:

- Netlify: host React frontend.
- Supabase: database, Auth, Storage, Row Level Security và Edge Function `admin-users`.

Express API trong thư mục `server/` chỉ còn là lựa chọn dev/legacy, không phải đường deploy production mặc định.

## 1. Supabase

### Migrations

Chạy đầy đủ các migration trong `supabase/migrations`, gồm cả migration security mới nhất:

```powershell
npm run supabase:migrate -- supabase/migrations/006_security_hardening.sql
```

### Edge Functions

Deploy functions tạo/reset tài khoản và quản lý dung lượng ảnh:

```powershell
supabase functions deploy admin-users --project-ref czxoozwydvmjisydyims
supabase functions deploy storage-maintenance --project-ref czxoozwydvmjisydyims
```

Functions dùng `SUPABASE_SERVICE_ROLE_KEY` do Supabase Edge Functions cung cấp ở runtime. Không đặt service key trong Netlify hoặc biến frontend.

### Admin Đầu Tiên

Admin production:

```text
admin@maika.edu.vn
```

Profile của tài khoản này phải có:

```text
role = admin
is_active = true
```

Sau đó admin có thể tạo giáo viên, phụ huynh và admin phụ trực tiếp trong màn **Tài khoản**.

## 2. Netlify

Connect GitHub repo và dùng cấu hình có sẵn trong `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"
```

Environment frontend:

```env
VITE_DATA_BACKEND=supabase
VITE_ENABLE_LEGACY_BACKENDS=false
VITE_SUPABASE_URL=https://czxoozwydvmjisydyims.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_su1zQoGPpEdoUTzvuVFc4g_k1ksLyjo
```

Không set `SUPABASE_SERVICE_KEY` trên Netlify.

## 3. Kiểm Tra Sau Deploy

- Mở web Netlify.
- Đăng nhập admin bằng `admin@maika.edu.vn`.
- Vào **Tài khoản** tạo thử một tài khoản giáo viên hoặc phụ huynh.
- Đặt lại mật khẩu tạm thời cho tài khoản vừa tạo.
- Đăng xuất và đăng nhập bằng tài khoản vừa tạo để kiểm tra role.

## Checklist Production

- [ ] Supabase migrations đã chạy đủ.
- [ ] Edge Functions `admin-users` và `storage-maintenance` đã deploy.
- [ ] Service role key chỉ nằm trong Supabase function secret.
- [ ] Netlify chỉ có publishable/anon key.
- [ ] Admin `admin@maika.edu.vn` active và đổi mật khẩu thật.
- [ ] Bucket ảnh trẻ ở trạng thái private.
- [ ] Backup Supabase đã có lịch vận hành riêng.
