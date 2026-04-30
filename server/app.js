import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import bcrypt from 'bcryptjs'
import multer from 'multer'
import { mkdirSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import {
    addAuditLog,
    deleteRecord,
    createUser,
    findUserForLogin,
    getUser,
    listAuditLogs,
    listCollections,
    listUsers,
    readCollection,
    readRecord,
    readSnapshot,
    replaceSnapshot,
    seedDatabase,
    updateUser,
    upsertRecord,
    db,
} from './db.js'
import { publicUser, requireAuth, requireRoles, signToken } from './auth.js'

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

export async function createApp() {
    await seedDatabase()

    const app = express()
    app.use(helmet({ contentSecurityPolicy: false }))
    app.use(cors({ origin: process.env.MAIKA_CORS_ORIGIN?.split(',') || true }))
    app.use(express.json({ limit: '10mb' }))
    app.use('/uploads', express.static(UPLOAD_DIR))

    app.get('/api/health', (_req, res) => {
        res.json({ ok: true, collections: listCollections() })
    })

    app.post('/api/auth/login', async (req, res) => {
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
        res.json({ token: signToken(user), user: publicUser(user) })
    })

    app.get('/api/me', requireAuth, (req, res) => {
        res.json({ user: publicUser(req.user) })
    })

    app.get('/api/users', requireAuth, requireRoles('admin'), (_req, res) => {
        res.json({ data: listUsers() })
    })

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

    app.post('/api/uploads', requireAuth, upload.single('file'), (req, res) => {
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

    return app
}
