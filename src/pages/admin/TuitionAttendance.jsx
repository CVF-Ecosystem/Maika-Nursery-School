import { useEffect, useMemo, useState } from 'react'
import { isSupabaseSession } from '../../data/backendMode'
import { commit, getDB } from '../../data/store'
import { listAttendanceByFacilityDateRange } from '../../features/attendance/attendanceService'
import { listTuitionPlans } from '../../features/operations/operationalService'
import {
    listStudentTuitionCredits,
    saveMonthlyFeeNotices,
    upsertStudentTuitionCredit,
} from '../../features/payments/feeNoticeService'
import { listStudents } from '../../features/students/studentService'
import { fmtMoney } from '../../utils/format'
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
    const [classFilter, setClassFilter] = useState('')
    const [view, setView] = useState('tuition')
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [showPreview, setShowPreview] = useState(false)

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
                    const [studentItems, attendanceItems, tuitionRuleItems, creditItems] = await Promise.all([
                        listStudents({ facilityId: selectedFacilityId || undefined, status: 'active' }),
                        listAttendanceByFacilityDateRange({
                            facilityId: selectedFacilityId || undefined,
                            startDate: range.startDate,
                            endDate: range.endDate,
                        }),
                        listTuitionPlans({ activeOnly: true }),
                        listStudentTuitionCredits({ facilityId: selectedFacilityId || undefined, yearMonth }),
                    ])
                    if (!mounted) return
                    setStudents(studentItems)
                    setClasses([...new Set(studentItems.map(student => student.className).filter(Boolean))])
                    setAttendance(attendanceItems)
                    setTuitionRules(tuitionRuleItems)
                    setCredits(
                        Object.fromEntries(
                            creditItems.map(item => [item.student_id, normalizeTuitionNumber(item.amount)]),
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
            }),
        [attendanceModel.rows, credits, settings, tuitionRules, yearMonth],
    )
    const summary = useMemo(() => summarizeTuitionRows(tuitionRows), [tuitionRows])
    const classOptions = supabaseMode
        ? classes.map(name => ({ id: name, name }))
        : classes.map(item => ({ id: item.id, name: item.name }))
    const classLabel = classOptions.find(item => item.id === classFilter)?.name || ''
    const missingAttendanceCount = tuitionRows.filter(row => row.missingSchoolDays > 0).length

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

    async function handleExport() {
        setError('')
        setMessage('')
        try {
            await exportWorkbook({
                yearMonth,
                days: attendanceModel.days,
                attendanceRows: attendanceModel.rows,
                tuitionRows,
                summary,
                classLabel,
            })
            setMessage('Đã xuất file Excel theo mẫu bảng điểm danh và bảng học phí.')
        } catch (ex) {
            setError(ex.message || 'Không xuất được Excel.')
        }
    }

    function handleGenerateClick() {
        const payableRows = tuitionRows.filter(row => row.studentId && row.amountDue > 0)
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
            const payableRows = tuitionRows.filter(row => row.studentId && row.amountDue > 0)
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
                    notes: `Từ bảng điểm danh tháng ${yearMonth}.`,
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
                            <input
                                type="number"
                                min="0"
                                value={settings.monthlyTuition}
                                onChange={event => updateSetting('monthlyTuition', event.target.value)}
                                style={numberInputStyle()}
                            />
                        )}
                    </label>
                    {!supabaseMode && (
                        <label style={{ display: 'grid', gap: 5, fontSize: 12, color: '#5B5490', fontWeight: 600 }}>
                            Hoàn/vắng phép
                            <input
                                type="number"
                                min="0"
                                value={settings.refundPerPermittedAbsence}
                                onChange={event => updateSetting('refundPerPermittedAbsence', event.target.value)}
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
                    <button onClick={handleExport} disabled={loading || !tuitionRows.length} style={buttonStyle()}>
                        Xuất Excel
                    </button>
                    <button
                        onClick={handleGenerateClick}
                        disabled={saving || loading || !tuitionRows.length}
                        style={buttonStyle({ primary: true, disabled: saving || loading || !tuitionRows.length })}
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
                <SummaryChip label="Học sinh" value={tuitionRows.length} color="#6D28D9" />
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
                    rows={tuitionRows.filter(row => row.studentId && row.amountDue > 0)}
                    yearMonth={yearMonth}
                    onConfirm={generateInvoices}
                    onClose={() => setShowPreview(false)}
                />
            )}

            <div
                className="mobile-scroll-table"
                style={{
                    background: '#fff',
                    borderRadius: 16,
                    boxShadow: '0 2px 16px rgba(109,40,217,0.08)',
                    overflow: 'hidden',
                }}
            >
                {loading ? (
                    <div style={{ padding: 36, color: '#7C6D9B', fontWeight: 700, textAlign: 'center' }}>
                        Đang tải dữ liệu...
                    </div>
                ) : tuitionRows.length === 0 ? (
                    <div style={{ padding: 36, color: '#7C6D9B', fontWeight: 700, textAlign: 'center' }}>
                        Chưa có học sinh hoặc dữ liệu phù hợp.
                    </div>
                ) : view === 'tuition' ? (
                    <TuitionTable
                        rows={tuitionRows}
                        credits={credits}
                        onCreditChange={updateCredit}
                        summary={summary}
                    />
                ) : (
                    <AttendanceMatrix days={attendanceModel.days} rows={attendanceModel.rows} />
                )}
            </div>
        </div>
    )
}

