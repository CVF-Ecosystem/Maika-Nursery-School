import { requireSupabase } from '../../lib/supabaseClient'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

async function callZnsFn(payload) {
    const client = requireSupabase()
    const { data: { session } } = await client.auth.getSession()
    if (!session) return

    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-zalo-zns`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': ANON_KEY,
        },
        body: JSON.stringify(payload),
    })
    return res.json()
}

export async function sendInvoiceZns({ phone, studentName, amount, dueDate, invoiceNumber, facilityId, invoiceId }) {
    if (!phone) return
    return callZnsFn({
        phone,
        templateId: await getZnsTemplate('invoice', facilityId),
        templateData: {
            student_name: studentName || 'Học sinh',
            amount: Number(amount || 0).toLocaleString('vi-VN') + ' đ',
            due_date: dueDate ? new Date(dueDate).toLocaleDateString('vi-VN') : '',
            invoice_number: invoiceNumber || '',
        },
        refType: 'invoice',
        refId: invoiceId,
        facilityId,
        trackingId: `inv-${invoiceId || Date.now()}`,
    })
}

export async function sendIncidentZns({ phone, studentName, description, occurredAt, facilityId, incidentId }) {
    if (!phone) return
    return callZnsFn({
        phone,
        templateId: await getZnsTemplate('incident', facilityId),
        templateData: {
            student_name: studentName || 'Học sinh',
            description: (description || '').slice(0, 100),
            occurred_at: occurredAt ? new Date(occurredAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '',
        },
        refType: 'incident',
        refId: incidentId,
        facilityId,
        trackingId: `inc-${incidentId || Date.now()}`,
    })
}

async function getZnsTemplate(type, facilityId) {
    try {
        const client = requireSupabase()
        let q = client.from('school_settings').select('zalo_zns_invoice_template,zalo_zns_incident_template').limit(1)
        if (facilityId) q = q.eq('facility_id', facilityId)
        const { data } = await q.maybeSingle()
        return type === 'invoice' ? (data?.zalo_zns_invoice_template || '') : (data?.zalo_zns_incident_template || '')
    } catch { return '' }
}
