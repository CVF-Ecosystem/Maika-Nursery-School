import { useEffect, useState } from 'react'
import { hasBackendAPI } from '../../data/api'
import { isSupabaseSession } from '../../data/backendMode'
import { listNotifications, markNotificationRead } from '../../features/operations/operationalService'

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

const TYPE_ICON = { general: '📢', invoice: '💰', event: '📅', health: '🏥', incident: '⚠️', emergency: '🚨', system: '⚙️' }
const PRIORITY_COLOR = { low: '#9CA3AF', normal: '#6D28D9', high: '#D97706', urgent: '#DC2626' }
const TYPE_FILTER = [
    { value: '', label: 'Tất cả' },
    { value: 'general', label: '📢 Chung' },
    { value: 'invoice', label: '💰 Học phí' },
    { value: 'event', label: '📅 Sự kiện' },
    { value: 'health', label: '🏥 Y tế' },
    { value: 'incident', label: '⚠️ Sự cố' },
    { value: 'emergency', label: '🚨 Khẩn cấp' },
]

export default function NotificationCenter({ studentId, classId }) {
    const supabaseMode = isSupabaseSession()
    const [items, setItems] = useState([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [filterType, setFilterType] = useState('')
    const [expanded, setExpanded] = useState(new Set())
    const [err, setErr] = useState('')

    function reload() {
        if (!supabaseMode && !hasBackendAPI()) return
        const request = supabaseMode ? listNotifications() : apiFetch('/api/notifications')
        request
            .then(d => {
                const list = Array.isArray(d) ? d : (d.data || [])
                setItems(list)
                setUnreadCount(typeof d.unreadCount === 'number' ? d.unreadCount : list.filter(n => !n.is_read).length)
            })
            .catch(() => setErr('Không tải được thông báo'))
    }

    useEffect(reload, [])

    async function markRead(id) {
        try {
            if (supabaseMode) {
                await markNotificationRead(id)
            } else {
                await apiFetch(`/api/notifications/${id}/read`, { method: 'POST' })
            }
            setItems(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n))
            setUnreadCount(prev => Math.max(0, prev - 1))
        } catch {}
    }

    function toggleExpand(id, isRead) {
        setExpanded(prev => {
            const next = new Set(prev)
            if (next.has(id)) { next.delete(id) } else {
                next.add(id)
                if (!isRead) markRead(id)
            }
            return next
        })
    }

    if (!supabaseMode && !hasBackendAPI()) {
        return (
            <div style={{ background: '#fff', borderRadius: 20, padding: 48, textAlign: 'center', boxShadow: '0 2px 14px rgba(109,40,217,0.07)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#1E1B4B' }}>Chưa có thông báo mới</div>
                <div style={{ fontSize: 13, color: '#7C6D9B', marginTop: 6 }}>Các thông báo mới từ nhà trường sẽ hiển thị tại đây.</div>
            </div>
        )
    }

    const filtered = filterType ? items.filter(n => n.type === filterType) : items

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E1B4B', margin: 0 }}>🔔 Thông báo từ nhà trường</h2>
                    {unreadCount > 0 && <span style={{ fontSize: 13, color: '#6D28D9', fontWeight: 700 }}>{unreadCount} thông báo chưa đọc</span>}
                </div>
            </div>

            {err && <div style={{ color: '#DC2626', fontSize: 13, marginBottom: 12 }}>{err}</div>}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                {TYPE_FILTER.map(f => (
                    <button key={f.value} onClick={() => setFilterType(f.value)} style={{ padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${filterType === f.value ? '#6D28D9' : '#DDD6FE'}`, background: filterType === f.value ? '#6D28D9' : '#fff', color: filterType === f.value ? '#fff' : '#7C6D9B', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                        {f.label}
                    </button>
                ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filtered.map(item => {
                    const isExpanded = expanded.has(item.id)
                    const isRead = !!item.is_read
                    const priorityColor = PRIORITY_COLOR[item.priority] || '#6D28D9'
                    return (
                        <div key={item.id} onClick={() => toggleExpand(item.id, isRead)} style={{ background: isRead ? '#F9F9FF' : '#fff', borderRadius: 16, padding: '18px 22px', boxShadow: '0 2px 12px rgba(109,40,217,0.07)', borderLeft: `4px solid ${isRead ? '#E5E7EB' : priorityColor}`, cursor: 'pointer', transition: 'box-shadow 0.15s' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 12, background: isRead ? '#F3F4F6' : '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                                    {TYPE_ICON[item.type] || '📢'}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                        <div style={{ fontWeight: isRead ? 600 : 800, fontSize: 15, color: '#1E1B4B' }}>{item.title}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                            {!isRead && <div style={{ width: 8, height: 8, borderRadius: '50%', background: priorityColor }} />}
                                            <span style={{ fontSize: 11, color: '#9CA3AF' }}>{new Date(item.created_at).toLocaleDateString('vi-VN')}</span>
                                        </div>
                                    </div>
                                    {!isExpanded && <div style={{ fontSize: 13, color: '#7C6D9B', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.body}</div>}
                                    {isExpanded && <div style={{ fontSize: 14, color: '#4B4899', marginTop: 10, lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{item.body}</div>}
                                </div>
                            </div>
                        </div>
                    )
                })}

                {filtered.length === 0 && (
                    <div style={{ background: '#fff', borderRadius: 20, padding: 48, textAlign: 'center', boxShadow: '0 2px 14px rgba(109,40,217,0.07)' }}>
                        <div style={{ fontSize: 52, marginBottom: 12 }}>📭</div>
                        <div style={{ fontWeight: 700, fontSize: 16, color: '#1E1B4B' }}>Chưa có thông báo nào</div>
                    </div>
                )}
            </div>
        </div>
    )
}
