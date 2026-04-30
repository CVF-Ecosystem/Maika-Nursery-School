import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import bcrypt from 'bcryptjs'
import multer from 'multer'
import { mkdirSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import {
    deleteRecord,
    findUserForLogin,
    listCollections,
    readCollection,
    readRecord,
    readSnapshot,
    replaceSnapshot,
    seedDatabase,
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
        if (!user) return res.status(401).json({ error: 'Không tìm thấy tài khoản.' })

        if (role !== 'parent') {
            const ok = await bcrypt.compare(String(req.body?.password || ''), user.password_hash || '')
            if (!ok) return res.status(401).json({ error: 'Mật khẩu không đúng.' })
        }

        res.json({ token: signToken(user), user: publicUser(user) })
    })

    app.get('/api/me', requireAuth, (req, res) => {
        res.json({ user: publicUser(req.user) })
    })

    app.get('/api/snapshot', requireAuth, (req, res) => {
        res.json({ data: filterSnapshotForUser(readSnapshot(), req.user) })
    })

    app.put('/api/snapshot', requireAuth, requireRoles('admin', 'teacher'), (req, res) => {
        if (!req.body?.data || typeof req.body.data !== 'object') return res.status(400).json({ error: 'Missing snapshot data' })
        res.json({ data: replaceSnapshot(req.body.data) })
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
        res.status(201).json({ data: upsertRecord(collection, record) })
    })

    app.put('/api/:collection/:id', requireAuth, requireRoles('admin', 'teacher'), (req, res) => {
        const collection = routeToCollection(req.params.collection)
        if (!collection) return res.status(404).json({ error: 'Unknown collection' })
        res.json({ data: upsertRecord(collection, { ...req.body, id: req.params.id }) })
    })

    app.delete('/api/:collection/:id', requireAuth, requireRoles('admin', 'teacher'), (req, res) => {
        const collection = routeToCollection(req.params.collection)
        if (!collection) return res.status(404).json({ error: 'Unknown collection' })
        res.json({ deleted: deleteRecord(collection, req.params.id) })
    })

    app.post('/api/uploads', requireAuth, upload.single('file'), (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'Chỉ hỗ trợ file ảnh tối đa 5MB.' })

        const id = `up-${Date.now()}`
        db.prepare(`
          INSERT INTO uploads (id, original_name, stored_name, mime_type, size, path, uploaded_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(id, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size, `/uploads/${req.file.filename}`, req.user.id)

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
