import { requireSupabase } from '../../lib/supabaseClient'

const ATTENDANCE_COLUMNS = `
    id,
    student_id,
    facility_id,
    attendance_date,
    status,
    note,
    meal_photo_url,
    meal_photo_path,
    recorded_by
`

export function mapAttendanceFromSupabase(row) {
    return {
        id: row.id,
        studentId: row.student_id,
        facilityId: row.facility_id,
        date: row.attendance_date,
        status: row.status,
        note: row.note || '',
        mealPhotoUrl: row.meal_photo_url || '',
        mealPhotoPath: row.meal_photo_path || '',
        recordedBy: row.recorded_by || '',
    }
}

export async function listAttendanceByFacilityDate({ facilityId, date }) {
    const client = requireSupabase()
    let query = client
        .from('attendance')
        .select(ATTENDANCE_COLUMNS)
        .eq('attendance_date', date)

    if (facilityId) query = query.eq('facility_id', facilityId)

    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw error
    return (data || []).map(mapAttendanceFromSupabase)
}

export async function upsertAttendance(record) {
    const client = requireSupabase()
    const payload = {
        student_id: record.studentId,
        facility_id: record.facilityId,
        attendance_date: record.date,
        status: record.status,
        note: record.note || null,
        meal_photo_url: record.mealPhotoUrl || null,
        meal_photo_path: record.mealPhotoPath || null,
        recorded_by: record.recordedBy || null,
    }

    const { data, error } = await client
        .from('attendance')
        .upsert(payload, { onConflict: 'student_id,attendance_date' })
        .select(ATTENDANCE_COLUMNS)
        .single()

    if (error) throw error
    return mapAttendanceFromSupabase(data)
}
