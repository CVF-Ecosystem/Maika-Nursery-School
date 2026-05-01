import { useEffect, useState } from 'react'
import { hasBackendAPI } from '../../data/api'

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
    { id: 'academic', label: '📅 Năm học & Ngày nghỉ' },
    { id: 'tuition', label: '💰 Mức học phí' },
    { id: 'consents', label: '🔒 Đồng ý dữ liệu' },
]

const CYCLE_LABEL = { monthly: 'Hàng tháng', term: 'Học kỳ', yearly: 'Cả năm' }

function NoBackend() {
    return (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: '#7C6D9B' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔌</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Cấu hình trường học đang được chuẩn bị</div>
            <div style={{ fontSize: 13 }}>Các thông tin vận hành của trường sẽ được cập nhật tại đây khi chức năng được bật.</div>
        </div>
    )
}

// ─── Tab: Thông tin trường ─────────────────────────────────────────────────────

function SchoolInfoTab() {
    const [form, setForm] = useState(null)
    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState('')

    useEffect(() => {
        apiFetch('/api/school-settings').then(d => setForm({
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
        })).catch(() => setMsg('Không tải được cấu hình'))
    }, [])

    async function handleSave(e) {
        e.preventDefault()
        setSaving(true)
        setMsg('')
        try {
            await apiFetch('/api/school-settings', { method: 'PUT', body: JSON.stringify(form) })
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
                    <div className="mobile-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                        <div>
                            {inp('Giờ đón - Bắt đầu', 'pickupStart', 'time')}
                        </div>
                        <div>
                            {inp('Giờ đón - Kết thúc', 'pickupEnd', 'time')}
                        </div>
                    </div>
                </div>
            </div>
            {msg && <div style={{ marginBottom: 12, fontSize: 13, color: msg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{msg}</div>}
            <button type="submit" disabled={saving} style={btnStyle}>
                {saving ? 'Đang lưu...' : '💾 Lưu cấu hình'}
            </button>
        </form>
    )
}

// ─── Tab: Năm học & Ngày nghỉ ─────────────────────────────────────────────────

function AcademicTab() {
    const [years, setYears] = useState([])
    const [holidays, setHolidays] = useState([])
    const [yearForm, setYearForm] = useState({ name: '', startDate: '', endDate: '', isCurrent: false })
    const [holForm, setHolForm] = useState({ name: '', date: '', isRecurring: false, note: '' })
    const [err, setErr] = useState('')

    function reload() {
        Promise.all([
            apiFetch('/api/academic-years'),
            apiFetch('/api/school-holidays'),
        ]).then(([y, h]) => { setYears(y); setHolidays(h) }).catch(() => setErr('Lỗi tải dữ liệu'))
    }

    useEffect(reload, [])

    async function addYear(e) {
        e.preventDefault()
        setErr('')
        try {
            await apiFetch('/api/academic-years', { method: 'POST', body: JSON.stringify(yearForm) })
            setYearForm({ name: '', startDate: '', endDate: '', isCurrent: false })
            reload()
        } catch (ex) { setErr(ex.message) }
    }

    async function setCurrentYear(id) {
        setErr('')
        try {
            await apiFetch(`/api/academic-years/${id}`, { method: 'PUT', body: JSON.stringify({ isCurrent: true }) })
            reload()
        } catch (ex) { setErr(ex.message) }
    }

    async function addHoliday(e) {
        e.preventDefault()
        setErr('')
        try {
            await apiFetch('/api/school-holidays', { method: 'POST', body: JSON.stringify(holForm) })
            setHolForm({ name: '', date: '', isRecurring: false, note: '' })
            reload()
        } catch (ex) { setErr(ex.message) }
    }

    async function deleteHoliday(id) {
        if (!confirm('Xóa ngày nghỉ này?')) return
        try {
            await apiFetch(`/api/school-holidays/${id}`, { method: 'DELETE' })
            reload()
        } catch (ex) { setErr(ex.message) }
    }

    return (
        <div className="mobile-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Năm học */}
            <div>
                <div style={sectionTitle}>📅 Năm học</div>
                <form onSubmit={addYear} style={{ marginBottom: 16, background: '#F8F7FF', borderRadius: 10, padding: 12 }}>
                    <input placeholder="VD: 2025–2026" value={yearForm.name} onChange={e => setYearForm(f => ({ ...f, name: e.target.value }))} style={{ ...inpStyle, marginBottom: 8 }} required />
                    <div className="mobile-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                        <input type="date" value={yearForm.startDate} onChange={e => setYearForm(f => ({ ...f, startDate: e.target.value }))} style={inpStyle} required />
                        <input type="date" value={yearForm.endDate} onChange={e => setYearForm(f => ({ ...f, endDate: e.target.value }))} style={inpStyle} required />
                    </div>
                    <label style={{ fontSize: 12, color: '#5B5490', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <input type="checkbox" checked={yearForm.isCurrent} onChange={e => setYearForm(f => ({ ...f, isCurrent: e.target.checked }))} />
                        Đặt làm năm học hiện tại
                    </label>
                    <button type="submit" style={{ ...btnStyle, padding: '8px 16px', fontSize: 13 }}>+ Thêm</button>
                </form>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {years.map(y => (
                        <div key={y.id} style={{ background: y.is_current ? '#EDE9FE' : '#F8F7FF', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: y.is_current ? '1.5px solid #A78BFA' : '1.5px solid #E5E7EB' }}>
                            <div>
                                <span style={{ fontWeight: 700, fontSize: 14, color: '#1E1B4B' }}>{y.name}</span>
                                {y.is_current && <span style={{ marginLeft: 6, fontSize: 11, background: '#6D28D9', color: '#fff', borderRadius: 4, padding: '1px 6px' }}>Hiện tại</span>}
                                <div style={{ fontSize: 12, color: '#7C6D9B', marginTop: 2 }}>{y.start_date} → {y.end_date}</div>
                            </div>
                            {!y.is_current && (
                                <button onClick={() => setCurrentYear(y.id)} style={{ fontSize: 12, border: '1px solid #A78BFA', background: 'none', borderRadius: 6, padding: '4px 10px', color: '#6D28D9', cursor: 'pointer' }}>
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
                <form onSubmit={addHoliday} style={{ marginBottom: 16, background: '#F8F7FF', borderRadius: 10, padding: 12 }}>
                    <input placeholder="Tên ngày nghỉ" value={holForm.name} onChange={e => setHolForm(f => ({ ...f, name: e.target.value }))} style={{ ...inpStyle, marginBottom: 8 }} required />
                    <input type="date" value={holForm.date} onChange={e => setHolForm(f => ({ ...f, date: e.target.value }))} style={{ ...inpStyle, marginBottom: 8 }} required />
                    <input placeholder="Ghi chú (tùy chọn)" value={holForm.note} onChange={e => setHolForm(f => ({ ...f, note: e.target.value }))} style={{ ...inpStyle, marginBottom: 8 }} />
                    <label style={{ fontSize: 12, color: '#5B5490', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <input type="checkbox" checked={holForm.isRecurring} onChange={e => setHolForm(f => ({ ...f, isRecurring: e.target.checked }))} />
                        Lặp hàng năm
                    </label>
                    <button type="submit" style={{ ...btnStyle, padding: '8px 16px', fontSize: 13 }}>+ Thêm</button>
                </form>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
                    {holidays.map(h => (
                        <div key={h.id} style={{ background: '#F8F7FF', borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #E5E7EB' }}>
                            <div>
                                <span style={{ fontWeight: 600, fontSize: 13, color: '#1E1B4B' }}>{h.name}</span>
                                {h.is_recurring ? <span style={{ marginLeft: 6, fontSize: 10, background: '#DDD6FE', color: '#5B21B6', borderRadius: 4, padding: '1px 5px' }}>Hàng năm</span> : null}
                                <div style={{ fontSize: 12, color: '#7C6D9B' }}>{h.date}{h.note ? ` — ${h.note}` : ''}</div>
                            </div>
                            <button onClick={() => deleteHoliday(h.id)} aria-label="Xóa ngày nghỉ" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontSize: 16 }}>🗑</button>
                        </div>
                    ))}
                    {holidays.length === 0 && <div style={{ color: '#9CA3AF', fontSize: 13 }}>Chưa có ngày nghỉ nào.</div>}
                </div>
            </div>

            {err && <div style={{ gridColumn: '1/-1', color: '#DC2626', fontSize: 13 }}>{err}</div>}
        </div>
    )
}

// ─── Tab: Mức học phí ─────────────────────────────────────────────────────────

function TuitionTab() {
    const [plans, setPlans] = useState([])
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState({ name: '', amount: '', billingCycle: 'monthly', description: '', isActive: true })
    const [err, setErr] = useState('')

    function reload() {
        apiFetch('/api/tuition-plans').then(setPlans).catch(() => setErr('Lỗi tải dữ liệu'))
    }

    useEffect(reload, [])

    function startEdit(p) {
        setEditing(p.id)
        setForm({ name: p.name, amount: p.amount, billingCycle: p.billing_cycle, description: p.description || '', isActive: !!p.is_active })
    }

    function cancelEdit() { setEditing(null); setForm({ name: '', amount: '', billingCycle: 'monthly', description: '', isActive: true }) }

    async function handleSubmit(e) {
        e.preventDefault()
        setErr('')
        try {
            if (editing) {
                await apiFetch(`/api/tuition-plans/${editing}`, { method: 'PUT', body: JSON.stringify(form) })
            } else {
                await apiFetch('/api/tuition-plans', { method: 'POST', body: JSON.stringify(form) })
            }
            cancelEdit()
            reload()
        } catch (ex) { setErr(ex.message) }
    }

    return (
        <div>
            <form onSubmit={handleSubmit} style={{ background: '#F8F7FF', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1E1B4B', marginBottom: 12 }}>{editing ? '✏️ Chỉnh sửa mức phí' : '➕ Thêm mức học phí'}</div>
                <div className="mobile-two-col" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                        <label style={lblStyle}>Tên mức phí</label>
                        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="VD: Học phí tháng Mầm" style={inpStyle} required />
                    </div>
                    <div>
                        <label style={lblStyle}>Số tiền (VND)</label>
                        <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="3000000" style={inpStyle} required min="0" />
                    </div>
                    <div>
                        <label style={lblStyle}>Chu kỳ</label>
                        <select value={form.billingCycle} onChange={e => setForm(f => ({ ...f, billingCycle: e.target.value }))} style={inpStyle}>
                            <option value="monthly">Hàng tháng</option>
                            <option value="term">Học kỳ</option>
                            <option value="yearly">Cả năm</option>
                        </select>
                    </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                    <label style={lblStyle}>Mô tả (tùy chọn)</label>
                    <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ghi chú thêm..." style={inpStyle} />
                </div>
                <label style={{ fontSize: 12, color: '#5B5490', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                    Đang áp dụng
                </label>
                {err && <div style={{ fontSize: 13, color: '#DC2626', marginBottom: 8 }}>{err}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" style={btnStyle}>{editing ? '💾 Lưu' : '➕ Thêm'}</button>
                    {editing && <button type="button" onClick={cancelEdit} style={{ ...btnStyle, background: '#E5E7EB', color: '#374151' }}>Hủy</button>}
                </div>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {plans.map(p => (
                    <div key={p.id} style={{ background: p.is_active ? '#F8F7FF' : '#F9FAFB', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1.5px solid ${p.is_active ? '#DDD6FE' : '#E5E7EB'}` }}>
                        <div>
                            <span style={{ fontWeight: 700, fontSize: 14, color: p.is_active ? '#1E1B4B' : '#9CA3AF' }}>{p.name}</span>
                            {!p.is_active && <span style={{ marginLeft: 6, fontSize: 11, background: '#F3F4F6', color: '#6B7280', borderRadius: 4, padding: '1px 6px' }}>Ngưng</span>}
                            <div style={{ fontSize: 13, color: '#6D28D9', fontWeight: 600, marginTop: 2 }}>
                                {Number(p.amount).toLocaleString('vi-VN')}đ / {CYCLE_LABEL[p.billing_cycle]}
                            </div>
                            {p.description && <div style={{ fontSize: 12, color: '#7C6D9B' }}>{p.description}</div>}
                        </div>
                        <button onClick={() => startEdit(p)} style={{ fontSize: 12, border: '1px solid #DDD6FE', background: 'none', borderRadius: 6, padding: '4px 10px', color: '#6D28D9', cursor: 'pointer' }}>
                            ✏️ Sửa
                        </button>
                    </div>
                ))}
                {plans.length === 0 && <div style={{ color: '#9CA3AF', fontSize: 13 }}>Chưa có mức học phí nào.</div>}
            </div>
        </div>
    )
}

// ─── Tab: Đồng ý dữ liệu (admin overview) ────────────────────────────────────

function ConsentsTab() {
    const [students, setStudents] = useState([])
    const [consents, setConsents] = useState({})
    const [loading, setLoading] = useState(true)
    const [err, setErr] = useState('')
    const [saving, setSaving] = useState(null)

    useEffect(() => {
        Promise.all([
            apiFetch('/api/students'),
            apiFetch('/api/student-consents/all').catch(() => null),
        ]).then(([s]) => {
            setStudents(s)
            const map = {}
            s.forEach(st => { map[st.id] = null })
            setConsents(map)
            setLoading(false)
            s.forEach(st => {
                apiFetch(`/api/student-consents/${st.id}`)
                    .then(c => setConsents(prev => ({ ...prev, [st.id]: c })))
                    .catch(() => {})
            })
        }).catch(() => { setErr('Lỗi tải dữ liệu'); setLoading(false) })
    }, [])

    async function toggleConsent(studentId, field, currentVal) {
        setSaving(studentId + field)
        try {
            const updated = await apiFetch(`/api/student-consents/${studentId}`, {
                method: 'PUT',
                body: JSON.stringify({ [field]: !currentVal }),
            })
            setConsents(prev => ({ ...prev, [studentId]: updated }))
        } catch (ex) { setErr(ex.message) }
        setSaving(null)
    }

    if (loading) return <div style={{ padding: 32, color: '#7C6D9B' }}>Đang tải...</div>

    return (
        <div>
            <div style={{ fontSize: 13, color: '#7C6D9B', marginBottom: 16 }}>
                Quản lý quyền riêng tư & đồng ý sử dụng dữ liệu cho từng học sinh. Phụ huynh có thể tự cập nhật trong cổng thông tin của họ.
            </div>
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
                        const def = { allow_photos: 1, allow_notifications: 1, allow_photo_sharing: 0, data_retention_days: 365 }
                        const cv = c || def
                        return (
                            <tr key={st.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                                <td style={tdStyle}>
                                    <div style={{ fontWeight: 600, color: '#1E1B4B' }}>{st.name}</div>
                                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>{st.className || st.classId || ''}</div>
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                    <Toggle value={!!cv.allow_photos} onChange={() => toggleConsent(st.id, 'allowPhotos', !!cv.allow_photos)} loading={saving === st.id + 'allowPhotos'} />
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                    <Toggle value={!!cv.allow_notifications} onChange={() => toggleConsent(st.id, 'allowNotifications', !!cv.allow_notifications)} loading={saving === st.id + 'allowNotifications'} />
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                    <Toggle value={!!cv.allow_photo_sharing} onChange={() => toggleConsent(st.id, 'allowPhotoSharing', !!cv.allow_photo_sharing)} loading={saving === st.id + 'allowPhotoSharing'} />
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'center', color: '#6D28D9', fontWeight: 600 }}>{cv.data_retention_days}</td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
            </div>
            {students.length === 0 && <div style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: 32 }}>Chưa có học sinh nào.</div>}
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
                width: 40, height: 22, borderRadius: 11, border: 'none', cursor: loading ? 'wait' : 'pointer',
                background: value ? '#6D28D9' : '#D1D5DB', position: 'relative', transition: 'background 0.2s',
            }}
        >
            <span style={{
                position: 'absolute', top: 3, left: value ? 20 : 3,
                width: 16, height: 16, borderRadius: '50%', background: '#fff',
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
        </button>
    )
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const lblStyle = { fontSize: 12, fontWeight: 700, color: '#5B5490', display: 'block', marginBottom: 4 }
const inpStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #DDD6FE', fontSize: 13, color: '#1E1B4B', background: '#fff', boxSizing: 'border-box' }
const btnStyle = { padding: '10px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }
const sectionTitle = { fontWeight: 700, fontSize: 14, color: '#1E1B4B', marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid #EDE9FE' }
const thStyle = { padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#5B5490', fontSize: 12 }
const tdStyle = { padding: '12px', verticalAlign: 'middle' }

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Settings() {
    const [tab, setTab] = useState('school')

    if (!hasBackendAPI()) return <NoBackend />

    const tabContent = {
        school: <SchoolInfoTab />,
        academic: <AcademicTab />,
        tuition: <TuitionTab />,
        consents: <ConsentsTab />,
    }

    return (
        <div style={{ padding: '0 0 32px' }}>
            <div style={{ marginBottom: 24 }}>
                <div style={{ fontWeight: 900, fontSize: 22, color: '#1E1B4B' }}>⚙️ Cấu hình trường học</div>
                <div style={{ fontSize: 13, color: '#7C6D9B', marginTop: 4 }}>Thông tin trường, năm học, mức học phí và quyền riêng tư dữ liệu</div>
            </div>

            <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid #EDE9FE', paddingBottom: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                {TABS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        style={{
                            padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
                            fontWeight: tab === t.id ? 800 : 600, fontSize: 13,
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

            <div style={{ background: '#fff', borderRadius: 16, padding: 'clamp(14px, 4vw, 24px)', boxShadow: '0 2px 12px rgba(109,40,217,0.06)' }}>
                {tabContent[tab]}
            </div>
        </div>
    )
}
