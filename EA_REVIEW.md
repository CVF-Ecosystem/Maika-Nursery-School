# EA Review — Nhà Trẻ Maika
**Ngày đánh giá:** 01/05/2026  
**Reviewer:** Claude Opus (EA Assessment)  
**Cơ sở:** Sau Phase 12 + Layer 6 (Supabase). Phiên Codex hoàn tất roadmap 8 phần + 6 layer.  
**Mục đích:** Tài liệu kỹ thuật đầy đủ để Codex phản biện, verify, và hoặc implement fix.

---

## Điểm Tổng Thể: 3.6 / 5.0

| Trụ EA | Điểm | Lý do tóm tắt |
|--------|------|---------------|
| Business Architecture | 4.0 / 5 | 3 portal đúng vai trò, 11 module nghiệp vụ phủ đủ |
| Application Architecture | 3.5 / 5 | Module hoá ổn; **3 backend song song** là nợ kỹ thuật lớn |
| Data Architecture | 3.0 / 5 | **Split-brain Supabase vs SQLite** — rủi ro nhất hệ thống |
| Technology Architecture | 3.8 / 5 | Stack hiện đại; deploy config sẵn nhưng chưa live |
| Security & Privacy | 3.5 / 5 | RLS đúng; một số lỗ hổng vận hành nghiêm trọng chưa đóng |
| Operations & Observability | 3.5 / 5 | CI/CD + request logging có; DR/SLO/frontend monitoring thiếu |

---

## Phần I — Rủi Ro Mức ĐỎ (Phải Xử Lý Trước Production)

---

### ĐỎ-1: Split-brain Data — Supabase chỉ cover 4 bảng core, 11 module nghiệp vụ vẫn ở SQLite

#### Dẫn chứng

**Supabase schema hiện tại** (2 file migration):
```
supabase/migrations/001_core_schema.sql   → facilities, profiles, students, attendance
supabase/migrations/002_parent_attendance_media.sql → parent_student_links, media_albums, media_assets, import_batches
```

**SQLite vẫn giữ** (`server/db.js` — 1278 dòng):
Toàn bộ `collection_records` JSON blob + bảng riêng cho:
- `health_records` (Phase 8)
- `incidents` (Phase 8)
- `invoices` (Phase 8)
- `notifications`, `notification_reads` (Phase 9)
- `attendance_records` nâng cao (Phase 10 — *tách biệt với `attendance` Supabase*)
- `meal_menus` (Phase 11)
- `media_albums`, `media_assets` theo SQLite (Phase 11 — *trùng với Supabase schema*)
- `school_settings`, `academic_years`, `school_holidays`, `tuition_plans` (Phase 8)
- `student_consents` (Phase 8)
- `users`, `audit_logs`, `backups` (Phase 7)

**Hệ quả kiến trúc:**

1. **RLS Supabase không bảo vệ được dữ liệu nhạy cảm nhất**: `health_records` (dị ứng, thuốc), `incidents` (sự cố tai nạn), `invoices` (học phí) — tất cả đang nằm ngoài tầm kiểm soát của Supabase RLS.

2. **Trùng lặp schema**: `media_albums/media_assets` tồn tại ở CẢ 2 nơi (SQLite Phase 11 và Supabase migration 002) — không rõ frontend đang đọc từ đâu khi `VITE_DATA_BACKEND=supabase`.

3. **Backup không atomic**: SQLite backup (`server/backup.js`) chỉ lấy `.sqlite` file. Supabase có PITR riêng. Nếu một transaction spans hai hệ thống (vd: tạo invoice + ghi notification), không có cách đảm bảo consistency khi restore.

4. **Audit log split**: SQLite có bảng `audit_logs` ghi mọi thao tác backend. Supabase không có tương đương. Khi cutover, lịch sử audit bị đứt.

#### Phương pháp xử lý

**Bước 1 — Quyết định canonical store cho từng bảng:**

| Bảng | Canonical Target | Ưu tiên |
|------|-----------------|---------|
| health_records | Supabase (dữ liệu nhạy cảm cần RLS) | P0 |
| incidents | Supabase | P0 |
| invoices | Supabase | P0 |
| student_consents | Supabase | P0 |
| notifications, notification_reads | Supabase | P1 |
| school_settings, tuition_plans | Supabase | P1 |
| meal_menus | Supabase | P2 |
| attendance_records nâng cao | Merge vào `attendance` Supabase | P1 |
| audit_logs | Supabase (+ Postgres triggers) | P1 |
| users (local auth) | Supabase Auth profiles | Đã làm, dọn legacy |

