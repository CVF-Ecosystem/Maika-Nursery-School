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

## Admin Account Management

Production uses Netlify for the React app and Supabase Edge Function `admin-users` for privileged account actions. Admins create teachers, parents, and other admins from the web UI. The service role key stays in Supabase function secrets and is never exposed to Netlify or browser code.

Deploy the Edge Function after changing code:

```powershell
supabase functions deploy admin-users --project-ref czxoozwydvmjisydyims
```

Supabase Edge Functions expose `SUPABASE_SERVICE_ROLE_KEY` automatically at runtime. Do not create custom secrets starting with `SUPABASE_`; Supabase CLI ignores those names.

The local script remains available for one-time recovery or emergency admin creation:

```powershell
$env:SUPABASE_URL="https://czxoozwydvmjisydyims.supabase.co"
$env:SUPABASE_SERVICE_KEY="<service-role-key>"
node scripts/create-supabase-user.mjs parent@domain.vn "PasswordHere" parent "Tên phụ huynh" "Tên học sinh"
node scripts/create-supabase-user.mjs teacher.cs1@domain.vn "PasswordHere" teacher "Tên giáo viên" CS1
Remove-Item Env:\SUPABASE_SERVICE_KEY
```

## Storage

Migration `002_parent_attendance_media.sql` creates bucket `maika-media` as private. Migration `003_private_media_storage.sql` is the production hardening step that also closes any older public bucket state and removes the broad public read policy if it already exists in a live project.

Media URLs must be generated with signed URLs from `src/features/media/mediaService.js`. Do not store or render Supabase public object URLs for child photos.

Run the private-storage migration before production:

```sql
-- Supabase SQL editor
-- paste and run supabase/migrations/003_private_media_storage.sql
```

## Backup

SQLite backups do not cover Supabase data. For Supabase production/staging backup, run:

```powershell
$env:SUPABASE_POSTGRES_URL="postgresql://..."
$env:SUPABASE_URL="https://<project>.supabase.co"
$env:SUPABASE_SERVICE_KEY="<service-role-key>"
npm run backup:supabase
Remove-Item Env:\SUPABASE_POSTGRES_URL
Remove-Item Env:\SUPABASE_SERVICE_KEY
```

The script writes a compressed `public` schema dump and a `maika-media` storage backup under `MAIKA_SUPABASE_BACKUP_DIR` or `server/backups/supabase`. It requires local `pg_dump`. Set `SUPABASE_BACKUP_STORAGE_OBJECTS=false` to write only the storage manifest.

Alternatively, put these values in an untracked `.env.backup.local` file. `.env.*.local` is ignored by git.

On machines without `pg_dump`, `scripts/backup-supabase.mjs` falls back to a gzip JSON snapshot of public tables via the Postgres connection. That fallback is useful for staging/test data capture; use Supabase PITR or real `pg_dump` for production restore drills.

## Applying Supabase migrations

With `SUPABASE_POSTGRES_URL` available in `.env.backup.local`:

```powershell
npm run supabase:migrate -- supabase/migrations/003_private_media_storage.sql
npm run supabase:migrate -- supabase/migrations/004_sensitive_domains.sql
npm run supabase:migrate -- supabase/migrations/005_operational_domains.sql
```

Migration `005_operational_domains.sql` moves the P1 operational domains into Supabase: notifications/read state, school settings, academic years, holidays, tuition plans, and meal menus.

## Before Real Production

- Rotate Supabase service/secret key used during setup.
- Replace all test passwords.
- Confirm `maika-media` has `public = false`.
- Schedule `npm run backup:supabase` or enable Supabase PITR before moving real child data to Supabase.
- Turn on real parent accounts only after consent/privacy copy is reviewed.
- Keep `VITE_DEMO_MODE` unset or `false` on Netlify.
