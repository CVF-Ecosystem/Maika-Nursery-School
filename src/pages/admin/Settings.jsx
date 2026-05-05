import { useEffect, useState } from 'react'
import { hasBackendAPI } from '../../data/api'
import { isSupabaseSession } from '../../data/backendMode'
import { getStudentConsent, saveStudentConsent } from '../../features/sensitive/sensitiveService'
import { getPaymentSettings, savePaymentSettings } from '../../features/payments/paymentSettings'
import { listStudents } from '../../features/students/studentService'
import {
    createAcademicYear,
    createFeeItem,
    createSchoolHoliday,
    createTuitionPlan,
    deleteSchoolHoliday,
    getSchoolSettings,
    listAcademicYears,
    listFeeItems,
    listSchoolHolidays,
    listTuitionPlans,
    saveSchoolSettings,
    updateAcademicYear,
    updateFeeItem,
    updateTuitionPlan,
} from '../../features/operations/operationalService'
import { listFacilities } from '../../features/facilities/facilityService'

const API = import.meta.env.VITE_API_URL || ''

async function apiFetch(path, opts = {}) {
    const token = sessionStorage.getItem('maika_api_token')
    const res = await fetch(API + path, {
        ...opts,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Lỗi server')
    return json.data
}

const TABS = [
    { id: 'school', label: '🏫 Thông tin trường' },
    { id: 'payment', label: '🏦 Tài khoản nhận tiền' },
    { id: 'academic', label: '📅 Năm học & Ngày nghỉ' },
    { id: 'tuition', label: '💰 Mức học phí' },
    { id: 'consents', label: '🔒 Đồng ý dữ liệu' },
    { id: 'zalo', label: '🟦 Zalo OA' },
    { id: 'guide', label: '📋 Hướng dẫn sử dụng' },
]

const CYCLE_LABEL = { monthly: 'Hàng tháng', term: 'Học kỳ', yearly: 'Cả năm' }

function NoBackend() {
    return (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: '#7C6D9B' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔌</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Cấu hình trường học đang được chuẩn bị</div>
            <div style={{ fontSize: 13 }}>
                Các thông tin vận hành của trường sẽ được cập nhật tại đây khi chức năng được bật.
            </div>
        </div>
    )
}

// ─── Tab: Thông tin trường ─────────────────────────────────────────────────────

function SchoolInfoTab() {
    const supabaseMode = isSupabaseSession()
    const [form, setForm] = useState(null)
    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState('')

    useEffect(() => {
        const request = supabaseMode ? getSchoolSettings() : apiFetch('/api/school-settings')
        request
            .then(d =>
                setForm({
                    schoolName: d.school_name || '',
                    logoUrl: d.logo_url || '',
                    address: d.address || '',
                    phone: d.phone || '',
                    email: d.email || '',
                    hoursOpen: d.hours_open || '07:00',
                    hoursClose: d.hours_close || '18:00',
                    pickupStart: d.pickup_start || '16:30',
                    pickupEnd: d.pickup_end || '18:00',
                    timezone: d.timezone || 'Asia/Ho_Chi_Minh',
                }),
            )
            .catch(() => setMsg('Không tải được cấu hình'))
    }, [supabaseMode])

    async function handleSave(e) {
        e.preventDefault()
        setSaving(true)
        setMsg('')
        try {
            if (supabaseMode) {
                await saveSchoolSettings(form)
            } else {
                await apiFetch('/api/school-settings', { method: 'PUT', body: JSON.stringify(form) })
            }
            setMsg('✅ Lưu thành công!')
        } catch (err) {
            setMsg(`❌ ${err.message}`)
        } finally {
            setSaving(false)
        }
    }

    if (!form) return <div style={{ padding: 32, color: '#7C6D9B' }}>Đang tải...</div>

    const inp = (label, field, type = 'text', placeholder = '') => (
        <div style={{ marginBottom: 16 }}>
            <label style={lblStyle}>{label}</label>
            <input
                type={type}
                value={form[field]}
                onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                placeholder={placeholder}
                style={inpStyle}
            />
        </div>
    )

    return (
        <form onSubmit={handleSave}>
            <div className="mobile-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                <div>
                    {inp('Tên trường', 'schoolName', 'text', 'Nhà Trẻ Maika')}
                    {inp('Địa chỉ', 'address', 'text', '123 Đường ABC, Quận 1, TP.HCM')}
                    {inp('Điện thoại', 'phone', 'tel', '028 xxxx xxxx')}
                    {inp('Email liên hệ', 'email', 'email', 'info@maika.edu.vn')}
                </div>
                <div>
                    {inp('URL Logo', 'logoUrl', 'url', 'https://...')}
                    {inp('Giờ mở cửa', 'hoursOpen', 'time')}
                    {inp('Giờ đóng cửa', 'hoursClose', 'time')}
                    <div
                        className="mobile-two-col"
                        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}
                    >
                        <div>{inp('Giờ đón - Bắt đầu', 'pickupStart', 'time')}</div>
                        <div>{inp('Giờ đón - Kết thúc', 'pickupEnd', 'time')}</div>
                    </div>
                </div>
            </div>
            {msg && (
                <div style={{ marginBottom: 12, fontSize: 13, color: msg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>
                    {msg}
                </div>
            )}
            <button type="submit" disabled={saving} style={btnStyle}>
                {saving ? 'Đang lưu...' : '💾 Lưu cấu hình'}
            </button>
        </form>
    )
}

function PaymentTab() {
    const [form, setForm] = useState(() => getPaymentSettings())
    const [msg, setMsg] = useState('')

    function handleSave(e) {
        e.preventDefault()
        savePaymentSettings(form)
        setMsg('✅ Đã lưu thông tin tài khoản. Biên lai sẽ tự tạo QR theo đúng số tiền hóa đơn.')
        setTimeout(() => setMsg(''), 3000)
    }

    const bankOptions = [
        ['MB', 'MB Bank'],
        ['VCB', 'Vietcombank'],
        ['TCB', 'Techcombank'],
        ['ACB', 'ACB'],
        ['BIDV', 'BIDV'],
        ['VTB', 'VietinBank'],
        ['VPB', 'VPBank'],
        ['TPB', 'TPBank'],
        ['MOMO', 'MoMo'],
    ]

    return (
        <form onSubmit={handleSave}>
            <div className="mobile-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                <div>
                    <label style={lblStyle}>Ngân hàng/Ví nhận tiền</label>
                    <select
                        value={form.bankId}
                        onChange={e => setForm(f => ({ ...f, bankId: e.target.value }))}
                        style={inpStyle}
                        required
                    >
                        <option value="">Chọn ngân hàng</option>
                        {bankOptions.map(([id, name]) => (
                            <option key={id} value={id}>
                                {name} ({id})
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label style={lblStyle}>Số tài khoản</label>
                    <input
                        value={form.accountNo}
                        onChange={e => setForm(f => ({ ...f, accountNo: e.target.value }))}
                        placeholder="VD: 0123456789"
                        style={inpStyle}
                        required
                    />
                </div>
                <div>
                    <label style={lblStyle}>Tên chủ tài khoản</label>
                    <input
                        value={form.accountName}
                        onChange={e => setForm(f => ({ ...f, accountName: e.target.value }))}
                        placeholder="TRUONG MAM NON MAIKA"
                        style={inpStyle}
                        required
                    />
                </div>
                <div>
                    <label style={lblStyle}>Tiền tố nội dung chuyển khoản</label>
                    <input
                        value={form.transferPrefix}
                        onChange={e => setForm(f => ({ ...f, transferPrefix: e.target.value }))}
                        placeholder="Hoc phi Maika"
                        style={inpStyle}
                    />
                </div>
            </div>
            <div style={{ fontSize: 12, color: '#7C6D9B', lineHeight: 1.6, margin: '4px 0 14px' }}>
                QR trên biên lai dùng số tiền của hóa đơn và nội dung gồm tiền tố, mã biên lai, tên học sinh.
            </div>
            {msg && <div style={{ marginBottom: 12, fontSize: 13, color: '#16a34a' }}>{msg}</div>}
            <button type="submit" style={btnStyle}>
                💾 Lưu tài khoản
            </button>
        </form>
    )
}

// ─── Tab: Năm học & Ngày nghỉ ─────────────────────────────────────────────────

function AcademicTab() {
    const supabaseMode = isSupabaseSession()
    const [years, setYears] = useState([])
    const [holidays, setHolidays] = useState([])
    const [yearForm, setYearForm] = useState({ name: '', startDate: '', endDate: '', isCurrent: false })
    const [holForm, setHolForm] = useState({ name: '', date: '', isRecurring: false, note: '' })
    const [err, setErr] = useState('')

    function reload() {
        Promise.all([
            supabaseMode ? listAcademicYears() : apiFetch('/api/academic-years'),
            supabaseMode ? listSchoolHolidays() : apiFetch('/api/school-holidays'),
        ])
            .then(([y, h]) => {
                setYears(y)
                setHolidays(h)
            })
            .catch(() => setErr('Lỗi tải dữ liệu'))
    }

    useEffect(reload, [supabaseMode])

    async function addYear(e) {
        e.preventDefault()
        setErr('')
        try {
            if (supabaseMode) {
                await createAcademicYear(yearForm)
            } else {
                await apiFetch('/api/academic-years', { method: 'POST', body: JSON.stringify(yearForm) })
            }
            setYearForm({ name: '', startDate: '', endDate: '', isCurrent: false })
            reload()
        } catch (ex) {
            setErr(ex.message)
        }
    }

    async function setCurrentYear(id) {
        setErr('')
        try {
            if (supabaseMode) {
                await updateAcademicYear(id, { isCurrent: true })
            } else {
                await apiFetch(`/api/academic-years/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ isCurrent: true }),
                })
            }
            reload()
        } catch (ex) {
            setErr(ex.message)
        }
    }

    async function addHoliday(e) {
        e.preventDefault()
        setErr('')
        try {
            if (supabaseMode) {
                await createSchoolHoliday(holForm)
            } else {
                await apiFetch('/api/school-holidays', { method: 'POST', body: JSON.stringify(holForm) })
            }
            setHolForm({ name: '', date: '', isRecurring: false, note: '' })
            reload()
        } catch (ex) {
            setErr(ex.message)
        }
    }

    async function deleteHoliday(id) {
        if (!confirm('Xóa ngày nghỉ này?')) return
        try {
            if (supabaseMode) {
                await deleteSchoolHoliday(id)
            } else {
                await apiFetch(`/api/school-holidays/${id}`, { method: 'DELETE' })
            }
            reload()
        } catch (ex) {
            setErr(ex.message)
        }
    }

    return (
        <div className="mobile-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Năm học */}
            <div>
                <div style={sectionTitle}>📅 Năm học</div>
                <form
                    onSubmit={addYear}
                    style={{ marginBottom: 16, background: '#F8F7FF', borderRadius: 10, padding: 12 }}
                >
                    <input
                        placeholder="VD: 2025–2026"
                        value={yearForm.name}
                        onChange={e => setYearForm(f => ({ ...f, name: e.target.value }))}
                        style={{ ...inpStyle, marginBottom: 8 }}
                        required
                    />
                    <div
                        className="mobile-two-col"
                        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}
                    >
                        <input
                            type="date"
                            value={yearForm.startDate}
                            onChange={e => setYearForm(f => ({ ...f, startDate: e.target.value }))}
                            style={inpStyle}
                            required
                        />
                        <input
                            type="date"
                            value={yearForm.endDate}
                            onChange={e => setYearForm(f => ({ ...f, endDate: e.target.value }))}
                            style={inpStyle}
                            required
                        />
                    </div>
                    <label
                        style={{
                            fontSize: 12,
                            color: '#5B5490',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            marginBottom: 8,
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={yearForm.isCurrent}
                            onChange={e => setYearForm(f => ({ ...f, isCurrent: e.target.checked }))}
                        />
                        Đặt làm năm học hiện tại
                    </label>
                    <button type="submit" style={{ ...btnStyle, padding: '8px 16px', fontSize: 13 }}>
                        + Thêm
                    </button>
                </form>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {years.map(y => (
                        <div
                            key={y.id}
                            style={{
                                background: y.is_current ? '#EDE9FE' : '#F8F7FF',
                                borderRadius: 8,
                                padding: '10px 14px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                border: y.is_current ? '1.5px solid #A78BFA' : '1.5px solid #E5E7EB',
                            }}
                        >
                            <div>
                                <span style={{ fontWeight: 700, fontSize: 14, color: '#1E1B4B' }}>{y.name}</span>
                                {y.is_current && (
                                    <span
                                        style={{
                                            marginLeft: 6,
                                            fontSize: 11,
                                            background: '#6D28D9',
                                            color: '#fff',
                                            borderRadius: 4,
                                            padding: '1px 6px',
                                        }}
                                    >
                                        Hiện tại
                                    </span>
                                )}
                                <div style={{ fontSize: 12, color: '#7C6D9B', marginTop: 2 }}>
                                    {y.start_date} → {y.end_date}
                                </div>
                            </div>
                            {!y.is_current && (
                                <button
                                    onClick={() => setCurrentYear(y.id)}
                                    style={{
                                        fontSize: 12,
                                        border: '1px solid #A78BFA',
                                        background: 'none',
                                        borderRadius: 6,
                                        padding: '4px 10px',
                                        color: '#6D28D9',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Đặt hiện tại
                                </button>
                            )}
                        </div>
                    ))}
                    {years.length === 0 && <div style={{ color: '#9CA3AF', fontSize: 13 }}>Chưa có năm học nào.</div>}
                </div>
            </div>

            {/* Ngày nghỉ */}
            <div>
                <div style={sectionTitle}>🏖️ Ngày nghỉ lễ</div>
                <form
                    onSubmit={addHoliday}
                    style={{ marginBottom: 16, background: '#F8F7FF', borderRadius: 10, padding: 12 }}
                >
                    <input
                        placeholder="Tên ngày nghỉ"
                        value={holForm.name}
                        onChange={e => setHolForm(f => ({ ...f, name: e.target.value }))}
                        style={{ ...inpStyle, marginBottom: 8 }}
                        required
                    />
                    <input
                        type="date"
                        value={holForm.date}
                        onChange={e => setHolForm(f => ({ ...f, date: e.target.value }))}
                        style={{ ...inpStyle, marginBottom: 8 }}
                        required
                    />
                    <input
                        placeholder="Ghi chú (tùy chọn)"
                        value={holForm.note}
                        onChange={e => setHolForm(f => ({ ...f, note: e.target.value }))}
                        style={{ ...inpStyle, marginBottom: 8 }}
                    />
                    <label
                        style={{
                            fontSize: 12,
                            color: '#5B5490',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            marginBottom: 8,
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={holForm.isRecurring}
                            onChange={e => setHolForm(f => ({ ...f, isRecurring: e.target.checked }))}
                        />
                        Lặp hàng năm
                    </label>
                    <button type="submit" style={{ ...btnStyle, padding: '8px 16px', fontSize: 13 }}>
                        + Thêm
                    </button>
                </form>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
                    {holidays.map(h => (
                        <div
                            key={h.id}
                            style={{
                                background: '#F8F7FF',
                                borderRadius: 8,
                                padding: '8px 12px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                border: '1px solid #E5E7EB',
                            }}
                        >
                            <div>
                                <span style={{ fontWeight: 600, fontSize: 13, color: '#1E1B4B' }}>{h.name}</span>
                                {h.is_recurring ? (
                                    <span
                                        style={{
                                            marginLeft: 6,
                                            fontSize: 10,
                                            background: '#DDD6FE',
                                            color: '#5B21B6',
                                            borderRadius: 4,
                                            padding: '1px 5px',
                                        }}
                                    >
                                        Hàng năm
                                    </span>
                                ) : null}
                                <div style={{ fontSize: 12, color: '#7C6D9B' }}>
                                    {h.date}
                                    {h.note ? ` — ${h.note}` : ''}
                                </div>
                            </div>
                            <button
                                onClick={() => deleteHoliday(h.id)}
                                aria-label="Xóa ngày nghỉ"
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#DC2626',
                                    fontSize: 16,
                                }}
                            >
                                🗑
                            </button>
                        </div>
                    ))}
                    {holidays.length === 0 && (
                        <div style={{ color: '#9CA3AF', fontSize: 13 }}>Chưa có ngày nghỉ nào.</div>
                    )}
                </div>
            </div>

            {err && <div style={{ gridColumn: '1/-1', color: '#DC2626', fontSize: 13 }}>{err}</div>}
        </div>
    )
}

// ─── Tab: Mức học phí ─────────────────────────────────────────────────────────

function TuitionTab() {
    const supabaseMode = isSupabaseSession()
    const [plans, setPlans] = useState([])
    const [facilities, setFacilities] = useState([])
    const [feeItems, setFeeItems] = useState([])
    const [editing, setEditing] = useState(null)
    const [editingFeeItem, setEditingFeeItem] = useState(null)
    const [form, setForm] = useState(defaultTuitionForm())
    const [feeItemForm, setFeeItemForm] = useState(defaultFeeItemForm())
    const [err, setErr] = useState('')

    function reload() {
        const request = supabaseMode
            ? Promise.all([listTuitionPlans(), listFacilities(), listFeeItems()])
            : Promise.all([apiFetch('/api/tuition-plans'), Promise.resolve([]), Promise.resolve([])])
        request
            .then(([tuitionPlans, facilityItems, feeItemItems]) => {
                setPlans(tuitionPlans)
                setFacilities(facilityItems)
                setFeeItems(feeItemItems)
            })
            .catch(() => setErr('Lỗi tải dữ liệu'))
    }

    useEffect(reload, [supabaseMode])

    function startEdit(p) {
        setEditing(p.id)
        setForm({
            name: p.name,
            facilityId: p.facility_id || '',
            className: p.class_name || p.class_id || '',
            amount: p.amount,
            billingCycle: p.billing_cycle,
            refundPerPermittedAbsence: p.refund_per_permitted_absence ?? 20000,
            mealPricePerDay: p.meal_price_per_day ?? 0,
            description: p.description || '',
            isActive: !!p.is_active,
        })
    }

    function cancelEdit() {
        setEditing(null)
        setForm(defaultTuitionForm())
    }

    function startFeeItemEdit(item) {
        setEditingFeeItem(item.id)
        setFeeItemForm({
            facilityId: item.facility_id || '',
            name: item.name,
            unit: item.unit || 'tháng',
            defaultAmount: item.default_amount || 0,
            category: item.category || 'optional',
            displayOrder: item.display_order || 100,
            isActive: item.is_active !== false,
        })
    }

    function cancelFeeItemEdit() {
        setEditingFeeItem(null)
        setFeeItemForm(defaultFeeItemForm())
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setErr('')
        try {
            if (editing) {
                if (supabaseMode) {
                    await updateTuitionPlan(editing, form)
                } else {
                    await apiFetch(`/api/tuition-plans/${editing}`, { method: 'PUT', body: JSON.stringify(form) })
                }
            } else {
                if (supabaseMode) {
                    await createTuitionPlan(form)
                } else {
                    await apiFetch('/api/tuition-plans', { method: 'POST', body: JSON.stringify(form) })
                }
            }
            cancelEdit()
            reload()
        } catch (ex) {
            setErr(ex.message)
        }
    }

    async function handleFeeItemSubmit(e) {
        e.preventDefault()
        setErr('')
        try {
            if (editingFeeItem) await updateFeeItem(editingFeeItem, feeItemForm)
            else await createFeeItem(feeItemForm)
            cancelFeeItemEdit()
            reload()
        } catch (ex) {
            setErr(ex.message)
        }
    }

    return (
        <div style={{ display: 'grid', gap: 18 }}>
            <form
                onSubmit={handleSubmit}
                style={{ background: '#F8F7FF', borderRadius: 12, padding: 16, marginBottom: 20 }}
            >
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1E1B4B', marginBottom: 12 }}>
                    {editing ? 'Chỉnh sửa mức học phí' : 'Thêm mức học phí'}
                </div>
                <div
                    className="mobile-two-col"
                    style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 12, marginBottom: 12 }}
                >
                    <div>
                        <label style={lblStyle}>Cơ sở</label>
                        <select
                            value={form.facilityId}
                            onChange={e => setForm(f => ({ ...f, facilityId: e.target.value }))}
                            style={inpStyle}
                        >
                            <option value="">Áp dụng chung</option>
                            {facilities.map(facility => (
                                <option key={facility.id} value={facility.id}>
                                    {facility.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={lblStyle}>Tên mức phí</label>
                        <input
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="VD: Học phí tháng Mầm"
                            style={inpStyle}
                            required
                        />
                    </div>
                    <div>
                        <label style={lblStyle}>Lớp</label>
                        <input
                            value={form.className}
                            onChange={e => setForm(f => ({ ...f, className: e.target.value }))}
                            placeholder="VD: Mầm + Chồi"
                            style={inpStyle}
                        />
                    </div>
                </div>
                <div
                    className="mobile-two-col"
                    style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}
                >
                    <div>
                        <label style={lblStyle}>Số tiền (VND)</label>
                        <input
                            type="number"
                            value={form.amount}
                            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                            placeholder="3000000"
                            style={inpStyle}
                            required
                            min="0"
                        />
                    </div>
                    <div>
                        <label style={lblStyle}>Hoàn vắng P/ngày</label>
                        <input
                            type="number"
                            value={form.refundPerPermittedAbsence}
                            onChange={e => setForm(f => ({ ...f, refundPerPermittedAbsence: e.target.value }))}
                            placeholder="20000"
                            style={inpStyle}
                            min="0"
                        />
                    </div>
                    <div>
                        <label style={lblStyle}>Tiền ăn/ngày</label>
                        <input
                            type="number"
                            value={form.mealPricePerDay}
                            onChange={e => setForm(f => ({ ...f, mealPricePerDay: e.target.value }))}
                            placeholder="0"
                            style={inpStyle}
                            min="0"
                        />
                    </div>
                    <div>
                        <label style={lblStyle}>Chu kỳ</label>
                        <select
                            value={form.billingCycle}
                            onChange={e => setForm(f => ({ ...f, billingCycle: e.target.value }))}
                            style={inpStyle}
                        >
                            <option value="monthly">Hàng tháng</option>
                            <option value="term">Học kỳ</option>
                            <option value="yearly">Cả năm</option>
                        </select>
                    </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                    <label style={lblStyle}>Mô tả (tùy chọn)</label>
                    <input
                        value={form.description}
                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="Ghi chú thêm..."
                        style={inpStyle}
                    />
                </div>
                <label
                    style={{
                        fontSize: 12,
                        color: '#5B5490',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginBottom: 12,
                    }}
                >
                    <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                    />
                    Đang áp dụng
                </label>
                {err && <div style={{ fontSize: 13, color: '#DC2626', marginBottom: 8 }}>{err}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" style={btnStyle}>
                        {editing ? 'Lưu' : 'Thêm'}
                    </button>
                    {editing && (
                        <button
                            type="button"
                            onClick={cancelEdit}
                            style={{ ...btnStyle, background: '#E5E7EB', color: '#374151' }}
                        >
                            Hủy
                        </button>
                    )}
                </div>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {plans.map(p => (
                    <div
                        key={p.id}
                        style={{
                            background: p.is_active ? '#F8F7FF' : '#F9FAFB',
                            borderRadius: 10,
                            padding: '12px 16px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            border: `1.5px solid ${p.is_active ? '#DDD6FE' : '#E5E7EB'}`,
                        }}
                    >
                        <div>
                            <span style={{ fontWeight: 700, fontSize: 14, color: p.is_active ? '#1E1B4B' : '#9CA3AF' }}>
                                {p.name}
                            </span>
                            {!p.is_active && (
                                <span
                                    style={{
                                        marginLeft: 6,
                                        fontSize: 11,
                                        background: '#F3F4F6',
                                        color: '#6B7280',
                                        borderRadius: 4,
                                        padding: '1px 6px',
                                    }}
                                >
                                    Ngưng
                                </span>
                            )}
                            <div style={{ fontSize: 13, color: '#6D28D9', fontWeight: 600, marginTop: 2 }}>
                                {Number(p.amount).toLocaleString('vi-VN')}đ / {CYCLE_LABEL[p.billing_cycle]}
                            </div>
                            <div style={{ fontSize: 12, color: '#7C6D9B', marginTop: 2 }}>
                                {facilityName(facilities, p.facility_id)} · {p.class_name || p.class_id || 'Tất cả lớp'}{' '}
                                · Hoàn P {Number(p.refund_per_permitted_absence || 0).toLocaleString('vi-VN')}đ/ngày
                            </div>
                            {p.description && <div style={{ fontSize: 12, color: '#7C6D9B' }}>{p.description}</div>}
                        </div>
                        <button
                            onClick={() => startEdit(p)}
                            style={{
                                fontSize: 12,
                                border: '1px solid #DDD6FE',
                                background: 'none',
                                borderRadius: 6,
                                padding: '4px 10px',
                                color: '#6D28D9',
                                cursor: 'pointer',
                            }}
                        >
                            Sửa
                        </button>
                    </div>
                ))}
                {plans.length === 0 && <div style={{ color: '#9CA3AF', fontSize: 13 }}>Chưa có mức học phí nào.</div>}
            </div>

            {supabaseMode && (
                <form onSubmit={handleFeeItemSubmit} style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1E1B4B', marginBottom: 12 }}>
                        Khoản thu mặc định
                    </div>
                    <div
                        className="mobile-two-col"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '1.2fr 1fr .8fr .8fr .7fr',
                            gap: 12,
                            marginBottom: 12,
                        }}
                    >
                        <div>
                            <label style={lblStyle}>Tên khoản</label>
                            <input
                                value={feeItemForm.name}
                                onChange={e => setFeeItemForm(f => ({ ...f, name: e.target.value }))}
                                style={inpStyle}
                                required
                            />
                        </div>
                        <div>
                            <label style={lblStyle}>Cơ sở</label>
                            <select
                                value={feeItemForm.facilityId}
                                onChange={e => setFeeItemForm(f => ({ ...f, facilityId: e.target.value }))}
                                style={inpStyle}
                            >
                                <option value="">Áp dụng chung</option>
                                {facilities.map(facility => (
                                    <option key={facility.id} value={facility.id}>
                                        {facility.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={lblStyle}>Đơn vị</label>
                            <input
                                value={feeItemForm.unit}
                                onChange={e => setFeeItemForm(f => ({ ...f, unit: e.target.value }))}
                                style={inpStyle}
                            />
                        </div>
                        <div>
                            <label style={lblStyle}>Số tiền mặc định</label>
                            <input
                                type="number"
                                min="0"
                                value={feeItemForm.defaultAmount}
                                onChange={e => setFeeItemForm(f => ({ ...f, defaultAmount: e.target.value }))}
                                style={inpStyle}
                            />
                        </div>
                        <div>
                            <label style={lblStyle}>Thứ tự</label>
                            <input
                                type="number"
                                value={feeItemForm.displayOrder}
                                onChange={e => setFeeItemForm(f => ({ ...f, displayOrder: e.target.value }))}
                                style={inpStyle}
                            />
                        </div>
                    </div>
                    <label
                        style={{
                            fontSize: 12,
                            color: '#5B5490',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            marginBottom: 12,
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={feeItemForm.isActive}
                            onChange={e => setFeeItemForm(f => ({ ...f, isActive: e.target.checked }))}
                        />
                        Đang áp dụng
                    </label>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                        <button type="submit" style={btnStyle}>
                            {editingFeeItem ? 'Lưu khoản thu' : 'Thêm khoản thu'}
                        </button>
                        {editingFeeItem && (
                            <button
                                type="button"
                                onClick={cancelFeeItemEdit}
                                style={{ ...btnStyle, background: '#E5E7EB', color: '#374151' }}
                            >
                                Hủy
                            </button>
                        )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {feeItems.map(item => (
                            <div
                                key={item.id}
                                style={{
                                    border: '1px solid #EDE9FE',
                                    borderRadius: 10,
                                    padding: '10px 12px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    gap: 10,
                                    alignItems: 'center',
                                }}
                            >
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1E1B4B' }}>{item.name}</div>
                                    <div style={{ fontSize: 12, color: '#7C6D9B' }}>
                                        {facilityName(facilities, item.facility_id)} · {item.unit} ·{' '}
                                        {Number(item.default_amount || 0).toLocaleString('vi-VN')}đ
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => startFeeItemEdit(item)}
                                    style={{
                                        fontSize: 12,
                                        border: '1px solid #DDD6FE',
                                        background: 'none',
                                        borderRadius: 6,
                                        padding: '4px 10px',
                                        color: '#6D28D9',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Sửa
                                </button>
                            </div>
                        ))}
                    </div>
                </form>
            )}
        </div>
    )
}

function defaultTuitionForm() {
    return {
        name: '',
        facilityId: '',
        className: '',
        amount: '',
        billingCycle: 'monthly',
        refundPerPermittedAbsence: 20000,
        mealPricePerDay: 0,
        description: '',
        isActive: true,
    }
}

function defaultFeeItemForm() {
    return {
        facilityId: '',
        name: '',
        unit: 'tháng',
        defaultAmount: 0,
        category: 'optional',
        displayOrder: 100,
        isActive: true,
    }
}

function facilityName(facilities, facilityId) {
    if (!facilityId) return 'Áp dụng chung'
    return facilities.find(facility => facility.id === facilityId)?.name || 'Cơ sở'
}

// ─── Tab: Đồng ý dữ liệu (admin overview) ────────────────────────────────────

function ConsentsTab() {
    const supabaseMode = isSupabaseSession()
    const [students, setStudents] = useState([])
    const [consents, setConsents] = useState({})
    const [loading, setLoading] = useState(true)
    const [err, setErr] = useState('')
    const [saving, setSaving] = useState(null)

    useEffect(() => {
        Promise.all([
            supabaseMode ? listStudents({ status: 'active' }) : apiFetch('/api/students'),
            supabaseMode ? Promise.resolve(null) : apiFetch('/api/student-consents/all').catch(() => null),
        ])
            .then(([s]) => {
                setStudents(s)
                const map = {}
                s.forEach(st => {
                    map[st.id] = null
                })
                setConsents(map)
                setLoading(false)
                s.forEach(st => {
                    const request = supabaseMode ? getStudentConsent(st.id) : apiFetch(`/api/student-consents/${st.id}`)
                    request.then(c => setConsents(prev => ({ ...prev, [st.id]: c }))).catch(() => {})
                })
            })
            .catch(() => {
                setErr('Lỗi tải dữ liệu')
                setLoading(false)
            })
    }, [supabaseMode])

    async function toggleConsent(studentId, field, currentVal) {
        setSaving(studentId + field)
        try {
            const current = consents[studentId] || {
                allow_photos: 1,
                allow_notifications: 1,
                allow_photo_sharing: 0,
                data_retention_days: 365,
                contact_channels: ['app'],
            }
            const supabasePayload = {
                allowPhotos: field === 'allowPhotos' ? !currentVal : !!current.allow_photos,
                allowNotifications: field === 'allowNotifications' ? !currentVal : !!current.allow_notifications,
                allowPhotoSharing: field === 'allowPhotoSharing' ? !currentVal : !!current.allow_photo_sharing,
                dataRetentionDays: current.data_retention_days || 365,
                contactChannels: current.contact_channels || ['app'],
            }
            const updated = supabaseMode
                ? await saveStudentConsent(studentId, supabasePayload)
                : await apiFetch(`/api/student-consents/${studentId}`, {
                      method: 'PUT',
                      body: JSON.stringify({ [field]: !currentVal }),
                  })
            setConsents(prev => ({ ...prev, [studentId]: updated }))
        } catch (ex) {
            setErr(ex.message)
        }
        setSaving(null)
    }

    if (loading) return <div style={{ padding: 32, color: '#7C6D9B' }}>Đang tải...</div>

    return (
        <div>
            <div style={{ fontSize: 13, color: '#7C6D9B', marginBottom: 16 }}>Quản lý dữ liệu từng học sinh.</div>
            {err && <div style={{ color: '#DC2626', fontSize: 13, marginBottom: 12 }}>{err}</div>}
            <div className="mobile-scroll-table">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr style={{ background: '#F5F3FF' }}>
                            <th style={thStyle}>Học sinh</th>
                            <th style={thStyle}>📷 Cho phép ảnh</th>
                            <th style={thStyle}>🔔 Thông báo</th>
                            <th style={thStyle}>🌐 Chia sẻ ảnh</th>
                            <th style={thStyle}>🗃️ Lưu trữ (ngày)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map(st => {
                            const c = consents[st.id]
                            const def = {
                                allow_photos: 1,
                                allow_notifications: 1,
                                allow_photo_sharing: 0,
                                data_retention_days: 365,
                            }
                            const cv = c || def
                            return (
                                <tr key={st.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                                    <td style={tdStyle}>
                                        <div style={{ fontWeight: 600, color: '#1E1B4B' }}>{st.name}</div>
                                        <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                                            {st.className || st.classId || ''}
                                        </div>
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                        <Toggle
                                            value={!!cv.allow_photos}
                                            onChange={() => toggleConsent(st.id, 'allowPhotos', !!cv.allow_photos)}
                                            loading={saving === st.id + 'allowPhotos'}
                                        />
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                        <Toggle
                                            value={!!cv.allow_notifications}
                                            onChange={() =>
                                                toggleConsent(st.id, 'allowNotifications', !!cv.allow_notifications)
                                            }
                                            loading={saving === st.id + 'allowNotifications'}
                                        />
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                        <Toggle
                                            value={!!cv.allow_photo_sharing}
                                            onChange={() =>
                                                toggleConsent(st.id, 'allowPhotoSharing', !!cv.allow_photo_sharing)
                                            }
                                            loading={saving === st.id + 'allowPhotoSharing'}
                                        />
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'center', color: '#6D28D9', fontWeight: 600 }}>
                                        {cv.data_retention_days}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
            {students.length === 0 && (
                <div style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: 32 }}>
                    Chưa có học sinh nào.
                </div>
            )}
        </div>
    )
}

function Toggle({ value, onChange, loading }) {
    return (
        <button
            onClick={onChange}
            disabled={loading}
            aria-label={value ? 'Đang bật, nhấn để tắt' : 'Đang tắt, nhấn để bật'}
            style={{
                width: 40,
                height: 22,
                borderRadius: 11,
                border: 'none',
                cursor: loading ? 'wait' : 'pointer',
                background: value ? '#6D28D9' : '#D1D5DB',
                position: 'relative',
                transition: 'background 0.2s',
            }}
        >
            <span
                style={{
                    position: 'absolute',
                    top: 3,
                    left: value ? 20 : 3,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }}
            />
        </button>
    )
}

function ZaloTab() {
    const supabaseMode = isSupabaseSession()
    const [form, setForm] = useState({ zaloOaToken: '', zaloZnsInvoiceTemplate: '', zaloZnsIncidentTemplate: '' })
    const [saving, setSaving] = useState(false)
    const [testing, setTesting] = useState(false)
    const [msg, setMsg] = useState('')

    useEffect(() => {
        if (!supabaseMode) return
        getSchoolSettings()
            .then(d =>
                setForm({
                    zaloOaToken: d.zalo_oa_token || '',
                    zaloZnsInvoiceTemplate: d.zalo_zns_invoice_template || '',
                    zaloZnsIncidentTemplate: d.zalo_zns_incident_template || '',
                }),
            )
            .catch(() => {})
    }, [supabaseMode])

    async function handleSave(e) {
        e.preventDefault()
        setSaving(true)
        setMsg('')
        try {
            await saveSchoolSettings(form)
            setMsg('✅ Đã lưu cấu hình Zalo OA.')
        } catch (err) {
            setMsg(`❌ ${err.message}`)
        } finally {
            setSaving(false)
        }
    }

    async function handleTest() {
        const phone = prompt('Nhập số điện thoại Zalo để test (VD: 0901234567):')
        if (!phone) return
        setTesting(true)
        setMsg('')
        try {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
            const {
                data: { session },
            } = await (await import('../../lib/supabaseClient')).requireSupabase().auth.getSession()
            const res = await fetch(`${supabaseUrl}/functions/v1/send-zalo-zns`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session?.access_token}`,
                    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
                },
                body: JSON.stringify({
                    phone,
                    templateId: form.zaloZnsInvoiceTemplate,
                    templateData: {
                        student_name: 'Test',
                        amount: '100.000 đ',
                        due_date: '01/06/2026',
                        invoice_number: 'TEST-001',
                    },
                    refType: 'test',
                }),
            })
            const result = await res.json()
            setMsg(result.sent ? '✅ Gửi test thành công!' : `❌ ${result.error || 'Gửi thất bại'}`)
        } catch (err) {
            setMsg(`❌ ${err.message}`)
        } finally {
            setTesting(false)
        }
    }

    const inp = (label, field, placeholder = '') => (
        <div style={{ marginBottom: 16 }}>
            <label style={lblStyle}>{label}</label>
            <input
                type="text"
                value={form[field]}
                onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                placeholder={placeholder}
                style={inpStyle}
            />
        </div>
    )

    return (
        <div>
            <div style={sectionTitle}>🟦 Zalo Official Account (ZNS)</div>
            <div
                style={{
                    background: '#F0F9FF',
                    borderRadius: 10,
                    padding: '12px 16px',
                    marginBottom: 20,
                    fontSize: 13,
                    color: '#0369A1',
                }}
            >
                <strong>Hướng dẫn:</strong> Đăng ký Zalo Official Account tại <em>oa.zalo.me</em> → Lấy{' '}
                <strong>OA Access Token</strong> trong phần API → Tạo ZNS Template → Nhập Template ID vào đây.
            </div>
            <form onSubmit={handleSave} style={{ maxWidth: 560 }}>
                <div>
                    <label style={lblStyle}>🔑 Zalo OA Access Token</label>
                    <input
                        type="password"
                        value={form.zaloOaToken}
                        onChange={e => setForm(f => ({ ...f, zaloOaToken: e.target.value }))}
                        placeholder="Dán Access Token từ Zalo OA Dashboard..."
                        style={inpStyle}
                    />
                    <div style={{ fontSize: 11, color: '#7C6D9B', marginTop: 4, marginBottom: 16 }}>
                        Token được mã hóa khi lưu, không hiển thị lại
                    </div>
                </div>
                {inp('📄 ZNS Template ID — Hóa đơn học phí', 'zaloZnsInvoiceTemplate', 'VD: 320145')}
                {inp('🚨 ZNS Template ID — Sự cố (tùy chọn)', 'zaloZnsIncidentTemplate', 'VD: 320146')}
                {msg && (
                    <div
                        style={{ marginBottom: 12, fontSize: 13, color: msg.startsWith('✅') ? '#16a34a' : '#dc2626' }}
                    >
                        {msg}
                    </div>
                )}
                <div style={{ display: 'flex', gap: 10 }}>
                    <button type="submit" disabled={saving} style={btnStyle}>
                        {saving ? 'Đang lưu...' : '💾 Lưu cấu hình'}
                    </button>
                    {form.zaloZnsInvoiceTemplate && (
                        <button
                            type="button"
                            onClick={handleTest}
                            disabled={testing}
                            style={{ ...btnStyle, background: 'linear-gradient(135deg,#0369A1,#0284C7)' }}
                        >
                            {testing ? 'Đang gửi...' : '🧪 Gửi test ZNS'}
                        </button>
                    )}
                </div>
            </form>
        </div>
    )
}

// ─── Tab: Hướng dẫn sử dụng ──────────────────────────────────────────────────

const GUIDE_SECTIONS = [
    {
        title: '1. Đăng Nhập',
        items: [
            {
                role: 'Admin / Ban giám hiệu',
                steps: [
                    'Nhấn Admin / Giáo viên trên thanh điều hướng trang chủ.',
                    'Nhập email quản trị và mật khẩu được cấp.',
                    'Hệ thống chuyển đến trang quản trị.',
                ],
            },
            {
                role: 'Giáo viên',
                steps: [
                    'Nhấn Admin / Giáo viên trên trang chủ.',
                    'Nhập email và mật khẩu được cấp.',
                    'Giáo viên chỉ thấy dữ liệu của cơ sở được phân công.',
                ],
            },
            {
                role: 'Phụ huynh',
                steps: [
                    'Nhấn Phụ huynh đăng nhập trên trang chủ.',
                    'Nhập email và mật khẩu nhà trường cấp.',
                    'Nếu có nhiều bé, chọn bé cần xem ở thanh đầu trang.',
                ],
            },
        ],
    },
    {
        title: '2. Chức Năng Admin',
        bullets: [
            '🏠 Tổng quan: xem số học sinh, giáo viên, điểm danh và chỉ số vận hành theo thời gian thực.',
            '👦 Học sinh: xem danh sách, thêm/cập nhật hồ sơ, lọc theo cơ sở và lớp.',
            '👩‍🏫 Giáo viên: quản lý danh sách, thông tin liên hệ, phân công cơ sở.',
            '✅ Điểm danh: theo dõi chuyên cần theo ngày (có mặt, đi trễ, vắng, giờ đón, ghi chú).',
            '📓 Nhật ký ngày: xem nhật ký giáo viên ghi cho từng học sinh (bữa ăn, giấc ngủ, hoạt động).',
            '🏥 Sức khỏe: dị ứng, thuốc, ghi chú y tế, liên hệ khẩn cấp.',
            '🚨 Sự cố: ghi nhận sự cố, mức độ, cách xử lý, phụ huynh xác nhận.',
            '💰 Học phí: tạo hóa đơn, theo dõi thanh toán, nhắc qua Zalo ZNS.',
            '📢 Thông báo: gửi theo vai trò, lớp, học sinh hoặc toàn trường; hỗ trợ push notification.',
            '🍱 Thực đơn: lập thực đơn tuần, xuất bản cho phụ huynh xem.',
            '📷 Thư viện ảnh: tạo album, tải ảnh, duyệt và xuất bản; lưu trữ & xóa khi không cần.',
            '👤 Tài khoản: tạo/khóa/xóa tài khoản giáo viên và phụ huynh, gán cơ sở, liên kết học sinh.',
            '🗄️ Lưu trữ: theo dõi dung lượng ảnh, tải về và xóa ảnh lưu trữ.',
        ],
    },
    {
        title: '3. Quy Tắc Tài Khoản',
        bullets: [
            'Mỗi email chỉ tạo được một tài khoản trong toàn hệ thống.',
            'Giáo viên được phân cơ sở trực tiếp — chỉ thấy dữ liệu cơ sở được gán.',
            'Phụ huynh được phân cơ sở qua học sinh liên kết.',
            'Phụ huynh phải liên kết với học sinh trước khi lưu tài khoản.',
            'Mật khẩu tạm thời tối thiểu 8 ký tự. Để trống khi sửa nếu không muốn đổi.',
            'Khóa tài khoản chặn đăng nhập nhưng không xóa hồ sơ.',
        ],
    },
    {
        title: '4. Bảng Thu Tháng',
        bullets: [
            'Cấu hình học phí theo cơ sở và lớp tại tab Mức học phí trước khi tạo phiếu báo thu.',
            'Vắng P hoàn tiền ăn theo mức đã cấu hình; vắng K, nghỉ lễ và x/2 chỉ dùng để thống kê.',
            'x/2 vẫn tính đủ một suất ăn.',
            'Nếu còn ngày chưa điểm danh, hệ thống sẽ cảnh báo khi tạo phiếu báo thu.',
            'Phiếu chưa thanh toán được cập nhật khi tính lại; phiếu đã thanh toán sẽ tạo bản điều chỉnh.',
        ],
    },
    {
        title: '5. Chức Năng Giáo Viên',
        bullets: [
            '✅ Điểm danh học sinh trong cơ sở được phân công.',
            '📓 Ghi nhật ký ngày: bữa ăn, giấc ngủ, hoạt động, ghi chú.',
            '📷 Tải ảnh hoạt động lên thư viện để admin duyệt và xuất bản.',
            'Không xem được dữ liệu học sinh ngoài cơ sở của mình.',
        ],
    },
    {
        title: '6. Chức Năng Phụ Huynh',
        bullets: [
            'Xem hồ sơ, điểm danh, nhật ký ngày, thông báo, thực đơn, hình ảnh đã duyệt.',
            'Xem hồ sơ sức khỏe, báo cáo sự cố, hóa đơn học phí.',
            'Thiết lập quyền riêng tư và đồng ý hình ảnh.',
            'Bật push notification để nhận thông báo trực tiếp trên trình duyệt / điện thoại.',
            'Nhận thông báo Zalo ZNS (học phí, sự cố) nếu nhà trường đã cấu hình Zalo OA.',
        ],
    },
    {
        title: '7. Lưu Ý & Hỗ Trợ',
        bullets: [
            'Không chia sẻ tài khoản. Đăng xuất sau khi dùng thiết bị công cộng.',
            'Báo ngay cho nhà trường nếu thông tin học sinh hoặc phụ huynh chưa chính xác.',
            'Ảnh chỉ xuất bản khi phù hợp với quyền đồng ý của phụ huynh.',
            'Liên hệ quản trị nếu: không đăng nhập được, dữ liệu bị thiếu, cần cấp lại mật khẩu, push notification hoặc Zalo không nhận được tin.',
        ],
    },
]

function UserGuideTab() {
    return (
        <div>
            <div style={sectionTitle}>📋 Hướng Dẫn Sử Dụng Hệ Thống Maika</div>
            <div style={{ fontSize: 13, color: '#7C6D9B', marginBottom: 20 }}>
                Dành cho Admin, Giáo viên và Phụ huynh. Phiên bản cập nhật tháng 5/2026.
            </div>
            {GUIDE_SECTIONS.map(section => (
                <div key={section.title} style={{ marginBottom: 24 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#4C1D95', marginBottom: 10 }}>
                        {section.title}
                    </div>
                    {section.bullets && (
                        <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {section.bullets.map((b, i) => (
                                <li key={i} style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                                    {b}
                                </li>
                            ))}
                        </ul>
                    )}
                    {section.items && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {section.items.map(item => (
                                <div
                                    key={item.role}
                                    style={{ background: '#F5F3FF', borderRadius: 10, padding: '12px 16px' }}
                                >
                                    <div style={{ fontWeight: 700, fontSize: 13, color: '#6D28D9', marginBottom: 6 }}>
                                        {item.role}
                                    </div>
                                    <ol
                                        style={{
                                            margin: 0,
                                            paddingLeft: 18,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 4,
                                        }}
                                    >
                                        {item.steps.map((s, i) => (
                                            <li key={i} style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                                                {s}
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    )
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const lblStyle = { fontSize: 12, fontWeight: 700, color: '#5B5490', display: 'block', marginBottom: 4 }
const inpStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1.5px solid #DDD6FE',
    fontSize: 13,
    color: '#1E1B4B',
    background: '#fff',
    boxSizing: 'border-box',
}
const btnStyle = {
    padding: '10px 20px',
    borderRadius: 10,
    border: 'none',
    background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)',
    color: '#fff',
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
}
const sectionTitle = {
    fontWeight: 700,
    fontSize: 14,
    color: '#1E1B4B',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: '2px solid #EDE9FE',
}
const thStyle = { padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#5B5490', fontSize: 12 }
const tdStyle = { padding: '12px', verticalAlign: 'middle' }

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Settings() {
    const supabaseMode = isSupabaseSession()
    const [tab, setTab] = useState('school')

    if (!supabaseMode && !hasBackendAPI()) return <NoBackend />

    const tabContent = {
        school: <SchoolInfoTab />,
        payment: <PaymentTab />,
        academic: <AcademicTab />,
        tuition: <TuitionTab />,
        consents: <ConsentsTab />,
        zalo: <ZaloTab />,
        guide: <UserGuideTab />,
    }

    return (
        <div style={{ padding: '0 0 32px' }}>
            <div
                style={{
                    display: 'flex',
                    gap: 4,
                    marginBottom: 24,
                    borderBottom: '2px solid #EDE9FE',
                    paddingBottom: 0,
                    overflowX: 'auto',
                    WebkitOverflowScrolling: 'touch',
                }}
            >
                {TABS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        style={{
                            padding: '10px 18px',
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            fontWeight: tab === t.id ? 800 : 600,
                            fontSize: 13,
                            color: tab === t.id ? '#6D28D9' : '#7C6D9B',
                            borderBottom: tab === t.id ? '2px solid #6D28D9' : '2px solid transparent',
                            marginBottom: -2,
                            flexShrink: 0,
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div
                style={{
                    background: '#fff',
                    borderRadius: 16,
                    padding: 'clamp(14px, 4vw, 24px)',
                    boxShadow: '0 2px 12px rgba(109,40,217,0.06)',
                }}
            >
                {tabContent[tab]}
            </div>
        </div>
    )
}