**Bước 2 — Migration idempotent cho từng bảng:**
```sql
-- Ví dụ migration health_records sang Supabase
create table if not exists public.health_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  facility_id uuid not null references public.facilities(id) on delete restrict,
  allergies text,
  medications text,
  medical_notes text,
  emergency_contact_name text,
  emergency_contact_phone text,
  doctor_name text,
  doctor_phone text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (student_id)
);

alter table public.health_records enable row level security;

-- Admin và teacher theo facility; parent read-only con mình
create policy "health admin all" on public.health_records for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

create policy "health teacher facility" on public.health_records for select
  using (public.current_user_role() = 'teacher' and facility_id = public.current_facility_id());

create policy "health teacher write facility" on public.health_records for all
  using (public.current_user_role() = 'teacher' and facility_id = public.current_facility_id())
  with check (public.current_user_role() = 'teacher' and facility_id = public.current_facility_id());

create policy "health parent own child" on public.health_records for select
  using (
    public.current_user_role() = 'parent'
    and exists (
      select 1 from public.parent_student_links psl
      where psl.parent_profile_id = auth.uid() and psl.student_id = health_records.student_id
    )
  );
```

**Bước 3 — Migration script (SQLite → Supabase):**
```javascript
// scripts/migrate-health-records-to-supabase.mjs
import Database from 'better-sqlite3'
import { createClient } from '@supabase/supabase-js'

const sqlite = new Database('server/data/maika.sqlite')
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const records = sqlite.prepare('SELECT * FROM health_records').all()
// Map SQLite IDs → Supabase student UUIDs qua tên học sinh
// Upsert từng record với conflict resolution
```

**Bước 4 — Đặt freeze flag cho SQLite features:**
Sau khi migrate xong, thêm comment/env guard trong `server/db.js`:
```javascript
// DEPRECATED: health_records bảng này frozen — write qua Supabase
// Xóa sau khi verify Supabase migration hoàn tất.
```

**Acceptance criteria:**
- `VITE_DATA_BACKEND=supabase` → tất cả CRUD health/incidents/invoices đọc từ Supabase RLS
- Teacher CS2 không đọc được health record học sinh CS1
- Parent chỉ đọc được health record con mình
- Build + audit pass, không regression

---

### ĐỎ-2: Service Role Key Supabase Chưa Rotate

#### Dẫn chứng

`AGENT_HANDOFF.md` dòng 490–491:
```
- [x] Chạy migration vào Supabase project `czxoozwydvmjisydyims` ngày 01/05/2026...
- [ ] Rotate lại Supabase secret/service key trước production vì key đã được dùng trong quá trình setup local.
```

`SUPABASE_OPERATIONS.md` dòng 21–26 ghi rõ cách inject key vào PowerShell session, sau đó `Remove-Item Env:\SUPABASE_SERVICE_KEY`. Đây là practice đúng nhưng **key chưa bị invalidate**. Nếu terminal history, clipboard, hay `.env` tạm còn lưu key cũ → attacker có thể bypass toàn bộ RLS.

**Mức độ rủi ro:** Service role key = God-mode database access. Với trẻ em, dữ liệu y tế, PII phụ huynh → vi phạm Nghị định 13/2023/NĐ-CP Điều 9 (dữ liệu nhạy cảm của người dưới 16 tuổi).

#### Phương pháp xử lý

```
Supabase Dashboard → Project Settings → API → Service Role Key → "Generate New Secret"
```

Sau khi rotate:
1. Chạy `git log --all -p | grep -i "supabase"` — kiểm tra xem key cũ có bị commit không
2. Nếu có: dùng `git filter-repo --path-glob '*.env*' --invert-paths` hoặc liên hệ Supabase để revoke key cũ qua support
3. Cập nhật `SUPABASE_OPERATIONS.md` với key placeholder mới
4. Document ngày rotate trong AGENT_HANDOFF

---

### ĐỎ-3: Storage Bucket `maika-media` Public — Vi Phạm Privacy Trẻ Em

#### Dẫn chứng

`supabase/migrations/002_parent_attendance_media.sql` dòng 70–75:
```sql
insert into storage.buckets (id, name, public, ...)
values ('maika-media', 'maika-media', true, 5242880, ...)
```

Dòng 212–215:
```sql
create policy "storage maika media select"
on storage.objects for select
using (bucket_id = 'maika-media');
```

