import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeadersFor } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const ZNS_API = 'https://business.openapi.zalo.me/message/template'

function jsonResponse(request: Request, body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeadersFor(request), 'Content-Type': 'application/json' },
    })
}

function fail(request: Request, message: string, status = 400) {
    return jsonResponse(request, { error: message }, status)
}

function normalizePhone(raw: string): string {
    const digits = raw.replace(/\D/g, '')
    if (digits.startsWith('84') && digits.length === 11) return '0' + digits.slice(2)
    if (digits.startsWith('0') && digits.length === 10) return digits
    return digits
}

interface ZnsRequest {
    phone: string
    templateId: string
    templateData: Record<string, string>
    trackingId?: string
    refType?: string
    refId?: string
    facilityId?: string
}

Deno.serve(async (request) => {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeadersFor(request) })
    }
    if (request.method !== 'POST') return fail(request, 'Method not allowed', 405)

    let body: ZnsRequest
    try { body = await request.json() } catch { return fail(request, 'Invalid JSON') }

    const { phone, templateId, templateData, trackingId, refType, refId, facilityId } = body
    if (!phone || !templateId) return fail(request, 'phone and templateId required')

    const serviceClient = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    })

    // Get OA token from school settings (use facilityId if provided)
    let settingsQuery = serviceClient.from('school_settings').select('zalo_oa_token').limit(1)
    if (facilityId) settingsQuery = settingsQuery.eq('facility_id', facilityId)
    const { data: settings } = await settingsQuery.maybeSingle()
    const oaToken = settings?.zalo_oa_token
    if (!oaToken) return fail(request, 'Zalo OA token chưa được cấu hình trong Cài đặt trường.', 422)

    const normalizedPhone = normalizePhone(phone)
    const znsPayload = {
        phone: normalizedPhone,
        template_id: templateId,
        template_data: templateData,
        ...(trackingId ? { tracking_id: trackingId } : {}),
    }

    let zaloMsgId: string | null = null
    let errorMsg: string | null = null
    let status = 'sent'

    try {
        const resp = await fetch(ZNS_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'access_token': oaToken },
            body: JSON.stringify(znsPayload),
        })
        const result = await resp.json()
        if (result.error !== 0) {
            status = 'failed'
            errorMsg = result.message || `Zalo error ${result.error}`
        } else {
            zaloMsgId = result.data?.msg_id || null
        }
    } catch (err) {
        status = 'failed'
        errorMsg = err instanceof Error ? err.message : 'Network error'
    }

    // Log attempt
    await serviceClient.from('zns_logs').insert({
        facility_id: facilityId || null,
        template_id: templateId,
        phone: normalizedPhone,
        ref_type: refType || null,
        ref_id: refId || null,
        status,
        zalo_msg_id: zaloMsgId,
        error: errorMsg,
    })

    if (status === 'failed') return fail(request, errorMsg || 'Gửi ZNS thất bại', 502)
    return jsonResponse(request, { sent: true, msgId: zaloMsgId })
})
