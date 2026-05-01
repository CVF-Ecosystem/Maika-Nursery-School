import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeadersFor } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_KEY') || ''

const validRoles = new Set(['admin', 'teacher', 'parent'])

function jsonResponse(request: Request, body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            ...corsHeadersFor(request),
            'Content-Type': 'application/json',
        },
    })
}

function fail(request: Request, message: string, status = 400) {
    return jsonResponse(request, { error: message }, status)
}

function cleanText(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}

function profilePayload(input: Record<string, unknown>) {
    const role = cleanText(input.role)
    const facilityId = cleanText(input.facilityId)
    return {
        role,
        facility_id: role === 'teacher' ? facilityId || null : null,
        full_name: cleanText(input.fullName),
        phone: cleanText(input.phone) || null,
        email: cleanText(input.email).toLowerCase() || null,
        is_active: cleanText(input.status) !== 'locked',
    }
}

function validatePayload(input: Record<string, unknown>, isCreate: boolean) {
    const email = cleanText(input.email).toLowerCase()
    const role = cleanText(input.role)
    const fullName = cleanText(input.fullName)
    const password = cleanText(input.password)

    if (!validRoles.has(role)) return 'Vai trò không hợp lệ.'
    if (!email || !email.includes('@')) return 'Email không hợp lệ.'
    if (!fullName) return 'Thiếu họ tên.'
    if (role === 'teacher' && !cleanText(input.facilityId)) return 'Giáo viên cần được gán cơ sở.'
    if (isCreate && password.length < 8) return 'Mật khẩu tạm thời cần ít nhất 8 ký tự.'
    if (!isCreate && password && password.length < 8) return 'Mật khẩu mới cần ít nhất 8 ký tự.'
    return ''
}

function mapProfile(row: Record<string, unknown>) {
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

async function requireAdmin(request: Request, serviceClient: ReturnType<typeof createClient>) {
    const authorization = request.headers.get('Authorization') || ''
    const token = authorization.replace(/^Bearer\s+/i, '')
    if (!token) throw new Response(JSON.stringify({ error: 'Phiên đăng nhập đã hết hạn.' }), { status: 401 })

    const userClient = createClient(supabaseUrl, anonKey)
    const { data: userData, error: userError } = await userClient.auth.getUser(token)
    if (userError || !userData.user) {
        throw new Response(JSON.stringify({ error: 'Phiên đăng nhập không hợp lệ.' }), { status: 401 })
    }

    const { data: profile, error: profileError } = await serviceClient
        .from('profiles')
        .select('id, role, full_name, is_active')
        .eq('id', userData.user.id)
        .single()

    if (profileError || !profile || profile.role !== 'admin' || profile.is_active !== true) {
        throw new Response(JSON.stringify({ error: 'Bạn không có quyền quản trị tài khoản.' }), { status: 403 })
    }

    return profile
}

async function replaceParentLink(
    serviceClient: ReturnType<typeof createClient>,
    parentProfileId: string,
    studentId: string,
) {
    await serviceClient.from('parent_student_links').delete().eq('parent_profile_id', parentProfileId)
    if (!studentId) return

    const { error } = await serviceClient.from('parent_student_links').insert({
        parent_profile_id: parentProfileId,
        student_id: studentId,
        relationship: 'parent',
        is_primary: true,
    })
    if (error) throw error
}

async function writeAudit(
    serviceClient: ReturnType<typeof createClient>,
    actor: Record<string, unknown>,
    action: string,
    entityId: string,
    summary: string,
) {
    const { error } = await serviceClient.from('audit_logs').insert({
        actor_id: actor.id,
        actor_role: actor.role,
        actor_name: actor.full_name,
        action,
        entity_type: 'profile',
        entity_id: entityId,
        summary,
    })
    if (error) console.warn('audit log skipped', error.message)
}

Deno.serve(async (request) => {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeadersFor(request) })
    }

    if (!supabaseUrl || !anonKey || !serviceKey) {
        return fail(request, 'Supabase admin function chưa được cấu hình service key.', 500)
    }

    const serviceClient = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    })

    let actor: Record<string, unknown>
    try {
        actor = await requireAdmin(request, serviceClient)
    } catch (error) {
        if (error instanceof Response) {
            return new Response(error.body, {
                status: error.status,
                headers: { ...corsHeadersFor(request), 'Content-Type': 'application/json' },
            })
        }
        return fail(request, 'Không xác thực được quyền admin.', 401)
    }

    const url = new URL(request.url)
    const parts = url.pathname.split('/').filter(Boolean)
    const userId = parts[parts.length - 1] === 'admin-users' ? '' : parts[parts.length - 1]
    const input = await request.json().catch(() => ({}))
    const isCreate = request.method === 'POST'

    if (!isCreate && request.method !== 'PUT') return fail(request, 'Phương thức không được hỗ trợ.', 405)
    if (!isCreate && !userId) return fail(request, 'Thiếu ID tài khoản.', 400)

    const validationError = validatePayload(input, isCreate)
    if (validationError) return fail(request, validationError, 400)

    const payload = profilePayload(input)
    const email = cleanText(input.email).toLowerCase()
    const password = cleanText(input.password)
    const role = cleanText(input.role)

    try {
        if (isCreate) {
            const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: {
                    role,
                    full_name: payload.full_name,
                },
            })
            if (createError || !created.user) throw createError || new Error('Không tạo được tài khoản.')

            const profile = { id: created.user.id, ...payload }
            const { data, error } = await serviceClient
                .from('profiles')
                .upsert(profile, { onConflict: 'id' })
                .select('id, role, facility_id, full_name, phone, email, is_active, created_at')
                .single()

            if (error) {
                await serviceClient.auth.admin.deleteUser(created.user.id)
                throw error
            }

            if (role === 'parent') {
                await replaceParentLink(serviceClient, created.user.id, cleanText(input.studentId))
            }

            await writeAudit(serviceClient, actor, 'profile_created', created.user.id, `Tạo tài khoản ${email}`)
            return jsonResponse(request, { data: mapProfile(data) }, 201)
        }

        const authUpdate: Record<string, unknown> = {
            email,
            email_confirm: true,
            user_metadata: {
                role,
                full_name: payload.full_name,
            },
        }
        if (password) authUpdate.password = password

        const { error: authError } = await serviceClient.auth.admin.updateUserById(userId, authUpdate)
        if (authError) throw authError

        const { data, error } = await serviceClient
            .from('profiles')
            .update(payload)
            .eq('id', userId)
            .select('id, role, facility_id, full_name, phone, email, is_active, created_at')
            .single()
        if (error) throw error

        if (role === 'parent') {
            await replaceParentLink(serviceClient, userId, cleanText(input.studentId))
        } else {
            await serviceClient.from('parent_student_links').delete().eq('parent_profile_id', userId)
        }

        await writeAudit(serviceClient, actor, 'profile_updated', userId, `Cập nhật tài khoản ${email}`)
        return jsonResponse(request, { data: mapProfile(data) })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Không cập nhật được tài khoản.'
        return fail(request, message, 400)
    }
})