Policy này cho phép **bất kỳ HTTP request nào** (kể cả anonymous, không qua Supabase Auth) đọc file trong bucket nếu biết path.

RLS trên `media_assets` (rows) bảo vệ **metadata**, nhưng Supabase Storage phục vụ file binary qua CDN URL dạng:
```
https://czxoozwydvmjisydyims.supabase.co/storage/v1/object/public/maika-media/...
```

URL này public, cacheable, shareable — ảnh bữa ăn, ảnh học sinh có thể bị index bởi Google nếu URL bị leak.

**Compliance gap:** Nghị định 13/2023 Điều 9 khoản 1c: dữ liệu về trẻ em là dữ liệu cá nhân nhạy cảm cần bảo vệ nghiêm ngặt. Ảnh trẻ em không nên public-accessible.

#### Phương pháp xử lý

**Bước 1 — Đổi bucket sang private:**
```sql
-- Migration 003_private_storage.sql
update storage.buckets set public = false where id = 'maika-media';

drop policy if exists "storage maika media select" on storage.objects;
-- Xóa policy select mở. Select giờ phải qua signed URL server-side.
```

**Bước 2 — Tạo signed URL trong service:**
```javascript
// src/features/media/mediaService.js
export async function getSignedUrl(storagePath, expiresInSeconds = 600) {
  const client = requireSupabase()
  const { data, error } = await client.storage
    .from('maika-media')
    .createSignedUrl(storagePath, expiresInSeconds)
  if (error) throw error
  return data.signedUrl
}
```

**Bước 3 — Dùng signed URL trong component:**
```jsx
// Thay vì dùng public_url lưu trong DB,
// gọi getSignedUrl(asset.storage_path) khi render
const [imgUrl, setImgUrl] = useState('')
useEffect(() => {
  getSignedUrl(asset.storagePath).then(setImgUrl)
}, [asset.storagePath])
```

**Lưu ý:** TTL 10 phút (600s) phù hợp cho session xem ảnh. Không cache signed URL quá TTL.

---

### ĐỎ-4: PII Trẻ Em Trong Git Repository

#### Dẫn chứng

```
-rw-r--r-- 1 DELL 197121  14629 May  1 11:07 Danh sach tre CS1.xlsx
```

File 14KB chứa tên học sinh, tên phụ huynh, số điện thoại của 64 trẻ em CS1 **đang được tracked bởi git** (confirmed bởi AGENT_HANDOFF nói import từ file này). Nếu repo này push lên GitHub (dù private), PII đã rời khỏi control của operator.

`.gitignore` hiện tại **không loại trừ `.xlsx`**:
```
# .gitignore hiện tại
node_modules/
dist/
.env
.env.local
```

#### Phương pháp xử lý

**Bước 1 — Gỡ khỏi git tracking:**
```bash
git rm --cached "Danh sach tre CS1.xlsx"
echo "*.xlsx" >> .gitignore
echo "*.xls" >> .gitignore
git add .gitignore
git commit -m "Remove PII spreadsheet from git tracking"
```

**Bước 2 — Clean git history (nếu đã push remote):**
```bash
# Dùng git filter-repo (cài: pip install git-filter-repo)
git filter-repo --path "Danh sach tre CS1.xlsx" --invert-paths
# Sau đó force push (cần xác nhận với owner repo)
```

**Bước 3 — Cập nhật `.gitignore` bổ sung:**
```gitignore
# PII & data files
*.xlsx
*.xls
*.csv
uploads/
server/uploads/
server/backups/
server/data/*.sqlite
```

---

## Phần II — Rủi Ro Mức CAM (Cần Fix Trước hoặc Trong Tháng Production Đầu)

---

### CAM-5: RoleGate Chỉ Kiểm Tra sessionStorage — Dễ Bypass

#### Dẫn chứng

`src/app/RoleGate.jsx` dòng 5–9:
```jsx
export default function RoleGate({ allowedRoles, loginPath, children }) {
    const role = sessionStorage.getItem('maika_role')
    if (!role) return <Navigate to={loginPath} replace />
    if (allowedRoles?.length && !allowedRoles.includes(role)) {
        return <Navigate to={portalPathForRole(role)} replace />
    }
    return children
}
```

**Attack vector:** User mở DevTools Console → `sessionStorage.setItem('maika_role', 'admin')` → navigate to `/admin/app` → thấy toàn bộ admin UI shell.

