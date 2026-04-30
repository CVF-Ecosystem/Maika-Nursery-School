import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import bcrypt from 'bcryptjs'
import { defaultData } from '../src/data/store.js'

const DB_PATH = resolve(process.env.MAIKA_DB_PATH || 'server/data/maika.sqlite')
const COLLECTIONS = ['students', 'teachers', 'classes', 'attendance', 'finance', 'messages', 'events', 'dailyReports', 'resources', 'badges']

mkdirSync(dirname(DB_PATH), { recursive: true })

export const db = new DatabaseSync(DB_PATH)

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'parent')),
    display_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    password_hash TEXT,
    student_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_role_phone ON users(role, phone) WHERE phone IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_role_email ON users(role, email) WHERE email IS NOT NULL;

  CREATE TABLE IF NOT EXISTS collection_records (
    collection TEXT NOT NULL,
    id TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (collection, id)
  );

  CREATE TABLE IF NOT EXISTS uploads (
    id TEXT PRIMARY KEY,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    path TEXT NOT NULL,
    uploaded_by TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`)

function rowToData(row) {
    return row ? JSON.parse(row.data) : null
}

export function listCollections() {
    return COLLECTIONS
}

export function readCollection(collection) {
    const rows = db.prepare('SELECT data FROM collection_records WHERE collection = ? ORDER BY id').all(collection)
    return rows.map(rowToData)
}

export function readRecord(collection, id) {
    return rowToData(db.prepare('SELECT data FROM collection_records WHERE collection = ? AND id = ?').get(collection, id))
}

export function upsertRecord(collection, record) {
    db.prepare(`
      INSERT INTO collection_records (collection, id, data, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(collection, id) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP
    `).run(collection, record.id, JSON.stringify(record))
    return record
}

export function deleteRecord(collection, id) {
    const result = db.prepare('DELETE FROM collection_records WHERE collection = ? AND id = ?').run(collection, id)
    return result.changes > 0
}

export function readSnapshot() {
    return Object.fromEntries(COLLECTIONS.map(collection => [collection, readCollection(collection)]))
}

export function replaceSnapshot(data) {
    db.exec('BEGIN')
    try {
        for (const collection of COLLECTIONS) {
            if (!Array.isArray(data[collection])) continue
            db.prepare('DELETE FROM collection_records WHERE collection = ?').run(collection)
            for (const record of data[collection]) upsertRecord(collection, record)
        }
        db.exec('COMMIT')
    } catch (error) {
        db.exec('ROLLBACK')
        throw error
    }
    return readSnapshot()
}

export function findUserById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id)
}

export function findUserForLogin({ role, phone }) {
    if (role === 'parent') {
        return db.prepare('SELECT * FROM users WHERE role = ? AND phone = ?').get(role, phone)
    }
    return db.prepare('SELECT * FROM users WHERE role = ? ORDER BY created_at LIMIT 1').get(role)
}

function ensureUser(user) {
    db.prepare(`
      INSERT INTO users (id, role, display_name, phone, email, password_hash, student_id)
      VALUES (@id, @role, @display_name, @phone, @email, @password_hash, @student_id)
      ON CONFLICT(id) DO NOTHING
    `).run(user)
}

export async function seedDatabase() {
    const recordCount = db.prepare('SELECT COUNT(*) AS total FROM collection_records').get().total
    if (recordCount === 0) replaceSnapshot(defaultData)

    const adminPassword = process.env.MAIKA_ADMIN_PASSWORD || '123456'
    const teacherPassword = process.env.MAIKA_TEACHER_PASSWORD || 'maika'

    ensureUser({
        id: 'admin-1',
        role: 'admin',
        display_name: 'Hiệu trưởng',
        phone: null,
        email: 'admin@maika.edu.vn',
        password_hash: await bcrypt.hash(adminPassword, 12),
        student_id: null,
    })

    ensureUser({
        id: 'teacher-1',
        role: 'teacher',
        display_name: 'Giáo viên',
        phone: null,
        email: 'teacher@maika.edu.vn',
        password_hash: await bcrypt.hash(teacherPassword, 12),
        student_id: null,
    })

    for (const student of defaultData.students) {
        if (!student.parentPhone) continue
        ensureUser({
            id: `parent-${student.id}`,
            role: 'parent',
            display_name: student.parentName || `Phụ huynh ${student.name}`,
            phone: student.parentPhone,
            email: student.parentEmail || null,
            password_hash: null,
            student_id: student.id,
        })
    }
}
