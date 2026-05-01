import { requireSupabase } from '../../lib/supabaseClient'

const PROFILE_COLUMNS = 'id, role, facility_id, full_name, phone, email, is_active, created_at'

export function mapProfile(row) {
    return {
        id: row.id,
        role: row.role,
        facilityId: row.facility_id || '',
        fullName: row.full_name || '',
        phone: row.phone || '',
        email: row.email || '',
        isActive: row.is_active,
        status: row.is_active ? 'active' : 'locked',
        createdAt: row.created_at,
    }
}

export async function listProfiles() {
    const client = requireSupabase()
    const { data, error } = await client
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []).map(mapProfile)
}

export async function saveProfile(input) {
    const client = requireSupabase()
    const payload = {
        role: input.role,
        facility_id: input.role === 'teacher' ? input.facilityId || null : input.facilityId || null,
        full_name: input.fullName?.trim(),
        phone: input.phone || null,
        email: input.email || null,
        is_active: input.status !== 'locked',
    }
    const { data, error } = await client
        .from('profiles')
        .update(payload)
        .eq('id', input.id)
        .select(PROFILE_COLUMNS)
        .single()
    if (error) throw error
    return mapProfile(data)
}

export async function listParentLinks() {
    const client = requireSupabase()
    const { data, error } = await client
        .from('parent_student_links')
        .select('parent_profile_id, student_id, relationship, is_primary')
    if (error) throw error
    return data || []
}

export async function replaceParentLink({ parentProfileId, studentId, relationship = 'parent' }) {
    const client = requireSupabase()
    await client
        .from('parent_student_links')
        .delete()
        .eq('parent_profile_id', parentProfileId)

    if (!studentId) return null
    const { data, error } = await client
        .from('parent_student_links')
        .insert({
            parent_profile_id: parentProfileId,
            student_id: studentId,
            relationship,
            is_primary: true,
        })
        .select('parent_profile_id, student_id, relationship, is_primary')
        .single()
    if (error) throw error
    return data
}