**Clarification:** Dữ liệu thật vẫn được bảo vệ bởi Supabase RLS (Supabase sẽ trả về empty/error nếu không có JWT hợp lệ với role đúng). Nhưng:
- Admin UI shell bị lộ (forms, tables, buttons) → tấn công XSS/CSRF surface rộng hơn
- Error messages từ Supabase bị lộ → information disclosure
- Trang `no-access` chưa có (TODO trong Layer 5) → user bị khóa tài khoản không biết lý do

#### Phương pháp xử lý

**Option A (Recommended) — Async profile check với React Context:**
```jsx
// src/features/auth/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react'
import { getCurrentProfile } from './authService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [profile, setProfile] = useState(undefined) // undefined = loading, null = not logged in
    useEffect(() => {
        getCurrentProfile()
            .then(setProfile)
            .catch(() => setProfile(null))
    }, [])
    return <AuthContext.Provider value={profile}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
```

```jsx
// src/app/RoleGate.jsx (refactored)
import { useAuth } from '../features/auth/AuthContext'
import { Navigate } from 'react-router-dom'

export default function RoleGate({ allowedRoles, loginPath, children }) {
    const profile = useAuth()
    if (profile === undefined) return <div>Đang tải...</div> // loading state
    if (!profile) return <Navigate to={loginPath} replace />
    if (!profile.is_active) return <Navigate to="/no-access?reason=locked" replace />
    if (!profile.facility_id && profile.role === 'teacher')
        return <Navigate to="/no-access?reason=no-facility" replace />
    if (allowedRoles?.length && !allowedRoles.includes(profile.role))
        return <Navigate to={portalPathForRole(profile.role)} replace />
    return children
}
```

**Trang `/no-access`:**
```jsx
// src/pages/NoAccess.jsx
export default function NoAccess() {
    const reason = new URLSearchParams(location.search).get('reason')
    const messages = {
        locked: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.',
        'no-facility': 'Tài khoản chưa được gán cơ sở. Liên hệ admin để cấu hình.',
    }
    return <div className="no-access-page">{messages[reason] ?? 'Không có quyền truy cập.'}</div>
}
```

---

### CAM-6: Backup Chỉ Cover SQLite, Không Cover Supabase

#### Dẫn chứng

`server/backup.js` — backup bằng cách copy `.sqlite` file:
```javascript
// server/backup.js (suy luận từ AGENT_HANDOFF)
// Backup = copy server/data/maika.sqlite → server/backups/maika-YYYY-MM-DD.sqlite
```

Khi production chạy trên Supabase:
- `health_records`, `incidents`, `invoices` (sau khi migrate) sẽ ở Supabase
- SQLite backup không cover data này
- Supabase PITR chỉ có ở plan Pro+ ($25/mo); Free plan không có PITR

**Gap:** Nếu sự cố xảy ra ở Free plan, không có cách restore Supabase về điểm trước đó.

#### Phương pháp xử lý

**Option A (Minimum viable) — pg_dump daily:**
```bash
# scripts/backup-supabase.sh
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="backups/supabase-$TIMESTAMP.sql"

pg_dump "$SUPABASE_POSTGRES_URL" \
  --schema=public \
  --no-owner \
  --no-acl \
  -f "$BACKUP_FILE"

gzip "$BACKUP_FILE"
echo "Backup saved: $BACKUP_FILE.gz"
```

```javascript
// Tích hợp vào server/scheduler.js
// Chạy song song với SQLite backup scheduler
```

**Option B (Recommended) — Nâng lên Supabase Pro:**
- $25/mo → PITR 7 ngày
- Cho trường học quản lý dữ liệu trẻ em → chi phí chấp nhận được

**Lưu ý:** Supabase Storage (ảnh) **không** trong PITR. Cần backup Storage riêng:
```javascript
// list all objects và tải về hoặc copy sang S3-compatible storage
const { data: files } = await supabase.storage.from('maika-media').list()
```

---

### CAM-7: Không Có Data Access Abstraction Layer

#### Dẫn chứng

`src/pages/admin/Students.jsx` (suy luận từ cấu trúc) — phải tự if/else `VITE_DATA_BACKEND`:
```jsx
// Pattern hiện tại (không tập trung)
const backend = import.meta.env.VITE_DATA_BACKEND
if (backend === 'supabase') {
    // gọi studentService.js
} else if (backend === 'api') {
    // fetch('/api/students')
} else {
    // localStorage
}
```

