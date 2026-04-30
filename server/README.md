# Maika Backend

Phase 7 adds an optional API backend. The Netlify static demo still works without it; set `VITE_API_URL` to make the React app hydrate from the API.

## Run locally

```bash
cp .env.example .env
npm run api:dev
```

Default local API: `http://127.0.0.1:8787`

## Auth

- `POST /api/auth/login` with `{ "role": "admin", "password": "..." }`
- `POST /api/auth/login` with `{ "role": "teacher", "password": "..." }`
- `POST /api/auth/login` with `{ "role": "parent", "phone": "0901234567" }`

Set `MAIKA_ADMIN_PASSWORD`, `MAIKA_TEACHER_PASSWORD`, and `MAIKA_JWT_SECRET` in `.env` before production use.

## Data

SQLite lives at `MAIKA_DB_PATH` and is seeded from `src/data/store.js`.

Snapshot migration:

```bash
node server/export-snapshot.js maika-snapshot.json
node server/import-snapshot.js maika-snapshot.json
```

REST collections:

`students`, `teachers`, `classes`, `attendance`, `finance`, `messages`, `events`, `daily-reports`, `resources`, `badges`

User management:

- `GET /api/users` lists accounts. Admin only.
- `POST /api/users` creates an account. Admin only.
- `PUT /api/users/:id` edits role/contact/password/status. Admin only.
- User status can be `active` or `locked`; locked users cannot log in.

Audit log:

- `GET /api/audit-logs?limit=200` lists audit events. Admin only.
- Optional filters: `action`, `entityType`, `actorId`.
- The API records login success/failure, user management changes, snapshot sync, REST create/update/delete, and uploads.

Backup/restore:

- `GET /api/backups` lists backup files. Admin only.
- `POST /api/backups` creates a JSON snapshot backup in `MAIKA_BACKUP_DIR`.
- `GET /api/backups/:name/download` downloads a backup.
- `POST /api/backups/:name/restore` replaces current data with the backup snapshot.
- Backup and restore actions are recorded in audit logs.

Examples:

```bash
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8787/api/students
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8787/api/users
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8787/api/audit-logs
curl -X POST -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8787/api/backups
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"id":"s-new","name":"Bé mới"}' http://127.0.0.1:8787/api/students
```
