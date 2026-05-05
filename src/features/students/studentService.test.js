import { describe, expect, it } from 'vitest'
import { mapStudentFromSupabase } from './studentService'

describe('student service', () => {
    it('maps Supabase rows to UI student shape', () => {
        expect(
            mapStudentFromSupabase({
                id: 's1',
                facility_id: 'f1',
                full_name: 'Bé Maika',
                dob: null,
                gender: null,
                class_name: 'Nhà Trẻ',
                parent_name: 'Phụ huynh',
                parent_phone: null,
                parent_email: null,
                status: 'active',
                notes: null,
            }),
        ).toEqual({
            id: 's1',
            facilityId: 'f1',
            name: 'Bé Maika',
            dob: '',
            gender: 'unknown',
            className: 'Nhà Trẻ',
            parentName: 'Phụ huynh',
            parentPhone: '',
            parentEmail: '',
            enrollmentDate: '',
            status: 'active',
            notes: '',
        })
    })
})