Điều này đồng nghĩa với mỗi page phải tự handle 3 nhánh. Khi retire SQLite, sẽ phải sửa từng page.

**`src/features/students/SupabaseStudentsPanel.jsx` (132 dòng)** — component riêng chỉ cho Supabase branch, thay vì refactor `Students.jsx` dùng adapter.

#### Phương pháp xử lý

**Tạo abstraction với Repository Pattern:**
```javascript
// src/data/repositories/studentRepository.js
import * as supabaseStudents from '../../features/students/studentService'

const backend = import.meta.env.VITE_DATA_BACKEND ?? 'local'

function getLocalStudents() { /* từ localStorage */ }
function getApiStudents()   { /* fetch('/api/students') */ }

export const studentRepository = {
    list:   backend === 'supabase' ? supabaseStudents.listStudents
          : backend === 'api'      ? getApiStudents
          :                          getLocalStudents,
    save:   backend === 'supabase' ? supabaseStudents.saveStudent : ...,
    remove: backend === 'supabase' ? supabaseStudents.markStudentInactive : ...,
}
```

Pages chỉ `import { studentRepository }` — không biết backend.

---

### CAM-8: Teacher Portal Là Shell Rỗng

#### Dẫn chứng

`src/portals/teacher/TeacherApp.jsx` — 74 dòng (đã `wc -l`). AGENT_HANDOFF Phase 10 nói:
> "Mobile-first slide-up detail modal: check-in/out times, pickup person/phone, ghi chú"

Nhưng `AttendanceAdvanced.jsx` nằm trong `src/pages/admin/` — giáo viên phải vào `/admin/app` để điểm danh. Đây là UX sai — giáo viên không nên thấy trang admin.

#### Phương pháp xử lý

Move/reuse `AttendanceAdvanced.jsx` logic vào Teacher portal với layout mobile-first:
```
src/portals/teacher/
  TeacherApp.jsx          (nav + layout)
  TeacherLogin.jsx        (hiện có)
  pages/
    TeacherAttendance.jsx (reuse AttendanceAdvanced logic, mobile layout)
    TeacherStudents.jsx   (read-only student list)
    TeacherDailyReports.jsx
```

Teacher portal route: `/teacher/app` → default page là `TeacherAttendance` (use-case phổ biến nhất).

---

### CAM-9: Test Coverage Thấp Cho Supabase Services

#### Dẫn chứng

Từ `ls` output:
```
src/features/auth/authService.test.js
src/features/students/studentService.test.js
```

Chỉ 2 test files cho toàn bộ Supabase feature layer. Không có:
- Integration test với Supabase test project
- Test RLS isolation (teacher CS1 không thấy CS2)
- Test parent isolation (chỉ thấy con mình)
- Test attendance upsert

`AGENT_HANDOFF.md` Layer 7 còn `[ ]`:
```
- [ ] Unit test service mapping.
- [ ] Integration smoke bằng Supabase test project hoặc mock Supabase client.
- [ ] Playwright chính thức: /login teacher → xem học sinh cơ sở mình → điểm danh.
```

#### Phương pháp xử lý

**Setup Supabase test project:**
```bash
# .env.test
VITE_SUPABASE_URL=https://test-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=test-anon-key
SUPABASE_SERVICE_KEY=test-service-key  # chỉ dùng để seed test data
```

**RLS isolation tests (vitest):**
```javascript
// src/features/students/studentService.rls.test.js
describe('RLS: teacher facility isolation', () => {
  it('teacher CS1 only sees CS1 students', async () => {
    await signInAsTeacherCS1()
    const students = await listStudents()
    expect(students.every(s => s.facilityId === CS1_FACILITY_ID)).toBe(true)
  })

  it('teacher CS2 cannot read CS1 students', async () => {
    await signInAsTeacherCS2()
    const { data, error } = await supabase.from('students')
      .eq('facility_id', CS1_FACILITY_ID)
    expect(data).toHaveLength(0)
  })
})
```

---

### CAM-10: `attendanceService.js` — Double Field Mapping (camelCase + snake_case)

#### Dẫn chứng

