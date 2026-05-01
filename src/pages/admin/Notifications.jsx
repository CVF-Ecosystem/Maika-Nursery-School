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
    return json.data ?? json
}

const TYPE_OPTIONS = [
    { value: 'general', label: 'Thông báo chung', icon: '📢' },
    { value: 'invoice', label: 'Học phí', icon: '💰' },
    { value: 'event', label: 'Sự kiện', icon: '📅' },
    { value: 'health', label: 'Y tế', icon: '🏥' },
    { value: 'incident', label: 'Sự cố', icon: '⚠️' },
    { value: 'emergency', label: 'Khẩn cấp', icon: '🚨' },
    { value: 'system', label: 'Hệ thống', icon: '⚙️' },
]

const PRIORITY_OPTIONS = [
    { value: 'low', label: 'Thấp', color: '#6B7280' },
    { value: 'normal', label: 'Bình thường', color: '#6D28D9' },
    { value: 'high', label: 'Cao', color: '#D97706' },
    { value: 'urgent', label: 'Khẩn cấp', color: '#DC2626' },
]

const CHANNEL_OPTIONS = [
    { value: 'app', label: '📱 Trong app' },
    { value: 'email', label: '📧 Email' },
    { value: 'sms', label: '💬 SMS' },
    { value: 'zalo', label: '💙 Zalo' },
    { value: 'all', label: '📡 Tất cả' },
]

const STATUS_BADGE = {
    draft: { label: 'Nháp', bg: '#F3F4F6', color: '#6B7280' },
    scheduled: { label: 'Đã lên lịch', bg: '#EFF6FF', color: '#1D4ED8' },
    sent: { label: 'Đã gửi', bg: '#ECFDF5', color: '#059669' },
    failed: { label: 'Thất bại', bg: '#FEF2F2', color: '#DC2626' },
    cancelled: { label: 'Đã hủy', bg: '#F9FAFB', color: '#9CA3AF' },
}

const EMPTY_FORM = { title: '', body: '', type: 'general', priority: 'normal', targetRole: '', channel: 'app', scheduledAt: '', status: 'draft' }

function NoBackend() {
    return (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: '#7C6D9B' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔌</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Thông báo đang được chuẩn bị</div>
            <div style={{ fontSize: 13 }}>Nhà trường sẽ có thể tạo và gửi thông báo tại đây khi chức năng được bật.</div>
        </div>
    )
}

