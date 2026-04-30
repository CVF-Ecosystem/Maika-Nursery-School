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
})
