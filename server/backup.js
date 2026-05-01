import { mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { readSnapshot, replaceSnapshot } from './db.js'

export const BACKUP_DIR = resolve(process.env.MAIKA_BACKUP_DIR || 'server/backups')
mkdirSync(BACKUP_DIR, { recursive: true })

function backupName() {
    return `maika-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
}

function safeBackupPath(name) {
    const safeName = basename(name)
    if (!safeName.endsWith('.json')) throw new Error('Invalid backup file')
    return join(BACKUP_DIR, safeName)
}

export function createBackup({ reason = 'manual', actor = null } = {}) {
    const data = readSnapshot()
    const payload = {
        version: 1,
        app: 'maika',
        reason,
        actor,
        createdAt: new Date().toISOString(),
        collections: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value.length])),
        data,
    }
    const name = backupName()
    const path = safeBackupPath(name)
    writeFileSync(path, JSON.stringify(payload, null, 2), 'utf8')
    const stats = statSync(path)
    return { name, path, size: stats.size, createdAt: payload.createdAt, collections: payload.collections, reason }
}

export function listBackups() {
    return readdirSync(BACKUP_DIR)
        .filter(name => name.endsWith('.json'))
        .map(name => {
            const path = safeBackupPath(name)
            const stats = statSync(path)
            let meta = {}
            try {
                const payload = JSON.parse(readFileSync(path, 'utf8'))
                meta = {
                    createdAt: payload.createdAt,
                    collections: payload.collections,
                    reason: payload.reason,
                    actor: payload.actor,
                }
            } catch { }
            return { name, size: stats.size, modifiedAt: stats.mtime.toISOString(), ...meta }
        })
        .sort((a, b) => new Date(b.createdAt || b.modifiedAt) - new Date(a.createdAt || a.modifiedAt))
}

export function readBackup(name) {
    const payload = JSON.parse(readFileSync(safeBackupPath(name), 'utf8'))
    if (payload.app !== 'maika' || !payload.data || typeof payload.data !== 'object') {
        throw new Error('Invalid Maika backup')
    }
    return payload
}

export function restoreBackup(name) {
    const payload = readBackup(name)
    replaceSnapshot(payload.data)
    return { name, createdAt: payload.createdAt, collections: payload.collections }
}

export function getBackupPath(name) {
    return safeBackupPath(name)
}

export function deleteBackup(name) {
    unlinkSync(safeBackupPath(name))
}

export function applyRetentionPolicy({ count = 30, days = 30 } = {}) {
    const backups = listBackups()
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const sorted = [...backups].sort((a, b) =>
        new Date(b.createdAt || b.modifiedAt) - new Date(a.createdAt || a.modifiedAt))

    let deleted = 0
    sorted.forEach((backup, index) => {
        if (index >= count || new Date(backup.createdAt || backup.modifiedAt) < cutoff) {
            try { deleteBackup(backup.name); deleted++ } catch { }
        }
    })
    return deleted
}
