import { requireSupabase, SUPABASE_URL } from '../../lib/supabaseClient'

async function storageMaintenanceRequest(options = {}) {
    const client = requireSupabase()
    const { data: sessionData, error: sessionError } = await client.auth.getSession()
    if (sessionError) throw sessionError
    const token = sessionData.session?.access_token
    if (!token) throw new Error('Phiên đăng nhập đã hết hạn.')

    const response = await fetch(`${SUPABASE_URL}/functions/v1/storage-maintenance`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
            ...(options.headers || {}),
        },
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.error || 'Không tải được thông tin dung lượng.')
    return body.data
}

export function getMediaStorageSummary() {
    return storageMaintenanceRequest()
}

export function createArchivedMediaDownload() {
    return storageMaintenanceRequest({
        method: 'POST',
        body: JSON.stringify({ action: 'download-archived' }),
    })
}

export function deleteArchivedMedia() {
    return storageMaintenanceRequest({
        method: 'POST',
        body: JSON.stringify({ action: 'delete-archived', confirmText: 'XOA ANH LUU TRU' }),
    })
}
