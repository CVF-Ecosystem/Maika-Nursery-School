import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeadersFor } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const bucket = 'maika-media'
const warningBytes = Number(Deno.env.get('MAIKA_STORAGE_WARNING_BYTES') || 800 * 1024 * 1024)

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

function objectSize(row: Record<string, unknown>) {
    const metadata = (row.metadata || {}) as Record<string, unknown>
    const size = metadata.size || metadata.contentLength || metadata.content_length
    return Number(size || 0)
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
        throw new Response(JSON.stringify({ error: 'Bạn không có quyền quản trị lưu trữ.' }), { status: 403 })
    }

    return profile
}

async function listStorageObjects(serviceClient: ReturnType<typeof createClient>) {
    const rows: Record<string, unknown>[] = []
    let from = 0
    const pageSize = 1000

    while (true) {
        const { data, error } = await serviceClient
            .schema('storage')
            .from('objects')
            .select('name, metadata, created_at, updated_at')
            .eq('bucket_id', bucket)
            .range(from, from + pageSize - 1)

        if (error) throw error
        rows.push(...(data || []))
        if (!data || data.length < pageSize) break
        from += pageSize
    }

    return rows
}

async function listArchivedAssets(serviceClient: ReturnType<typeof createClient>) {
    const { data, error } = await serviceClient
        .from('media_assets')
        .select('id, storage_path, original_name, caption, status, size_bytes, created_at')
        .eq('status', 'archived')
        .order('created_at', { ascending: false })
        .limit(500)

    if (error) throw error
    return data || []
}

async function storageSummary(serviceClient: ReturnType<typeof createClient>) {
    const [objects, archivedAssets] = await Promise.all([
        listStorageObjects(serviceClient),
        listArchivedAssets(serviceClient),
    ])
    const objectSizeByPath = new Map(objects.map(row => [String(row.name), objectSize(row)]))
    const totalBytes = objects.reduce((sum, row) => sum + objectSize(row), 0)
    const archivedBytes = archivedAssets.reduce((sum, row) => (
        sum + Number(row.size_bytes || objectSizeByPath.get(row.storage_path) || 0)
    ), 0)

    return {
        bucket,
        objectCount: objects.length,
        totalBytes,
        warningBytes,
        usageRatio: warningBytes > 0 ? totalBytes / warningBytes : 0,
        isWarning: warningBytes > 0 && totalBytes >= warningBytes,
        archivedCount: archivedAssets.length,
        archivedBytes,
        updatedAt: new Date().toISOString(),
    }
}

async function downloadArchived(serviceClient: ReturnType<typeof createClient>) {
    const assets = await listArchivedAssets(serviceClient)
    const files = []
    for (const asset of assets) {
        const { data, error } = await serviceClient.storage
            .from(bucket)
            .createSignedUrl(asset.storage_path, 3600)
        if (!error && data?.signedUrl) {
            files.push({
                id: asset.id,
                name: asset.original_name || asset.caption || asset.storage_path,
                path: asset.storage_path,
                sizeBytes: asset.size_bytes || 0,
                signedUrl: data.signedUrl,
            })
        }
    }
    return { expiresInSeconds: 3600, files }
}

async function deleteArchived(serviceClient: ReturnType<typeof createClient>, input: Record<string, unknown>) {
    if (input.confirmText !== 'XOA ANH LUU TRU') {
        throw new Error('Thiếu xác nhận xóa ảnh lưu trữ.')
    }

    const assets = await listArchivedAssets(serviceClient)
    const paths = assets.map(asset => asset.storage_path).filter(Boolean)
    if (paths.length) {
        const { error: storageError } = await serviceClient.storage.from(bucket).remove(paths)
        if (storageError) throw storageError
    }

    const ids = assets.map(asset => asset.id)
    if (ids.length) {
        const { error } = await serviceClient.from('media_assets').delete().in('id', ids)
        if (error) throw error
    }

    return {
        deletedCount: ids.length,
        deletedBytes: assets.reduce((sum, asset) => sum + Number(asset.size_bytes || 0), 0),
    }
}

Deno.serve(async (request) => {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeadersFor(request) })
    }

    if (!supabaseUrl || !anonKey || !serviceKey) {
        return fail(request, 'Storage maintenance function chưa được cấu hình.', 500)
    }

    const serviceClient = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    })

    try {
        await requireAdmin(request, serviceClient)
    } catch (error) {
        if (error instanceof Response) {
            return new Response(error.body, {
                status: error.status,
                headers: { ...corsHeadersFor(request), 'Content-Type': 'application/json' },
            })
        }
        return fail(request, 'Không xác thực được quyền admin.', 401)
    }

    try {
        if (request.method === 'GET') {
            return jsonResponse(request, { data: await storageSummary(serviceClient) })
        }

        if (request.method !== 'POST') return fail(request, 'Phương thức không được hỗ trợ.', 405)
        const input = await request.json().catch(() => ({}))
        if (input.action === 'download-archived') {
            return jsonResponse(request, { data: await downloadArchived(serviceClient) })
        }
        if (input.action === 'delete-archived') {
            return jsonResponse(request, { data: await deleteArchived(serviceClient, input) })
        }

        return fail(request, 'Thao tác không hợp lệ.', 400)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Không xử lý được lưu trữ.'
        return fail(request, message, 400)
    }
})
