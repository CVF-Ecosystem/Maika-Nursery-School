# Maika Supabase Operations

## Production Login URL

- Public app: `https://maikaschool.netlify.app/`
- Unified login: `https://maikaschool.netlify.app/login`

## Test Accounts

- Admin: `admin@maika.test`
- Teacher CS1: `teacher.cs1@maika.test`
- Teacher CS2: `teacher.cs2@maika.test`
- Parent CS1: `parent@maikaschool.vn`

All current test accounts use the shared dev password created during setup. Rotate before production.

## Import Students From Excel

Use service role only in a local terminal. Do not commit service keys.

```powershell
$env:SUPABASE_URL="https://czxoozwydvmjisydyims.supabase.co"
$env:SUPABASE_SERVICE_KEY="<service-role-key>"
python scripts/import-supabase-students.py "Danh sach tre CS1.xlsx" CS1
Remove-Item Env:\SUPABASE_SERVICE_KEY
```

The importer supports common Vietnamese/English headers for student, parent, phone, email, date of birth, gender, class, facility, and notes. Missing fields stay empty/null so they can be edited manually in Admin.

## Create Or Link Auth Users

Frontend can manage `profiles` and parent-student links, but it cannot create/reset Supabase Auth users because that requires service role.

```powershell
$env:SUPABASE_URL="https://czxoozwydvmjisydyims.supabase.co"
$env:SUPABASE_SERVICE_KEY="<service-role-key>"
node scripts/create-supabase-user.mjs parent@domain.vn "PasswordHere" parent "Tên phụ huynh" "Tên học sinh"
node scripts/create-supabase-user.mjs teacher.cs1@domain.vn "PasswordHere" teacher "Tên giáo viên" CS1
Remove-Item Env:\SUPABASE_SERVICE_KEY
```

## Storage

Migration `002_parent_attendance_media.sql` creates bucket `maika-media` and policies for admin/teacher uploads plus parent read of published media.

## Before Real Production

- Rotate Supabase service/secret key used during setup.
- Replace all test passwords.
- Turn on real parent accounts only after consent/privacy copy is reviewed.
- Keep `VITE_DEMO_MODE` unset or `false` on Netlify.
