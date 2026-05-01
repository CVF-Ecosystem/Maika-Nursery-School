// Notification adapter layer — mock by default; production adapters read from env

function log(adapter, notification) {
    console.log(`[Notification:${adapter}] "${notification.title}" → ${notification.target_role || 'all'} (${notification.channel})`)
}

async function mockAdapter(notification) {
    log('mock', notification)
    return { ok: true, adapter: 'mock', messageId: `mock-${Date.now()}` }
}

async function emailAdapter(notification) {
    const apiKey = process.env.MAIKA_EMAIL_API_KEY
    if (!apiKey) {
        log('email:skipped', notification)
        return { ok: false, adapter: 'email', error: 'MAIKA_EMAIL_API_KEY not set — skipped gracefully' }
    }
    // Real implementation: call SMTP/provider here
    log('email', notification)
    return { ok: true, adapter: 'email' }
}

async function smsAdapter(notification) {
    const apiKey = process.env.MAIKA_SMS_API_KEY
    if (!apiKey) {
        log('sms:skipped', notification)
        return { ok: false, adapter: 'sms', error: 'MAIKA_SMS_API_KEY not set — skipped gracefully' }
    }
    log('sms', notification)
    return { ok: true, adapter: 'sms' }
}

async function zaloAdapter(notification) {
    const apiKey = process.env.MAIKA_ZALO_OA_TOKEN
    if (!apiKey) {
        log('zalo:skipped', notification)
        return { ok: false, adapter: 'zalo', error: 'MAIKA_ZALO_OA_TOKEN not set — skipped gracefully' }
    }
    log('zalo', notification)
    return { ok: true, adapter: 'zalo' }
}

const ADAPTERS = { mock: mockAdapter, email: emailAdapter, sms: smsAdapter, zalo: zaloAdapter }

export async function dispatchNotification(notification) {
    const channel = notification.channel || 'app'
    if (channel === 'app') return { ok: true, adapter: 'app', note: 'in-app only, no external dispatch' }
    if (channel === 'all') {
        const results = await Promise.all(
            Object.entries(ADAPTERS).map(([name, fn]) => fn(notification).then(r => ({ ...r, adapter: name })).catch(err => ({ ok: false, adapter: name, error: err.message })))
        )
        return { ok: true, results }
    }
    const fn = ADAPTERS[channel] || mockAdapter
    return fn(notification).catch(err => ({ ok: false, adapter: channel, error: err.message }))
}
