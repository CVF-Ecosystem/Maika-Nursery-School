import { describe, expect, it } from 'vitest'
import { buildAttendanceMonthRows, buildTuitionRows, monthDays, summarizeTuitionRows } from './tuitionFromAttendance'

describe('tuitionFromAttendance', () => {
    it('counts August 2025 school days like the Maika workbook', () => {
        const days = monthDays('2025-08', true)

        expect(days).toHaveLength(31)
        expect(days.filter(day => day.isSunday)).toHaveLength(5)
        expect(days.filter(day => day.isSchoolDay)).toHaveLength(26)
    })

    it('maps monthly attendance into symbols and tuition rows', () => {
        const students = [{ id: 'MC_01', name: 'Trần Phan Bảo Anh', className: 'Mầm + Chồi' }]
        const attendance = [
            { studentId: 'MC_01', date: '2025-08-01', status: 'absent', note: 'Phụ huynh xin phép' },
            { studentId: 'MC_01', date: '2025-08-02', status: 'present' },
            { studentId: 'MC_01', date: '2025-08-05', status: 'late' },
            { studentId: 'MC_01', date: '2025-08-06', status: 'early_pickup' },
            { studentId: 'MC_01', date: '2025-08-07', status: 'absent', note: '' },
        ]

        const model = buildAttendanceMonthRows({ students, attendance, yearMonth: '2025-08', includeSaturday: true })
        const row = model.rows[0]

        expect(row.marks['2025-08-01']).toBe('P')
        expect(row.marks['2025-08-02']).toBe('x')
        expect(row.marks['2025-08-05']).toBe('x')
        expect(row.marks['2025-08-06']).toBe('x/2')
        expect(row.marks['2025-08-07']).toBe('K')
        expect(row.actualDays).toBe(2.5)
        expect(row.permittedAbsences).toBe(1)
        expect(row.unpermittedAbsences).toBe(1)

        const tuitionRows = buildTuitionRows({
            attendanceRows: model.rows,
            yearMonth: '2025-08',
            settings: { monthlyTuition: 1300000, refundPerPermittedAbsence: 20000 },
            previousCredits: { MC_01: 5000 },
        })

        expect(tuitionRows[0].amountDue).toBe(1275000)
        expect(summarizeTuitionRows(tuitionRows).amountDue).toBe(1275000)
    })
})