export default function Notifications({ readOnly = false }) {
    const [items, setItems] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState(EMPTY_FORM)
    const [err, setErr] = useState('')
    const [saving, setSaving] = useState(false)
    const [filterStatus, setFilterStatus] = useState('')

    function reload() {
        const qs = filterStatus ? `?status=${filterStatus}` : ''
        apiFetch(`/api/notifications${qs}`)
            .then(d => setItems(Array.isArray(d) ? d : d.data || []))
            .catch(() => setErr('Lỗi tải dữ liệu'))
    }

    useEffect(reload, [filterStatus])

    function openCreate() {
        setEditing(null)
        setForm(EMPTY_FORM)
        setErr('')
        setShowModal(true)
    }

    function openEdit(item) {
        if (item.status === 'sent') return
        setEditing(item)
        setForm({
            title: item.title,
            body: item.body,
            type: item.type,
            priority: item.priority,
            targetRole: item.target_role || '',
            channel: item.channel,
            scheduledAt: item.scheduled_at || '',
            status: item.status,
        })
        setErr('')
        setShowModal(true)
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setSaving(true)
        setErr('')
        try {
            if (editing) {
                await apiFetch(`/api/notifications/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) })
            } else {
                await apiFetch('/api/notifications', { method: 'POST', body: JSON.stringify(form) })
            }
            setShowModal(false)
            reload()
        } catch (ex) { setErr(ex.message) }
        setSaving(false)
    }

    async function handleSend(item) {
        if (!confirm(`Gửi thông báo "${item.title}" ngay bây giờ?`)) return
        setSaving(true)
        try {
            await apiFetch(`/api/notifications/${item.id}`, { method: 'PUT', body: JSON.stringify({ status: 'sent' }) })
            reload()
        } catch (ex) { setErr(ex.message) }
        setSaving(false)
    }

    async function handleCancel(item) {
        if (!confirm('Hủy thông báo này?')) return
        try {
            await apiFetch(`/api/notifications/${item.id}`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) })
            reload()
        } catch (ex) { setErr(ex.message) }
    }

    if (!hasBackendAPI()) return <NoBackend />

    const typeMap = Object.fromEntries(TYPE_OPTIONS.map(t => [t.value, t]))

    return (
        <div>
            {!readOnly && (
                <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {['', 'draft', 'sent', 'scheduled', 'failed'].map(s => (
                            <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${filterStatus === s ? '#6D28D9' : '#DDD6FE'}`, background: filterStatus === s ? '#6D28D9' : '#fff', color: filterStatus === s ? '#fff' : '#7C6D9B', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                                {s ? (STATUS_BADGE[s]?.label || s) : 'Tất cả'}
                            </button>
                        ))}
                    </div>
                    <button onClick={openCreate} style={{ padding: '10px 20px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
                        ✉️ Tạo thông báo
                    </button>
                </div>
            )}

            {err && <div style={{ color: '#DC2626', fontSize: 13, marginBottom: 12 }}>{err}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {items.map(item => {
                    const badge = STATUS_BADGE[item.status] || STATUS_BADGE.draft
                    const typeInfo = typeMap[item.type] || { icon: '📢', label: item.type }
                    const priority = PRIORITY_OPTIONS.find(p => p.value === item.priority)
                    return (
                        <div key={item.id} style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', boxShadow: '0 2px 10px rgba(109,40,217,0.06)', borderLeft: `4px solid ${priority?.color || '#6D28D9'}` }}>
                            <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: 16 }}>{typeInfo.icon}</span>
                                        <span style={{ fontWeight: 800, fontSize: 15, color: '#1E1B4B' }}>{item.title}</span>
                                        <span style={{ fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.color, borderRadius: 20, padding: '2px 8px' }}>{badge.label}</span>
                                        {item.priority !== 'normal' && <span style={{ fontSize: 11, fontWeight: 700, color: priority?.color, background: priority?.color + '15', borderRadius: 20, padding: '2px 8px' }}>{priority?.label}</span>}
                                    </div>
                                    <div style={{ fontSize: 13, color: '#4B4899', marginBottom: 8, whiteSpace: 'pre-wrap' }}>{item.body}</div>
                                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#9CA3AF', flexWrap: 'wrap' }}>
                                        {item.target_role && <span>👥 {item.target_role}</span>}
                                        <span>📡 {CHANNEL_OPTIONS.find(c => c.value === item.channel)?.label || item.channel}</span>
                                        {item.sent_at && <span>✅ Gửi: {new Date(item.sent_at).toLocaleString('vi-VN')}</span>}
                                        {item.scheduled_at && item.status === 'scheduled' && <span>⏰ Lịch: {new Date(item.scheduled_at).toLocaleString('vi-VN')}</span>}
                                        <span>🕐 {new Date(item.created_at).toLocaleDateString('vi-VN')}</span>
                                    </div>
                                </div>
                                {!readOnly && (
                                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                                        {['draft', 'scheduled'].includes(item.status) && (
                                            <>
                                                <button onClick={() => openEdit(item)} style={actBtn('#DDD6FE', '#6D28D9')}>✏️</button>
                                                <button onClick={() => handleSend(item)} disabled={saving} style={actBtn('#D1FAE5', '#059669')}>📤</button>
                                                <button onClick={() => handleCancel(item)} style={actBtn('#FEE2E2', '#DC2626')}>✕</button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
                {items.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '48px 24px', color: '#7C6D9B' }}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                        <div style={{ fontWeight: 700 }}>Chưa có thông báo nào</div>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div role="dialog" aria-modal="true" aria-label="Tạo thông báo" style={{ position: 'fixed', inset: 0, background: 'rgba(30,27,75,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
                    <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: '28px 32px', boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
                        <div style={{ fontWeight: 900, fontSize: 18, color: '#1E1B4B', marginBottom: 20 }}>
                            {editing ? '✏️ Chỉnh sửa thông báo' : '✉️ Tạo thông báo mới'}
                        </div>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <Field label="Tiêu đề *">
                                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="VD: Thông báo nghỉ lễ 30/4" style={INP} required />
                            </Field>
                            <Field label="Nội dung *">
                                <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={4} placeholder="Nội dung thông báo..." style={{ ...INP, resize: 'vertical' }} required />
                            </Field>
                            <div className="mobile-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <Field label="Loại thông báo">
                                    <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={INP}>
                                        {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                                    </select>
                                </Field>
                                <Field label="Độ ưu tiên">
                                    <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={INP}>
                                        {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                    </select>
                                </Field>
                                <Field label="Đối tượng nhận">
                                    <select value={form.targetRole} onChange={e => setForm(f => ({ ...f, targetRole: e.target.value }))} style={INP}>
                                        <option value="">Tất cả</option>
                                        <option value="parent">Phụ huynh</option>
                                        <option value="teacher">Giáo viên</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </Field>
                                <Field label="Kênh gửi">
                                    <select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))} style={INP}>
                                        {CHANNEL_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                    </select>
                                </Field>
                            </div>
                            <Field label="Gửi lúc (để trống = gửi ngay khi bấm Gửi)">
                                <input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value, status: e.target.value ? 'scheduled' : 'draft' }))} style={INP} />
                            </Field>
                            {err && <div style={{ color: '#DC2626', fontSize: 13, background: '#FEF2F2', borderRadius: 8, padding: '8px 12px' }}>{err}</div>}
                            <div className="mobile-stack" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '10px 20px', borderRadius: 10, border: '1.5px solid #DDD6FE', background: '#fff', color: '#6D28D9', fontWeight: 700, cursor: 'pointer' }}>Hủy</button>
                                <button type="submit" disabled={saving} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)', color: '#fff', fontWeight: 800, cursor: saving ? 'wait' : 'pointer' }}>
                                    {saving ? 'Đang lưu...' : editing ? 'Cập nhật' : 'Lưu nháp'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

function Field({ label, children }) {
    return (
        <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#5B5490', display: 'block', marginBottom: 4 }}>{label}</label>
            {children}
        </div>
    )
}

const INP = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #DDD6FE', fontSize: 13, color: '#1E1B4B', background: '#fff', boxSizing: 'border-box' }

function actBtn(bg, color) {
    return { background: bg, color, border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontWeight: 700, fontSize: 13 }
}
