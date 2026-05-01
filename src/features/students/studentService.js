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
    const client = requireSupabase()
    let query = client
        .from('students')
        .select(STUDENT_COLUMNS)
        .eq('status', 'active')
        .order('full_name', { ascending: true })

    if (facilityId) query = query.eq('facility_id', facilityId)

    const { data, error } = await query
    if (error) throw error
    return (data || []).map(mapStudentFromSupabase)
}
