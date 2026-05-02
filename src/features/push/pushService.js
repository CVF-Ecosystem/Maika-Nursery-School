import { requireSupabase } from '../../lib/supabaseClient'
import { getCurrentProfile } from '../auth/authService'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = atob(base64)
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export function isPushSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function getPushPermission() {
    if (!isPushSupported()) return 'unsupported'
    return Notification.permission
}

export async function isPushSubscribed() {
    if (!isPushSupported()) return false
    try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        return !!sub
    } catch {
        return false
    }
}

export async function subscribeToPush({ facilityId, studentIds = [] }) {
    if (!isPushSupported()) throw new Error('Push notifications không được hỗ trợ trên trình duyệt này.')
    if (!VAPID_PUBLIC_KEY) throw new Error('VAPID public key chưa được cấu hình.')

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') throw new Error('Người dùng từ chối quyền thông báo.')

    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
        sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })
    }

    const subJson = sub.toJSON()
    const client = requireSupabase()
    const profile = await getCurrentProfile()

    const { error } = await client.from('push_subscriptions').upsert({
        user_id: profile?.id,
        facility_id: facilityId || profile?.facility_id || null,
        student_ids: studentIds,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys?.p256dh,
        auth_key: subJson.keys?.auth,
        updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,endpoint' })

    if (error) throw error
    return sub
}

export async function unsubscribeFromPush() {
    if (!isPushSupported()) return
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return

    const client = requireSupabase()
    await client.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
}

export async function sendPushForEvent({ facilityId, studentId, title, body, url }) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    if (!supabaseUrl) return

    const client = requireSupabase()
    const { data: { session } } = await client.auth.getSession()
    if (!session) return

    const fnUrl = `${supabaseUrl}/functions/v1/send-push`
    await fetch(fnUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({
            facilityId,
            studentId,
            payload: { title, body, url },
        }),
    })
}