function TuitionTable({ rows, credits, onCreditChange, summary }) {
    return (
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1120, fontSize: 13 }}>
            <thead>
                <tr style={{ background: '#F8F7FF' }}>
                    {[
                        'STT',
                        'MSHS',
                        'Họ và tên',
                        'Lớp',
                        'Học phí',
                        'Ngày học',
                        'Suất ăn',
                        'Vắng K',
                        'Vắng P',
                        'Hoàn lại',
                        'Thừa tháng trước',
                        'Phải thu',
                    ].map(header => (
                        <th
                            key={header}
                            style={{
                                padding: '12px 14px',
                                textAlign: 'left',
                                color: '#7C6D9B',
                                fontSize: 11,
                                fontWeight: 700,
                                borderBottom: '1.5px solid #DDD6FE',
                            }}
                        >
                            {header}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                <tr style={{ background: '#FAFAFF', borderBottom: '1px solid #EDE9FE' }}>
                    <td colSpan={4} style={{ padding: '10px 14px', fontWeight: 700, color: '#1E1B4B' }}>
                        Tổng cộng
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>{fmtMoney(summary.monthlyTuition)}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>{summary.actualDays}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>{summary.mealDays}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>{summary.unpermittedAbsences}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>{summary.permittedAbsences}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>{fmtMoney(summary.totalCredit)}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#059669' }}>
                        {fmtMoney(summary.amountDue)}
                    </td>
                </tr>
                {rows.map((row, index) => (
                    <tr key={row.studentId} style={{ borderBottom: '1px solid #EDE9FE' }}>
                        <td style={{ padding: '11px 14px', color: '#6B6494', fontWeight: 600 }}>{index + 1}</td>
                        <td style={{ padding: '11px 14px', color: '#7C3AED', fontWeight: 700 }}>{row.studentCode}</td>
                        <td style={{ padding: '11px 14px', color: '#1E1B4B', fontWeight: 600 }}>{row.studentName}</td>
                        <td style={{ padding: '11px 14px', color: '#6B6494', fontWeight: 600 }}>
                            {row.className || '-'}
                        </td>
                        <td style={{ padding: '11px 14px', fontWeight: 600 }}>{fmtMoney(row.monthlyTuition)}</td>
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
                            <input
                                type="number"
                                min="0"
                                value={credits[row.studentId] || 0}
                                onChange={event => onCreditChange(row.studentId, event.target.value)}
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
                                {['Học sinh', 'Lớp', 'Học phí', 'Vắng P', 'Hoàn', 'Thừa trước', 'Phải thu', ''].map(
                                    h => (
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
                                    ),
                                )}
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
                minWidth: Math.max(900, 296 + days.length * 33),
                fontSize: 13,
            }}
        >
            <thead>
                <tr style={{ background: '#F8F7FF' }}>
                    {['STT', 'MSHS', 'Họ và tên'].map(header => (
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
                        <td style={{ padding: '10px', color: '#6B6494', fontWeight: 600 }}>{index + 1}</td>
                        <td style={{ padding: '10px', color: '#7C3AED', fontWeight: 700 }}>{row.studentCode}</td>
                        <td style={{ padding: '10px', color: '#1E1B4B', fontWeight: 600, minWidth: 190 }}>
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
