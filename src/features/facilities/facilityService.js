import { requireSupabase } from '../../lib/supabaseClient'

export function mapFacilityFromSupabase(row) {
    return {
        id: row.id,
        code: row.code,
        name: row.name,
        address: row.address || '',
        phone: row.phone || '',
        isActive: row.is_active,
    }
}

export async function listFacilities() {
    const client = requireSupabase()
    const { data, error } = await client
        .from('facilities')
        .select('id, code, name, address, phone, is_active')
        .eq('is_active', true)
        .order('code', { ascending: true })

    if (error) throw error
    return (data || []).map(mapFacilityFromSupabase)
}
