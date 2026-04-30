import 'dotenv/config'
import cron from 'node-cron'
import { applyRetentionPolicy, createBackup } from './backup.js'
import { addAuditLog } from './db.js'

const ENABLED = process.env.MAIKA_BACKUP_SCHEDULE_ENABLED === 'true'
const CRON_EXPR = process.env.MAIKA_BACKUP_CRON || '0 2 * * *'
const RETENTION_COUNT = parseInt(process.env.MAIKA_BACKUP_RETENTION_COUNT || '30', 10)
const RETENTION_DAYS = parseInt(process.env.MAIKA_BACKUP_RETENTION_DAYS || '30', 10)

export const schedulerState = {
    enabled: ENABLED,
    cron: CRON_EXPR,
    retentionCount: RETENTION_COUNT,
    retentionDays: RETENTION_DAYS,
    lastRun: null,
    lastResult: null,
}

async function runBackup() {
    const now = new Date().toISOString()
    try {
        const backup = createBackup({ reason: 'scheduled' })
        const deletedOld = applyRetentionPolicy({ count: RETENTION_COUNT, days: RETENTION_DAYS })
        schedulerState.lastRun = now
        schedulerState.lastResult = { success: true, backup: backup.name, deletedOld }
        addAuditLog({
            action: 'backup_scheduled',
            entityType: 'backup',
            entityId: backup.name,
            summary: `Backup tự động ${backup.name}` + (deletedOld ? `, xóa ${deletedOld} bản cũ` : ''),
            metadata: { size: backup.size, deletedOld },
        })
        console.log(`[Scheduler] Backup thành công: ${backup.name}`)
    } catch (err) {
        schedulerState.lastRun = now
        schedulerState.lastResult = { success: false, error: err.message }
        addAuditLog({
            action: 'backup_scheduled_failed',
            entityType: 'backup',
            summary: `Backup tự động thất bại: ${err.message}`,
        })
        console.error(`[Scheduler] Backup thất bại:`, err.message)
    }
}

export function startScheduler() {
    if (!ENABLED) {
        console.log('[Scheduler] Lịch backup tự động chưa bật (MAIKA_BACKUP_SCHEDULE_ENABLED != true)')
        return
    }
    if (!cron.validate(CRON_EXPR)) {
        console.warn(`[Scheduler] MAIKA_BACKUP_CRON="${CRON_EXPR}" không hợp lệ, bỏ qua.`)
        return
    }
    cron.schedule(CRON_EXPR, runBackup, { timezone: 'Asia/Ho_Chi_Minh' })
    console.log(`[Scheduler] Backup tự động đã bật: ${CRON_EXPR} (Asia/Ho_Chi_Minh)`)
}