`src/features/attendance/attendanceService.js` dòng 22–44:
```javascript
export function mapAttendanceFromSupabase(row) {
    return {
        // camelCase (chuẩn)
        checkInTime: row.check_in_time || '',
        checkOutTime: row.check_out_time || '',
        pickupPerson: row.pickup_person || '',
        pickupPhone: row.pickup_phone || '',
        lateReason: row.late_reason || '',
        earlyPickupReason: row.early_pickup_reason || '',
        // snake_case (legacy cho component cũ)
        check_in_time: row.check_in_time || '',
        check_out_time: row.check_out_time || '',
        pickup_person: row.pickup_person || '',
        pickup_phone: row.pickup_phone || '',
        late_reason: row.late_reason || '',
        early_pickup_reason: row.early_pickup_reason || '',
    }
}
```

Double export = 2 copies của mỗi field trong mọi object attendance → memory waste, type confusion.

#### Phương pháp xử lý

Xóa snake_case duplicate, update component đang dùng snake_case sang camelCase:
```bash
grep -r "check_in_time\|pickup_person\|late_reason" src/ --include="*.jsx"
# Đổi tất cả sang camelCase, xóa snake_case khỏi mapper
```

---

## Phần III — Vấn Đề Kiến Trúc Mức Vàng (Quality/Technical Debt)

---

### VÀNG-11: Không Có Env Validation Startup

#### Dẫn chứng

`src/lib/supabaseClient.js` (suy luận từ import pattern):
```javascript
export function requireSupabase() {
  if (!import.meta.env.VITE_SUPABASE_URL) throw new Error('Missing VITE_SUPABASE_URL')
  // ...
}
```

Error chỉ xuất hiện khi user click login — không phải lúc app load. User thấy trang trắng/crash thay vì thông báo có nghĩa.

#### Phương pháp xử lý

```javascript
// src/main.jsx — thêm validation trước ReactDOM.createRoot
const REQUIRED_VARS = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
const missing = REQUIRED_VARS.filter(k => !import.meta.env[k])
if (missing.length) {
  document.body.innerHTML = `<div style="padding:2rem;color:red">
    <h2>Cấu hình thiếu: ${missing.join(', ')}</h2>
    <p>Kiểm tra file .env.local hoặc Netlify environment variables.</p>
  </div>`
} else {
  ReactDOM.createRoot(document.getElementById('root')).render(<App />)
}
```

---

### VÀNG-12: `server/db.js` Quá Lớn (1278 Dòng)

#### Dẫn chứng

```
1278 server/db.js
```

File monolith này chứa schema init + tất cả repository functions cho 15+ entity. Mỗi lần sửa bất kỳ entity nào đều edit cùng file → merge conflict cao, khó review.

#### Phương pháp xử lý

Tách theo domain (chỉ làm nếu tiếp tục develop SQLite layer, không làm nếu migrate sang Supabase):
```
server/
  db/
    init.js          (schema + migration runner)
    students.repo.js
    health.repo.js
    incidents.repo.js
    invoices.repo.js
    notifications.repo.js
    users.repo.js
    audit.repo.js
```

**Khuyến nghị:** Chỉ làm refactor này **kèm với** Phase 13 migration. Không tách file để rồi migrate sang Supabase ngay — double effort.

---

### VÀNG-13: Không Có API Versioning

#### Dẫn chứng

`server/app.js` routes: `/api/students`, `/api/health-records`, `/api/incidents` — không có `/v1/`.

Nếu sau này thay đổi response shape (vd: đổi field name), mọi frontend client cũ sẽ break.

#### Phương pháp xử lý

```javascript
// server/app.js
const v1Router = express.Router()
v1Router.use('/students', studentsRouter)
v1Router.use('/health-records', healthRouter)
// ...
app.use('/api/v1', v1Router)
app.use('/api', v1Router) // backward compat alias
```

---

### VÀNG-14: Không Có Frontend Error Tracking

#### Dẫn chứng

Backend có request logging (Phase 12). Frontend silent — không Sentry, không error boundary global, không analytics.

#### Phương pháp xử lý

**Option A (Free) — Sentry:**
```bash
npm install @sentry/react
```
```javascript
// src/main.jsx
import * as Sentry from '@sentry/react'
if (import.meta.env.PROD) {
  Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, environment: 'production' })
}
```

**Option B (Privacy-friendly) — Tự host Glitchtip:** Tương thích Sentry API, self-hosted, không gửi PII ra ngoài.

---

### VÀNG-15: Bucket Storage Policy Cần Scope Theo Facility

#### Dẫn chứng

`supabase/migrations/002_parent_attendance_media.sql` dòng 228–234:
```sql
create policy "storage maika media teacher write"
on storage.objects for insert
with check (
  bucket_id = 'maika-media'
  and public.current_user_role() = 'teacher'
);
```

