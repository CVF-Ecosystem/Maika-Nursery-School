import { requireSupabase, SUPABASE_URL } from '../../lib/supabaseClient'

const PROFILE_COLUMNS = 'id, role, facility_id, full_name, phone, email, is_active, created_at'
const API = import.meta.env.VITE_API_URL || ''

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

async function supabaseAdminRequest(path, options = {}) {
    const client = requireSupabase()
    const { data: sessionData, error: sessionError } = await client.auth.getSession()
    if (sessionError) throw sessionError
    const token = sessionData.session?.access_token
    if (!token) throw new Error('Phiên đăng nhập đã hết hạn.')

    const baseUrl = API ? API.replace(/\/$/, '') : ''
    const functionPath = path.replace(/^\/api\/supabase\/users/, '')
    const requestUrl = API
        ? `${baseUrl}${path}`
        : `${SUPABASE_URL}/functions/v1/admin-users${functionPath}`

    const response = await fetch(requestUrl, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
            ...(options.headers || {}),
        },
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.error || 'Không cập nhật được tài khoản.')
    return body.data
}

function profileAdminPayload(input) {
    return {
        role: input.role,
        facilityId: input.role === 'teacher' ? input.facilityId || '' : '',
        fullName: input.fullName?.trim(),
        phone: input.phone || '',
        email: input.email || '',
        password: input.password || '',
        studentId: input.role === 'parent' ? input.studentId || '' : '',
        status: input.status || 'active',
    }
}

export async function createProfileAccount(input) {
    const data = await supabaseAdminRequest('/api/supabase/users', {
        method: 'POST',
        body: JSON.stringify(profileAdminPayload(input)),
    })
    return data
}

export async function updateProfileAccount(input) {
    if (!input.id) throw new Error('Thiếu ID tài khoản.')
    const data = await supabaseAdminRequest(`/api/supabase/users/${input.id}`, {
        method: 'PUT',
        body: JSON.stringify(profileAdminPayload(input)),
    })
    return data
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
