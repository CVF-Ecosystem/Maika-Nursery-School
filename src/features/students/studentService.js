import { getCurrentProfile } from '../auth/authService'
import { requireSupabase } from '../../lib/supabaseClient'

const STUDENT_COLUMNS = `
    id,
    facility_id,
    full_name,
    dob,
    gender,
    class_name,
    parent_name,
    parent_phone,
    parent_email,
    status,
    notes
`

export function mapStudentFromSupabase(row) {
    return {
        id: row.id,
        facilityId: row.facility_id,
        name: row.full_name,
        dob: row.dob || '',
        gender: row.gender || 'unknown',
        className: row.class_name || '',
        parentName: row.parent_name || '',
        parentPhone: row.parent_phone || '',
        parentEmail: row.parent_email || '',
        status: row.status || 'active',
        notes: row.notes || '',
    }
}

export async function listStudentsForCurrentTeacher() {
    const profile = await getCurrentProfile()
    if (!profile) throw new Error('Chưa đăng nhập.')
    if (profile.role !== 'teacher') throw new Error('Chỉ giáo viên dùng chức năng này.')
    if (!profile.facility_id) throw new Error('Giáo viên chưa được gán cơ sở.')

    const client = requireSupabase()
    const { data, error } = await client
        .from('students')
        .select(STUDENT_COLUMNS)
        .eq('facility_id', profile.facility_id)
        .eq('status', 'active')
        .order('full_name', { ascending: true })

    if (error) throw error
    return (data || []).map(mapStudentFromSupabase)
}

export async function listStudentsForFacility(facilityId) {
    return listStudents({ facilityId, status: 'active' })
}

export async function listStudents({ facilityId, status } = {}) {
    const client = requireSupabase()
    let query = client
        .from('students')
        .select(STUDENT_COLUMNS)
        .order('full_name', { ascending: true })

    if (facilityId) query = query.eq('facility_id', facilityId)
    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw error
    return (data || []).map(mapStudentFromSupabase)
}

export async function saveStudent(input) {
    const client = requireSupabase()
    const payload = {
        ...(input.id ? { id: input.id } : {}),
        facility_id: input.facilityId,
        full_name: input.name?.trim(),
        dob: input.dob || null,
        gender: input.gender || 'unknown',
        class_name: input.className || null,
        parent_name: input.parentName || null,
        parent_phone: input.parentPhone || null,
        parent_email: input.parentEmail || null,
        status: input.status || 'active',
        notes: input.notes || null,
    }

    const { data, error } = await client
        .from('students')
        .upsert(payload, { onConflict: 'id' })
        .select(STUDENT_COLUMNS)
        .single()

    if (error) throw error
    return mapStudentFromSupabase(data)
}

export async function markStudentInactive(id) {
    const client = requireSupabase()
    const { data, error } = await client
        .from('students')
        .update({ status: 'inactive' })
        .eq('id', id)
        .select(STUDENT_COLUMNS)
        .single()

    if (error) throw error
    return mapStudentFromSupabase(data)
}
