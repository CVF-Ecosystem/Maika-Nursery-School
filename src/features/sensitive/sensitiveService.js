import { getCurrentProfile } from '../auth/authService'
import { requireSupabase } from '../../lib/supabaseClient'
import { buildReceiptNumber } from '../payments/receiptNumbers'

const HEALTH_COLUMNS = 'id, student_id, facility_id, allergies, blood_type, medications, medical_notes, emergency_contact_name, emergency_contact_relation, emergency_contact_phone, doctor_name, doctor_phone, updated_by, created_at, updated_at'
const INCIDENT_COLUMNS = 'id, student_id, facility_id, occurred_at, reported_by, reporter_name, severity, description, initial_action, status, parent_acknowledged_at, parent_note, created_at, updated_at'
const INVOICE_COLUMNS = 'id, student_id, facility_id, invoice_number, type, description, amount, due_date, paid_at, payment_method, status, note, created_by, created_at, updated_at'
const CONSENT_COLUMNS = 'student_id, facility_id, allow_photos, allow_notifications, contact_channels, allow_photo_sharing, data_retention_days, updated_by, created_at, updated_at'

async function getStudentFacilityId(studentId) {
    const client = requireSupabase()
    const { data, error } = await client
        .from('students')
        .select('facility_id')
        .eq('id', studentId)
        .single()
    if (error) throw error
    return data.facility_id
}

export async function getHealthRecord(studentId) {
    const client = requireSupabase()
    const { data, error } = await client
        .from('health_records')
        .select(HEALTH_COLUMNS)
        .eq('student_id', studentId)
        .maybeSingle()
    if (error) throw error
    return data || {}
}

export async function saveHealthRecord(studentId, input) {
    const client = requireSupabase()
    const [facilityId, profile] = await Promise.all([getStudentFacilityId(studentId), getCurrentProfile()])
    const payload = {
        student_id: studentId,
        facility_id: facilityId,
        allergies: input.allergies || null,
        blood_type: input.blood_type || null,
        medications: input.medications || null,
        medical_notes: input.medical_notes || null,
        emergency_contact_name: input.emergency_contact_name || null,
        emergency_contact_relation: input.emergency_contact_relation || null,
        emergency_contact_phone: input.emergency_contact_phone || null,
        doctor_name: input.doctor_name || null,
        doctor_phone: input.doctor_phone || null,
        updated_by: profile?.id || null,
        updated_at: new Date().toISOString(),
    }
    const { data, error } = await client
        .from('health_records')
        .upsert(payload, { onConflict: 'student_id' })
        .select(HEALTH_COLUMNS)
        .single()
    if (error) throw error
    return data
}

export async function getStudentConsent(studentId) {
    const client = requireSupabase()
    const { data, error } = await client
        .from('student_consents')
        .select(CONSENT_COLUMNS)
        .eq('student_id', studentId)
        .maybeSingle()
    if (error) throw error
    return data || {
        student_id: studentId,
        allow_photos: true,
        allow_notifications: true,
        contact_channels: ['app'],
        allow_photo_sharing: false,
        data_retention_days: 365,
    }
}

export async function saveStudentConsent(studentId, input) {
    const client = requireSupabase()
    const [facilityId, profile] = await Promise.all([getStudentFacilityId(studentId), getCurrentProfile()])
    const payload = {
        student_id: studentId,
        facility_id: facilityId,
        allow_photos: !!input.allowPhotos,
        allow_notifications: !!input.allowNotifications,
        contact_channels: input.contactChannels?.length ? input.contactChannels : ['app'],
        allow_photo_sharing: !!input.allowPhotoSharing,
        data_retention_days: Number(input.dataRetentionDays || 365),
        updated_by: profile?.id || null,
        updated_at: new Date().toISOString(),
    }
    const { data, error } = await client
        .from('student_consents')
        .upsert(payload, { onConflict: 'student_id' })
        .select(CONSENT_COLUMNS)
        .single()
    if (error) throw error
    return data
}

export async function listIncidents({ studentId, facilityId, status } = {}) {
    const client = requireSupabase()
    let query = client.from('incidents').select(INCIDENT_COLUMNS).order('occurred_at', { ascending: false })
    if (studentId) query = query.eq('student_id', studentId)
    if (facilityId) query = query.eq('facility_id', facilityId)
    if (status && status !== 'all') query = query.eq('status', status)
    const { data, error } = await query
    if (error) throw error
    return data || []
}

export async function saveIncident(input) {
    const client = requireSupabase()
    const [facilityId, profile] = await Promise.all([getStudentFacilityId(input.studentId), getCurrentProfile()])
    const payload = {
        ...(input.id ? { id: input.id } : {}),
        student_id: input.studentId,
        facility_id: facilityId,
        occurred_at: input.occurredAt || new Date().toISOString(),
        reported_by: profile?.id || null,
        reporter_name: profile?.full_name || null,
        severity: input.severity || 'minor',
        description: input.description,
        initial_action: input.initialAction || null,
        status: input.status || 'open',
        updated_at: new Date().toISOString(),
    }
    const { data, error } = await client
        .from('incidents')
        .upsert(payload, { onConflict: 'id' })
        .select(INCIDENT_COLUMNS)
        .single()
    if (error) throw error
    return data
}

export async function acknowledgeIncident(id, parentNote = '') {
    const client = requireSupabase()
    const { data, error } = await client.rpc('acknowledge_incident', {
        p_incident_id: id,
        p_parent_note: parentNote || null,
    })
    if (error) throw error
    return data
}

function invoiceNumber() {
    return buildReceiptNumber({ dueDate: new Date(), fallbackCode: `AUTO${String(Date.now()).slice(-5)}` })
}

export async function listInvoices({ studentId, facilityId, status } = {}) {
    const client = requireSupabase()
    let query = client.from('invoices').select(INVOICE_COLUMNS).order('due_date', { ascending: false })
    if (studentId) query = query.eq('student_id', studentId)
    if (facilityId) query = query.eq('facility_id', facilityId)
    if (status && status !== 'all') query = query.eq('status', status)
    const { data, error } = await query
    if (error) throw error
    return (data || []).map(row => ({ ...row, paid_date: row.paid_at?.slice(0, 10) || '', notes: row.note || '' }))
}

export async function saveInvoice(input) {
    const client = requireSupabase()
    const [facilityId, profile] = await Promise.all([getStudentFacilityId(input.studentId), getCurrentProfile()])
    const payload = {
        ...(input.id ? { id: input.id } : {}),
        student_id: input.studentId,
        facility_id: facilityId,
        invoice_number: input.invoiceNumber || input.invoice_number || invoiceNumber(),
        type: input.type || 'tuition',
        description: input.description,
        amount: Number(input.amount || 0),
        due_date: input.dueDate || null,
        paid_at: input.paidDate ? new Date(input.paidDate).toISOString() : null,
        payment_method: input.paymentMethod || null,
        status: input.status || 'pending',
        note: input.notes || null,
        created_by: profile?.id || null,
        updated_at: new Date().toISOString(),
    }
    const { data, error } = await client
        .from('invoices')
        .upsert(payload, { onConflict: 'id' })
        .select(INVOICE_COLUMNS)
        .single()
    if (error) throw error
    return { ...data, paid_date: data.paid_at?.slice(0, 10) || '', notes: data.note || '' }
}
