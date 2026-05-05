import { describe, expect, it } from 'vitest'
import {
    buildAttendanceMonthRows,
    buildTuitionRows,
    monthDays,
    summarizeTuitionRows,
    tuitionInvoiceNumber,
} from './tuitionFromAttendance'

describe('tuitionFromAttendance', () => {
    it('counts August 2025 school days like the Maika workbook', () => {
        const days = monthDays('2025-08', true)

        expect(days).toHaveLength(31)
        expect(days.filter(day => day.isSunday)).toHaveLength(5)
        expect(days.filter(day => day.isSchoolDay)).toHaveLength(26)
    })

    it('updates calendar and billable days when changing months', () => {
        const february = monthDays('2026-02', true)
        const may = monthDays('2026-05', true)

        expect(february).toHaveLength(28)
        expect(february.filter(day => day.isSchoolDay)).toHaveLength(24)
        expect(may).toHaveLength(31)
        expect(may.filter(day => day.isSchoolDay)).toHaveLength(26)
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

    it('lets explicit K/P markers override free-text absence notes', () => {
        const students = [{ id: 'MC_01', name: 'Trần Phan Bảo Anh', className: 'Mầm + Chồi' }]
        const attendance = [
            { studentId: 'MC_01', date: '2025-08-01', status: 'absent', note: '[K] Phụ huynh xin phép muộn' },
            { studentId: 'MC_01', date: '2025-08-02', status: 'absent', note: '[P] Không ghi thêm' },
        ]

        const model = buildAttendanceMonthRows({ students, attendance, yearMonth: '2025-08', includeSaturday: true })

        expect(model.rows[0].marks['2025-08-01']).toBe('K')
        expect(model.rows[0].marks['2025-08-02']).toBe('P')
    })

    it('uses explicit absence type and class tuition rules before note fallback', () => {
        const students = [{ id: 'MC_01', name: 'Trần Phan Bảo Anh', className: 'Mầm + Chồi', facilityId: 'cs-1' }]
        const attendance = [
            { studentId: 'MC_01', date: '2025-08-01', status: 'absent', absenceType: 'permitted', note: '[K] cũ' },
            { studentId: 'MC_01', date: '2025-08-02', status: 'early_pickup' },
        ]

        const model = buildAttendanceMonthRows({ students, attendance, yearMonth: '2025-08', includeSaturday: true })
        const tuitionRows = buildTuitionRows({
            attendanceRows: model.rows,
            yearMonth: '2025-08',
            settings: {
                monthlyTuition: 1300000,
                refundPerPermittedAbsence: 20000,
                tuitionRules: [
                    {
                        facility_id: 'cs-1',
                        class_name: 'Mầm + Chồi',
                        amount: 1500000,
                        refund_per_permitted_absence: 30000,
                        meal_price_per_day: 30000,
                    },
                ],
            },
        })

        expect(model.rows[0].marks['2025-08-01']).toBe('P')
        expect(model.rows[0].mealDays).toBe(1)
        expect(tuitionRows[0].amountDue).toBe(1470000)
        expect(tuitionRows[0].tuitionRuleSource).toBe('settings')
    })

    it('creates a unique invoice number when a receipt already exists', () => {
        const row = {
            dueDate: '2025-08-01',
            studentCode: 'MC_01',
            studentId: 'student-1',
        }

        expect(tuitionInvoiceNumber(row, ['HP-202508-MC_01'])).toBe('HP-202508-MC_01-02')
    })
})
