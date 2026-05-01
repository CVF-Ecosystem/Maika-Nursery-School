import { requireSupabase } from '../../lib/supabaseClient'
import { mapStudentFromSupabase } from '../students/studentService'

const LINK_COLUMNS = `
    relationship,
    is_primary,
    student:students (
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
    )
`

export async function listMyLinkedStudents() {
    const client = requireSupabase()
    const { data, error } = await client
        .from('parent_student_links')
        .select(LINK_COLUMNS)
        .order('is_primary', { ascending: false })

    if (error) throw error
    return (data || [])
        .map(row => row.student ? {
            ...mapStudentFromSupabase(row.student),
            relationship: row.relationship || 'parent',
            isPrimary: row.is_primary,
        } : null)
        .filter(Boolean)
}
