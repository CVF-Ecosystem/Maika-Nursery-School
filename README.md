# Maika Nursery School

Maika Nursery School is a React/Vite nursery management app for school admins, teachers, and parents.

## Main Features

- Admin dashboard for students, teachers, attendance, health records, incidents, notifications, media, menus, and accounts.
- Tuition and receipt management with manual edits, PDF/print receipts, and VietQR payment QR generation.
- Maika tuition Excel import/export using the workbook format with `Thông tin học sinh` and `Bảng học phí_nội  bộ` sheets.
- Teacher portal for attendance, daily reports, media, and classroom workflows.
- Parent portal for attendance, reports, invoices, media, notifications, health records, and consent settings.
- Supabase-backed production mode with legacy local/API modes kept for development and tests.

## Tech Stack

- React 18, Vite, React Router
- Supabase client and Edge Functions
- Express/SQLite legacy API for local or recovery workflows
- Vitest and Playwright

## Getting Started

```bash
npm install
npm run dev
```

The app runs locally at the Vite URL shown in the terminal, usually `http://127.0.0.1:5173`.

## Environment

Copy `.env.example` to `.env.local` for local development and set the values you need.

Important notes:

- Browser-safe Supabase publishable keys can be used in frontend env vars.
- Never commit Supabase service role keys or production secrets.
- Local-only env files such as `.env.local` and `.env.*.local` are ignored.

## Useful Commands

```bash
npm run build
npm run test:run
npm run test:e2e
npm run api:dev
npm run backup:supabase
```

## Tuition Excel Format

The tuition screen supports importing and exporting the school workbook format used by Maika:

- `Thông tin học sinh`: student code, name, gender, date of birth, enrollment date, class, status, address, parent name, phone, notes.
- `Bảng học phí_nội  bộ`: month/year, student code, name, class, tuition, amount due, payment date, payer, paid amount, notes.

Supported file types: `.xls`, `.xlsx`, `.csv`.

## Documentation

- [User guide](docs/USER_GUIDE.md)
- [Supabase operations](docs/SUPABASE_OPERATIONS.md)
- [Legacy server notes](server/README.md)
- [Legacy deployment notes](server/DEPLOY.md)

## Contributors

Maika Nursery School belongs to the CVF Ecosystem. Product ownership and acceptance review are led by Blackbird, with development support from Codex and earlier AI implementation support from Claude.

See [CONTRIBUTORS.md](CONTRIBUTORS.md) for the canonical contributor record.

## CI

GitHub Actions runs unit tests, dependency audit, frontend build, and Playwright e2e checks on pushes and pull requests to `master` or `main`.
