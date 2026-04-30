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
