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
    {
        version: 3,
        name: 'add_school_settings_consents_academic_years',
        statements: [`
          CREATE TABLE IF NOT EXISTS school_settings (
            id INTEGER PRIMARY KEY DEFAULT 1,
            school_name TEXT NOT NULL DEFAULT 'Nhà Trẻ Maika',
            logo_url TEXT,
            address TEXT,
            phone TEXT,
            email TEXT,
            hours_open TEXT NOT NULL DEFAULT '07:00',
            hours_close TEXT NOT NULL DEFAULT '18:00',
            pickup_start TEXT NOT NULL DEFAULT '16:30',
            pickup_end TEXT NOT NULL DEFAULT '18:00',
            timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
            current_academic_year_id TEXT,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `, `
          INSERT OR IGNORE INTO school_settings (id) VALUES (1)
        `, `
          CREATE TABLE IF NOT EXISTS academic_years (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            is_current INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `, `
          CREATE TABLE IF NOT EXISTS school_holidays (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            date TEXT NOT NULL,
            is_recurring INTEGER NOT NULL DEFAULT 0,
            note TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `, `
          CREATE INDEX IF NOT EXISTS idx_holidays_date ON school_holidays(date)
        `, `
          CREATE TABLE IF NOT EXISTS tuition_plans (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            class_id TEXT,
            amount INTEGER NOT NULL,
            currency TEXT NOT NULL DEFAULT 'VND',
            billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'term', 'yearly')),
            description TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `, `
          CREATE TABLE IF NOT EXISTS student_consents (
            student_id TEXT PRIMARY KEY,
            allow_photos INTEGER NOT NULL DEFAULT 1,
            allow_notifications INTEGER NOT NULL DEFAULT 1,
            contact_channels TEXT NOT NULL DEFAULT '["app"]',
            allow_photo_sharing INTEGER NOT NULL DEFAULT 0,
            data_retention_days INTEGER NOT NULL DEFAULT 365,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_by TEXT
          )
        `],
    },
    {
        version: 4,
        name: 'add_notifications',
        statements: [`
          CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'general' CHECK (type IN ('general', 'invoice', 'event', 'health', 'incident', 'emergency', 'system')),
            priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
            target_role TEXT,
            target_class_id TEXT,
            target_student_id TEXT,
            channel TEXT NOT NULL DEFAULT 'app' CHECK (channel IN ('app', 'email', 'sms', 'zalo', 'all')),
            status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent', 'failed', 'cancelled')),
            scheduled_at TEXT,
            sent_at TEXT,
            created_by TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `, `
          CREATE INDEX IF NOT EXISTS idx_notif_status ON notifications(status)
        `, `
          CREATE INDEX IF NOT EXISTS idx_notif_target_role ON notifications(target_role)
        `, `
          CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications(created_at DESC)
        `, `
          CREATE TABLE IF NOT EXISTS notification_reads (
            notification_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            read_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (notification_id, user_id)
          )
        `, `
          CREATE INDEX IF NOT EXISTS idx_notif_reads_user ON notification_reads(user_id)
        `],
    },
    {
        version: 5,
        name: 'add_attendance_advanced',
        statements: [`
          CREATE TABLE IF NOT EXISTS attendance_records (
            id TEXT PRIMARY KEY,
            student_id TEXT NOT NULL,
            date TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'early_pickup')),
            check_in_time TEXT,
            check_out_time TEXT,
            pickup_person TEXT,
            pickup_phone TEXT,
            late_reason TEXT,
            early_pickup_reason TEXT,
            note TEXT,
            recorded_by TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(student_id, date)
          )
        `, `
          CREATE INDEX IF NOT EXISTS idx_att_student ON attendance_records(student_id)
        `, `
          CREATE INDEX IF NOT EXISTS idx_att_date ON attendance_records(date DESC)
        `, `
          CREATE INDEX IF NOT EXISTS idx_att_status ON attendance_records(status)
        `],
    },
    {
        version: 6,
        name: 'add_meal_menus_and_media',
        statements: [`
          CREATE TABLE IF NOT EXISTS meal_menus (
            id TEXT PRIMARY KEY,
            week_start TEXT NOT NULL,
            day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
            meal_type TEXT NOT NULL DEFAULT 'lunch' CHECK (meal_type IN ('breakfast', 'lunch', 'snack')),
            dishes TEXT NOT NULL DEFAULT '[]',
            ingredients TEXT,
            allergen_notes TEXT,
            is_published INTEGER NOT NULL DEFAULT 0,
            created_by TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(week_start, day_of_week, meal_type)
          )
        `, `
          CREATE INDEX IF NOT EXISTS idx_menu_week ON meal_menus(week_start)
        `, `
          CREATE TABLE IF NOT EXISTS media_albums (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            class_id TEXT,
            status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
            cover_asset_id TEXT,
            created_by TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `, `
          CREATE TABLE IF NOT EXISTS media_assets (
            id TEXT PRIMARY KEY,
            album_id TEXT,
            original_name TEXT NOT NULL,
            stored_name TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            size INTEGER NOT NULL,
            path TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
            class_id TEXT,
            caption TEXT,
            expires_at TEXT,
            uploaded_by TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `, `
          CREATE INDEX IF NOT EXISTS idx_media_album ON media_assets(album_id)
        `, `
          CREATE INDEX IF NOT EXISTS idx_media_status ON media_assets(status)
        `, `
          CREATE TABLE IF NOT EXISTS media_asset_students (
            asset_id TEXT NOT NULL,
            student_id TEXT NOT NULL,
            PRIMARY KEY (asset_id, student_id)
          )
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
    const mustChangePassword = input.mustChangePassword !== undefined ? input.mustChangePassword : current.must_change_password
    db.prepare(`
      UPDATE users
      SET role = @role,
          display_name = @display_name,
          phone = @phone,
          email = @email,
          password_hash = @password_hash,
          student_id = @student_id,
          status = @status,
          must_change_password = @must_change_password
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
        must_change_password: mustChangePassword ?? 0,
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

// ─── School Settings ──────────────────────────────────────────────────────────

export function getSchoolSettings() {
    return db.prepare('SELECT * FROM school_settings WHERE id = 1').get() || null
}

export function updateSchoolSettings(input) {
    const cur = getSchoolSettings()
    db.prepare(`
      UPDATE school_settings SET
        school_name = @school_name, logo_url = @logo_url, address = @address,
        phone = @phone, email = @email,
        hours_open = @hours_open, hours_close = @hours_close,
        pickup_start = @pickup_start, pickup_end = @pickup_end,
        timezone = @timezone, current_academic_year_id = @current_academic_year_id,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run({
        school_name: input.schoolName ?? cur.school_name,
        logo_url: input.logoUrl !== undefined ? input.logoUrl : cur.logo_url,
        address: input.address !== undefined ? input.address : cur.address,
        phone: input.phone !== undefined ? input.phone : cur.phone,
        email: input.email !== undefined ? input.email : cur.email,
        hours_open: input.hoursOpen ?? cur.hours_open,
        hours_close: input.hoursClose ?? cur.hours_close,
        pickup_start: input.pickupStart ?? cur.pickup_start,
        pickup_end: input.pickupEnd ?? cur.pickup_end,
        timezone: input.timezone ?? cur.timezone,
        current_academic_year_id: input.currentAcademicYearId !== undefined ? input.currentAcademicYearId : cur.current_academic_year_id,
    })
    return getSchoolSettings()
}

// ─── Academic Years ───────────────────────────────────────────────────────────

export function listAcademicYears() {
    return db.prepare('SELECT * FROM academic_years ORDER BY start_date DESC').all()
}

export function getAcademicYear(id) {
    return db.prepare('SELECT * FROM academic_years WHERE id = ?').get(id) || null
}

export function createAcademicYear(input) {
    const id = `ay-${Date.now()}`
    if (input.isCurrent) {
        db.prepare('UPDATE academic_years SET is_current = 0').run()
    }
    db.prepare(`
      INSERT INTO academic_years (id, name, start_date, end_date, is_current)
      VALUES (@id, @name, @start_date, @end_date, @is_current)
    `).run({
        id,
        name: input.name,
        start_date: input.startDate,
        end_date: input.endDate,
        is_current: input.isCurrent ? 1 : 0,
    })
    return getAcademicYear(id)
}

export function updateAcademicYear(id, input) {
    const existing = getAcademicYear(id)
    if (!existing) return null
    if (input.isCurrent) {
        db.prepare('UPDATE academic_years SET is_current = 0').run()
    }
    db.prepare(`
      UPDATE academic_years
      SET name = @name, start_date = @start_date, end_date = @end_date, is_current = @is_current
      WHERE id = @id
    `).run({
        id,
        name: input.name ?? existing.name,
        start_date: input.startDate ?? existing.start_date,
        end_date: input.endDate ?? existing.end_date,
        is_current: input.isCurrent !== undefined ? (input.isCurrent ? 1 : 0) : existing.is_current,
    })
    return getAcademicYear(id)
}

// ─── School Holidays ──────────────────────────────────────────────────────────

export function listSchoolHolidays() {
    return db.prepare('SELECT * FROM school_holidays ORDER BY date').all()
}

export function createSchoolHoliday(input) {
    const id = `hol-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
    db.prepare(`
      INSERT INTO school_holidays (id, name, date, is_recurring, note)
      VALUES (@id, @name, @date, @is_recurring, @note)
    `).run({
        id,
        name: input.name,
        date: input.date,
        is_recurring: input.isRecurring ? 1 : 0,
        note: input.note || null,
    })
    return db.prepare('SELECT * FROM school_holidays WHERE id = ?').get(id)
}

export function deleteSchoolHoliday(id) {
    return db.prepare('DELETE FROM school_holidays WHERE id = ?').run(id).changes > 0
}

// ─── Tuition Plans ────────────────────────────────────────────────────────────

export function listTuitionPlans({ activeOnly = false } = {}) {
    const where = activeOnly ? 'WHERE is_active = 1' : ''
    return db.prepare(`SELECT * FROM tuition_plans ${where} ORDER BY name`).all()
}

export function getTuitionPlan(id) {
    return db.prepare('SELECT * FROM tuition_plans WHERE id = ?').get(id) || null
}

export function createTuitionPlan(input) {
    const id = `tp-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
    db.prepare(`
      INSERT INTO tuition_plans (id, name, class_id, amount, currency, billing_cycle, description, is_active)
      VALUES (@id, @name, @class_id, @amount, @currency, @billing_cycle, @description, @is_active)
    `).run({
        id,
        name: input.name,
        class_id: input.classId || null,
        amount: Math.round(Number(input.amount) || 0),
        currency: input.currency || 'VND',
        billing_cycle: input.billingCycle || 'monthly',
        description: input.description || null,
        is_active: input.isActive !== false ? 1 : 0,
    })
    return getTuitionPlan(id)
}

export function updateTuitionPlan(id, input) {
    const existing = getTuitionPlan(id)
    if (!existing) return null
    db.prepare(`
      UPDATE tuition_plans
      SET name = @name, class_id = @class_id, amount = @amount, currency = @currency,
          billing_cycle = @billing_cycle, description = @description, is_active = @is_active
      WHERE id = @id
    `).run({
        id,
        name: input.name ?? existing.name,
        class_id: input.classId !== undefined ? (input.classId || null) : existing.class_id,
        amount: input.amount !== undefined ? Math.round(Number(input.amount)) : existing.amount,
        currency: input.currency ?? existing.currency,
        billing_cycle: input.billingCycle ?? existing.billing_cycle,
        description: input.description !== undefined ? input.description : existing.description,
        is_active: input.isActive !== undefined ? (input.isActive ? 1 : 0) : existing.is_active,
    })
    return getTuitionPlan(id)
}

// ─── Student Consents ─────────────────────────────────────────────────────────

export function getStudentConsent(studentId) {
    return db.prepare('SELECT * FROM student_consents WHERE student_id = ?').get(studentId) || null
}

export function upsertStudentConsent(studentId, input, actorId) {
    const existing = getStudentConsent(studentId)
    const channels = Array.isArray(input.contactChannels)
        ? JSON.stringify(input.contactChannels)
        : (existing?.contact_channels ?? '["app"]')

    if (existing) {
        db.prepare(`
          UPDATE student_consents
          SET allow_photos = @allow_photos, allow_notifications = @allow_notifications,
              contact_channels = @contact_channels, allow_photo_sharing = @allow_photo_sharing,
              data_retention_days = @data_retention_days,
              updated_at = CURRENT_TIMESTAMP, updated_by = @updated_by
          WHERE student_id = @student_id
        `).run({
            student_id: studentId,
            allow_photos: input.allowPhotos !== undefined ? (input.allowPhotos ? 1 : 0) : existing.allow_photos,
            allow_notifications: input.allowNotifications !== undefined ? (input.allowNotifications ? 1 : 0) : existing.allow_notifications,
            contact_channels: channels,
            allow_photo_sharing: input.allowPhotoSharing !== undefined ? (input.allowPhotoSharing ? 1 : 0) : existing.allow_photo_sharing,
            data_retention_days: input.dataRetentionDays !== undefined ? Number(input.dataRetentionDays) : existing.data_retention_days,
            updated_by: actorId || null,
        })
    } else {
        db.prepare(`
          INSERT INTO student_consents
            (student_id, allow_photos, allow_notifications, contact_channels, allow_photo_sharing, data_retention_days, updated_by)
          VALUES (@student_id, @allow_photos, @allow_notifications, @contact_channels, @allow_photo_sharing, @data_retention_days, @updated_by)
        `).run({
            student_id: studentId,
            allow_photos: input.allowPhotos !== false ? 1 : 0,
            allow_notifications: input.allowNotifications !== false ? 1 : 0,
            contact_channels: channels,
            allow_photo_sharing: input.allowPhotoSharing ? 1 : 0,
            data_retention_days: Number(input.dataRetentionDays) || 365,
            updated_by: actorId || null,
        })
    }
    const row = getStudentConsent(studentId)
    return { ...row, contact_channels: JSON.parse(row.contact_channels || '["app"]') }
}

// ─── Meal Menus ───────────────────────────────────────────────────────────────

export function listMealMenus({ weekStart, published = false } = {}) {
    const clauses = []
    const params = {}
    if (weekStart) { clauses.push('week_start = @weekStart'); params.weekStart = weekStart }
    if (published) { clauses.push('is_published = 1'); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const rows = db.prepare(`SELECT * FROM meal_menus ${where} ORDER BY week_start DESC, day_of_week, meal_type`).all(params)
    return rows.map(r => ({ ...r, dishes: JSON.parse(r.dishes || '[]') }))
}

export function upsertMealMenu(input, actorId) {
    const existing = db.prepare('SELECT id FROM meal_menus WHERE week_start = ? AND day_of_week = ? AND meal_type = ?').get(input.weekStart, input.dayOfWeek, input.mealType)
    const id = existing?.id || `menu-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
    db.prepare(`
      INSERT INTO meal_menus (id, week_start, day_of_week, meal_type, dishes, ingredients, allergen_notes, is_published, created_by)
      VALUES (@id, @week_start, @day_of_week, @meal_type, @dishes, @ingredients, @allergen_notes, @is_published, @created_by)
      ON CONFLICT(week_start, day_of_week, meal_type) DO UPDATE SET
        dishes = excluded.dishes, ingredients = excluded.ingredients,
        allergen_notes = excluded.allergen_notes, is_published = excluded.is_published,
        updated_at = CURRENT_TIMESTAMP
    `).run({
        id,
        week_start: input.weekStart,
        day_of_week: Number(input.dayOfWeek),
        meal_type: input.mealType || 'lunch',
        dishes: JSON.stringify(Array.isArray(input.dishes) ? input.dishes : []),
        ingredients: input.ingredients || null,
        allergen_notes: input.allergenNotes || null,
        is_published: input.isPublished ? 1 : 0,
        created_by: actorId || null,
    })
    const row = db.prepare('SELECT * FROM meal_menus WHERE id = ?').get(id)
    return row ? { ...row, dishes: JSON.parse(row.dishes || '[]') } : null
}

// ─── Media Assets ─────────────────────────────────────────────────────────────

export function listMediaAlbums({ status, classId } = {}) {
    const clauses = []
    const params = {}
    if (status) { clauses.push('status = @status'); params.status = status }
    if (classId) { clauses.push('class_id = @classId'); params.classId = classId }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    return db.prepare(`SELECT * FROM media_albums ${where} ORDER BY created_at DESC`).all(params)
}

export function getMediaAlbum(id) {
    return db.prepare('SELECT * FROM media_albums WHERE id = ?').get(id) || null
}

export function createMediaAlbum(input, actorId) {
    const id = `album-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
    db.prepare(`
      INSERT INTO media_albums (id, title, description, class_id, status, created_by)
      VALUES (@id, @title, @description, @class_id, @status, @created_by)
    `).run({ id, title: input.title, description: input.description || null, class_id: input.classId || null, status: input.status || 'draft', created_by: actorId || null })
    return getMediaAlbum(id)
}

export function updateMediaAlbum(id, input) {
    const existing = getMediaAlbum(id)
    if (!existing) return null
    db.prepare(`
      UPDATE media_albums SET title = @title, description = @description, class_id = @class_id, status = @status WHERE id = @id
    `).run({ id, title: input.title ?? existing.title, description: input.description !== undefined ? input.description : existing.description, class_id: input.classId !== undefined ? input.classId : existing.class_id, status: input.status ?? existing.status })
    return getMediaAlbum(id)
}

export function listMediaAssets({ albumId, status, classId, forParent = false } = {}) {
    const clauses = []
    const params = {}
    if (albumId) { clauses.push('album_id = @albumId'); params.albumId = albumId }
    if (status) { clauses.push('status = @status'); params.status = status }
    if (classId) { clauses.push('class_id = @classId'); params.classId = classId }
    if (forParent) { clauses.push("status = 'published'"); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    return db.prepare(`SELECT * FROM media_assets ${where} ORDER BY created_at DESC LIMIT 200`).all(params)
}

export function getMediaAsset(id) {
    return db.prepare('SELECT * FROM media_assets WHERE id = ?').get(id) || null
}

export function createMediaAsset(input, actorId) {
    const id = `asset-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
    const expiresAt = input.retentionDays ? new Date(Date.now() + input.retentionDays * 86400000).toISOString() : null
    db.prepare(`
      INSERT INTO media_assets (id, album_id, original_name, stored_name, mime_type, size, path, status, class_id, caption, expires_at, uploaded_by)
      VALUES (@id, @album_id, @original_name, @stored_name, @mime_type, @size, @path, @status, @class_id, @caption, @expires_at, @uploaded_by)
    `).run({
        id,
        album_id: input.albumId || null,
        original_name: input.originalName,
        stored_name: input.storedName,
        mime_type: input.mimeType,
        size: input.size,
        path: input.path,
        status: input.status || 'draft',
        class_id: input.classId || null,
        caption: input.caption || null,
        expires_at: expiresAt,
        uploaded_by: actorId || null,
    })
    return getMediaAsset(id)
}

export function updateMediaAsset(id, input) {
    const existing = getMediaAsset(id)
    if (!existing) return null
    db.prepare(`
      UPDATE media_assets
      SET status = @status, caption = @caption, class_id = @class_id, album_id = @album_id
      WHERE id = @id
    `).run({
        id,
        status: input.status ?? existing.status,
        caption: input.caption !== undefined ? input.caption : existing.caption,
        class_id: input.classId !== undefined ? input.classId : existing.class_id,
        album_id: input.albumId !== undefined ? input.albumId : existing.album_id,
    })
    return getMediaAsset(id)
}

// ─── Attendance (Advanced) ────────────────────────────────────────────────────

export function listAttendanceRecords({ date, studentId, classId, limit = 200 } = {}) {
    const clauses = []
    const params = {}
    if (date) { clauses.push('date = @date'); params.date = date }
    if (studentId) { clauses.push('student_id = @studentId'); params.studentId = studentId }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 1000)
    return db.prepare(`SELECT * FROM attendance_records ${where} ORDER BY date DESC, created_at DESC LIMIT ${safeLimit}`).all(params)
}

export function getAttendanceRecord(studentId, date) {
    return db.prepare('SELECT * FROM attendance_records WHERE student_id = ? AND date = ?').get(studentId, date) || null
}

export function upsertAttendanceRecord(input, actorId) {
    const existing = getAttendanceRecord(input.studentId, input.date)
    const id = existing ? existing.id : `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    db.prepare(`
      INSERT INTO attendance_records
        (id, student_id, date, status, check_in_time, check_out_time, pickup_person, pickup_phone, late_reason, early_pickup_reason, note, recorded_by)
      VALUES
        (@id, @student_id, @date, @status, @check_in_time, @check_out_time, @pickup_person, @pickup_phone, @late_reason, @early_pickup_reason, @note, @recorded_by)
      ON CONFLICT(student_id, date) DO UPDATE SET
        status = excluded.status,
        check_in_time = excluded.check_in_time,
        check_out_time = excluded.check_out_time,
        pickup_person = excluded.pickup_person,
        pickup_phone = excluded.pickup_phone,
        late_reason = excluded.late_reason,
        early_pickup_reason = excluded.early_pickup_reason,
        note = excluded.note,
        recorded_by = excluded.recorded_by,
        updated_at = CURRENT_TIMESTAMP
    `).run({
        id,
        student_id: input.studentId,
        date: input.date,
        status: input.status || 'present',
        check_in_time: input.checkInTime || null,
        check_out_time: input.checkOutTime || null,
        pickup_person: input.pickupPerson || null,
        pickup_phone: input.pickupPhone || null,
        late_reason: input.lateReason || null,
        early_pickup_reason: input.earlyPickupReason || null,
        note: input.note || null,
        recorded_by: actorId || null,
    })
    return getAttendanceRecord(input.studentId, input.date)
}

export function getAttendanceSummary(date) {
    return db.prepare(`
      SELECT status, COUNT(*) as count
      FROM attendance_records
      WHERE date = ?
      GROUP BY status
    `).all(date)
}

// ─── Notifications ────────────────────────────────────────────────────────────

export function listNotifications({ status, type, targetRole, limit = 100 } = {}) {
    const clauses = []
    const params = {}
    if (status) { clauses.push('status = @status'); params.status = status }
    if (type) { clauses.push('type = @type'); params.type = type }
    if (targetRole) { clauses.push("(target_role IS NULL OR target_role = @targetRole OR target_role = 'all')"); params.targetRole = targetRole }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500)
    return db.prepare(`SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT ${safeLimit}`).all(params)
}

export function getNotification(id) {
    return db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) || null
}

export function createNotification(input, actorId) {
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    db.prepare(`
      INSERT INTO notifications (id, title, body, type, priority, target_role, target_class_id, target_student_id, channel, status, scheduled_at, created_by)
      VALUES (@id, @title, @body, @type, @priority, @target_role, @target_class_id, @target_student_id, @channel, @status, @scheduled_at, @created_by)
    `).run({
        id,
        title: input.title,
        body: input.body,
        type: input.type || 'general',
        priority: input.priority || 'normal',
        target_role: input.targetRole || null,
        target_class_id: input.targetClassId || null,
        target_student_id: input.targetStudentId || null,
        channel: input.channel || 'app',
        status: input.status || 'draft',
        scheduled_at: input.scheduledAt || null,
        created_by: actorId || null,
    })
    return getNotification(id)
}

export function updateNotification(id, input) {
    const existing = getNotification(id)
    if (!existing) return null
    db.prepare(`
      UPDATE notifications
      SET title = @title, body = @body, type = @type, priority = @priority,
          target_role = @target_role, target_class_id = @target_class_id,
          target_student_id = @target_student_id, channel = @channel,
          status = @status, scheduled_at = @scheduled_at, sent_at = @sent_at,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run({
        id,
        title: input.title ?? existing.title,
        body: input.body ?? existing.body,
        type: input.type ?? existing.type,
        priority: input.priority ?? existing.priority,
        target_role: input.targetRole !== undefined ? input.targetRole : existing.target_role,
        target_class_id: input.targetClassId !== undefined ? input.targetClassId : existing.target_class_id,
        target_student_id: input.targetStudentId !== undefined ? input.targetStudentId : existing.target_student_id,
        channel: input.channel ?? existing.channel,
        status: input.status ?? existing.status,
        scheduled_at: input.scheduledAt !== undefined ? input.scheduledAt : existing.scheduled_at,
        sent_at: input.sentAt !== undefined ? input.sentAt : existing.sent_at,
    })
    return getNotification(id)
}

export function markNotificationRead(notificationId, userId) {
    db.prepare(`
      INSERT OR IGNORE INTO notification_reads (notification_id, user_id)
      VALUES (?, ?)
    `).run(notificationId, userId)
}

export function getUnreadCount(userId) {
    const row = db.prepare(`
      SELECT COUNT(*) AS cnt FROM notifications n
      WHERE n.status = 'sent'
        AND NOT EXISTS (SELECT 1 FROM notification_reads r WHERE r.notification_id = n.id AND r.user_id = ?)
    `).get(userId)
    return row?.cnt || 0
}

export function listNotificationsForUser(userId, { studentId, classId } = {}) {
    const rows = db.prepare(`
      SELECT n.*,
        CASE WHEN r.notification_id IS NOT NULL THEN 1 ELSE 0 END AS is_read
      FROM notifications n
      LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = ?
      WHERE n.status = 'sent'
        AND (
          n.target_role IS NULL
          OR n.target_student_id = ?
          OR n.target_class_id = ?
        )
      ORDER BY n.created_at DESC
      LIMIT 100
    `).all(userId, studentId || '', classId || '')
    return rows
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

    for (const student of readCollection('students')) {
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
