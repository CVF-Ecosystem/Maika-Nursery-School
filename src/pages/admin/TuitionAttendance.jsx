import { useEffect, useMemo, useState } from 'react'
import { isSupabaseSession } from '../../data/backendMode'
import { commit, getDB } from '../../data/store'
import { listAttendanceByFacilityDateRange } from '../../features/attendance/attendanceService'
import { listFeeItems, listTuitionPlans } from '../../features/operations/operationalService'
import {
    deleteStudentTuitionOverride,
    listStudentTuitionCredits,
    listStudentTuitionOverrides,
    saveMonthlyFeeNotices,
    upsertStudentTuitionCredit,
    upsertStudentTuitionOverride,
} from '../../features/payments/feeNoticeService'
import { listStudents } from '../../features/students/studentService'
import { fmtMoney } from '../../utils/format'
import MoneyInput from '../../components/MoneyInput'
import {
    DEFAULT_TUITION_SETTINGS,
    buildAttendanceMonthRows,
    buildTuitionRows,
    monthRange,
    normalizeTuitionNumber,
    summarizeTuitionRows,
    tuitionInvoiceNumber,
} from '../../features/payments/tuitionFromAttendance'

function currentYearMonth() {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function storageKey(yearMonth) {
    return `maika_tuition_attendance_${yearMonth}`
}

function loadSavedSettings(yearMonth) {
    try {
        const saved = JSON.parse(localStorage.getItem(storageKey(yearMonth)) || '{}')
        return {
            settings: { ...DEFAULT_TUITION_SETTINGS, ...(saved.settings || {}) },
            credits: saved.credits || {},
        }
    } catch {
        return { settings: DEFAULT_TUITION_SETTINGS, credits: {} }
    }
}

function saveLocalSettings(yearMonth, settings, credits) {
    localStorage.setItem(storageKey(yearMonth), JSON.stringify({ settings, credits }))
}

function classValue(student, supabaseMode) {
    return supabaseMode ? student.className || '' : student.classId || ''
}

function statusColor(symbol) {
    if (symbol === 'x') return ['#ECFDF5', '#059669']
    if (symbol === 'x/2') return ['#EFF6FF', '#2563EB']
    if (symbol === 'P') return ['#FFFBEB', '#B45309']
    if (symbol === 'K') return ['#FEF2F2', '#DC2626']
    if (symbol === 'L') return ['#F5F5F4', '#6B7280']
    return ['transparent', '#9B93C9']
}

function numberInputStyle(width = 132) {
    return {
        width,
        padding: '9px 11px',
        borderRadius: 10,
        border: '1.5px solid #DDD6FE',
        fontSize: 13,
        fontWeight: 600,
        color: '#1E1B4B',
        background: '#fff',
        lineHeight: 1.25,
    }
}

const readonlyInfoStyle = {
    minWidth: 132,
    padding: '9px 11px',
    borderRadius: 10,
    border: '1.5px solid #DDD6FE',
    fontSize: 13,
    fontWeight: 600,
    color: '#5B5490',
    background: '#fff',
    lineHeight: 1.25,
}

function buttonStyle({ primary = false, danger = false, disabled = false } = {}) {
    return {
        padding: '10px 14px',
        borderRadius: 12,
        border: primary ? 'none' : `1.5px solid ${danger ? '#FCA5A5' : '#DDD6FE'}`,
        background: disabled ? '#F8F7FF' : primary ? 'linear-gradient(135deg,#6D28D9,#8B5CF6)' : '#fff',
        color: disabled ? '#A8A0C8' : primary ? '#fff' : danger ? '#DC2626' : '#6D28D9',
        fontSize: 13,
        fontWeight: 700,
        lineHeight: 1.25,
        cursor: disabled ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap',
    }
}

async function exportWorkbook({ yearMonth, days, attendanceRows, tuitionRows, summary, classLabel }) {
    const XLSX = await import('@e965/xlsx')
    const range = monthRange(yearMonth)
    const titleMonth = `Tháng ${String(range.month).padStart(2, '0')} năm ${range.year}`
    const sundayCount = days.filter(day => day.isSunday).length
    const attendanceSheet = [
        ['MẦM NON THIÊN THẦN MAIKA', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'BẢNG ĐIỂM DANH'],
        ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', titleMonth],
        [],
        ['', 'Tháng', range.month],
        ['', 'Năm', range.year],
        ['', 'Số ngày trong tháng', range.daysInMonth],
        [],
        [
            'STT',
            'MSHS',
            'HỌ VÀ TÊN',
            titleMonth,
            ...days.slice(1).map(() => ''),
            'Đủ ngày',
            'Nửa ngày',
            'Tổng ngày học',
            'Nghỉ có phép',
            'Nghỉ Lễ',
            'Nghỉ không phép',
        ],
        ['', '', '', ...days.map(day => day.day), '', '', '', '', '', ''],
        ['', '', '', ...days.map(day => day.weekdayLabel), '', '', '', '', '', ''],
        ...attendanceRows.map((row, index) => [
            index + 1,
            row.studentCode,
            row.studentName,
            ...days.map(day => row.marks[day.date] || ''),
            row.fullDays,
            row.halfDays,
            row.actualDays,
            row.permittedAbsences,
            row.holidayAbsences,
            row.unpermittedAbsences,
        ]),
        [],
        ['Quy ước'],
        ['1. Đi học đủ ngày kí hiệu: x'],
        ['2. Đi học nửa ngày kí hiệu: x/2'],
        ['3. Nghỉ lễ kí hiệu: L'],
        ['4. Nghỉ có xin phép: P'],
        ['5. Nghỉ không xin phép: K'],
    ]
    const tuitionSheet = [
        ['MẦM NON THIÊN THẦN MAIKA', '', '', '', 'BẢNG THEO DÕI HỌC PHÍ'],
        [],
        ['', 'Tháng', range.month, '', titleMonth],
        ['', 'Năm', range.year],
        ['', 'Ngày học chuẩn trong tháng', attendanceRows[0]?.schoolDayCount || 0],
        [
            'STT',
            'MSHS',
            'Họ và tên',
            'Lớp',
            'Học phí',
            'Số ngày đi học thực tế',
            'Số ngày vắng không phép',
            'Số ngày vắng có phép',
            'Tiền hoàn lại',
            'Tiền thừa tháng trước',
            'Tiền phải thu trong tháng',
            'Ngày nộp tiền',
            'Họ & Tên người nộp tiền',
            'Số tiền nộp',
            'Ghi chú',
            '',
            'Số ngày chủ nhật',
            sundayCount,
        ],
        [
            '',
            '',
            '',
            '',
            summary.monthlyTuition,
            summary.actualDays,
            summary.unpermittedAbsences,
            summary.permittedAbsences,
            summary.totalCredit,
            '',
            summary.amountDue,
        ],
        ...tuitionRows.map((row, index) => [
            index + 1,
            row.studentCode,
            row.studentName,
            row.className,
            row.monthlyTuition,
            row.actualDays,
            row.unpermittedAbsences,
            row.permittedAbsences,
            row.refundAmount,
            row.previousCredit,
            row.amountDue,
            '',
            row.student.parentName || '',
            '',
            row.missingSchoolDays ? `Còn ${row.missingSchoolDays} ngày chưa điểm danh` : '',
        ]),
    ]

    const workbook = XLSX.utils.book_new()
    const wsAttendance = XLSX.utils.aoa_to_sheet(attendanceSheet)
    const wsTuition = XLSX.utils.aoa_to_sheet(tuitionSheet)
    wsAttendance['!cols'] = [
        { wch: 6 },
        { wch: 12 },
        { wch: 28 },
        ...days.map(() => ({ wch: 6 })),
        { wch: 10 },
        { wch: 10 },
        { wch: 14 },
        { wch: 12 },
        { wch: 10 },
        { wch: 14 },
    ]
    wsTuition['!cols'] = [
        { wch: 6 },
        { wch: 12 },
        { wch: 28 },
        { wch: 16 },
        { wch: 14 },
        { wch: 16 },
        { wch: 16 },
        { wch: 16 },
        { wch: 14 },
        { wch: 16 },
        { wch: 18 },
        { wch: 14 },
        { wch: 24 },
        { wch: 14 },
        { wch: 32 },
    ]
    XLSX.utils.book_append_sheet(workbook, wsAttendance, 'Bảng điểm danh học sinh')
    XLSX.utils.book_append_sheet(workbook, wsTuition, 'Bảng học phí_nội bộ')
    const suffix = classLabel ? classLabel.toLowerCase().replace(/\s+/g, '-') : 'tat-ca'
    XLSX.writeFile(workbook, `bang-hoc-phi-diem-danh-${suffix}-${yearMonth}.xlsx`)
}

export default function TuitionAttendance({ selectedFacilityId = '' }) {
    const supabaseMode = isSupabaseSession()
    const [yearMonth, setYearMonth] = useState(currentYearMonth)
    const loaded = useMemo(() => loadSavedSettings(yearMonth), [yearMonth])
    const [settings, setSettings] = useState(loaded.settings)
    const [credits, setCredits] = useState(loaded.credits)
    const [students, setStudents] = useState([])
    const [classes, setClasses] = useState([])
    const [attendance, setAttendance] = useState([])
    const [tuitionRules, setTuitionRules] = useState([])
    const [feeItems, setFeeItems] = useState([])
    const [tuitionOverrides, setTuitionOverrides] = useState({})
    const [feeItemSelections, setFeeItemSelections] = useState({})
    const [classFilter, setClassFilter] = useState('')
    const [view, setView] = useState('tuition')
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [showPreview, setShowPreview] = useState(false)
    const [feePickerRow, setFeePickerRow] = useState(null)

    useEffect(() => {
        const next = loadSavedSettings(yearMonth)
        setSettings(next.settings)
        setCredits(next.credits)
    }, [yearMonth])

    useEffect(() => {
        saveLocalSettings(yearMonth, settings, credits)
    }, [yearMonth, settings, credits])

    useEffect(() => {
        let mounted = true
        async function load() {
            setLoading(true)
            setError('')
            try {
                const range = monthRange(yearMonth)
                if (supabaseMode) {
                    const [studentItems, attendanceItems, tuitionRuleItems, creditItems, feeItemItems, overrideItems] =
                        await Promise.all([
                            listStudents({ facilityId: selectedFacilityId || undefined, status: 'active' }),
                            listAttendanceByFacilityDateRange({
                                facilityId: selectedFacilityId || undefined,
                                startDate: range.startDate,
                                endDate: range.endDate,
                            }),
                            listTuitionPlans({ activeOnly: true }),
                            listStudentTuitionCredits({ facilityId: selectedFacilityId || undefined, yearMonth }),
                            listFeeItems({ activeOnly: true }),
                            listStudentTuitionOverrides({ facilityId: selectedFacilityId || undefined, yearMonth }),
                        ])
                    if (!mounted) return
                    setStudents(studentItems)
                    setClasses([...new Set(studentItems.map(student => student.className).filter(Boolean))])
                    setAttendance(attendanceItems)
                    setTuitionRules(tuitionRuleItems)
                    setFeeItems(
                        feeItemItems.filter(
                            item =>
                                item.category === 'optional' &&
                                (!item.facility_id || !selectedFacilityId || item.facility_id === selectedFacilityId),
                        ),
                    )
                    setCredits(
                        Object.fromEntries(
                            creditItems.map(item => [item.student_id, normalizeTuitionNumber(item.amount)]),
                        ),
                    )
                    setTuitionOverrides(
                        Object.fromEntries(
                            overrideItems.map(item => [
                                item.student_id,
                                { amount: normalizeTuitionNumber(item.amount), reason: item.reason || '' },
                            ]),
                        ),
                    )
                    return
                }

                const db = getDB()
                const localStudents = (db.students || []).filter(student => student.status === 'active')
                const localAttendance = (db.attendance || []).filter(
                    record => record.date >= range.startDate && record.date <= range.endDate,
                )
                if (!mounted) return
                setStudents(localStudents)
                setClasses(db.classes || [])
                setAttendance(localAttendance)
                setTuitionRules([])
                setFeeItems([])
                setTuitionOverrides({})
            } catch (ex) {
                if (mounted) setError(ex.message || 'Không tải được dữ liệu điểm danh.')
            } finally {
                if (mounted) setLoading(false)
            }
        }
        load()
        return () => {
            mounted = false
        }
    }, [supabaseMode, selectedFacilityId, yearMonth])

    const filteredStudents = useMemo(() => {
        if (!classFilter) return students
        return students.filter(student => classValue(student, supabaseMode) === classFilter)
    }, [students, classFilter, supabaseMode])

    const attendanceModel = useMemo(
        () =>
            buildAttendanceMonthRows({
                students: filteredStudents,
                classes: supabaseMode ? [] : classes,
                attendance,
                yearMonth,
                includeSaturday: settings.includeSaturday,
            }),
        [attendance, classes, filteredStudents, settings.includeSaturday, supabaseMode, yearMonth],
    )

    const tuitionRows = useMemo(
        () =>
            buildTuitionRows({
                attendanceRows: attendanceModel.rows,
                yearMonth,
                settings: { ...settings, tuitionRules },
                previousCredits: credits,
                tuitionOverrides,
            }),
        [attendanceModel.rows, credits, settings, tuitionOverrides, tuitionRules, yearMonth],
    )
    const feeItemMap = useMemo(() => new Map(feeItems.map(item => [item.id, item])), [feeItems])
    const billingRows = useMemo(
        () =>
            tuitionRows.map(row => {
                const selectedIds = feeItemSelections[row.studentId] || []
                const extraFeeItems = selectedIds.map(id => feeItemMap.get(id)).filter(Boolean)
                const optionalFeeTotal = extraFeeItems.reduce(
                    (sum, item) => sum + normalizeTuitionNumber(item.default_amount),
                    0,
                )
                return {
                    ...row,
                    baseAmountDue: row.amountDue,
                    extraFeeItems,
                    optionalFeeTotal,
                    amountDue: row.amountDue + optionalFeeTotal,
                    totalCredit: row.totalCredit,
                }
            }),
        [feeItemMap, feeItemSelections, tuitionRows],
    )
    const summary = useMemo(() => summarizeTuitionRows(billingRows), [billingRows])
    const classOptions = supabaseMode
        ? classes.map(name => ({ id: name, name }))
        : classes.map(item => ({ id: item.id, name: item.name }))
    const classLabel = classOptions.find(item => item.id === classFilter)?.name || ''
    const missingAttendanceCount = billingRows.filter(row => row.missingSchoolDays > 0).length

    function updateSetting(name, value) {
        setSettings(prev => ({
            ...prev,
            [name]: name === 'includeSaturday' ? value : normalizeTuitionNumber(value),
        }))
    }

    async function updateCredit(studentId, value) {
        const amount = normalizeTuitionNumber(value)
        setCredits(prev => ({ ...prev, [studentId]: amount }))
        if (!supabaseMode) return
        const student = students.find(item => item.id === studentId)
        if (!student?.facilityId) return
        try {
            await upsertStudentTuitionCredit({
                studentId,
                facilityId: student.facilityId,
                yearMonth,
                amount,
                note: `Tiền thừa/cấn trừ nhập tại bảng thu tháng ${yearMonth}.`,
            })
        } catch (ex) {
            setError(ex.message || 'Chưa lưu được tiền thừa tháng trước.')
        }
    }

    async function updateTuitionOverride(studentId, value) {
        const amount = normalizeTuitionNumber(value)
        setTuitionOverrides(prev => ({
            ...prev,
            [studentId]: amount ? { amount, reason: `Nhập riêng tại bảng thu tháng ${yearMonth}.` } : null,
        }))
        if (!supabaseMode) return
        const student = students.find(item => item.id === studentId)
        if (!student?.facilityId) return
        try {
            if (!amount) {
                await deleteStudentTuitionOverride({ studentId, yearMonth })
                return
            }
            await upsertStudentTuitionOverride({
                studentId,
                facilityId: student.facilityId,
                yearMonth,
                amount,
                reason: `Học phí riêng nhập tại bảng thu tháng ${yearMonth}.`,
            })
        } catch (ex) {
            setError(ex.message || 'Chưa lưu được học phí riêng.')
        }
    }

    function toggleStudentFeeItem(studentId, feeItemId, checked) {
        setFeeItemSelections(prev => {
            const current = new Set(prev[studentId] || [])
            if (checked) current.add(feeItemId)
            else current.delete(feeItemId)
            return { ...prev, [studentId]: [...current] }
        })
    }

    function toggleFeeItemForRows(feeItemId, checked) {
        setFeeItemSelections(prev => {
            const next = { ...prev }
            billingRows.forEach(row => {
                const current = new Set(next[row.studentId] || [])
                if (checked) current.add(feeItemId)
                else current.delete(feeItemId)
                next[row.studentId] = [...current]
            })
            return next
        })
    }

    async function handleExport() {
        setError('')
        setMessage('')
        try {
            await exportWorkbook({
                yearMonth,
                days: attendanceModel.days,
                attendanceRows: attendanceModel.rows,
                tuitionRows: billingRows,
                summary,
                classLabel,
            })
            setMessage('Đã xuất file Excel theo mẫu bảng điểm danh và bảng học phí.')
        } catch (ex) {
            setError(ex.message || 'Không xuất được Excel.')
        }
    }

    function handleGenerateClick() {
        const payableRows = billingRows.filter(row => row.studentId && row.amountDue > 0)
        if (!payableRows.length) {
            setMessage('Không có khoản học phí cần tạo.')
            return
        }
        setShowPreview(true)
    }

    async function generateInvoices() {
        setSaving(true)
        setShowPreview(false)
        setMessage('')
        setError('')
        try {
            const payableRows = billingRows.filter(row => row.studentId && row.amountDue > 0)
            if (!payableRows.length) {
                setMessage('Không có khoản học phí cần tạo.')
                return
            }

            if (supabaseMode) {
                const result = await saveMonthlyFeeNotices({
                    rows: payableRows,
                    yearMonth,
                    facilityId: selectedFacilityId || undefined,
                })
                setMessage(
                    `Đã tạo ${result.created}, cập nhật ${result.updated} phiếu thông báo${
                        result.adjusted ? `, tạo ${result.adjusted} bản điều chỉnh` : ''
                    }${result.credited ? `, ghi ${result.credited} khoản cấn trừ tháng sau` : ''}.`,
                )
                return
            }

            const db = getDB()
            if (!Array.isArray(db.finance)) db.finance = []
            const existingNumbers = new Set((db.finance || []).map(item => item.invoiceNumber).filter(Boolean))
            const existingTuitionKeys = new Set(
                (db.finance || [])
                    .filter(item => item.type === 'tuition' && item.studentId && item.date)
                    .map(item => `${item.studentId}:${item.date}`),
            )
            let created = 0
            let skipped = 0
            payableRows.forEach(row => {
                const tuitionKey = `${row.studentId}:${row.dueDate}`
                if (existingTuitionKeys.has(tuitionKey)) {
                    skipped += 1
                    return
                }
                const invoiceNumber = tuitionInvoiceNumber(row, [...existingNumbers])
                db.finance.push({
                    id: `tuition-${yearMonth}-${row.studentId}`,
                    studentId: row.studentId,
                    invoiceNumber,
                    type: 'tuition',
                    desc: row.description,
                    amount: row.amountDue,
                    date: row.dueDate,
                    status: 'pending',
                    method: '',
                    notes: null,
                })
                existingNumbers.add(invoiceNumber)
                existingTuitionKeys.add(tuitionKey)
                created += 1
            })
            commit()
            setMessage(`Đã tạo ${created} khoản thu học phí${skipped ? `, bỏ qua ${skipped} khoản đã tồn tại` : ''}.`)
        } catch (ex) {
            setError(ex.message || 'Không tạo được khoản thu học phí.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="admin-page-pad" style={{ padding: '28px 36px' }}>
            <div
                className="mobile-stack"
                style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                    marginBottom: 18,
                }}
            >
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <label style={{ display: 'grid', gap: 5, fontSize: 12, color: '#5B5490', fontWeight: 600 }}>
                        Tháng tính phí
                        <input
                            type="month"
                            value={yearMonth}
                            onChange={event => setYearMonth(event.target.value)}
                            style={numberInputStyle(150)}
                        />
                    </label>
                    <label style={{ display: 'grid', gap: 5, fontSize: 12, color: '#5B5490', fontWeight: 600 }}>
                        Lớp
                        <select
                            value={classFilter}
                            onChange={event => setClassFilter(event.target.value)}
                            style={numberInputStyle(170)}
                        >
                            <option value="" style={{ fontWeight: 400 }}>
                                Tất cả lớp
                            </option>
                            {classOptions.map(item => (
                                <option key={item.id} value={item.id} style={{ fontWeight: 400 }}>
                                    {item.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label style={{ display: 'grid', gap: 5, fontSize: 12, color: '#5B5490', fontWeight: 600 }}>
                        {supabaseMode ? 'Nguồn học phí' : 'Học phí tháng'}
                        {supabaseMode ? (
                            <div style={readonlyInfoStyle}>Theo Cài đặt</div>
                        ) : (
                            <MoneyInput
                                value={settings.monthlyTuition}
                                onChange={value => updateSetting('monthlyTuition', value)}
                                style={numberInputStyle()}
                            />
                        )}
                    </label>
                    {!supabaseMode && (
                        <label style={{ display: 'grid', gap: 5, fontSize: 12, color: '#5B5490', fontWeight: 600 }}>
                            Hoàn/vắng phép
                            <MoneyInput
                                value={settings.refundPerPermittedAbsence}
                                onChange={value => updateSetting('refundPerPermittedAbsence', value)}
                                style={numberInputStyle()}
                            />
                        </label>
                    )}
                    <label
                        style={{
                            display: 'flex',
                            gap: 8,
                            alignItems: 'center',
                            height: 40,
                            padding: '0 12px',
                            borderRadius: 10,
                            border: '1.5px solid #DDD6FE',
                            background: '#fff',
                            color: '#5B5490',
                            fontSize: 12,
                            fontWeight: 600,
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={settings.includeSaturday}
                            onChange={event => updateSetting('includeSaturday', event.target.checked)}
                        />
                        Tính thứ bảy
                    </label>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button onClick={handleExport} disabled={loading || !billingRows.length} style={buttonStyle()}>
                        Xuất Excel
                    </button>
                    <button
                        onClick={handleGenerateClick}
                        disabled={saving || loading || !billingRows.length}
                        style={buttonStyle({ primary: true, disabled: saving || loading || !billingRows.length })}
                    >
                        {saving ? 'Đang tạo...' : supabaseMode ? 'Tạo phiếu báo thu' : 'Tạo khoản thu'}
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                {[
                    ['tuition', 'Bảng học phí'],
                    ['attendance', 'Bảng điểm danh tháng'],
                ].map(([id, label]) => (
                    <button
                        key={id}
                        onClick={() => setView(id)}
                        style={{
                            padding: '9px 13px',
                            borderRadius: 10,
                            border: `1.5px solid ${view === id ? '#7C3AED' : '#DDD6FE'}`,
                            background: view === id ? '#EDE9FE' : '#fff',
                            color: view === id ? '#6D28D9' : '#6B6494',
                            fontWeight: 700,
                            fontSize: 13,
                        }}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {message && (
                <div
                    style={{
                        marginBottom: 14,
                        padding: '10px 14px',
                        borderRadius: 10,
                        background: '#ECFDF5',
                        color: '#047857',
                        fontWeight: 700,
                        fontSize: 13,
                    }}
                >
                    {message}
                </div>
            )}
            {error && (
                <div
                    style={{
                        marginBottom: 14,
                        padding: '10px 14px',
                        borderRadius: 10,
                        background: '#FEF2F2',
                        color: '#DC2626',
                        fontWeight: 700,
                        fontSize: 13,
                    }}
                >
                    {error}
                </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end', marginBottom: 16 }}>
                <SummaryChip label="Học sinh" value={billingRows.length} color="#6D28D9" />
                <SummaryChip label="Ngày chuẩn" value={attendanceModel.schoolDayCount} color="#2563EB" />
                {view === 'tuition' && (
                    <>
                        <SummaryChip label="Vắng P" value={summary.permittedAbsences} color="#B45309" />
                        <SummaryChip label="Phải thu" value={fmtMoney(summary.amountDue)} color="#059669" />
                        {missingAttendanceCount > 0 && (
                            <SummaryChip label="Chưa điểm danh" value={missingAttendanceCount} color="#DC2626" />
                        )}
                    </>
                )}
            </div>

            {showPreview && (
                <PreviewModal
                    rows={billingRows.filter(row => row.studentId && row.amountDue > 0)}
                    yearMonth={yearMonth}
                    onConfirm={generateInvoices}
                    onClose={() => setShowPreview(false)}
                />
            )}
            {feePickerRow && (
                <FeeItemPickerModal
                    row={feePickerRow}
                    feeItems={feeItems}
                    selectedIds={feeItemSelections[feePickerRow.studentId] || []}
                    onToggle={toggleStudentFeeItem}
                    onClose={() => setFeePickerRow(null)}
                />
            )}

            {supabaseMode && feeItems.length > 0 && view === 'tuition' && (
                <div
                    style={{
                        background: '#fff',
                        borderRadius: 14,
                        border: '1px solid #EDE9FE',
                        padding: '12px 14px',
                        marginBottom: 14,
                    }}
                >
                    <div style={{ fontSize: 12, color: '#5B5490', fontWeight: 800, marginBottom: 8 }}>
                        Khoản thu phụ áp dụng nhanh
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {feeItems.map(item => {
                            const allSelected =
                                billingRows.length > 0 &&
                                billingRows.every(row => (feeItemSelections[row.studentId] || []).includes(item.id))
                            return (
                                <label
                                    key={item.id}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 7,
                                        padding: '7px 10px',
                                        borderRadius: 10,
                                        border: `1.5px solid ${allSelected ? '#7C3AED' : '#DDD6FE'}`,
                                        background: allSelected ? '#F5F3FF' : '#fff',
                                        color: allSelected ? '#6D28D9' : '#5B5490',
                                        fontSize: 12,
                                        fontWeight: 700,
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        onChange={event => toggleFeeItemForRows(item.id, event.target.checked)}
                                    />
                                    {item.name} · {fmtMoney(item.default_amount)}
                                </label>
                            )
                        })}
                    </div>
                </div>
            )}

            <div
                style={{
                    background: '#fff',
                    borderRadius: 16,
                    boxShadow: '0 2px 16px rgba(109,40,217,0.08)',
                    overflow: 'hidden',
                }}
            >
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    {loading ? (
                        <div style={{ padding: 36, color: '#7C6D9B', fontWeight: 700, textAlign: 'center' }}>
                            Đang tải dữ liệu...
                        </div>
                    ) : billingRows.length === 0 ? (
                        <div style={{ padding: 36, color: '#7C6D9B', fontWeight: 700, textAlign: 'center' }}>
                            Chưa có học sinh hoặc dữ liệu phù hợp.
                        </div>
                    ) : view === 'tuition' ? (
                        <TuitionTable
                            rows={billingRows}
                            credits={credits}
                            onCreditChange={updateCredit}
                            onTuitionOverrideChange={updateTuitionOverride}
                            feeItems={feeItems}
                            feeItemSelections={feeItemSelections}
                            onOpenFeePicker={setFeePickerRow}
                            summary={summary}
                        />
                    ) : (
                        <AttendanceMatrix days={attendanceModel.days} rows={attendanceModel.rows} />
                    )}
                </div>
            </div>
        </div>
    )
}

function stickyCellStyle(left, width, zIndex = 2) {
    return {
        position: 'sticky',
        left,
        width,
        minWidth: width,
        maxWidth: width,
        background: '#fff',
        zIndex,
        boxShadow: '1px 0 0 #EDE9FE',
    }
}

function TuitionTable({ rows, credits, onCreditChange, onTuitionOverrideChange, onOpenFeePicker, summary }) {
    return (
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1360, fontSize: 13 }}>
            <thead>
                <tr style={{ background: '#F8F7FF' }}>
                    {[
                        ['STT', stickyCellStyle(0, 58, 4)],
                        ['MSHS', stickyCellStyle(58, 104, 4)],
                        ['Họ và tên', stickyCellStyle(162, 210, 4)],
                        ['Lớp'],
                        ['Học phí'],
                        ['Học phí riêng'],
                        ['Khoản phụ'],
                        ['Ngày học'],
                        ['Suất ăn'],
                        ['Vắng K'],
                        ['Vắng P'],
                        ['Hoàn lại'],
                        ['Thừa tháng trước'],
                        ['Phải thu'],
                    ].map(([header, extraStyle]) => (
                        <th
                            key={header}
                            style={{
                                padding: '12px 14px',
                                textAlign: 'left',
                                color: '#7C6D9B',
                                fontSize: 11,
                                fontWeight: 700,
                                borderBottom: '1.5px solid #DDD6FE',
                                background: '#F8F7FF',
                                ...(extraStyle || {}),
                            }}
                        >
                            {header}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                <tr style={{ background: '#FAFAFF', borderBottom: '1px solid #EDE9FE' }}>
                    <td
                        colSpan={3}
                        style={{
                            padding: '10px 14px',
                            fontWeight: 700,
                            color: '#1E1B4B',
                            ...stickyCellStyle(0, 372, 3),
                            background: '#FAFAFF',
                        }}
                    >
                        Tổng cộng
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>—</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>{fmtMoney(summary.monthlyTuition)}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>—</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>
                        {fmtMoney(rows.reduce((sum, row) => sum + (row.optionalFeeTotal || 0), 0))}
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>{summary.actualDays}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>{summary.mealDays}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>{summary.unpermittedAbsences}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>{summary.permittedAbsences}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>{fmtMoney(summary.refundAmount)}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>{fmtMoney(summary.previousCredit)}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#059669' }}>
                        {fmtMoney(summary.amountDue)}
                    </td>
                </tr>
                {rows.map((row, index) => (
                    <tr key={row.studentId} style={{ borderBottom: '1px solid #EDE9FE' }}>
                        <td
                            style={{
                                padding: '11px 14px',
                                color: '#6B6494',
                                fontWeight: 600,
                                ...stickyCellStyle(0, 58),
                            }}
                        >
                            {index + 1}
                        </td>
                        <td
                            style={{
                                padding: '11px 14px',
                                color: '#7C3AED',
                                fontWeight: 700,
                                ...stickyCellStyle(58, 104),
                            }}
                        >
                            {row.studentCode}
                        </td>
                        <td
                            style={{
                                padding: '11px 14px',
                                color: '#1E1B4B',
                                fontWeight: 600,
                                ...stickyCellStyle(162, 210),
                            }}
                        >
                            {row.studentName}
                        </td>
                        <td style={{ padding: '11px 14px', color: '#6B6494', fontWeight: 600 }}>
                            {row.className || '-'}
                        </td>
                        <td style={{ padding: '11px 14px', fontWeight: 600 }}>
                            {fmtMoney(row.monthlyTuition)}
                            {row.isProrated && (
                                <div style={{ fontSize: 10, color: '#B45309', marginTop: 2 }}>
                                    Pro-rate {row.billableSchoolDays}/{row.schoolDayCount} ngày
                                </div>
                            )}
                        </td>
                        <td style={{ padding: '9px 14px' }}>
                            <MoneyInput
                                value={row.tuitionOverrideAmount || ''}
                                onChange={value => onTuitionOverrideChange(row.studentId, value)}
                                style={numberInputStyle(118)}
                                aria-label={`Học phí riêng của ${row.studentName}`}
                            />
                        </td>
                        <td style={{ padding: '9px 14px' }}>
                            <button
                                type="button"
                                onClick={() => onOpenFeePicker(row)}
                                style={buttonStyle()}
                                aria-label={`Chọn khoản phụ cho ${row.studentName}`}
                            >
                                {row.extraFeeItems?.length || 0} khoản · {fmtMoney(row.optionalFeeTotal || 0)}
                            </button>
                        </td>
                        <td style={{ padding: '11px 14px', fontWeight: 600 }}>{row.actualDays}</td>
                        <td style={{ padding: '11px 14px', fontWeight: 600 }}>{row.mealDays}</td>
                        <td
                            style={{
                                padding: '11px 14px',
                                color: row.unpermittedAbsences ? '#DC2626' : '#6B6494',
                                fontWeight: 600,
                            }}
                        >
                            {row.unpermittedAbsences}
                        </td>
                        <td
                            style={{
                                padding: '11px 14px',
                                color: row.permittedAbsences ? '#B45309' : '#6B6494',
                                fontWeight: 600,
                            }}
                        >
                            {row.permittedAbsences}
                        </td>
                        <td style={{ padding: '11px 14px', fontWeight: 600 }}>{fmtMoney(row.refundAmount)}</td>
                        <td style={{ padding: '9px 14px' }}>
                            <MoneyInput
                                value={credits[row.studentId] || 0}
                                onChange={value => onCreditChange(row.studentId, value)}
                                style={numberInputStyle(120)}
                                aria-label={`Tiền thừa tháng trước của ${row.studentName}`}
                            />
                        </td>
                        <td style={{ padding: '11px 14px', color: '#059669', fontWeight: 700 }}>
                            {fmtMoney(row.amountDue)}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    )
}

function SummaryChip({ label, value, color }) {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                borderRadius: 999,
                background: '#F8F7FF',
                border: '1px solid #EDE9FE',
                padding: '7px 10px',
                whiteSpace: 'nowrap',
            }}
        >
            <span style={{ color: '#7C6D9B', fontSize: 11, fontWeight: 600 }}>{label}</span>
            <span style={{ color, fontSize: 13, fontWeight: 700 }}>{value}</span>
        </div>
    )
}

function FeeItemPickerModal({ row, feeItems, selectedIds, onToggle, onClose }) {
    const selectedSet = new Set(selectedIds)
    const selectedTotal = feeItems
        .filter(item => selectedSet.has(item.id))
        .reduce((sum, item) => sum + normalizeTuitionNumber(item.default_amount), 0)

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(30,27,74,0.45)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 20,
            }}
            onClick={e => {
                if (e.target === e.currentTarget) onClose()
            }}
        >
            <div
                style={{
                    width: 'min(520px, 100%)',
                    maxHeight: '86vh',
                    overflow: 'hidden',
                    background: '#fff',
                    borderRadius: 16,
                    boxShadow: '0 8px 40px rgba(109,40,217,0.18)',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                <div
                    style={{
                        padding: '16px 18px',
                        borderBottom: '1px solid #EDE9FE',
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                    }}
                >
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 900, color: '#1E1B4B' }}>Khoản thu phụ</div>
                        <div style={{ fontSize: 12, color: '#7C6D9B', marginTop: 2 }}>
                            {row.studentName} · {row.className || 'Chưa có lớp'}
                        </div>
                    </div>
                    <button onClick={onClose} style={buttonStyle()} aria-label="Đóng chọn khoản phụ">
                        Đóng
                    </button>
                </div>
                <div style={{ padding: 18, overflowY: 'auto', display: 'grid', gap: 8 }}>
                    {feeItems.map(item => {
                        const checked = selectedSet.has(item.id)
                        return (
                            <label
                                key={item.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    padding: '10px 12px',
                                    borderRadius: 10,
                                    border: `1.5px solid ${checked ? '#7C3AED' : '#EDE9FE'}`,
                                    background: checked ? '#F5F3FF' : '#fff',
                                    color: '#1E1B4B',
                                    fontSize: 13,
                                    fontWeight: 700,
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={event => onToggle(row.studentId, item.id, event.target.checked)}
                                />
                                <span style={{ flex: 1 }}>
                                    {item.name}
                                    <span style={{ color: '#7C6D9B', fontWeight: 500 }}> / {item.unit}</span>
                                </span>
                                <span style={{ color: '#059669', whiteSpace: 'nowrap' }}>
                                    {fmtMoney(item.default_amount)}
                                </span>
                            </label>
                        )
                    })}
                    {!feeItems.length && (
                        <div style={{ color: '#7C6D9B', fontWeight: 700, fontSize: 13 }}>
                            Chưa có khoản thu phụ đang áp dụng trong Cài đặt.
                        </div>
                    )}
                </div>
                <div
                    style={{
                        padding: '12px 18px',
                        borderTop: '1px solid #EDE9FE',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        color: '#059669',
                        fontSize: 13,
                        fontWeight: 900,
                    }}
                >
                    <span>Tổng khoản phụ</span>
                    <span>{fmtMoney(selectedTotal)}</span>
                </div>
            </div>
        </div>
    )
}

function PreviewModal({ rows, yearMonth, onConfirm, onClose }) {
    const missingCount = rows.filter(row => row.missingSchoolDays > 0).length
    const totalDue = rows.reduce((sum, row) => sum + row.amountDue, 0)
    const range = monthRange(yearMonth)

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(30,27,74,0.45)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 20,
            }}
            onClick={e => {
                if (e.target === e.currentTarget) onClose()
            }}
        >
            <div
                style={{
                    background: '#fff',
                    borderRadius: 18,
                    boxShadow: '0 8px 40px rgba(109,40,217,0.18)',
                    width: '100%',
                    maxWidth: 700,
                    maxHeight: '88vh',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }}
            >
                {/* Header */}
                <div
                    style={{
                        padding: '18px 22px',
                        borderBottom: '1px solid #EDE9FE',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}
                >
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#1E1B4B' }}>
                            Xác nhận tạo phiếu báo thu
                        </div>
                        <div style={{ fontSize: 12, color: '#7C6D9B', marginTop: 2 }}>
                            Tháng {String(range.month).padStart(2, '0')}/{range.year} · {rows.length} học sinh
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            width: 30,
                            height: 30,
                            borderRadius: 8,
                            border: '1.5px solid #DDD6FE',
                            background: '#fff',
                            color: '#6B6494',
                            fontWeight: 700,
                            fontSize: 16,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        ×
                    </button>
                </div>

                {/* Summary chips */}
                <div
                    style={{
                        padding: '12px 22px',
                        display: 'flex',
                        gap: 10,
                        flexWrap: 'wrap',
                        borderBottom: '1px solid #F0EEFF',
                    }}
                >
                    <div
                        style={{
                            padding: '7px 14px',
                            borderRadius: 999,
                            background: '#F8F7FF',
                            border: '1px solid #EDE9FE',
                            fontSize: 12,
                            fontWeight: 700,
                        }}
                    >
                        <span style={{ color: '#7C6D9B' }}>Tổng phiếu: </span>
                        <span style={{ color: '#6D28D9' }}>{rows.length}</span>
                    </div>
                    <div
                        style={{
                            padding: '7px 14px',
                            borderRadius: 999,
                            background: '#ECFDF5',
                            border: '1px solid #A7F3D0',
                            fontSize: 12,
                            fontWeight: 700,
                        }}
                    >
                        <span style={{ color: '#065F46' }}>Tổng thu: </span>
                        <span style={{ color: '#059669' }}>{fmtMoney(totalDue)}</span>
                    </div>
                    {missingCount > 0 && (
                        <div
                            style={{
                                padding: '7px 14px',
                                borderRadius: 999,
                                background: '#FEF2F2',
                                border: '1px solid #FCA5A5',
                                fontSize: 12,
                                fontWeight: 700,
                            }}
                        >
                            <span style={{ color: '#DC2626' }}>⚠ {missingCount} bé chưa đủ điểm danh</span>
                        </div>
                    )}
                </div>

                {/* Bảng preview */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                            <tr style={{ background: '#F8F7FF', position: 'sticky', top: 0 }}>
                                {[
                                    'Học sinh',
                                    'Lớp',
                                    'Học phí',
                                    'Khoản phụ',
                                    'Vắng P',
                                    'Hoàn',
                                    'Thừa trước',
                                    'Phải thu',
                                    '',
                                ].map(h => (
                                    <th
                                        key={h}
                                        style={{
                                            padding: '9px 12px',
                                            textAlign: 'left',
                                            color: '#7C6D9B',
                                            fontSize: 11,
                                            fontWeight: 700,
                                            borderBottom: '1.5px solid #DDD6FE',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(row => (
                                <tr key={row.studentId} style={{ borderBottom: '1px solid #EDE9FE' }}>
                                    <td style={{ padding: '9px 12px', color: '#1E1B4B', fontWeight: 600 }}>
                                        {row.studentName}
                                    </td>
                                    <td style={{ padding: '9px 12px', color: '#6B6494' }}>{row.className || '—'}</td>
                                    <td style={{ padding: '9px 12px', fontWeight: 600 }}>
                                        {fmtMoney(row.monthlyTuition)}
                                    </td>
                                    <td
                                        style={{
                                            padding: '9px 12px',
                                            color: row.optionalFeeTotal ? '#6D28D9' : '#9B93C9',
                                        }}
                                    >
                                        {row.optionalFeeTotal ? fmtMoney(row.optionalFeeTotal) : '—'}
                                    </td>
                                    <td
                                        style={{
                                            padding: '9px 12px',
                                            color: row.permittedAbsences ? '#B45309' : '#9B93C9',
                                        }}
                                    >
                                        {row.permittedAbsences}
                                    </td>
                                    <td
                                        style={{ padding: '9px 12px', color: row.refundAmount ? '#059669' : '#9B93C9' }}
                                    >
                                        {row.refundAmount ? `-${fmtMoney(row.refundAmount)}` : '—'}
                                    </td>
                                    <td
                                        style={{
                                            padding: '9px 12px',
                                            color: row.previousCredit ? '#2563EB' : '#9B93C9',
                                        }}
                                    >
                                        {row.previousCredit ? `-${fmtMoney(row.previousCredit)}` : '—'}
                                    </td>
                                    <td style={{ padding: '9px 12px', color: '#059669', fontWeight: 700 }}>
                                        {fmtMoney(row.amountDue)}
                                    </td>
                                    <td style={{ padding: '9px 12px' }}>
                                        {row.missingSchoolDays > 0 && (
                                            <span
                                                title={`Còn ${row.missingSchoolDays} ngày chưa điểm danh`}
                                                style={{ color: '#DC2626', fontSize: 14 }}
                                            >
                                                ⚠
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer actions */}
                <div
                    style={{
                        padding: '14px 22px',
                        borderTop: '1px solid #EDE9FE',
                        display: 'flex',
                        gap: 10,
                        justifyContent: 'flex-end',
                        background: '#fff',
                    }}
                >
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 18px',
                            borderRadius: 10,
                            border: '1.5px solid #DDD6FE',
                            background: '#fff',
                            color: '#6D28D9',
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: 'pointer',
                        }}
                    >
                        Hủy
                    </button>
                    <button
                        onClick={onConfirm}
                        style={{
                            padding: '10px 20px',
                            borderRadius: 10,
                            border: 'none',
                            background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)',
                            color: '#fff',
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: 'pointer',
                        }}
                    >
                        {missingCount > 0 ? `Xác nhận tạo (bỏ qua ${missingCount} cảnh báo)` : 'Xác nhận tạo phiếu'}
                    </button>
                </div>
            </div>
        </div>
    )
}

function AttendanceMatrix({ days, rows }) {
    return (
        <table
            style={{
                width: '100%',
                borderCollapse: 'collapse',
                minWidth: Math.max(980, 372 + days.length * 33),
                fontSize: 13,
            }}
        >
            <thead>
                <tr style={{ background: '#F8F7FF' }}>
                    {[
                        ['STT', stickyCellStyle(0, 58, 4)],
                        ['MSHS', stickyCellStyle(58, 104, 4)],
                        ['Họ và tên', stickyCellStyle(162, 210, 4)],
                    ].map(([header, extraStyle]) => (
                        <th
                            key={header}
                            rowSpan={2}
                            style={{
                                padding: '12px 10px',
                                textAlign: 'left',
                                color: '#7C6D9B',
                                fontSize: 11,
                                fontWeight: 700,
                                borderBottom: '1.5px solid #DDD6FE',
                                background: '#F8F7FF',
                                ...(extraStyle || {}),
                            }}
                        >
                            {header}
                        </th>
                    ))}
                    {days.map(day => (
                        <th
                            key={day.date}
                            style={{
                                width: 33,
                                padding: '8px 2px',
                                textAlign: 'center',
                                color: day.isSunday ? '#DC2626' : '#7C6D9B',
                                fontSize: 11,
                                fontWeight: 700,
                                borderBottom: '1px solid #EDE9FE',
                            }}
                        >
                            {day.day}
                        </th>
                    ))}
                </tr>
                <tr style={{ background: '#F8F7FF' }}>
                    {days.map(day => (
                        <th
                            key={day.date}
                            style={{
                                padding: '6px 2px',
                                textAlign: 'center',
                                color: day.isSunday ? '#DC2626' : '#9B93C9',
                                fontSize: 10,
                                fontWeight: 700,
                                borderBottom: '1.5px solid #DDD6FE',
                            }}
                        >
                            {day.weekdayLabel.replace('Thứ ', 'T')}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.map((row, index) => (
                    <tr key={row.studentId} style={{ borderBottom: '1px solid #EDE9FE' }}>
                        <td style={{ padding: '10px', color: '#6B6494', fontWeight: 600, ...stickyCellStyle(0, 58) }}>
                            {index + 1}
                        </td>
                        <td style={{ padding: '10px', color: '#7C3AED', fontWeight: 700, ...stickyCellStyle(58, 104) }}>
                            {row.studentCode}
                        </td>
                        <td
                            style={{
                                padding: '10px',
                                color: '#1E1B4B',
                                fontWeight: 600,
                                ...stickyCellStyle(162, 210),
                            }}
                        >
                            {row.studentName}
                        </td>
                        {days.map(day => {
                            const symbol = row.marks[day.date] || ''
                            const [bg, color] = statusColor(symbol)
                            return (
                                <td
                                    key={day.date}
                                    style={{
                                        padding: '7px 2px',
                                        textAlign: 'center',
                                        background: day.isSunday ? '#FAFAFA' : 'transparent',
                                    }}
                                >
                                    <span
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: 27,
                                            height: 26,
                                            borderRadius: 7,
                                            background: bg,
                                            color,
                                            fontSize: 11,
                                            fontWeight: 700,
                                        }}
                                    >
                                        {symbol}
                                    </span>
                                </td>
                            )
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
    )
}
