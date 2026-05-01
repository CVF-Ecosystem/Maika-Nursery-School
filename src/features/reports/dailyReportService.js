import { getCurrentProfile } from '../auth/authService'
import { requireSupabase } from '../../lib/supabaseClient'

const REPORT_COLUMNS = `
    id,
    student_id,
    facility_id,
    report_date,
    breakfast,
    lunch,
    snack,
    nap_duration,
    mood,
    activities,
    note,
    health,
    recorded_by,
    created_at,
    updated_at
`

export function mapDailyReport(row) {
    return {
        id: row.id,
        studentId: row.student_id,
        facilityId: row.facility_id,
        date: row.report_date,
        breakfast: row.breakfast || '',
        lunch: row.lunch || '',
        snack: row.snack || '',
        napDuration: row.nap_duration || 0,
        mood: row.mood || '',
        activities: row.activities || [],
        note: row.note || '',
        health: row.health || '',
        recordedBy: row.recorded_by || '',
        updatedAt: row.updated_at,
    }
}

export async function listDailyReportsByFacilityDate({ facilityId, date }) {
    const client = requireSupabase()
    let query = client
        .from('daily_reports')
        .select(REPORT_COLUMNS)
        .eq('report_date', date)
    if (facilityId) query = query.eq('facility_id', facilityId)

    const { data, error } = await query.order('updated_at', { ascending: false })
    if (error) throw error
    return (data || []).map(mapDailyReport)
}

export async function saveDailyReport(record) {
    const client = requireSupabase()
    const profile = await getCurrentProfile()
    const payload = {
        student_id: record.studentId,
        facility_id: record.facilityId,
        report_date: record.date,
        breakfast: record.breakfast || null,
        lunch: record.lunch || null,
        snack: record.snack || null,
        nap_duration: Number(record.napDuration || 0),
        mood: record.mood || null,
        activities: Array.isArray(record.activities) ? record.activities : [],
        note: record.note || null,
        health: record.health || null,
        recorded_by: record.recordedBy || profile?.id || null,
        updated_at: new Date().toISOString(),
    }
    const { data, error } = await client
        .from('daily_reports')
        .upsert(payload, { onConflict: 'student_id,report_date' })
        .select(REPORT_COLUMNS)
        .single()
    if (error) throw error
    return mapDailyReport(data)
}
