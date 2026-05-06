import { getCurrentProfile } from '../auth/authService'
import { requireSupabase } from '../../lib/supabaseClient'

const MSG_COLUMNS =
    'id, facility_id, from_user_id, from_name, from_role, to_user_id, student_id, subject, body, parent_message_id, is_broadcast, is_read, created_at'

export async function listMessages({ facilityId } = {}) {
    const client = requireSupabase()
    let query = client
        .from('messages')
        .select(MSG_COLUMNS)
        .is('parent_message_id', null)
        .order('created_at', { ascending: false })
        .limit(200)
    if (facilityId) query = query.eq('facility_id', facilityId)
    const { data, error } = await query
    if (error) throw error

    const threads = data || []
    if (threads.length === 0) return threads

    const ids = threads.map(m => m.id)
    const { data: replies, error: rErr } = await client
        .from('messages')
        .select(MSG_COLUMNS)
        .in('parent_message_id', ids)
        .order('created_at', { ascending: true })
    if (rErr) throw rErr

    const replyMap = {}
    ;(replies || []).forEach(r => {
        if (!replyMap[r.parent_message_id]) replyMap[r.parent_message_id] = []
        replyMap[r.parent_message_id].push(r)
    })
    return threads.map(m => ({ ...m, replies: replyMap[m.id] || [] }))
}

export async function sendMessage({ facilityId, toUserId, studentId, subject, body, isBroadcast }) {
    const client = requireSupabase()
    const profile = await getCurrentProfile()
    const { data, error } = await client
        .from('messages')
        .insert({
            facility_id: facilityId || null,
            from_user_id: profile?.id,
            from_name: profile?.full_name || profile?.email || 'Unknown',
            from_role: profile?.role || 'admin',
            to_user_id: toUserId || null,
            student_id: studentId || null,
            subject: subject || '',
            body: body || '',
            is_broadcast: !!isBroadcast,
            is_read: false,
        })
        .select(MSG_COLUMNS)
        .single()
    if (error) throw error
    return { ...data, replies: [] }
}

export async function sendReply({ parentMessageId, facilityId, toUserId, studentId, body }) {
    const client = requireSupabase()
    const profile = await getCurrentProfile()
    const { data, error } = await client
        .from('messages')
        .insert({
            facility_id: facilityId || null,
            from_user_id: profile?.id,
            from_name: profile?.full_name || profile?.email || 'Unknown',
            from_role: profile?.role || 'admin',
            to_user_id: toUserId || null,
            student_id: studentId || null,
            subject: '',
            body: body || '',
            parent_message_id: parentMessageId,
            is_broadcast: false,
            is_read: false,
        })
        .select(MSG_COLUMNS)
        .single()
    if (error) throw error
    return data
}

export async function markMessageRead(id) {
    const client = requireSupabase()
    const { error } = await client.from('messages').update({ is_read: true }).eq('id', id)
    if (error) throw error
}

export function subscribeMessages({ facilityId, onChange }) {
    const client = requireSupabase()
    const uid = Math.random().toString(36).slice(2, 8)
    const channel = client
        .channel(`messages:${facilityId || 'all'}:${uid}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, payload => {
            const row = payload.new?.id ? payload.new : null
            const old = payload.old?.id ? payload.old : null
            const rowFacilityId = row?.facility_id || old?.facility_id || ''
            if (facilityId && rowFacilityId && rowFacilityId !== facilityId) return
            onChange({ eventType: payload.eventType, record: row, oldRecord: old })
        })
        .subscribe()
    return () => client.removeChannel(channel)
}
