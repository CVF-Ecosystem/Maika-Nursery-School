// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let server
let baseUrl
let tempDir
let dbModule

async function api(path, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
    })
    const body = await response.json().catch(() => ({}))
    return { response, body }
}

describe('Maika API', () => {
    beforeAll(async () => {
        tempDir = mkdtempSync(join(tmpdir(), 'maika-api-'))
        process.env.MAIKA_DB_PATH = join(tempDir, 'test.sqlite')
        process.env.MAIKA_UPLOAD_DIR = join(tempDir, 'uploads')
        process.env.MAIKA_BACKUP_DIR = join(tempDir, 'backups')
        process.env.MAIKA_ADMIN_PASSWORD = '123456'
        process.env.MAIKA_TEACHER_PASSWORD = 'maika'
        process.env.MAIKA_JWT_SECRET = 'test-secret'

        dbModule = await import('./db.js')
        const { createApp } = await import('./app.js')
        const app = await createApp()

        await new Promise(resolve => {
            server = app.listen(0, '127.0.0.1', resolve)
        })
        baseUrl = `http://127.0.0.1:${server.address().port}`
    })

    afterAll(async () => {
        if (server) await new Promise(resolve => server.close(resolve))
        dbModule?.db?.close?.()
        if (tempDir) rmSync(tempDir, { recursive: true, force: true })
    })

    it('logs in admin and reads a snapshot', async () => {
        const login = await api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ role: 'admin', password: '123456' }),
        })

        expect(login.response.status).toBe(200)
        expect(login.body.token).toBeTruthy()

        const snapshot = await api('/api/snapshot', {
            headers: { Authorization: `Bearer ${login.body.token}` },
        })

        expect(snapshot.response.status).toBe(200)
        expect(snapshot.body.data.students.length).toBeGreaterThan(0)
    })

    it('supports authenticated CRUD for students', async () => {
        const login = await api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ role: 'admin', password: '123456' }),
        })
        const headers = { Authorization: `Bearer ${login.body.token}` }

        const created = await api('/api/students', {
            method: 'POST',
            headers,
            body: JSON.stringify({ id: 's-api-test', name: 'API Test', status: 'active' }),
        })
        expect(created.response.status).toBe(201)

        const updated = await api('/api/students/s-api-test', {
            method: 'PUT',
            headers,
            body: JSON.stringify({ name: 'API Test Updated', status: 'active' }),
        })
        expect(updated.body.data.name).toBe('API Test Updated')

        const deleted = await api('/api/students/s-api-test', { method: 'DELETE', headers })
        expect(deleted.body.deleted).toBe(true)
    })

    it('lets admins create and lock user accounts', async () => {
        const login = await api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ role: 'admin', password: '123456' }),
        })
        const headers = { Authorization: `Bearer ${login.body.token}` }

        const created = await api('/api/users', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                role: 'teacher',
                displayName: 'Teacher API Test',
                email: 'teacher-api@example.com',
                password: 'secret123',
            }),
        })
        expect(created.response.status).toBe(201)
        expect(created.body.data.role).toBe('teacher')

        const locked = await api(`/api/users/${created.body.data.id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ status: 'locked' }),
        })
        expect(locked.body.data.status).toBe('locked')

        const users = await api('/api/users', { headers })
        expect(users.body.data.some(user => user.id === created.body.data.id)).toBe(true)
    })

    it('records audit logs for authenticated changes', async () => {
        const login = await api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ role: 'admin', password: '123456' }),
        })
        const headers = { Authorization: `Bearer ${login.body.token}` }

        await api('/api/students', {
            method: 'POST',
            headers,
            body: JSON.stringify({ id: 's-audit-test', name: 'Audit Test', status: 'active' }),
        })

        const logs = await api('/api/audit-logs?limit=20', { headers })
        expect(logs.response.status).toBe(200)
        expect(logs.body.data.some(log => log.action === 'record_created' && log.entity_id === 's-audit-test')).toBe(true)
        expect(logs.body.data.some(log => log.action === 'login_success')).toBe(true)
    })

    it('creates, lists, downloads, and restores backups', async () => {
        const login = await api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ role: 'admin', password: '123456' }),
        })
        const headers = { Authorization: `Bearer ${login.body.token}` }

        const created = await api('/api/backups', {
            method: 'POST',
            headers,
            body: JSON.stringify({ reason: 'test' }),
        })
        expect(created.response.status).toBe(201)
        expect(created.body.data.name).toMatch(/maika-backup/)

        const listed = await api('/api/backups', { headers })
        expect(listed.body.data.some(backup => backup.name === created.body.data.name)).toBe(true)

        const downloaded = await fetch(`${baseUrl}/api/backups/${created.body.data.name}/download`, { headers })
        expect(downloaded.status).toBe(200)

        const restored = await api(`/api/backups/${created.body.data.name}/restore`, { method: 'POST', headers })
        expect(restored.response.status).toBe(200)
        expect(restored.body.data.name).toBe(created.body.data.name)
    })

    it('filters parent data to their student', async () => {
        const login = await api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ role: 'parent', phone: '0901234567' }),
        })
        const snapshot = await api('/api/snapshot', {
            headers: { Authorization: `Bearer ${login.body.token}` },
        })

        expect(snapshot.response.status).toBe(200)
        expect(snapshot.body.data.students).toHaveLength(1)
        expect(snapshot.body.data.students[0].parentPhone).toBe('0901234567')
    })

    it('/api/health returns db, dirs, scheduler status without auth', async () => {
        const { response, body } = await api('/api/health')
        expect(response.status).toBe(200)
        expect(body.ok).toBe(true)
        expect(typeof body.db).toBe('boolean')
        expect(typeof body.uploadDir).toBe('boolean')
        expect(typeof body.backupDir).toBe('boolean')
        expect(body.scheduler).toBeDefined()
    })

    it('supports /api/v1 aliases for versioned clients', async () => {
        const health = await api('/api/v1/health')
        expect(health.response.status).toBe(200)
        expect(health.body.ok).toBe(true)

        const login = await api('/api/v1/auth/login', {
            method: 'POST',
            body: JSON.stringify({ role: 'admin', password: '123456' }),
        })
        expect(login.response.status).toBe(200)
        expect(login.body.token).toBeTruthy()
    })

    it('/api/ready returns 200 when db is ok', async () => {
        const { response, body } = await api('/api/ready')
        expect(response.status).toBe(200)
        expect(body.ready).toBe(true)
    })

    it('parent cannot access another student consent (RBAC)', async () => {
        const login = await api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ role: 'parent', phone: '0901234567' }),
        })
        const headers = { Authorization: `Bearer ${login.body.token}` }
        const parentStudentId = login.body.user?.studentId

        // Can read own student
        const ownConsent = await api(`/api/student-consents/${parentStudentId}`, { headers })
        expect(ownConsent.response.status).toBe(200)

        // Cannot read another student's consent
        const otherConsent = await api('/api/student-consents/nonexistent-other-student', { headers })
        expect(otherConsent.response.status).toBe(403)
    })

    it('parent cannot create notifications (RBAC)', async () => {
        const login = await api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ role: 'parent', phone: '0901234567' }),
        })
        const headers = { Authorization: `Bearer ${login.body.token}` }

        const { response } = await api('/api/notifications', {
            method: 'POST',
            headers,
            body: JSON.stringify({ title: 'Hack', body: 'attempt' }),
        })
        expect(response.status).toBe(403)
    })

    it('admin CRUD for school settings', async () => {
        const login = await api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ role: 'admin', password: '123456' }),
        })
        const headers = { Authorization: `Bearer ${login.body.token}` }

        const get = await api('/api/school-settings', { headers })
        expect(get.response.status).toBe(200)
        expect(get.body.data).toBeDefined()

        const updated = await api('/api/school-settings', {
            method: 'PUT',
            headers,
            body: JSON.stringify({ schoolName: 'Maika Test' }),
        })
        expect(updated.response.status).toBe(200)
        expect(updated.body.data.school_name).toBe('Maika Test')
    })

    it('teacher cannot write school settings (RBAC)', async () => {
        const login = await api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ role: 'teacher', password: 'maika' }),
        })
        const headers = { Authorization: `Bearer ${login.body.token}` }

        const { response } = await api('/api/school-settings', {
            method: 'PUT',
            headers,
            body: JSON.stringify({ school_name: 'Hack' }),
        })
        expect(response.status).toBe(403)
    })

    it('admin can create and publish notifications', async () => {
        const login = await api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ role: 'admin', password: '123456' }),
        })
        const headers = { Authorization: `Bearer ${login.body.token}` }

        const created = await api('/api/notifications', {
            method: 'POST',
            headers,
            body: JSON.stringify({ title: 'Test Notif', body: 'Hello', type: 'general', channel: 'app' }),
        })
        expect(created.response.status).toBe(201)
        expect(created.body.data.status).toBe('draft')

        // Send it (channel='app' uses mock adapter which succeeds)
        const sent = await api(`/api/notifications/${created.body.data.id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ status: 'sent' }),
        })
        expect(sent.response.status).toBe(200)
    })

    it('admin can upsert attendance records and teacher can read them', async () => {
        const adminLogin = await api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ role: 'admin', password: '123456' }),
        })
        const adminHeaders = { Authorization: `Bearer ${adminLogin.body.token}` }

        const snap = await api('/api/snapshot', { headers: adminHeaders })
        const studentId = snap.body.data.students[0]?.id
        if (!studentId) return

        const upsert = await api(`/api/attendance-records/${studentId}/2024-01-15`, {
            method: 'PUT',
            headers: adminHeaders,
            body: JSON.stringify({ status: 'present', checkInTime: '07:30' }),
        })
        expect(upsert.response.status).toBe(200)
        expect(upsert.body.data.status).toBe('present')

        const teacherLogin = await api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ role: 'teacher', password: 'maika' }),
        })
        const teacherHeaders = { Authorization: `Bearer ${teacherLogin.body.token}` }

        const list = await api('/api/attendance-records?date=2024-01-15', { headers: teacherHeaders })
        expect(list.response.status).toBe(200)
    })
})
