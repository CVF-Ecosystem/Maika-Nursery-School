import { describe, expect, it } from 'vitest'
import { mapAttendanceFromSupabase } from './attendanceService'

describe('attendance service', () => {
    it('maps Supabase attendance rows to camelCase UI shape only', () => {
        const mapped = mapAttendanceFromSupabase({
            id: 'a1',
            student_id: 's1',
            facility_id: 'f1',
            attendance_date: '2026-05-01',
            status: 'present',
            note: null,
            meal_photo_url: null,
            meal_photo_path: null,
            recorded_by: 'u1',
            check_in_time: '08:00',
            check_out_time: '16:30',
            pickup_person: 'Me',
            pickup_phone: '0901',
            late_reason: null,
            early_pickup_reason: null,
        })

        expect(mapped).toMatchObject({
            studentId: 's1',
            facilityId: 'f1',
            checkInTime: '08:00',
            checkOutTime: '16:30',
            pickupPerson: 'Me',
            pickupPhone: '0901',
        })
        expect(mapped).not.toHaveProperty('check_in_time')
        expect(mapped).not.toHaveProperty('pickup_person')
    })
})
