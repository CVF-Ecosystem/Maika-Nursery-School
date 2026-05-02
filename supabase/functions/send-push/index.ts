import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push'
import { corsHeadersFor } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || ''
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || ''
const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@maikaschool.vn'

function jsonResponse(request: Request, body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeadersFor(request), 'Content-Type': 'application/json' },
    })
}

function fail(request: Request, message: string, status = 400) {
    return jsonResponse(request, { error: message }, status)
}

interface PushPayload {
    title: string
    body: string
    url?: string
    icon?: string
}

interface SendRequest {
    facilityId?: string
    studentId?: string
    payload: PushPayload
}

async function requireSender(request: Request, serviceClient: any) {
    const authorization = request.headers.get('Authorization') || ''
    const token = authorization.replace(/^Bearer\s+/i, '')
    if (!token) throw new Response(JSON.stringify({ error: 'Phiên đăng nhập đã hết hạn.' }), { status: 401 })

    const userClient = createClient(supabaseUrl, anonKey)
    const { data: userData, error: userError } = await userClient.auth.getUser(token)
    if (userError || !userData.user) {
        throw new Response(JSON.stringify({ error: 'Phiên đăng nhập không hợp lệ.' }), { status: 401 })
    }

    const { data, error: profileError } = await serviceClient
        .from('profiles')
        .select('id, role, facility_id, is_active')
        .eq('id', userData.user.id)
        .single()
    const profile = data as { id: string; role: string; facility_id: string | null; is_active: boolean } | null

    if (profileError || !profile || !profile.is_active || !['admin', 'teacher'].includes(profile.role)) {
        throw new Response(JSON.stringify({ error: 'Bạn không có quyền gửi thông báo.' }), { status: 403 })
    }

    return profile
}

async function requireTargetAccess(
    request: Request,
    serviceClient: any,
    actor: Record<string, string | boolean | null>,
    facilityId?: string,
    studentId?: string,
) {
    if (actor.role === 'admin') return

    const actorFacilityId = String(actor.facility_id || '')
    if (facilityId && facilityId !== actorFacilityId) {
        throw new Response(JSON.stringify({ error: 'Bạn không có quyền gửi thông báo cho cơ sở này.' }), { status: 403 })
    }

    if (studentId) {
        const { data, error } = await serviceClient
            .from('students')
            .select('facility_id')
            .eq('id', studentId)
            .single()
        const student = data as { facility_id: string } | null
        if (error || !student || student.facility_id !== actorFacilityId) {
            throw new Response(JSON.stringify({ error: 'Bạn không có quyền gửi thông báo cho học sinh này.' }), { status: 403 })
        }
    }
}

Deno.serve(async (request) => {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeadersFor(request) })
    }

    if (request.method !== 'POST') return fail(request, 'Method not allowed', 405)
    if (!vapidPublicKey || !vapidPrivateKey) return fail(request, 'VAPID keys not configured', 500)

    let body: SendRequest
    try {
        body = await request.json()
    } catch {
        return fail(request, 'Invalid JSON body')
    }

    const { facilityId, studentId, payload } = body
    if (!payload?.title) return fail(request, 'payload.title required')

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

    const serviceClient = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    })

    try {
        const actor = await requireSender(request, serviceClient)
        await requireTargetAccess(request, serviceClient, actor, facilityId, studentId)
    } catch (response) {
        if (response instanceof Response) return response
        return fail(request, 'Không xác thực được quyền gửi thông báo.', 403)
    }

    // Find subscriptions: by studentId (parent of specific student) or facilityId (all parents)
    let subsQuery = serviceClient.from('push_subscriptions').select('endpoint, p256dh, auth_key')
    if (studentId) {
        subsQuery = subsQuery.contains('student_ids', [studentId])
    } else if (facilityId) {
        subsQuery = subsQuery.eq('facility_id', facilityId)
    } else {
        return fail(request, 'facilityId or studentId required')
    }

    const { data: subs, error: subsError } = await subsQuery
    if (subsError) return fail(request, subsError.message, 500)
    if (!subs || subs.length === 0) return jsonResponse(request, { sent: 0, message: 'No subscriptions found' })

    const notification = JSON.stringify({
        title: payload.title,
        body: payload.body || '',
        url: payload.url || '/',
        icon: payload.icon || '/icon.svg',
    })

    const results = await Promise.allSettled(
        subs.map(sub =>
            webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
                notification,
                { TTL: 86400 }
            )
        )
    )

    const sent = results.filter(r => r.status === 'fulfilled').length
    const failed = results.length - sent

    // Remove expired subscriptions (HTTP 410 Gone)
    const expiredEndpoints: string[] = []
    results.forEach((result, i) => {
        if (result.status === 'rejected') {
            const err = result.reason as { statusCode?: number }
            if (err?.statusCode === 410) expiredEndpoints.push(subs[i].endpoint)
        }
    })
    if (expiredEndpoints.length > 0) {
        await serviceClient.from('push_subscriptions').delete().in('endpoint', expiredEndpoints)
    }

    return jsonResponse(request, { sent, failed, total: subs.length })
})
