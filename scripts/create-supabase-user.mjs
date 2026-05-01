import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_KEY

if (!url || !serviceKey) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')

const [email, password, role, fullName, facilityCodeOrStudentName = ''] = process.argv.slice(2)
if (!email || !password || !role || !fullName) {
    throw new Error('Usage: node scripts/create-supabase-user.mjs email password admin|teacher|parent "Full name" [CS1|CS2|student name]\nExample admin: node scripts/create-supabase-user.mjs admin@maika.edu.vn "<password>" admin "Quản trị Maika"')
}

if (!['admin', 'teacher', 'parent'].includes(role)) {
    throw new Error('Role must be admin, teacher, or parent')
}

const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
})

let facilityId = null
let studentId = null

if (role === 'teacher' && facilityCodeOrStudentName) {
    const { data, error } = await supabase.from('facilities').select('id').eq('code', facilityCodeOrStudentName).single()
    if (error) throw error
    facilityId = data.id
}

if (role === 'parent' && facilityCodeOrStudentName) {
    const { data, error } = await supabase
        .from('students')
        .select('id')
        .ilike('full_name', `%${facilityCodeOrStudentName}%`)
        .limit(1)
        .maybeSingle()
    if (error) throw error
    studentId = data?.id || null
}

const created = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
})
const emailAlreadyExists = created.error && (
    created.error.code === 'email_exists' ||
    String(created.error.message || '').includes('already registered') ||
    String(created.error.message || '').includes('already been registered')
)
if (created.error && !emailAlreadyExists) throw created.error

const userId = created.data?.user?.id || (await supabase.auth.admin.listUsers()).data.users.find(u => u.email === email)?.id
if (!userId) throw new Error(`Cannot resolve auth user for ${email}`)

if (!created.data?.user) {
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, role },
    })
    if (updateError) throw updateError
}

const { error: profileError } = await supabase.from('profiles').upsert({
    id: userId,
    role,
    facility_id: facilityId,
    full_name: fullName,
    email,
    is_active: true,
}, { onConflict: 'id' })
if (profileError) throw profileError

if (role === 'parent' && studentId) {
    const { error: linkError } = await supabase.from('parent_student_links').upsert({
        parent_profile_id: userId,
        student_id: studentId,
        relationship: 'parent',
        is_primary: true,
    }, { onConflict: 'parent_profile_id,student_id' })
    if (linkError) throw linkError
}

console.log(JSON.stringify({ ok: true, email, role, linkedStudent: studentId }, null, 2))
