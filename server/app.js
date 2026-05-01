import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import bcrypt from 'bcryptjs'
import multer from 'multer'
import rateLimit from 'express-rate-limit'
import { accessSync, constants, existsSync, mkdirSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { BACKUP_DIR, createBackup, getBackupPath, listBackups, restoreBackup } from './backup.js'
import {
    addAuditLog,
    createAcademicYear,
    createIncident,
    createInvoice,
    createMediaAlbum,
    createMediaAsset,
    createNotification,
    createSchoolHoliday,
    createTuitionPlan,
    createUser,
    db,
    deleteRecord,
    deleteSchoolHoliday,
    findUserForLogin,
    getAcademicYear,
    getAttendanceRecord,
    getAttendanceSummary,
    getHealthRecord,
    getIncident,
    getInvoice,
    getMediaAlbum,
    getMediaAsset,
    getNotification,
    getSchoolSettings,
    getStudentConsent,
    getTuitionPlan,
    getUnreadCount,
    getUser,
    listAcademicYears,
    listAttendanceRecords,
    listAuditLogs,
    listCollections,
    listIncidents,
    listInvoices,
    listMealMenus,
    listMediaAlbums,
    listMediaAssets,
    listMigrations,
    listNotifications,
    listNotificationsForUser,
    listSchoolHolidays,
    listTuitionPlans,
    listUsers,
    markNotificationRead,
    readCollection,
    readRecord,
    readSnapshot,
    replaceSnapshot,
    seedDatabase,
    updateAcademicYear,
    updateIncident,
    updateInvoice,
    updateMediaAlbum,
    updateMediaAsset,
    updateNotification,
    updateSchoolSettings,
    updateTuitionPlan,
    updateUser,
    upsertAttendanceRecord,
    upsertHealthRecord,
    upsertMealMenu,
    upsertRecord,
    upsertStudentConsent,
} from './db.js'
import { dispatchNotification } from './notificationAdapters.js'
import { publicUser, requireAuth, requireRoles, signToken } from './auth.js'
import { schedulerState } from './scheduler.js'

const COLLECTION_ROUTE_MAP = {
    students: 'students',
    teachers: 'teachers',
    classes: 'classes',
    attendance: 'attendance',
    finance: 'finance',
    messages: 'messages',
    events: 'events',
    'daily-reports': 'dailyReports',
    resources: 'resources',
    badges: 'badges',
}

const UPLOAD_DIR = resolve(process.env.MAIKA_UPLOAD_DIR || 'server/uploads')
mkdirSync(UPLOAD_DIR, { recursive: true })

function getSupabaseAdminClient() {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_KEY
    if (!url || !serviceKey) return null
    return createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    })
}

