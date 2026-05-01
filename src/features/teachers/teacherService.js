import { getCurrentProfile } from '../auth/authService'
import { requireSupabase } from '../../lib/supabaseClient'

const TEACHER_COLUMNS = 'id, facility_id, linked_profile_id, full_name, class_name, subject, phone, email, join_date, status, initials, degree, notes, created_at, updated_at'

export function mapTeacher(row) {
    return {
        id: row.id,
        facilityId: row.facility_id,
        linkedProfileId: row.linked_profile_id || '',
        name: row.full_name || '',
        className: row.class_name || '',
        subject: row.subject || '',
        phone: row.phone || '',
        email: row.email || '',
        joinDate: row.join_date || '',
        status: row.status || 'active',
        initials: row.initials || '',
        degree: row.degree || '',
        notes: row.notes || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

export async function listTeachers({ facilityId, status } = {}) {
    const client = requireSupabase()
    let query = client
        .from('teachers')
        .select(TEACHER_COLUMNS)
        .order('full_name', { ascending: true })
    if (facilityId) query = query.eq('facility_id', facilityId)
    if (status && status !== 'all') query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw error
    return (data || []).map(mapTeacher)
}

export async function saveTeacher(input) {
    const client = requireSupabase()
    const profile = await getCurrentProfile()
    const facilityId = input.facilityId || profile?.facility_id
    let id = input.id || ''
    if (!id && input.email && facilityId) {
        const { data: existing, error: findError } = await client
            .from('teachers')
            .select('id')
            .eq('facility_id', facilityId)
            .ilike('email', input.email.trim())
            .maybeSingle()
        if (findError) throw findError
        id = existing?.id || ''
    }
    const payload = {
        ...(id ? { id } : {}),
        facility_id: facilityId,
        linked_profile_id: input.linkedProfileId || null,
        full_name: input.name?.trim(),
        class_name: input.className || null,
        subject: input.subject || 'Giáo viên chủ nhiệm',
        phone: input.phone || null,
        email: input.email || null,
        join_date: input.joinDate || null,
        status: input.status || 'active',
        initials: input.initials || null,
        degree: input.degree || null,
        notes: input.notes || null,
        updated_at: new Date().toISOString(),
    }

    const { data, error } = await client
        .from('teachers')
        .upsert(payload, { onConflict: 'id' })
        .select(TEACHER_COLUMNS)
        .single()
    if (error) throw error
    return mapTeacher(data)
}
