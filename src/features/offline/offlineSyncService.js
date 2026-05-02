const QUEUE_KEY = 'maika_teacher_offline_queue_v1'
const CACHE_PREFIX = 'maika_teacher_cache_v1:'

function readJson(key, fallback) {
    try {
        const raw = localStorage.getItem(key)
        return raw ? JSON.parse(raw) : fallback
    } catch {
        return fallback
    }
}

function writeJson(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value))
    } catch {}
}

function notify() {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('maika-offline-queue-changed'))
}

export function isOnline() {
    return typeof navigator === 'undefined' ? true : navigator.onLine
}

export function getOfflineQueue() {
    return readJson(QUEUE_KEY, [])
}

export function getOfflineQueueCount() {
    return getOfflineQueue().length
}

export function getFailedActions() {
    return getOfflineQueue().filter(action => action.lastError)
}

export function enqueueOfflineAction(type, payload) {
    const queue = getOfflineQueue()
    queue.push({
        id: `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type,
        payload,
        createdAt: new Date().toISOString(),
        attempts: 0,
        lastError: '',
        failedAt: '',
    })
    writeJson(QUEUE_KEY, queue)
    notify()
}

export function cacheTeacherData(key, data) {
    writeJson(CACHE_PREFIX + key, data)
}

export function readCachedTeacherData(key, fallback) {
    return readJson(CACHE_PREFIX + key, fallback)
}

async function runAction(action) {
    if (action.type === 'attendance') {
        const { upsertAttendance } = await import('../attendance/attendanceService')
        await upsertAttendance(action.payload)
        return
    }
    if (action.type === 'daily-report') {
        const { saveDailyReport } = await import('../reports/dailyReportService')
        await saveDailyReport(action.payload)
    }
}

export async function syncOfflineQueue() {
    if (!isOnline()) return { synced: 0, remaining: getOfflineQueueCount() }
    const queue = getOfflineQueue()
    const remaining = []
    let synced = 0
    for (const action of queue) {
        try {
            await runAction(action)
            synced += 1
        } catch (error) {
            remaining.push({
                ...action,
                attempts: (action.attempts || 0) + 1,
                lastError: error?.message || 'Không đồng bộ được dữ liệu.',
                failedAt: new Date().toISOString(),
            })
        }
    }
    writeJson(QUEUE_KEY, remaining)
    notify()
    return { synced, remaining: remaining.length }
}