const upload = multer({
    storage: multer.diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
            const safeExt = extname(file.originalname).toLowerCase() || '.bin'
            cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${safeExt}`)
        },
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
})

function routeToCollection(route) {
    return COLLECTION_ROUTE_MAP[route]
}

function filterCollectionForUser(collection, records, user) {
    if (user.role !== 'parent') return records

    const studentId = user.student_id
    if (collection === 'students') return records.filter(record => record.id === studentId)
    if (collection === 'classes') {
        const student = readRecord('students', studentId)
        return records.filter(record => record.id === student?.classId)
    }
    if (['attendance', 'dailyReports', 'finance', 'badges'].includes(collection)) {
        return records.filter(record => record.studentId === studentId)
    }
    if (collection === 'messages') {
        return records.filter(record => record.studentId === studentId || record.broadcast)
    }
    return []
}

function filterSnapshotForUser(snapshot, user) {
    if (user.role !== 'parent') return snapshot
    return Object.fromEntries(
        Object.entries(snapshot).map(([collection, records]) => [collection, filterCollectionForUser(collection, records, user)])
    )
}

function assertCanWrite(req, res, next) {
    if (['admin', 'teacher'].includes(req.user.role)) return next()
    if (req.user.role === 'parent' && req.params.collection === 'messages' && req.method === 'POST') return next()
    return res.status(403).json({ error: 'Forbidden' })
}

function requestMeta(req) {
    return {
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || null,
    }
}

function auditFromRequest(req, entry) {
    return addAuditLog({
        actorId: req.user?.id,
        actorRole: req.user?.role,
        actorName: req.user?.display_name,
        ...requestMeta(req),
        ...entry,
    })
}

function supabasePublicUser(profile) {
    return {
        id: profile.id,
        role: profile.role,
        facilityId: profile.facility_id || '',
        fullName: profile.full_name || '',
        phone: profile.phone || '',
        email: profile.email || '',
        isActive: profile.is_active,
        status: profile.is_active ? 'active' : 'locked',
        createdAt: profile.created_at,
    }
}

async function requireSupabaseAdmin(req, res, next) {
    const supabaseAdmin = getSupabaseAdminClient()
    if (!supabaseAdmin) {
        return res.status(503).json({ error: 'Chưa cấu hình API quản trị Supabase.' })
    }

    const header = req.get('authorization') || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!token) return res.status(401).json({ error: 'Missing bearer token' })

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !userData.user) return res.status(401).json({ error: 'Invalid or expired token' })

    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id, role, full_name, is_active')
        .eq('id', userData.user.id)
        .single()
    if (profileError || profile?.role !== 'admin' || !profile.is_active) {
        return res.status(403).json({ error: 'Forbidden' })
    }

    req.supabaseAdmin = supabaseAdmin
    req.supabaseActor = profile
    next()
}

export async function createApp() {
    await seedDatabase()

    const app = express()
    app.use(helmet({
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: { policy: 'cross-origin' },
    }))
    app.use(cors({ origin: process.env.MAIKA_CORS_ORIGIN?.split(',') || true }))
    app.use(express.json({ limit: '10mb' }))
    app.use('/uploads', express.static(UPLOAD_DIR))

    // Request logging with correlation id and duration
    app.use((req, _res, next) => {
        req.requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        req.startTime = Date.now()
        next()
    })
    app.use((req, res, next) => {
        res.on('finish', () => {
            const duration = Date.now() - req.startTime
            const actor = req.user ? `${req.user.role}:${req.user.id}` : 'anon'
            if (res.statusCode >= 400 || duration > 2000) {
                console.log(`[${req.requestId}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms actor=${actor}`)
            }
        })
        next()
    })

    // Rate limiting
    const loginLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 20,
        message: { error: 'Quá nhiều lần đăng nhập, thử lại sau 15 phút.' },
        standardHeaders: true,
        legacyHeaders: false,
    })
    const apiLimiter = rateLimit({
        windowMs: 60 * 1000,
        max: 300,
        message: { error: 'Quá nhiều yêu cầu, thử lại sau.' },
        standardHeaders: true,
        legacyHeaders: false,
    })
    const uploadLimiter = rateLimit({
        windowMs: 60 * 1000,
        max: 20,
        message: { error: 'Quá nhiều lần upload, thử lại sau.' },
        standardHeaders: true,
        legacyHeaders: false,
    })

    app.use('/api/v1', (req, res, next) => {
        const versionedUrl = req.url
        req.url = `/api${versionedUrl}`
        req.originalUrl = `/api${versionedUrl}`
        app.handle(req, res, next)
    })
    app.use('/api/', apiLimiter)

    app.get('/api/health', (_req, res) => {
        function dirWritable(dir) {
            try { accessSync(dir, constants.W_OK); return true } catch { return false }
        }
        let dbOk = false
        try { db.prepare('SELECT 1').get(); dbOk = true } catch { /* ignore */ }

        const checks = {
            db: dbOk,
            uploadDir: dirWritable(UPLOAD_DIR),
            backupDir: dirWritable(BACKUP_DIR),
            scheduler: schedulerState,
            collections: listCollections(),
        }
        const ok = checks.db && checks.uploadDir
        res.status(ok ? 200 : 503).json({ ok, ...checks })
    })

    app.get('/api/ready', (_req, res) => {
        let dbOk = false
        try { db.prepare('SELECT 1').get(); dbOk = true } catch { /* ignore */ }
        if (dbOk) return res.json({ ready: true })
        res.status(503).json({ ready: false, reason: 'db not ready' })
    })

    app.post('/api/auth/login', loginLimiter, async (req, res) => {
        const role = req.body?.role
        if (!['admin', 'teacher', 'parent'].includes(role)) return res.status(400).json({ error: 'Role không hợp lệ.' })

        const user = findUserForLogin({ role, phone: String(req.body?.phone || '').trim() })
        if (!user) {
            addAuditLog({
                action: 'login_failed',
                entityType: 'auth',
                summary: `Đăng nhập thất bại cho vai trò ${role}`,
                metadata: { role, phone: req.body?.phone ? String(req.body.phone) : null },
                ...requestMeta(req),
            })
            return res.status(401).json({ error: 'Không tìm thấy tài khoản.' })
        }

        if (role !== 'parent') {
            const ok = await bcrypt.compare(String(req.body?.password || ''), user.password_hash || '')
            if (!ok) {
                addAuditLog({
                    actorId: user.id,
                    actorRole: user.role,
                    actorName: user.display_name,
                    action: 'login_failed',
                    entityType: 'auth',
                    entityId: user.id,
                    summary: `Sai mật khẩu: ${user.display_name}`,
                    ...requestMeta(req),
                })
                return res.status(401).json({ error: 'Mật khẩu không đúng.' })
            }
        }

        addAuditLog({
            actorId: user.id,
            actorRole: user.role,
            actorName: user.display_name,
            action: 'login_success',
            entityType: 'auth',
            entityId: user.id,
            summary: `Đăng nhập thành công: ${user.display_name}`,
            ...requestMeta(req),
        })
        res.json({ token: signToken(user), user: publicUser(user), mustChangePassword: !!user.must_change_password })
    })

    app.get('/api/me', requireAuth, (req, res) => {
        res.json({ user: publicUser(req.user), mustChangePassword: !!req.user.must_change_password })
    })

    app.post('/api/auth/change-password', requireAuth, loginLimiter, async (req, res) => {
        if (req.user.role === 'parent') return res.status(403).json({ error: 'Phụ huynh không thể đổi mật khẩu qua đây.' })
        const { currentPassword, newPassword } = req.body || {}
        if (!newPassword || String(newPassword).length < 6) {
            return res.status(400).json({ error: 'Mật khẩu mới phải từ 6 ký tự trở lên.' })
        }
        const ok = await bcrypt.compare(String(currentPassword || ''), req.user.password_hash || '')
        if (!ok) {
            addAuditLog({ actorId: req.user.id, actorRole: req.user.role, actorName: req.user.display_name, action: 'password_change_failed', entityType: 'auth', entityId: req.user.id, summary: `Sai mật khẩu hiện tại khi đổi mật khẩu: ${req.user.display_name}`, ...requestMeta(req) })
            return res.status(401).json({ error: 'Mật khẩu hiện tại không đúng.' })
        }
        await updateUser(req.user.id, {
            password: String(newPassword),
            mustChangePassword: 0,
            displayName: req.user.display_name,
        })
        addAuditLog({ actorId: req.user.id, actorRole: req.user.role, actorName: req.user.display_name, action: 'password_changed', entityType: 'auth', entityId: req.user.id, summary: `Đổi mật khẩu thành công: ${req.user.display_name}`, ...requestMeta(req) })
        res.json({ ok: true, message: 'Đổi mật khẩu thành công.' })
    })

    // ─── Users ────────────────────────────────────────────────────────────────────

    app.get('/api/users', requireAuth, requireRoles('admin'), (_req, res) => {
        res.json({ data: listUsers() })
    })

    app.post('/api/users', requireAuth, requireRoles('admin'), async (req, res) => {
        const role = req.body?.role
        const displayName = String(req.body?.displayName || '').trim()
        if (!['admin', 'teacher', 'parent'].includes(role)) return res.status(400).json({ error: 'Role không hợp lệ.' })
        if (!displayName) return res.status(400).json({ error: 'Thiếu tên hiển thị.' })
        if (role !== 'parent' && !req.body?.password) return res.status(400).json({ error: 'Admin/Teacher cần mật khẩu.' })

        try {
            const user = await createUser({
                role,
                displayName,
                phone: String(req.body?.phone || '').trim(),
                email: String(req.body?.email || '').trim(),
                password: req.body?.password,
                studentId: req.body?.studentId || null,
                status: req.body?.status || 'active',
                mustChangePassword: req.body?.mustChangePassword ? 1 : 0,
            })
            auditFromRequest(req, {
                action: 'user_created',
                entityType: 'user',
                entityId: user.id,
                summary: `Tạo tài khoản ${user.display_name}`,
                metadata: { role: user.role, status: user.status },
            })
            res.status(201).json({ data: user })
        } catch {
            res.status(409).json({ error: 'Tài khoản đã tồn tại hoặc dữ liệu không hợp lệ.' })
        }
    })

    app.put('/api/users/:id', requireAuth, requireRoles('admin'), async (req, res) => {
        const existing = getUser(req.params.id)
        if (!existing) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' })
        const user = await updateUser(req.params.id, {
            role: req.body?.role,
            displayName: String(req.body?.displayName || existing.display_name).trim(),
            phone: req.body?.phone === undefined ? existing.phone : String(req.body.phone || '').trim(),
            email: req.body?.email === undefined ? existing.email : String(req.body.email || '').trim(),
            password: req.body?.password,
            studentId: req.body?.studentId === undefined ? existing.student_id : req.body.studentId || null,
            status: req.body?.status,
            mustChangePassword: req.body?.mustChangePassword !== undefined ? (req.body.mustChangePassword ? 1 : 0) : undefined,
        })
        auditFromRequest(req, {
            action: 'user_updated',
            entityType: 'user',
            entityId: user.id,
            summary: `Cập nhật tài khoản ${user.display_name}`,
            metadata: { role: user.role, status: user.status },
        })
        res.json({ data: user })
    })

    app.post('/api/supabase/users', requireSupabaseAdmin, async (req, res) => {
        const role = req.body?.role
        const fullName = String(req.body?.fullName || '').trim()
        const email = String(req.body?.email || '').trim().toLowerCase()
        const password = String(req.body?.password || '')
        const phone = String(req.body?.phone || '').trim()
        const facilityId = req.body?.facilityId || null
        const studentId = req.body?.studentId || null
        const isActive = req.body?.status !== 'locked'

        if (!['admin', 'teacher', 'parent'].includes(role)) return res.status(400).json({ error: 'Role không hợp lệ.' })
        if (!fullName) return res.status(400).json({ error: 'Thiếu tên hiển thị.' })
        if (!email) return res.status(400).json({ error: 'Thiếu email đăng nhập.' })
        if (password.length < 6) return res.status(400).json({ error: 'Mật khẩu phải từ 6 ký tự.' })
        if (role === 'teacher' && !facilityId) return res.status(400).json({ error: 'Giáo viên cần được gán cơ sở.' })
        if (role === 'parent' && !studentId) return res.status(400).json({ error: 'Phụ huynh cần được liên kết học sinh.' })

        const created = await req.supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName, role },
        })
        if (created.error) return res.status(409).json({ error: created.error.message })

        const userId = created.data.user.id
        const { data: profile, error: profileError } = await req.supabaseAdmin
            .from('profiles')
            .upsert({
                id: userId,
                role,
                facility_id: role === 'teacher' ? facilityId : null,
                full_name: fullName,
                phone: phone || null,
                email,
                is_active: isActive,
            }, { onConflict: 'id' })
            .select('id, role, facility_id, full_name, phone, email, is_active, created_at')
            .single()
        if (profileError) return res.status(400).json({ error: profileError.message })

        if (role === 'parent') {
            const { error: linkError } = await req.supabaseAdmin
                .from('parent_student_links')
                .upsert({
                    parent_profile_id: userId,
                    student_id: studentId,
                    relationship: 'parent',
                    is_primary: true,
                }, { onConflict: 'parent_profile_id,student_id' })
            if (linkError) return res.status(400).json({ error: linkError.message })
        }

        addAuditLog({
            actorId: req.supabaseActor.id,
            actorRole: req.supabaseActor.role,
            actorName: req.supabaseActor.full_name,
            action: 'supabase_user_created',
            entityType: 'profile',
            entityId: userId,
            summary: `Tạo tài khoản Supabase ${fullName}`,
            metadata: { role, email },
            ...requestMeta(req),
        })
        res.status(201).json({ data: supabasePublicUser(profile) })
    })

    app.put('/api/supabase/users/:id', requireSupabaseAdmin, async (req, res) => {
        const role = req.body?.role
        const fullName = String(req.body?.fullName || '').trim()
        const email = String(req.body?.email || '').trim().toLowerCase()
        const password = String(req.body?.password || '')
        const phone = String(req.body?.phone || '').trim()
        const facilityId = req.body?.facilityId || null
        const studentId = req.body?.studentId || null
        const isActive = req.body?.status !== 'locked'

        if (!['admin', 'teacher', 'parent'].includes(role)) return res.status(400).json({ error: 'Role không hợp lệ.' })
        if (!fullName) return res.status(400).json({ error: 'Thiếu tên hiển thị.' })
        if (!email) return res.status(400).json({ error: 'Thiếu email đăng nhập.' })
        if (password && password.length < 6) return res.status(400).json({ error: 'Mật khẩu phải từ 6 ký tự.' })
        if (role === 'teacher' && !facilityId) return res.status(400).json({ error: 'Giáo viên cần được gán cơ sở.' })

        const authPayload = {
            email,
            user_metadata: { full_name: fullName, role },
        }
        if (password) authPayload.password = password
        const updatedAuth = await req.supabaseAdmin.auth.admin.updateUserById(req.params.id, authPayload)
        if (updatedAuth.error) return res.status(400).json({ error: updatedAuth.error.message })

        const { data: profile, error: profileError } = await req.supabaseAdmin
            .from('profiles')
            .update({
                role,
                facility_id: role === 'teacher' ? facilityId : null,
                full_name: fullName,
                phone: phone || null,
                email,
                is_active: isActive,
            })
            .eq('id', req.params.id)
            .select('id, role, facility_id, full_name, phone, email, is_active, created_at')
            .single()
        if (profileError) return res.status(400).json({ error: profileError.message })

        await req.supabaseAdmin
            .from('parent_student_links')
            .delete()
            .eq('parent_profile_id', req.params.id)
        if (role === 'parent' && studentId) {
            const { error: linkError } = await req.supabaseAdmin
                .from('parent_student_links')
                .insert({
                    parent_profile_id: req.params.id,
                    student_id: studentId,
                    relationship: 'parent',
                    is_primary: true,
                })
            if (linkError) return res.status(400).json({ error: linkError.message })
        }

        addAuditLog({
            actorId: req.supabaseActor.id,
            actorRole: req.supabaseActor.role,
            actorName: req.supabaseActor.full_name,
            action: 'supabase_user_updated',
            entityType: 'profile',
            entityId: req.params.id,
            summary: `Cập nhật tài khoản Supabase ${fullName}`,
            metadata: { role, email, passwordChanged: Boolean(password) },
            ...requestMeta(req),
        })
        res.json({ data: supabasePublicUser(profile) })
    })

    // ─── Audit logs ───────────────────────────────────────────────────────────────

    app.get('/api/audit-logs', requireAuth, requireRoles('admin'), (req, res) => {
        res.json({
            data: listAuditLogs({
                limit: req.query.limit,
                action: req.query.action,
                entityType: req.query.entityType,
                actorId: req.query.actorId,
            }),
        })
    })

    // ─── Backups ──────────────────────────────────────────────────────────────────

    app.get('/api/backups', requireAuth, requireRoles('admin'), (_req, res) => {
        res.json({ data: listBackups(), scheduler: schedulerState })
    })

    app.post('/api/backups', requireAuth, requireRoles('admin'), (req, res) => {
        const backup = createBackup({
            reason: req.body?.reason || 'manual',
            actor: { id: req.user.id, name: req.user.display_name, role: req.user.role },
        })
        auditFromRequest(req, {
            action: 'backup_created',
            entityType: 'backup',
            entityId: backup.name,
            summary: `Tạo backup ${backup.name}`,
            metadata: { size: backup.size, reason: backup.reason },
        })
        res.status(201).json({ data: backup })
    })

    app.post('/api/backups/:name/restore', requireAuth, requireRoles('admin'), (req, res) => {
        try {
            const restored = restoreBackup(req.params.name)
            auditFromRequest(req, {
                action: 'backup_restored',
                entityType: 'backup',
                entityId: restored.name,
                summary: `Khôi phục backup ${restored.name}`,
                metadata: { createdAt: restored.createdAt },
            })
            res.json({ data: restored })
        } catch {
            res.status(400).json({ error: 'Backup không hợp lệ hoặc không tồn tại.' })
        }
    })

    app.get('/api/backups/:name/download', requireAuth, requireRoles('admin'), (req, res) => {
        try {
            const path = getBackupPath(req.params.name)
            res.download(path, req.params.name)
        } catch {
            res.status(404).json({ error: 'Không tìm thấy backup.' })
        }
    })

    // ─── Health Records ────────────────────────────────────────────────────────────

    app.get('/api/health-records/:studentId', requireAuth, (req, res) => {
        const { studentId } = req.params
        if (req.user.role === 'parent' && req.user.student_id !== studentId) {
            return res.status(403).json({ error: 'Forbidden' })
        }
        const record = getHealthRecord(studentId)
        res.json({ data: record || {} })
    })

    app.put('/api/health-records/:studentId', requireAuth, requireRoles('admin', 'teacher'), (req, res) => {
        const { studentId } = req.params
        const record = upsertHealthRecord(studentId, req.body, req.user.id)
        auditFromRequest(req, {
            action: 'health_record_updated',
            entityType: 'health_record',
            entityId: studentId,
            summary: `Cập nhật hồ sơ sức khỏe cho học sinh ${studentId}`,
        })
        res.json({ data: record })
    })

    // ─── Incidents ─────────────────────────────────────────────────────────────────

    app.get('/api/incidents', requireAuth, (req, res) => {
        const studentId = req.user.role === 'parent' ? req.user.student_id : req.query.studentId
        const items = listIncidents({ studentId, status: req.query.status, limit: req.query.limit })
        // Parents see only open/resolved/parent_acknowledged, not drafts
        const filtered = req.user.role === 'parent' ? items.filter(i => i.status !== 'draft') : items
        res.json({ data: filtered })
    })

    app.get('/api/incidents/:id', requireAuth, (req, res) => {
        const incident = getIncident(req.params.id)
        if (!incident) return res.status(404).json({ error: 'Không tìm thấy sự cố.' })
        if (req.user.role === 'parent' && req.user.student_id !== incident.student_id) {
            return res.status(403).json({ error: 'Forbidden' })
        }
        res.json({ data: incident })
    })

    app.post('/api/incidents', requireAuth, requireRoles('admin', 'teacher'), (req, res) => {
        if (!req.body?.studentId || !req.body?.description) {
            return res.status(400).json({ error: 'Thiếu studentId hoặc mô tả sự cố.' })
        }
        const incident = createIncident(req.body, req.user.id, req.user.display_name)
        auditFromRequest(req, {
            action: 'incident_created',
            entityType: 'incident',
            entityId: incident.id,
            summary: `Ghi nhận sự cố: ${incident.description.slice(0, 60)}`,
            metadata: { studentId: incident.student_id, severity: incident.severity },
        })
        res.status(201).json({ data: incident })
    })

    app.put('/api/incidents/:id', requireAuth, (req, res) => {
        const existing = getIncident(req.params.id)
        if (!existing) return res.status(404).json({ error: 'Không tìm thấy sự cố.' })

        // Parents can only set parent_acknowledged_at
        if (req.user.role === 'parent') {
            if (req.user.student_id !== existing.student_id) return res.status(403).json({ error: 'Forbidden' })
            const updated = updateIncident(req.params.id, {
                status: 'parent_acknowledged',
                parentAcknowledgedAt: new Date().toISOString(),
            }, req.user.id)
            auditFromRequest(req, {
                action: 'incident_acknowledged',
                entityType: 'incident',
                entityId: existing.id,
                summary: `Phụ huynh xác nhận đã đọc sự cố ${existing.id}`,
            })
            return res.json({ data: updated })
        }

        const updated = updateIncident(req.params.id, req.body, req.user.id)
        auditFromRequest(req, {
            action: 'incident_updated',
            entityType: 'incident',
            entityId: existing.id,
            summary: `Cập nhật sự cố ${existing.id} → ${req.body.status || existing.status}`,
            metadata: { status: req.body.status },
        })
        res.json({ data: updated })
    })

    // ─── Invoices ──────────────────────────────────────────────────────────────────

    app.get('/api/invoices', requireAuth, (req, res) => {
        const studentId = req.user.role === 'parent' ? req.user.student_id : req.query.studentId
        const items = listInvoices({ studentId, status: req.query.status, limit: req.query.limit })
        // Parents don't see cancelled invoices
        const filtered = req.user.role === 'parent' ? items.filter(i => i.status !== 'cancelled') : items
        res.json({ data: filtered })
    })

    app.get('/api/invoices/:id', requireAuth, (req, res) => {
        const invoice = getInvoice(req.params.id)
        if (!invoice) return res.status(404).json({ error: 'Không tìm thấy hóa đơn.' })
        if (req.user.role === 'parent' && req.user.student_id !== invoice.student_id) {
            return res.status(403).json({ error: 'Forbidden' })
        }
        res.json({ data: invoice })
    })

    app.post('/api/invoices', requireAuth, requireRoles('admin', 'teacher'), (req, res) => {
        if (!req.body?.studentId || !req.body?.description || !req.body?.amount || !req.body?.dueDate) {
            return res.status(400).json({ error: 'Thiếu thông tin hóa đơn.' })
        }
        const invoice = createInvoice(req.body, req.user.id)
        auditFromRequest(req, {
            action: 'invoice_created',
            entityType: 'invoice',
            entityId: invoice.id,
            summary: `Tạo hóa đơn ${invoice.invoice_number}: ${invoice.description}`,
            metadata: { amount: invoice.amount, studentId: invoice.student_id },
        })
        res.status(201).json({ data: invoice })
    })

    app.put('/api/invoices/:id', requireAuth, requireRoles('admin', 'teacher'), (req, res) => {
        const existing = getInvoice(req.params.id)
        if (!existing) return res.status(404).json({ error: 'Không tìm thấy hóa đơn.' })
        const updated = updateInvoice(req.params.id, req.body)
        auditFromRequest(req, {
            action: 'invoice_updated',
            entityType: 'invoice',
            entityId: existing.id,
            summary: `Cập nhật hóa đơn ${existing.invoice_number} → ${req.body.status || existing.status}`,
            metadata: { status: req.body.status, paidDate: req.body.paidDate },
        })
        res.json({ data: updated })
    })

    // ─── Meal Menus ───────────────────────────────────────────────────────────────

    app.get('/api/meal-menus', requireAuth, (req, res) => {
        const forParent = req.user.role === 'parent'
        const items = listMealMenus({ weekStart: req.query.weekStart, published: forParent })
        res.json({ data: items })
    })

    app.put('/api/meal-menus', requireAuth, requireRoles('admin', 'teacher'), (req, res) => {
        if (!req.body?.weekStart || !req.body?.dayOfWeek) return res.status(400).json({ error: 'Thiếu weekStart hoặc dayOfWeek.' })
        const menu = upsertMealMenu(req.body, req.user.id)
        auditFromRequest(req, {
            action: 'meal_menu_updated',
            entityType: 'meal_menu',
            entityId: menu.id,
            summary: `Cập nhật thực đơn tuần ${menu.week_start} ngày ${menu.day_of_week}`,
        })
        res.json({ data: menu })
    })

    // ─── Media Albums ─────────────────────────────────────────────────────────────

    app.get('/api/media-albums', requireAuth, (req, res) => {
        const status = req.user.role === 'parent' ? 'published' : req.query.status
        res.json({ data: listMediaAlbums({ status, classId: req.query.classId }) })
    })

    app.post('/api/media-albums', requireAuth, requireRoles('admin', 'teacher'), (req, res) => {
        if (!req.body?.title) return res.status(400).json({ error: 'Thiếu tiêu đề album.' })
        const album = createMediaAlbum(req.body, req.user.id)
        auditFromRequest(req, { action: 'media_album_created', entityType: 'media_album', entityId: album.id, summary: `Tạo album ${album.title}` })
        res.status(201).json({ data: album })
    })

    app.put('/api/media-albums/:id', requireAuth, requireRoles('admin', 'teacher'), (req, res) => {
        const existing = getMediaAlbum(req.params.id)
        if (!existing) return res.status(404).json({ error: 'Không tìm thấy album.' })
        const album = updateMediaAlbum(req.params.id, req.body)
        auditFromRequest(req, { action: 'media_album_updated', entityType: 'media_album', entityId: album.id, summary: `Cập nhật album ${album.title} → ${album.status}` })
        res.json({ data: album })
    })

    // ─── Media Assets ─────────────────────────────────────────────────────────────

    app.get('/api/media-assets', requireAuth, (req, res) => {
        const forParent = req.user.role === 'parent'
        const assets = listMediaAssets({
            albumId: req.query.albumId,
            status: forParent ? 'published' : req.query.status,
            classId: req.query.classId,
            forParent,
        })
        res.json({ data: assets })
    })

    app.post('/api/media-assets/upload', requireAuth, uploadLimiter, upload.single('file'), async (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'Chỉ hỗ trợ file ảnh tối đa 5MB.' })
        const settings = getSchoolSettings()
        const retentionDays = settings?.retention_days || 365

        const asset = createMediaAsset({
            albumId: req.body?.albumId || null,
            originalName: req.file.originalname,
            storedName: req.file.filename,
            mimeType: req.file.mimetype,
            size: req.file.size,
            path: `/uploads/${req.file.filename}`,
            status: req.user.role === 'admin' ? 'published' : 'draft',
            classId: req.body?.classId || null,
            caption: req.body?.caption || null,
            retentionDays,
        }, req.user.id)

        auditFromRequest(req, { action: 'media_asset_uploaded', entityType: 'media_asset', entityId: asset.id, summary: `Upload ảnh ${asset.original_name}` })
        res.status(201).json({ data: asset })
    })

    app.put('/api/media-assets/:id', requireAuth, requireRoles('admin', 'teacher'), (req, res) => {
        const existing = getMediaAsset(req.params.id)
        if (!existing) return res.status(404).json({ error: 'Không tìm thấy ảnh.' })
        const asset = updateMediaAsset(req.params.id, req.body)
        auditFromRequest(req, { action: 'media_asset_updated', entityType: 'media_asset', entityId: asset.id, summary: `Cập nhật ảnh ${asset.original_name} → ${asset.status}` })
        res.json({ data: asset })
    })

    // ─── Attendance (Advanced) ────────────────────────────────────────────────────

    app.get('/api/attendance-records', requireAuth, (req, res) => {
        const date = req.query.date || new Date().toISOString().split('T')[0]
        const studentId = req.user.role === 'parent' ? req.user.student_id : req.query.studentId
        const records = listAttendanceRecords({ date, studentId, limit: req.query.limit })
        const summary = req.user.role !== 'parent' ? getAttendanceSummary(date) : []
        res.json({ data: records, summary, date })
    })

    app.get('/api/attendance-records/:studentId/:date', requireAuth, (req, res) => {
        const { studentId, date } = req.params
        if (req.user.role === 'parent' && req.user.student_id !== studentId) {
            return res.status(403).json({ error: 'Forbidden' })
        }
        const record = getAttendanceRecord(studentId, date)
        res.json({ data: record || null })
    })

    app.put('/api/attendance-records/:studentId/:date', requireAuth, requireRoles('admin', 'teacher'), (req, res) => {
        const { studentId, date } = req.params
        const record = upsertAttendanceRecord({ studentId, date, ...req.body }, req.user.id)
        auditFromRequest(req, {
            action: 'attendance_recorded',
            entityType: 'attendance',
            entityId: `${studentId}-${date}`,
            summary: `Điểm danh học sinh ${studentId} ngày ${date}: ${record.status}`,
            metadata: { status: record.status, checkInTime: record.check_in_time },
        })
        res.json({ data: record })
    })

    // ─── School Settings ──────────────────────────────────────────────────────────

    app.get('/api/school-settings', requireAuth, (_req, res) => {
        res.json({ data: getSchoolSettings() })
    })

    app.put('/api/school-settings', requireAuth, requireRoles('admin'), (req, res) => {
        const settings = updateSchoolSettings(req.body || {})
        auditFromRequest(req, {
            action: 'school_settings_updated',
            entityType: 'school_settings',
            entityId: '1',
            summary: 'Cập nhật cấu hình trường học',
        })
        res.json({ data: settings })
    })

    // ─── Academic Years ───────────────────────────────────────────────────────────

    app.get('/api/academic-years', requireAuth, (_req, res) => {
        res.json({ data: listAcademicYears() })
    })

    app.post('/api/academic-years', requireAuth, requireRoles('admin'), (req, res) => {
        const { name, startDate, endDate } = req.body || {}
        if (!name || !startDate || !endDate) return res.status(400).json({ error: 'Thiếu tên, ngày bắt đầu hoặc ngày kết thúc năm học.' })
        const year = createAcademicYear(req.body)
        auditFromRequest(req, {
            action: 'academic_year_created',
            entityType: 'academic_year',
            entityId: year.id,
            summary: `Tạo năm học ${year.name}`,
        })
        res.status(201).json({ data: year })
    })

    app.put('/api/academic-years/:id', requireAuth, requireRoles('admin'), (req, res) => {
        const existing = getAcademicYear(req.params.id)
        if (!existing) return res.status(404).json({ error: 'Không tìm thấy năm học.' })
        const year = updateAcademicYear(req.params.id, req.body)
        auditFromRequest(req, {
            action: 'academic_year_updated',
            entityType: 'academic_year',
            entityId: year.id,
            summary: `Cập nhật năm học ${year.name}`,
        })
        res.json({ data: year })
    })

    // ─── School Holidays ──────────────────────────────────────────────────────────

    app.get('/api/school-holidays', requireAuth, (_req, res) => {
        res.json({ data: listSchoolHolidays() })
    })

    app.post('/api/school-holidays', requireAuth, requireRoles('admin'), (req, res) => {
        if (!req.body?.name || !req.body?.date) return res.status(400).json({ error: 'Thiếu tên hoặc ngày nghỉ.' })
        const holiday = createSchoolHoliday(req.body)
        auditFromRequest(req, {
            action: 'holiday_created',
            entityType: 'school_holiday',
            entityId: holiday.id,
            summary: `Thêm ngày nghỉ ${holiday.name} (${holiday.date})`,
        })
        res.status(201).json({ data: holiday })
    })

    app.delete('/api/school-holidays/:id', requireAuth, requireRoles('admin'), (req, res) => {
        const deleted = deleteSchoolHoliday(req.params.id)
        if (!deleted) return res.status(404).json({ error: 'Không tìm thấy ngày nghỉ.' })
        auditFromRequest(req, {
            action: 'holiday_deleted',
            entityType: 'school_holiday',
            entityId: req.params.id,
            summary: `Xóa ngày nghỉ ${req.params.id}`,
        })
        res.json({ deleted: true })
    })

    // ─── Tuition Plans ────────────────────────────────────────────────────────────

    app.get('/api/tuition-plans', requireAuth, (req, res) => {
        const activeOnly = req.query.activeOnly === 'true'
        res.json({ data: listTuitionPlans({ activeOnly }) })
    })

    app.post('/api/tuition-plans', requireAuth, requireRoles('admin'), (req, res) => {
        if (!req.body?.name || req.body?.amount === undefined) return res.status(400).json({ error: 'Thiếu tên hoặc số tiền.' })
        const plan = createTuitionPlan(req.body)
        auditFromRequest(req, {
            action: 'tuition_plan_created',
            entityType: 'tuition_plan',
            entityId: plan.id,
            summary: `Tạo mức học phí ${plan.name}`,
            metadata: { amount: plan.amount, billingCycle: plan.billing_cycle },
        })
        res.status(201).json({ data: plan })
    })

    app.put('/api/tuition-plans/:id', requireAuth, requireRoles('admin'), (req, res) => {
        const existing = getTuitionPlan(req.params.id)
        if (!existing) return res.status(404).json({ error: 'Không tìm thấy mức học phí.' })
        const plan = updateTuitionPlan(req.params.id, req.body)
        auditFromRequest(req, {
            action: 'tuition_plan_updated',
            entityType: 'tuition_plan',
            entityId: plan.id,
            summary: `Cập nhật mức học phí ${plan.name}`,
        })
        res.json({ data: plan })
    })

    // ─── Student Consents ─────────────────────────────────────────────────────────

    app.get('/api/student-consents/:studentId', requireAuth, (req, res) => {
        const { studentId } = req.params
        if (req.user.role === 'parent' && req.user.student_id !== studentId) {
            return res.status(403).json({ error: 'Forbidden' })
        }
        const consent = getStudentConsent(studentId)
        if (consent && typeof consent.contact_channels === 'string') {
            consent.contact_channels = JSON.parse(consent.contact_channels || '["app"]')
        }
        res.json({ data: consent || { student_id: studentId, allow_photos: 1, allow_notifications: 1, contact_channels: ['app'], allow_photo_sharing: 0, data_retention_days: 365 } })
    })

    app.put('/api/student-consents/:studentId', requireAuth, (req, res) => {
        const { studentId } = req.params
        if (req.user.role === 'parent' && req.user.student_id !== studentId) {
            return res.status(403).json({ error: 'Forbidden' })
        }
        if (req.user.role === 'teacher') return res.status(403).json({ error: 'Giáo viên không thể sửa consent.' })
        const consent = upsertStudentConsent(studentId, req.body, req.user.id)
        auditFromRequest(req, {
            action: 'student_consent_updated',
            entityType: 'student_consent',
            entityId: studentId,
            summary: `Cập nhật quyền riêng tư học sinh ${studentId}`,
        })
        res.json({ data: consent })
    })

    // ─── Notifications ────────────────────────────────────────────────────────────

    app.get('/api/notifications', requireAuth, (req, res) => {
        if (req.user.role === 'parent') {
            const student = readRecord('students', req.user.student_id)
            const items = listNotificationsForUser(req.user.id, {
                studentId: req.user.student_id,
                classId: student?.classId,
            })
            return res.json({ data: items, unreadCount: getUnreadCount(req.user.id) })
        }
        res.json({
            data: listNotifications({
                status: req.query.status,
                type: req.query.type,
                limit: req.query.limit,
            }),
        })
    })

    app.get('/api/notifications/unread-count', requireAuth, (req, res) => {
        res.json({ count: getUnreadCount(req.user.id) })
    })

    app.get('/api/notifications/:id', requireAuth, (req, res) => {
        const notif = getNotification(req.params.id)
        if (!notif) return res.status(404).json({ error: 'Không tìm thấy thông báo.' })
        if (req.user.role === 'parent' && notif.target_student_id && req.user.student_id !== notif.target_student_id) {
            return res.status(403).json({ error: 'Forbidden' })
        }
        res.json({ data: notif })
    })

    app.post('/api/notifications', requireAuth, requireRoles('admin', 'teacher'), (req, res) => {
        if (!req.body?.title || !req.body?.body) return res.status(400).json({ error: 'Thiếu tiêu đề hoặc nội dung thông báo.' })
        const notif = createNotification(req.body, req.user.id)
        auditFromRequest(req, {
            action: 'notification_created',
            entityType: 'notification',
            entityId: notif.id,
            summary: `Tạo thông báo: ${notif.title}`,
            metadata: { type: notif.type, channel: notif.channel, status: notif.status },
        })
        res.status(201).json({ data: notif })
    })

    app.put('/api/notifications/:id', requireAuth, requireRoles('admin', 'teacher'), async (req, res) => {
        const existing = getNotification(req.params.id)
        if (!existing) return res.status(404).json({ error: 'Không tìm thấy thông báo.' })
        if (existing.status === 'sent') return res.status(400).json({ error: 'Không thể sửa thông báo đã gửi.' })

        const isSending = req.body.status === 'sent' && existing.status !== 'sent'
        const updated = updateNotification(req.params.id, {
            ...req.body,
            ...(isSending ? { sentAt: new Date().toISOString() } : {}),
        })

        if (isSending) {
            const dispatchResult = await dispatchNotification(updated).catch(err => ({ ok: false, error: err.message }))
            if (!dispatchResult.ok && dispatchResult.adapter !== 'app') {
                updateNotification(req.params.id, { status: 'failed' })
                auditFromRequest(req, {
                    action: 'notification_send_failed',
                    entityType: 'notification',
                    entityId: existing.id,
                    summary: `Gửi thông báo thất bại: ${existing.title}`,
                    metadata: dispatchResult,
                })
                return res.status(502).json({ error: 'Gửi thông báo thất bại.', details: dispatchResult })
            }
            auditFromRequest(req, {
                action: 'notification_sent',
                entityType: 'notification',
                entityId: existing.id,
                summary: `Đã gửi thông báo: ${existing.title}`,
                metadata: { channel: existing.channel },
            })
        } else {
            auditFromRequest(req, {
                action: 'notification_updated',
                entityType: 'notification',
                entityId: existing.id,
                summary: `Cập nhật thông báo: ${existing.title}`,
            })
        }
        res.json({ data: getNotification(req.params.id) })
    })

    app.post('/api/notifications/:id/read', requireAuth, (req, res) => {
        const notif = getNotification(req.params.id)
        if (!notif) return res.status(404).json({ error: 'Không tìm thấy thông báo.' })
        markNotificationRead(req.params.id, req.user.id)
        res.json({ ok: true })
    })

    // ─── Schema info ───────────────────────────────────────────────────────────────

    app.get('/api/schema/migrations', requireAuth, requireRoles('admin'), (_req, res) => {
        res.json({ data: listMigrations() })
    })

    // ─── Snapshot ─────────────────────────────────────────────────────────────────

    app.get('/api/snapshot', requireAuth, (req, res) => {
        res.json({ data: filterSnapshotForUser(readSnapshot(), req.user) })
    })

    app.put('/api/snapshot', requireAuth, requireRoles('admin', 'teacher'), (req, res) => {
        if (!req.body?.data || typeof req.body.data !== 'object') return res.status(400).json({ error: 'Missing snapshot data' })
        const data = replaceSnapshot(req.body.data)
        auditFromRequest(req, {
            action: 'snapshot_replaced',
            entityType: 'snapshot',
            summary: 'Đồng bộ toàn bộ dữ liệu snapshot',
            metadata: { collections: Object.keys(req.body.data || {}) },
        })
        res.json({ data })
    })

    // ─── Collections (generic) ────────────────────────────────────────────────────

    app.get('/api/:collection', requireAuth, (req, res) => {
        const collection = routeToCollection(req.params.collection)
        if (!collection) return res.status(404).json({ error: 'Unknown collection' })
        res.json({ data: filterCollectionForUser(collection, readCollection(collection), req.user) })
    })

    app.get('/api/:collection/:id', requireAuth, (req, res) => {
        const collection = routeToCollection(req.params.collection)
        if (!collection) return res.status(404).json({ error: 'Unknown collection' })
        const record = readRecord(collection, req.params.id)
        if (!record) return res.status(404).json({ error: 'Not found' })
        if (!filterCollectionForUser(collection, [record], req.user).length) return res.status(403).json({ error: 'Forbidden' })
        res.json({ data: record })
    })

    app.post('/api/:collection', requireAuth, assertCanWrite, (req, res) => {
        const collection = routeToCollection(req.params.collection)
        if (!collection) return res.status(404).json({ error: 'Unknown collection' })
        const record = { ...req.body, id: req.body?.id || `${collection}-${Date.now()}` }
        const data = upsertRecord(collection, record)
        auditFromRequest(req, {
            action: 'record_created',
            entityType: collection,
            entityId: data.id,
            summary: `Tạo ${collection}: ${data.name || data.title || data.subject || data.id}`,
        })
        res.status(201).json({ data })
    })

    app.put('/api/:collection/:id', requireAuth, requireRoles('admin', 'teacher'), (req, res) => {
        const collection = routeToCollection(req.params.collection)
        if (!collection) return res.status(404).json({ error: 'Unknown collection' })
        const data = upsertRecord(collection, { ...req.body, id: req.params.id })
        auditFromRequest(req, {
            action: 'record_updated',
            entityType: collection,
            entityId: data.id,
            summary: `Cập nhật ${collection}: ${data.name || data.title || data.subject || data.id}`,
        })
        res.json({ data })
    })

    app.delete('/api/:collection/:id', requireAuth, requireRoles('admin', 'teacher'), (req, res) => {
        const collection = routeToCollection(req.params.collection)
        if (!collection) return res.status(404).json({ error: 'Unknown collection' })
        const deleted = deleteRecord(collection, req.params.id)
        auditFromRequest(req, {
            action: 'record_deleted',
            entityType: collection,
            entityId: req.params.id,
            summary: `Xóa ${collection}: ${req.params.id}`,
            metadata: { deleted },
        })
        res.json({ deleted })
    })

    // ─── Uploads ──────────────────────────────────────────────────────────────────

    app.post('/api/uploads', requireAuth, uploadLimiter, upload.single('file'), (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'Chỉ hỗ trợ file ảnh tối đa 5MB.' })

        const id = `up-${Date.now()}`
        db.prepare(`
          INSERT INTO uploads (id, original_name, stored_name, mime_type, size, path, uploaded_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(id, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size, `/uploads/${req.file.filename}`, req.user.id)

        auditFromRequest(req, {
            action: 'file_uploaded',
            entityType: 'upload',
            entityId: id,
            summary: `Tải file ${req.file.originalname}`,
            metadata: { mimeType: req.file.mimetype, size: req.file.size },
        })

        res.status(201).json({
            data: {
                id,
                originalName: req.file.originalname,
                mimeType: req.file.mimetype,
                size: req.file.size,
                url: `/uploads/${req.file.filename}`,
            },
        })
    })

    const distDir = resolve('dist')
    const indexHtml = resolve(distDir, 'index.html')
    if (existsSync(indexHtml)) {
        app.use(express.static(distDir))
        app.get(/^\/(?!api\/|uploads\/).*/, (_req, res) => {
            res.sendFile(indexHtml)
        })
    }

    // Normalize unhandled errors to JSON, hide stack in production
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, _next) => {
        const status = err.status || err.statusCode || 500
        const isProd = process.env.NODE_ENV === 'production'
        const message = isProd && status === 500 ? 'Lỗi máy chủ nội bộ.' : (err.message || 'Lỗi không xác định.')
        console.error(`[${req.requestId || '-'}] ERROR ${status}: ${err.message}`)
        if (!isProd && err.stack) console.error(err.stack)
        res.status(status).json({ error: message })
    })

    return app
}
