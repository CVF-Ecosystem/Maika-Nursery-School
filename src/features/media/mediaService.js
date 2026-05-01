import { getCurrentProfile } from '../auth/authService'
import { requireSupabase } from '../../lib/supabaseClient'

const BUCKET = 'maika-media'

const ALBUM_COLUMNS = 'id, facility_id, title, description, status, created_by, created_at'
const ASSET_COLUMNS = 'id, album_id, facility_id, student_id, storage_path, public_url, original_name, mime_type, caption, status, created_by, created_at'
const SIGNED_URL_TTL_SECONDS = 600

export function mapAlbum(row) {
    return {
        id: row.id,
        facilityId: row.facility_id || '',
        title: row.title,
        description: row.description || '',
        status: row.status || 'draft',
        createdBy: row.created_by || '',
        createdAt: row.created_at,
    }
}

export function mapAsset(row) {
    return {
        id: row.id,
        albumId: row.album_id || '',
        facilityId: row.facility_id || '',
        studentId: row.student_id || '',
        path: row.storage_path,
        url: row.signed_url || '',
        originalName: row.original_name || '',
        mimeType: row.mime_type || '',
        caption: row.caption || '',
        status: row.status || 'draft',
        createdBy: row.created_by || '',
        createdAt: row.created_at,
    }
}

export async function getSignedUrl(storagePath, expiresInSeconds = SIGNED_URL_TTL_SECONDS) {
    if (!storagePath) return ''
    const client = requireSupabase()
    const { data, error } = await client.storage
        .from(BUCKET)
        .createSignedUrl(storagePath, expiresInSeconds)
    if (error) throw error
    return data?.signedUrl || ''
}

export async function listAlbums({ facilityId } = {}) {
    const client = requireSupabase()
    let query = client.from('media_albums').select(ALBUM_COLUMNS).order('created_at', { ascending: false })
    if (facilityId) query = query.eq('facility_id', facilityId)
    const { data, error } = await query
    if (error) throw error
    return (data || []).map(mapAlbum)
}

export async function saveAlbum(input) {
    const client = requireSupabase()
    const profile = await getCurrentProfile()
    const payload = {
        ...(input.id ? { id: input.id } : {}),
        facility_id: input.facilityId || profile?.facility_id || null,
        title: input.title?.trim(),
        description: input.description || null,
        status: input.status || 'draft',
        created_by: profile?.id || null,
    }
    const { data, error } = await client
        .from('media_albums')
        .upsert(payload, { onConflict: 'id' })
        .select(ALBUM_COLUMNS)
        .single()
    if (error) throw error
    return mapAlbum(data)
}

export async function listAssets({ albumId, facilityId } = {}) {
    const client = requireSupabase()
    let query = client.from('media_assets').select(ASSET_COLUMNS).order('created_at', { ascending: false })
    if (albumId) query = query.eq('album_id', albumId)
    if (facilityId) query = query.eq('facility_id', facilityId)
    const { data, error } = await query
    if (error) throw error
    return Promise.all((data || []).map(async row => mapAsset({
        ...row,
        signed_url: await getSignedUrl(row.storage_path),
    })))
}

export async function updateAssetStatus(id, status) {
    const client = requireSupabase()
    const { data, error } = await client
        .from('media_assets')
        .update({ status })
        .eq('id', id)
        .select(ASSET_COLUMNS)
        .single()
    if (error) throw error
    return mapAsset(data)
}

export async function uploadMediaAsset({ file, albumId, facilityId, studentId, caption }) {
    const client = requireSupabase()
    const profile = await getCurrentProfile()
    const ownerFacility = facilityId || profile?.facility_id || null
    const safeName = file.name.replace(/[^\w.-]+/g, '-')
    const path = `${ownerFacility || 'shared'}/${Date.now()}-${safeName}`

    const upload = await client.storage.from(BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
    })
    if (upload.error) throw upload.error

    const { data, error } = await client
        .from('media_assets')
        .insert({
            album_id: albumId || null,
            facility_id: ownerFacility,
            student_id: studentId || null,
            storage_path: path,
            public_url: null,
            original_name: file.name,
            mime_type: file.type,
            caption: caption || file.name,
            status: 'draft',
            created_by: profile?.id || null,
        })
        .select(ASSET_COLUMNS)
        .single()
    if (error) throw error
    return mapAsset({ ...data, signed_url: await getSignedUrl(data.storage_path) })
}
