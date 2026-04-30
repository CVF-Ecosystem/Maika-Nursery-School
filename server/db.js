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
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'locked')),
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

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor_id TEXT,
    actor_role TEXT,
    actor_name TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    summary TEXT NOT NULL,
    metadata TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);
  CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
`)

for (const statement of [
    "ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'locked'))",
]) {
    try { db.exec(statement) } catch { }
}

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
        return db.prepare('SELECT * FROM users WHERE role = ? AND phone = ? AND status = ?').get(role, phone, 'active')
    }
    return db.prepare('SELECT * FROM users WHERE role = ? AND status = ? ORDER BY created_at LIMIT 1').get(role, 'active')
}

export function listUsers() {
    return db.prepare(`
      SELECT id, role, display_name, phone, email, student_id, status, created_at
      FROM users
      ORDER BY role, display_name
    `).all()
}

export function addAuditLog(entry) {
    const id = entry.id || `audit-${Date.now()}-${Math.random().toString(36).slice(2)}`
    db.prepare(`
      INSERT INTO audit_logs (
        id, actor_id, actor_role, actor_name, action, entity_type, entity_id,
        summary, metadata, ip_address, user_agent
      )
      VALUES (
        @id, @actor_id, @actor_role, @actor_name, @action, @entity_type, @entity_id,
        @summary, @metadata, @ip_address, @user_agent
      )
    `).run({
        id,
        actor_id: entry.actorId || null,
        actor_role: entry.actorRole || null,
        actor_name: entry.actorName || null,
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId || null,
        summary: entry.summary,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        ip_address: entry.ipAddress || null,
        user_agent: entry.userAgent || null,
    })
    return getAuditLog(id)
}

export function getAuditLog(id) {
    const row = db.prepare('SELECT * FROM audit_logs WHERE id = ?').get(id)
    if (!row) return null
    return { ...row, metadata: row.metadata ? JSON.parse(row.metadata) : null }
}

export function listAuditLogs({ limit = 100, action, entityType, actorId } = {}) {
    const clauses = []
    const params = {}

    if (action) {
        clauses.push('action = @action')
        params.action = action
    }
    if (entityType) {
        clauses.push('entity_type = @entityType')
        params.entityType = entityType
    }
    if (actorId) {
        clauses.push('actor_id = @actorId')
        params.actorId = actorId
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500)
    const rows = db.prepare(`
      SELECT * FROM audit_logs
      ${where}
      ORDER BY created_at DESC
      LIMIT ${safeLimit}
    `).all(params)

    return rows.map(row => ({ ...row, metadata: row.metadata ? JSON.parse(row.metadata) : null }))
}

export function getUser(id) {
    return db.prepare(`
      SELECT id, role, display_name, phone, email, student_id, status, created_at
      FROM users
      WHERE id = ?
    `).get(id)
}

export async function createUser(input) {
    const id = input.id || `${input.role}-${Date.now()}`
    const passwordHash = input.password ? await bcrypt.hash(input.password, 12) : null
    db.prepare(`
      INSERT INTO users (id, role, display_name, phone, email, password_hash, student_id, status)
      VALUES (@id, @role, @display_name, @phone, @email, @password_hash, @student_id, @status)
    `).run({
        id,
        role: input.role,
        display_name: input.displayName,
        phone: input.phone || null,
        email: input.email || null,
        password_hash: passwordHash,
        student_id: input.studentId || null,
        status: input.status || 'active',
    })
    return getUser(id)
}

export async function updateUser(id, input) {
    const current = findUserById(id)
    if (!current) return null
    const passwordHash = input.password ? await bcrypt.hash(input.password, 12) : current.password_hash
    db.prepare(`
      UPDATE users
      SET role = @role,
          display_name = @display_name,
          phone = @phone,
          email = @email,
          password_hash = @password_hash,
          student_id = @student_id,
          status = @status
      WHERE id = @id
    `).run({
        id,
        role: input.role || current.role,
        display_name: input.displayName || current.display_name,
        phone: input.phone ?? current.phone,
        email: input.email ?? current.email,
        password_hash: passwordHash,
        student_id: input.studentId ?? current.student_id,
        status: input.status || current.status || 'active',
    })
    return getUser(id)
}

function ensureUser(user) {
    db.prepare(`
      INSERT INTO users (id, role, display_name, phone, email, password_hash, student_id, status)
      VALUES (@id, @role, @display_name, @phone, @email, @password_hash, @student_id, @status)
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
        status: 'active',
    })

    ensureUser({
        id: 'teacher-1',
        role: 'teacher',
        display_name: 'Giáo viên',
        phone: null,
        email: 'teacher@maika.edu.vn',
        password_hash: await bcrypt.hash(teacherPassword, 12),
        student_id: null,
        status: 'active',
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
            status: 'active',
        })
    }
}
