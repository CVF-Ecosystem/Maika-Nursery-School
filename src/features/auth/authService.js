import { requireSupabase } from '../../lib/supabaseClient'

export async function getCurrentUser() {
    const client = requireSupabase()
    const { data, error } = await client.auth.getUser()
    if (error) throw error
    return data.user
}

export async function getCurrentProfile() {
    const user = await getCurrentUser()
    if (!user) return null

    const client = requireSupabase()
    const { data, error } = await client
        .from('profiles')
        .select('id, role, facility_id, full_name, phone, email, is_active')
        .eq('id', user.id)
        .single()

    if (error) throw error
    return data
}

export async function signInWithPassword({ email, password }) {
    const client = requireSupabase()
    const { data, error } = await client.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
}

export async function signOut() {
    const client = requireSupabase()
    const { error } = await client.auth.signOut()
    if (error) throw error
}

export async function changeCurrentUserPassword({ currentPassword, newPassword }) {
    const client = requireSupabase()
    const { data: userData, error: userError } = await client.auth.getUser()
    if (userError) throw userError
    const email = userData.user?.email
    if (!email) throw new Error('Không xác định được email tài khoản.')

    const { error: signInError } = await client.auth.signInWithPassword({
        email,
        password: currentPassword,
    })
    if (signInError) throw new Error('Mật khẩu hiện tại không đúng.')

    const { error } = await client.auth.updateUser({ password: newPassword })
    if (error) throw error
}

export function portalPathForRole(role) {
    if (role === 'admin') return '/admin/app'
    if (role === 'teacher') return '/teacher/app'
    if (role === 'parent') return '/parent/app'
    return '/'
}