Teacher bất kỳ có thể upload vào bucket, nhưng không bị ràng buộc `facility_id` trong storage path. Teacher CS2 có thể upload vào folder `cs1/` nếu muốn.

#### Phương pháp xử lý

Enforce naming convention trong service + policy:
```sql
-- Storage path phải bắt đầu bằng facility_id của teacher
create policy "storage maika media teacher write scoped"
on storage.objects for insert
with check (
  bucket_id = 'maika-media'
  and public.current_user_role() = 'teacher'
  and (storage.foldername(name))[1] = public.current_facility_id()::text
);
```

```javascript
// mediaService.js — enforce naming
async function uploadMedia(file, facilityId, studentId) {
  const path = `${facilityId}/${studentId}/${Date.now()}-${file.name}`
  // ...
}
```

---

### VÀNG-16: Multi-tenant Boundary Chưa Chuẩn Bị

#### Dẫn chứng

Schema hiện tại có `facility_id` (cơ sở trong cùng 1 trường Maika). Không có `school_id` hay `tenant_id`.

`AGENT_HANDOFF.md` Phase 14:
> "Multi-branch/multi-school chỉ làm khi có nhu cầu thật; chuẩn bị bằng `school_id` trong schema mới nếu refactor DB."

#### Phương pháp xử lý

**Nếu quyết định multi-school trong 12 tháng:** Thêm `tenant_id` ngay trong Phase 13 migration — sẽ rất khó add sau khi bảng đã có data thật.

**Tối thiểu ngay bây giờ:** Đặt tất cả data của Maika vào 1 tenant row, add `tenant_id` column `default 'maika-1'` để migration về sau có thể thêm tenant khác mà không đập schema.

```sql
-- Phase 13 schema: thêm ngay từ đầu
alter table public.facilities add column if not exists tenant_id text not null default 'maika';
alter table public.students add column if not exists tenant_id text not null default 'maika';
```

---

## Phần IV — Compliance Gap (Nghị Định 13/2023/NĐ-CP)

Ứng dụng xử lý dữ liệu cá nhân của trẻ em dưới 16 tuổi — đây là **dữ liệu nhạy cảm** theo Điều 9. Các yêu cầu pháp lý tối thiểu:

| Yêu cầu | Trạng thái | Ghi chú |
|---------|-----------|---------|
| Consent rõ ràng từ phụ huynh | 🟡 Một phần | `student_consents` đã làm trong SQLite; chưa cover đầy đủ theo NĐ |
| Thông báo mục đích thu thập | ❌ Chưa có | Privacy policy page chưa có |
| Quyền truy cập, sửa, xóa dữ liệu | 🟡 Một phần | Parent xem được, nhưng không có luồng "yêu cầu xóa" |
| Bảo vệ ảnh trẻ em | ❌ Thiếu | Bucket public (đã note ở ĐỎ-3) |
| Thông báo vi phạm dữ liệu | ❌ Chưa có | Không có incident response plan |
| Lưu trữ tại Việt Nam hoặc nước đủ điều kiện | 🟡 | Supabase Singapore region — cần xác nhận đủ điều kiện |

**Hành động tối thiểu trước production:**
1. Thêm Privacy Policy page (có thể ngắn, ít nhất nêu: dữ liệu gì được thu, lưu bao lâu, liên hệ ai để xóa)
2. Consent form phụ huynh khi đăng ký phải rõ ràng hơn
3. Đóng bucket ảnh (ĐỎ-3 đã hướng dẫn)

---

## Phần V — Kiến Trúc Điểm Mạnh (Để Giữ Nguyên)

Những điểm Codex đã làm tốt — không nên thay đổi:

1. **RLS PostgreSQL đúng nguyên tắc** — `current_user_role()` + `current_facility_id()` security definer functions là pattern chuẩn, không để logic RLS rải vào SQL ad-hoc.

2. **Migration versioning idempotent** — 2 file migration với `create if not exists`, `on conflict do update` → có thể chạy lại mà không lỗi.

3. **Adapter layer cho notification** (`server/notificationAdapters.js`) — mock/email/sms/zalo fail graceful khi thiếu key.

4. **CSP meta tag + DOMPurify** — Phase 3 đã làm đúng.

5. **`teacher_facility_required` check constraint** trong `profiles`:
   ```sql
   constraint teacher_facility_required check (role <> 'teacher' or facility_id is not null)
   ```
   Đây là DB-level enforcement — không thể tạo teacher mà thiếu facility qua bất kỳ path nào.

