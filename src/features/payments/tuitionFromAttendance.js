import { buildReceiptNumber } from './receiptNumbers'

export const DEFAULT_TUITION_SETTINGS = {
    monthlyTuition: 1300000,
    refundPerPermittedAbsence: 20000,
    includeSaturday: true,
}

const VI_WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']

function localDate(year, monthIndex, day) {
    return new Date(year, monthIndex, day, 12, 0, 0)
}

function isoDate(year, monthIndex, day) {
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function monthRange(yearMonth) {
    const [year, month] = String(yearMonth).split('-').map(Number)
    const safeDate = Number.isFinite(year) && Number.isFinite(month) ? localDate(year, month - 1, 1) : new Date()
    const safeYear = safeDate.getFullYear()
    const safeMonthIndex = safeDate.getMonth()
    const lastDay = localDate(safeYear, safeMonthIndex + 1, 0).getDate()
    return {
        year: safeYear,
        month: safeMonthIndex + 1,
        startDate: isoDate(safeYear, safeMonthIndex, 1),
        endDate: isoDate(safeYear, safeMonthIndex, lastDay),
        daysInMonth: lastDay,
    }
}

export function monthDays(yearMonth, includeSaturday = true) {
    const range = monthRange(yearMonth)
    return Array.from({ length: range.daysInMonth }, (_, index) => {
        const day = index + 1
        const date = localDate(range.year, range.month - 1, day)
        const weekday = date.getDay()
        return {
            day,
            date: isoDate(range.year, range.month - 1, day),
            weekday,
            weekdayLabel: VI_WEEKDAYS[weekday],
            isSunday: weekday === 0,
            isSaturday: weekday === 6,
            isSchoolDay: weekday !== 0 && (includeSaturday || weekday !== 6),
        }
    })
}

export function normalizeTuitionNumber(value) {
    if (typeof value === 'number') return Math.max(0, Math.round(value))
    const digits = String(value || '').replace(/[^\d.-]/g, '')
    return Math.max(0, Math.round(Number(digits || 0)))
}

function normalizeText(value = '') {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
}

function isPermittedAbsence(record) {
    const note = normalizeText(record?.note || '')
    if (note.startsWith('[k]')) return false
    if (note.startsWith('[p]')) return true
    return (
        note === 'p' ||
        note.includes('co phep') ||
        note.includes('xin phep') ||
        note.includes('xin nghi') ||
        note.includes('phu huynh bao')
    )
}

export function attendanceSymbol(record) {
    if (!record) return ''
    if (record.status === 'present' || record.status === 'late') return 'x'
    if (record.status === 'early_pickup') return 'x/2'
    if (record.status === 'holiday') return 'L'
    if (record.status === 'absent') return isPermittedAbsence(record) ? 'P' : 'K'
    return ''
}

function attendanceWeight(symbol) {
    if (symbol === 'x') return 1
    if (symbol === 'x/2') return 0.5
    return 0
}

function classNameForStudent(student, classes = []) {
    if (student?.className) return student.className
    const cls = classes.find(item => item.id === student?.classId)
    return cls?.name || ''
}

function prefixForClass(className = '') {
    const text = normalizeText(className).replace(/\s+/g, '')
    if (text.includes('nhatre')) return 'NT'
    if (text.includes('mam') || text.includes('choi')) return 'MC'
    return 'HS'
}

export function studentTuitionCode(student, index, className = '') {
    if (student?.code) return student.code
    if (student?.studentCode) return student.studentCode
    if (/^[A-Z]{1,4}_?\d+$/i.test(String(student?.id || ''))) return student.id
    return `${prefixForClass(className)}_${String(index + 1).padStart(2, '0')}`
}

export function buildAttendanceMonthRows({
    students = [],
    classes = [],
    attendance = [],
    yearMonth,
    includeSaturday = true,
}) {
    const days = monthDays(yearMonth, includeSaturday)
    const schoolDayCount = days.filter(day => day.isSchoolDay).length
    const attendanceByStudentDate = new Map()

    attendance.forEach(record => {
        const key = `${record.studentId || record.student_id}:${record.date || record.attendance_date}`
        attendanceByStudentDate.set(key, record)
    })

    const rows = students.map((student, index) => {
        const className = classNameForStudent(student, classes)
        const marks = {}
        const counts = {
            fullDays: 0,
            halfDays: 0,
            actualDays: 0,
            permittedAbsences: 0,
            holidayAbsences: 0,
            unpermittedAbsences: 0,
            missingSchoolDays: 0,
        }

        days.forEach(day => {
            const record = attendanceByStudentDate.get(`${student.id}:${day.date}`)
            const symbol = attendanceSymbol(record)
            marks[day.date] = symbol
            counts.actualDays += attendanceWeight(symbol)
            if (symbol === 'x') counts.fullDays += 1
            if (symbol === 'x/2') counts.halfDays += 1
            if (symbol === 'P') counts.permittedAbsences += 1
            if (symbol === 'L') counts.holidayAbsences += 1
            if (symbol === 'K') counts.unpermittedAbsences += 1
            if (day.isSchoolDay && !symbol) counts.missingSchoolDays += 1
        })

        return {
            student,
            studentId: student.id,
            studentCode: studentTuitionCode(student, index, className),
            studentName: student.name || '',
            className,
            marks,
            schoolDayCount,
            ...counts,
        }
    })

    return { days, rows, schoolDayCount }
}

export function buildTuitionRows({ attendanceRows = [], yearMonth, settings = {}, previousCredits = {} }) {
    const mergedSettings = { ...DEFAULT_TUITION_SETTINGS, ...settings }
    const range = monthRange(yearMonth)
    const dueDate = `${range.year}-${String(range.month).padStart(2, '0')}-01`

    return attendanceRows.map(row => {
        const monthlyTuition = normalizeTuitionNumber(mergedSettings.monthlyTuition)
        const refundPerPermittedAbsence = normalizeTuitionNumber(mergedSettings.refundPerPermittedAbsence)
        const previousCredit = normalizeTuitionNumber(previousCredits[row.studentId])
        const refundAmount = row.permittedAbsences * refundPerPermittedAbsence
        const totalCredit = previousCredit + refundAmount
        const amountDue = Math.max(0, monthlyTuition - totalCredit)

        return {
            ...row,
            monthlyTuition,
            refundPerPermittedAbsence,
            previousCredit,
            refundAmount,
            totalCredit,
            amountDue,
            dueDate,
            description: `Học phí tháng ${range.month}/${range.year}${row.className ? ` - ${row.className}` : ''}`,
        }
    })
}

export function summarizeTuitionRows(rows = []) {
    return rows.reduce(
        (sum, row) => ({
            monthlyTuition: sum.monthlyTuition + row.monthlyTuition,
            actualDays: sum.actualDays + row.actualDays,
            permittedAbsences: sum.permittedAbsences + row.permittedAbsences,
            unpermittedAbsences: sum.unpermittedAbsences + row.unpermittedAbsences,
            totalCredit: sum.totalCredit + row.totalCredit,
            amountDue: sum.amountDue + row.amountDue,
        }),
        {
            monthlyTuition: 0,
            actualDays: 0,
            permittedAbsences: 0,
            unpermittedAbsences: 0,
            totalCredit: 0,
            amountDue: 0,
        },
    )
}

export function tuitionInvoiceNumber(row) {
    return buildReceiptNumber({
        type: 'tuition',
        dueDate: row.dueDate,
        studentCode: row.studentCode,
        fallbackCode: row.studentId,
    })
}
