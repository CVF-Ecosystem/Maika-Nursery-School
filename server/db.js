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

  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'parent')),
    display_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    password_hash TEXT,
    student_id TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'locked')),
    must_change_password INTEGER NOT NULL DEFAULT 0,
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

  CREATE INDEX IF NOT EXISTS idx_collection_records_collection ON collection_records(collection);

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

const SCHEMA_MIGRATIONS = [
    {
        version: 1,
        name: 'add_status_must_change_password_to_users',
        statements: [
            "ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'locked'))",
            "ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0",
        ],
    },
    {
        version: 2,
        name: 'add_health_records_incidents_invoices',
        statements: [`
          CREATE TABLE IF NOT EXISTS health_records (
            id TEXT PRIMARY KEY,
            student_id TEXT NOT NULL,
            allergies TEXT,
            medications TEXT,
            medical_notes TEXT,
            emergency_contact_name TEXT,
            emergency_contact_phone TEXT,
            emergency_contact_relation TEXT,
            blood_type TEXT,
            doctor_name TEXT,
            doctor_phone TEXT,
            updated_by TEXT,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `, `
          CREATE TABLE IF NOT EXISTS incidents (
            id TEXT PRIMARY KEY,
            student_id TEXT NOT NULL,
            occurred_at TEXT NOT NULL,
            reported_by TEXT,
            reporter_name TEXT,
            severity TEXT NOT NULL DEFAULT 'minor' CHECK (severity IN ('minor', 'moderate', 'severe')),
            description TEXT NOT NULL,
            initial_action TEXT,
            status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('draft', 'open', 'resolved', 'parent_acknowledged')),
            confirmed_by TEXT,
            confirmed_at TEXT,
            parent_acknowledged_at TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `, `
          CREATE INDEX IF NOT EXISTS idx_incidents_student ON incidents(student_id)
        `, `
          CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status)
        `, `
          CREATE INDEX IF NOT EXISTS idx_incidents_occurred ON incidents(occurred_at DESC)
        `, `
          CREATE TABLE IF NOT EXISTS invoices (
            id TEXT PRIMARY KEY,
            student_id TEXT NOT NULL,
            invoice_number TEXT NOT NULL UNIQUE,
            type TEXT NOT NULL DEFAULT 'tuition' CHECK (type IN ('tuition', 'meal', 'material', 'activity', 'other')),
            description TEXT NOT NULL,
            amount INTEGER NOT NULL,
            due_date TEXT NOT NULL,
            paid_date TEXT,
            payment_method TEXT CHECK (payment_method IN ('cash', 'transfer', 'other', NULL)),
            status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
            notes TEXT,
            created_by TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `, `
          CREATE INDEX IF NOT EXISTS idx_invoices_student ON invoices(student_id)
        `, `
          CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)
        `, `
          CREATE INDEX IF NOT EXISTS idx_invoices_due ON invoices(due_date)
        `],
    },
]

for (const migration of SCHEMA_MIGRATIONS) {
    const applied = db.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(migration.version)
    if (!applied) {
        db.exec('BEGIN')
        try {
            for (const sql of migration.statements) {
                try { db.exec(sql) } catch { }
            }
            db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(migration.version, migration.name)
            db.exec('COMMIT')
        } catch (err) {
            db.exec('ROLLBACK')
            console.error(`Migration ${migration.version} failed:`, err.message)
        }
    }
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

// ─── Health Records ────────────────────────────────────────────────────────────

export function getHealthRecord(studentId) {
    return db.prepare('SELECT * FROM health_records WHERE student_id = ?').get(studentId) || null
}

export function upsertHealthRecord(studentId, input, actorId) {
    const existing = getHealthRecord(studentId)
    if (existing) {
        db.prepare(`
          UPDATE health_records
          SET allergies = @allergies, medications = @medications, medical_notes = @medical_notes,
              emergency_contact_name = @emergency_contact_name,
              emergency_contact_phone = @emergency_contact_phone,
              emergency_contact_relation = @emergency_contact_relation,
              blood_type = @blood_type, doctor_name = @doctor_name, doctor_phone = @doctor_phone,
              updated_by = @updated_by, updated_at = CURRENT_TIMESTAMP
          WHERE student_id = @student_id
        `).run({ student_id: studentId, updated_by: actorId || null, ...normalizeHealthInput(input) })
    } else {
        db.prepare(`
          INSERT INTO health_records (id, student_id, allergies, medications, medical_notes,
            emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
            blood_type, doctor_name, doctor_phone, updated_by)
          VALUES (@id, @student_id, @allergies, @medications, @medical_notes,
            @emergency_contact_name, @emergency_contact_phone, @emergency_contact_relation,
            @blood_type, @doctor_name, @doctor_phone, @updated_by)
        `).run({ id: `hr-${studentId}`, student_id: studentId, updated_by: actorId || null, ...normalizeHealthInput(input) })
    }
    return getHealthRecord(studentId)
}

function normalizeHealthInput(input) {
    return {
        allergies: input.allergies || null,
        medications: input.medications || null,
        medical_notes: input.medicalNotes || null,
        emergency_contact_name: input.emergencyContactName || null,
        emergency_contact_phone: input.emergencyContactPhone || null,
        emergency_contact_relation: input.emergencyContactRelation || null,
        blood_type: input.bloodType || null,
        doctor_name: input.doctorName || null,
        doctor_phone: input.doctorPhone || null,
    }
}

// ─── Incidents ─────────────────────────────────────────────────────────────────

export function listIncidents({ studentId, status, limit = 100 } = {}) {
    const clauses = []
    const params = {}
    if (studentId) { clauses.push('student_id = @studentId'); params.studentId = studentId }
    if (status) { clauses.push('status = @status'); params.status = status }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500)
    return db.prepare(`SELECT * FROM incidents ${where} ORDER BY occurred_at DESC LIMIT ${safeLimit}`).all(params)
}

