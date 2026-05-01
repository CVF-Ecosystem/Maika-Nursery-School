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
    recorded_by,
    check_in_time,
    check_out_time,
    pickup_person,
    pickup_phone,
    late_reason,
    early_pickup_reason
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
        checkInTime: row.check_in_time || '',
        checkOutTime: row.check_out_time || '',
        pickupPerson: row.pickup_person || '',
        pickupPhone: row.pickup_phone || '',
        lateReason: row.late_reason || '',
        earlyPickupReason: row.early_pickup_reason || '',
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
        check_in_time: record.checkInTime || null,
        check_out_time: record.checkOutTime || null,
        pickup_person: record.pickupPerson || null,
        pickup_phone: record.pickupPhone || null,
        late_reason: record.lateReason || null,
        early_pickup_reason: record.earlyPickupReason || null,
    }

    const { data, error } = await client
        .from('attendance')
        .upsert(payload, { onConflict: 'student_id,attendance_date' })
        .select(ATTENDANCE_COLUMNS)
        .single()

    if (error) throw error
    return mapAttendanceFromSupabase(data)
}

export function subscribeAttendanceByFacilityDate({ facilityId, date, onChange }) {
    const client = requireSupabase()
    const channel = client
        .channel(`attendance:${facilityId || 'all'}:${date}`)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'attendance', filter: `attendance_date=eq.${date}` },
            payload => {
                const nextRow = payload.new?.id ? payload.new : null
                const oldRow = payload.old?.id ? payload.old : null
                const rowFacilityId = nextRow?.facility_id || oldRow?.facility_id || ''
                if (facilityId && rowFacilityId !== facilityId) return
                onChange({
                    eventType: payload.eventType,
                    record: nextRow ? mapAttendanceFromSupabase(nextRow) : null,
                    oldRecord: oldRow ? mapAttendanceFromSupabase(oldRow) : null,
                })
            },
        )
        .subscribe()

    return () => client.removeChannel(channel)
}