6. **CI/CD workflow** với `npm audit --audit-level=high` — 0 vulnerability verified.

7. **`must_change_password` + force modal** — Pattern đúng cho bootstrap credentials.

8. **Composite FK trên attendance:**
   ```sql
   foreign key (student_id, facility_id) references public.students(id, facility_id)
   ```
   Đảm bảo không thể ghi attendance cho student của facility khác — database-level integrity.

9. **Import batch log** (`import_batches` table) — traceability cho data imports.

10. **`node-cron` scheduler** với timezone `Asia/Ho_Chi_Minh` và retention policy — production-ready.

---

## Phần VI — Bảng Tổng Hợp Đề Xuất Ưu Tiên

| # | Hạng mục | Mức độ | Effort | Tuần |
|---|----------|--------|--------|------|
| ĐỎ-1 | Migrate health/incidents/invoices sang Supabase + RLS | CRITICAL | L (2 tuần) | 2–4 |
| ĐỎ-2 | Rotate Supabase service role key | CRITICAL | XS (30 phút) | Ngay |
| ĐỎ-3 | Bucket → private + signed URL | CRITICAL | S (1 ngày) | Ngay |
| ĐỎ-4 | Gỡ PII xlsx khỏi git | CRITICAL | XS (1 giờ) | Ngay |
| CAM-5 | RoleGate async + `/no-access` page | HIGH | S (1 ngày) | 1 |
| CAM-6 | Backup Supabase + restore drill | HIGH | M (3 ngày) | 1 |
| CAM-7 | Data access abstraction layer | HIGH | M (3 ngày) | 2 |
| CAM-8 | Teacher portal đầy đủ mobile-first | HIGH | M (3 ngày) | 2 |
| CAM-9 | Integration tests RLS Supabase | HIGH | M (3 ngày) | 2 |
| CAM-10 | Dọn double field mapping attendance | MEDIUM | XS (1 giờ) | 1 |
| VÀNG-11 | Env validation startup | LOW | XS (30 phút) | 1 |
| VÀNG-12 | Tách server/db.js (chỉ nếu không retire SQLite sớm) | LOW | M | 3 |
| VÀNG-13 | API versioning /v1/ | LOW | XS | 1 |
| VÀNG-14 | Sentry / error tracking frontend | LOW | S | 2 |
| VÀNG-15 | Storage policy scope theo facility | MEDIUM | XS | 1 |
| VÀNG-16 | Chuẩn bị `tenant_id` nếu multi-school | MEDIUM | S | Phase 13 |
| COMP | Privacy policy page + consent đầy đủ | HIGH | M | 2 |

---

## Câu Hỏi Mở Cho Codex Phản Biện

1. **Split-brain media**: `media_albums/media_assets` xuất hiện ở cả SQLite (Phase 11) và Supabase migration 002. Component nào đang đọc từ đâu khi `VITE_DATA_BACKEND=supabase`? Có bị duplicate/inconsistent không?

2. **attendanceService.js vs AttendanceAdvanced.jsx**: Phase 10 tạo `attendanceService.js` cho Supabase, nhưng `AttendanceAdvanced.jsx` (trong `/admin/`) — file này đang dùng adapter nào? Có đang đọc từ SQLite hay Supabase?

3. **`SupabaseStudentsPanel.jsx` vs `Students.jsx`**: Tại sao cần component riêng thay vì nhánh trong `Students.jsx`? Kế hoạch merge là gì?

4. **`server/import-cs1-xlsx.py` trong `server/`**: File này khác `scripts/import-supabase-students.py` như thế nào? Cái nào là source of truth cho import?

5. **Audit log Supabase**: Sau khi migrate health/incidents sang Supabase, audit log cho những thay đổi đó sẽ đi đâu? SQLite `audit_logs` hay cần tạo mới trong Supabase?

---

*Tài liệu này được tạo tự động bởi Claude EA Review ngày 01/05/2026. Dẫn chứng dựa trên đọc trực tiếp file: `AGENT_HANDOFF.md`, `supabase/migrations/001_core_schema.sql`, `supabase/migrations/002_parent_attendance_media.sql`, `src/app/RoleGate.jsx`, `src/features/auth/authService.js`, `src/features/students/studentService.js`, `src/features/attendance/attendanceService.js`, `package.json`, `.env.example`, `SUPABASE_OPERATIONS.md`, và kết quả `ls`/`wc -l` của các thư mục chính.*
