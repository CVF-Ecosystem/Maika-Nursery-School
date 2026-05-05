import { requireSupabase } from '../../lib/supabaseClient'

const ATTENDANCE_COLUMNS = `
    id,
    student_id,
    facility_id,
    attendance_date,
    status,
    absence_type,
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
        absenceType: row.absence_type || '',
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
    let query = client.from('attendance').select(ATTENDANCE_COLUMNS).eq('attendance_date', date)

    if (facilityId) query = query.eq('facility_id', facilityId)

    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw error
    return (data || []).map(mapAttendanceFromSupabase)
}

export async function listAttendanceByFacilityDateRange({ facilityId, startDate, endDate }) {
    const client = requireSupabase()
    let query = client
        .from('attendance')
        .select(ATTENDANCE_COLUMNS)
        .gte('attendance_date', startDate)
        .lte('attendance_date', endDate)

    if (facilityId) query = query.eq('facility_id', facilityId)

    const { data, error } = await query
        .order('attendance_date', { ascending: true })
        .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []).map(mapAttendanceFromSupabase)
}

export async function upsertAttendance(record) {
    const client = requireSupabase()
    const { data, error } = await client.rpc('mark_attendance', {
        p_student_id: record.studentId,
        p_attendance_date: record.date,
        p_status: record.status,
        p_note: record.note || null,
        p_check_in_time: record.checkInTime || null,
        p_check_out_time: record.checkOutTime || null,
        p_pickup_person: record.pickupPerson || null,
        p_pickup_phone: record.pickupPhone || null,
        p_late_reason: record.lateReason || null,
        p_early_pickup_reason: record.earlyPickupReason || null,
        p_meal_photo_url: record.mealPhotoUrl || null,
        p_meal_photo_path: record.mealPhotoPath || null,
        p_absence_type: record.absenceType || null,
    })

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