export function getIncident(id) {
    return db.prepare('SELECT * FROM incidents WHERE id = ?').get(id) || null
}

export function createIncident(input, actorId, actorName) {
    const id = `inc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    db.prepare(`
      INSERT INTO incidents (id, student_id, occurred_at, reported_by, reporter_name,
        severity, description, initial_action, status)
      VALUES (@id, @student_id, @occurred_at, @reported_by, @reporter_name,
        @severity, @description, @initial_action, @status)
    `).run({
        id,
        student_id: input.studentId,
        occurred_at: input.occurredAt || new Date().toISOString(),
        reported_by: actorId || null,
        reporter_name: actorName || null,
        severity: input.severity || 'minor',
        description: input.description,
        initial_action: input.initialAction || null,
        status: input.status || 'open',
    })
    return getIncident(id)
}

export function updateIncident(id, input, actorId) {
    const existing = getIncident(id)
    if (!existing) return null
    db.prepare(`
      UPDATE incidents
      SET severity = @severity, description = @description, initial_action = @initial_action,
          status = @status, confirmed_by = @confirmed_by, confirmed_at = @confirmed_at,
          parent_acknowledged_at = @parent_acknowledged_at, updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run({
        id,
        severity: input.severity || existing.severity,
        description: input.description || existing.description,
        initial_action: input.initialAction !== undefined ? input.initialAction : existing.initial_action,
        status: input.status || existing.status,
        confirmed_by: input.confirmedBy !== undefined ? input.confirmedBy : existing.confirmed_by,
        confirmed_at: input.confirmedAt !== undefined ? input.confirmedAt : existing.confirmed_at,
        parent_acknowledged_at: input.parentAcknowledgedAt !== undefined ? input.parentAcknowledgedAt : existing.parent_acknowledged_at,
    })
    return getIncident(id)
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

let _invoiceSeq = 0

function nextInvoiceNumber() {
    const prefix = `INV${new Date().toISOString().slice(0, 7).replace('-', '')}`
    _invoiceSeq++
    return `${prefix}-${String(_invoiceSeq).padStart(4, '0')}`
}

export function listInvoices({ studentId, status, limit = 200 } = {}) {
    const clauses = []
    const params = {}
    if (studentId) { clauses.push('student_id = @studentId'); params.studentId = studentId }
    if (status) { clauses.push('status = @status'); params.status = status }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 1000)
    return db.prepare(`SELECT * FROM invoices ${where} ORDER BY due_date DESC LIMIT ${safeLimit}`).all(params)
}

export function getInvoice(id) {
    return db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) || null
}

export function createInvoice(input, actorId) {
    const id = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const invoiceNumber = input.invoiceNumber || nextInvoiceNumber()
    db.prepare(`
      INSERT INTO invoices (id, student_id, invoice_number, type, description, amount,
        due_date, status, notes, created_by)
      VALUES (@id, @student_id, @invoice_number, @type, @description, @amount,
        @due_date, @status, @notes, @created_by)
    `).run({
        id,
        student_id: input.studentId,
        invoice_number: invoiceNumber,
        type: input.type || 'tuition',
        description: input.description,
        amount: Math.round(Number(input.amount) || 0),
        due_date: input.dueDate,
        status: input.status || 'pending',
        notes: input.notes || null,
        created_by: actorId || null,
    })
    return getInvoice(id)
}

export function updateInvoice(id, input) {
    const existing = getInvoice(id)
    if (!existing) return null
    db.prepare(`
      UPDATE invoices
      SET status = @status, paid_date = @paid_date, payment_method = @payment_method,
          notes = @notes, description = @description, amount = @amount, due_date = @due_date,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run({
        id,
        status: input.status || existing.status,
        paid_date: input.paidDate !== undefined ? input.paidDate : existing.paid_date,
        payment_method: input.paymentMethod !== undefined ? input.paymentMethod : existing.payment_method,
        notes: input.notes !== undefined ? input.notes : existing.notes,
        description: input.description || existing.description,
        amount: input.amount !== undefined ? Math.round(Number(input.amount)) : existing.amount,
        due_date: input.dueDate || existing.due_date,
    })
    return getInvoice(id)
}

// ─── Schema info ───────────────────────────────────────────────────────────────

export function listMigrations() {
    return db.prepare('SELECT * FROM schema_migrations ORDER BY version').all()
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
