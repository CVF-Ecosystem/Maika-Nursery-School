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

const CHANNEL_OPTIONS = [
    { value: 'app', label: '📱 Ứng dụng' },
    { value: 'email', label: '📧 Email' },
    { value: 'sms', label: '💬 SMS' },
    { value: 'zalo', label: '💙 Zalo' },
]

const RETENTION_OPTIONS = [
    { value: 180, label: '6 tháng' },
    { value: 365, label: '1 năm' },
    { value: 730, label: '2 năm' },
    { value: 1825, label: '5 năm' },
]

export default function ConsentPanel({ studentId, studentName }) {
    const [consent, setConsent] = useState(null)
    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState('')

    useEffect(() => {
        if (!hasBackendAPI()) return
        apiFetch(`/api/student-consents/${studentId}`)
            .then(d => setConsent({
                allowPhotos: !!d.allow_photos,
                allowNotifications: !!d.allow_notifications,
                contactChannels: Array.isArray(d.contact_channels) ? d.contact_channels : ['app'],
                allowPhotoSharing: !!d.allow_photo_sharing,
                dataRetentionDays: d.data_retention_days || 365,
            }))
            .catch(() => setConsent({ allowPhotos: true, allowNotifications: true, contactChannels: ['app'], allowPhotoSharing: false, dataRetentionDays: 365 }))
    }, [studentId])

    async function handleSave(e) {
        e.preventDefault()
        setSaving(true)
        setMsg('')
        try {
            const updated = await apiFetch(`/api/student-consents/${studentId}`, {
                method: 'PUT',
                body: JSON.stringify(consent),
            })
            setConsent({
                allowPhotos: !!updated.allow_photos,
                allowNotifications: !!updated.allow_notifications,
                contactChannels: Array.isArray(updated.contact_channels) ? updated.contact_channels : ['app'],
                allowPhotoSharing: !!updated.allow_photo_sharing,
                dataRetentionDays: updated.data_retention_days || 365,
            })
            setMsg('✅ Đã cập nhật quyền riêng tư thành công.')
        } catch (err) {
            setMsg(`❌ ${err.message}`)
        } finally {
            setSaving(false)
        }
    }

    function toggleChannel(val) {
        setConsent(prev => {
            const channels = prev.contactChannels.includes(val)
                ? prev.contactChannels.filter(c => c !== val)
                : [...prev.contactChannels, val]
            return { ...prev, contactChannels: channels.length ? channels : ['app'] }
        })
    }

    if (!hasBackendAPI()) {
        return (
            <div style={{ background: '#fff', borderRadius: 20, padding: 48, textAlign: 'center', boxShadow: '0 2px 14px rgba(109,40,217,0.07)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔌</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#1E1B4B' }}>Cần kết nối Backend API</div>
                <div style={{ fontSize: 13, color: '#7C6D9B', marginTop: 6 }}>Tính năng này yêu cầu API để lưu trữ cài đặt quyền riêng tư.</div>
            </div>
        )
    }

    if (!consent) {
        return <div style={{ padding: 40, textAlign: 'center', color: '#7C6D9B' }}>Đang tải...</div>
    }

    return (
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <div style={{ background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)', borderRadius: 20, padding: '24px 28px', color: '#fff', marginBottom: 24 }}>
                <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 4 }}>🔒 Quyền riêng tư & Đồng ý</div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>Quản lý cách nhà trường sử dụng dữ liệu của <strong>{studentName}</strong></div>
            </div>

            <form onSubmit={handleSave}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* Cho phép ảnh */}
                    <ConsentCard
                        icon="📷"
                        title="Cho phép chụp ảnh hoạt động"
                        desc="Nhà trường có thể chụp ảnh bé trong các hoạt động học tập và sinh hoạt."
                        checked={consent.allowPhotos}
                        onChange={v => setConsent(p => ({ ...p, allowPhotos: v }))}
                    />

                    {/* Chia sẻ ảnh */}
                    <ConsentCard
                        icon="🌐"
                        title="Cho phép chia sẻ ảnh công khai"
                        desc="Nhà trường có thể sử dụng ảnh của bé trên website, mạng xã hội của trường."
                        checked={consent.allowPhotoSharing}
                        onChange={v => setConsent(p => ({ ...p, allowPhotoSharing: v }))}
                    />

                    {/* Thông báo */}
                    <ConsentCard
                        icon="🔔"
                        title="Nhận thông báo từ nhà trường"
                        desc="Thông báo học phí, sự kiện, sự cố sức khỏe và hoạt động của bé."
                        checked={consent.allowNotifications}
                        onChange={v => setConsent(p => ({ ...p, allowNotifications: v }))}
                    />

                    {/* Kênh liên lạc */}
                    {consent.allowNotifications && (
                        <div style={{ background: '#fff', borderRadius: 16, padding: '20px 22px', boxShadow: '0 2px 10px rgba(109,40,217,0.06)' }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: '#1E1B4B', marginBottom: 12 }}>📡 Kênh liên lạc ưu tiên</div>
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                {CHANNEL_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => toggleChannel(opt.value)}
                                        style={{
                                            padding: '8px 16px', borderRadius: 50, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                                            border: `2px solid ${consent.contactChannels.includes(opt.value) ? '#6D28D9' : '#DDD6FE'}`,
                                            background: consent.contactChannels.includes(opt.value) ? '#EDE9FE' : '#fff',
                                            color: consent.contactChannels.includes(opt.value) ? '#6D28D9' : '#7C6D9B',
                                        }}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Thời gian lưu dữ liệu */}
                    <div style={{ background: '#fff', borderRadius: 16, padding: '20px 22px', boxShadow: '0 2px 10px rgba(109,40,217,0.06)' }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#1E1B4B', marginBottom: 4 }}>🗃️ Thời gian lưu trữ dữ liệu</div>
                        <div style={{ fontSize: 13, color: '#7C6D9B', marginBottom: 12 }}>Sau thời gian này dữ liệu hình ảnh và nhật ký sẽ được xóa tự động.</div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            {RETENTION_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setConsent(p => ({ ...p, dataRetentionDays: opt.value }))}
                                    style={{
                                        padding: '8px 16px', borderRadius: 50, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                                        border: `2px solid ${consent.dataRetentionDays === opt.value ? '#6D28D9' : '#DDD6FE'}`,
                                        background: consent.dataRetentionDays === opt.value ? '#EDE9FE' : '#fff',
                                        color: consent.dataRetentionDays === opt.value ? '#6D28D9' : '#7C6D9B',
                                    }}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Legal note */}
                <div style={{ background: '#F8F7FF', borderRadius: 12, padding: '14px 18px', marginTop: 20, fontSize: 12, color: '#7C6D9B', lineHeight: 1.6 }}>
                    🛡️ Dữ liệu của bé được bảo mật theo quy định pháp luật. Nhà trường cam kết không chia sẻ thông tin cá nhân với bên thứ ba ngoài mục đích giáo dục đã được đồng ý.
                </div>

                {msg && (
                    <div style={{ marginTop: 14, fontSize: 13, fontWeight: 700, color: msg.startsWith('✅') ? '#16a34a' : '#dc2626', background: msg.startsWith('✅') ? '#F0FDF4' : '#FEF2F2', borderRadius: 10, padding: '10px 14px' }}>
                        {msg}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={saving}
                    style={{ marginTop: 20, width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: saving ? '#DDD6FE' : 'linear-gradient(135deg,#6D28D9,#8B5CF6)', color: saving ? '#7C6D9B' : '#fff', fontWeight: 800, fontSize: 15, cursor: saving ? 'not-allowed' : 'pointer' }}
                >
                    {saving ? 'Đang lưu...' : '💾 Lưu cài đặt quyền riêng tư'}
                </button>
            </form>
        </div>
    )
}

function ConsentCard({ icon, title, desc, checked, onChange }) {
    return (
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px 22px', boxShadow: '0 2px 10px rgba(109,40,217,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{icon}</div>
                <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1E1B4B' }}>{title}</div>
                    <div style={{ fontSize: 12, color: '#7C6D9B', marginTop: 3 }}>{desc}</div>
                </div>
            </div>
            <button
                type="button"
                onClick={() => onChange(!checked)}
                aria-label={checked ? 'Đang bật, nhấn để tắt' : 'Đang tắt, nhấn để bật'}
                style={{
                    flexShrink: 0, width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                    background: checked ? '#6D28D9' : '#D1D5DB', position: 'relative', transition: 'background 0.2s',
                }}
            >
                <span style={{
                    position: 'absolute', top: 3, left: checked ? 24 : 3,
                    width: 20, height: 20, borderRadius: '50%', background: '#fff',
                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
            </button>
        </div>
    )
}
