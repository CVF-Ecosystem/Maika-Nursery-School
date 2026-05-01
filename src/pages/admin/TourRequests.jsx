import { useEffect, useState } from 'react'
import { apiRequest, hasBackendAPI } from '../../data/api'
import { isLegacyBackendAllowed, isSupabaseSession } from '../../data/backendMode'
import { commit, getDB } from '../../data/store'
import { requireSupabase } from '../../lib/supabaseClient'

const STATUS = {
    new: { label: 'Mới', bg: '#FEF3C7', color: '#D97706' },
    contacted: { label: 'Đã liên hệ', bg: '#EDE9FE', color: '#6D28D9' },
    scheduled: { label: 'Đã hẹn', bg: '#DBEAFE', color: '#2563EB' },
    closed: { label: 'Đã xử lý', bg: '#D1FAE5', color: '#059669' },
}

function fmtDateTime(value) {
    if (!value) return '—'
    return new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

function mapSupabaseRequest(row) {
    return {
        id: row.id,
        parentName: row.parent_name,
        phone: row.phone,
        childAge: row.child_age || '',
        note: row.note || '',
        status: row.status,
        createdAt: row.created_at,
    }
}

export default function TourRequests() {
    const legacyMode = isLegacyBackendAllowed() && !isSupabaseSession()
    const [items, setItems] = useState([])
    const [error, setError] = useState('')

    function loadLocal() {
        const db = getDB()
        setItems([...(db.tourRequests || [])].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))))
    }

    function reload() {
        setError('')
        if (isSupabaseSession()) {
            let client
            try {
                client = requireSupabase()
            } catch (err) {
                setError(err.message || 'Hệ thống dữ liệu chưa sẵn sàng.')
                return
            }
            client
                .from('tour_requests')
                .select('id, parent_name, phone, child_age, note, status, created_at')
                .order('created_at', { ascending: false })
                .then(({ data, error }) => {
                    if (error) throw error
                    setItems((data || []).map(mapSupabaseRequest))
                })
                .catch(err => setError(err.message || 'Không tải được đăng ký tham quan.'))
            return
        }

        if (legacyMode && hasBackendAPI()) {
            apiRequest('/api/tour-requests')
                .then(payload => setItems(payload.data || []))
                .catch(err => setError(err.message || 'Không tải được đăng ký tham quan.'))
            return
        }
        if (legacyMode) loadLocal()
    }

    useEffect(() => {
        reload()
    }, [])

    async function setStatus(item, status) {
        if (isSupabaseSession()) {
            let client
            try {
                client = requireSupabase()
            } catch (err) {
                setError(err.message || 'Hệ thống dữ liệu chưa sẵn sàng.')
                return
            }
            const { data, error } = await client
                .from('tour_requests')
                .update({ status })
                .eq('id', item.id)
                .select('id, parent_name, phone, child_age, note, status, created_at')
                .single()
            if (error) {
                setError(error.message || 'Không cập nhật được trạng thái.')
                return
            }
            setItems(current => current.map(row => row.id === item.id ? mapSupabaseRequest(data) : row))
            return
        }

        if (legacyMode && hasBackendAPI()) {
            const payload = await apiRequest(`/api/tour-requests/${item.id}`, {
                method: 'PUT',
                body: JSON.stringify({ ...item, status }),
            })
            setItems(current => current.map(row => row.id === item.id ? payload.data : row))
            return
        }

        const db = getDB()
        const idx = (db.tourRequests || []).findIndex(row => row.id === item.id)
        if (idx >= 0) {
            db.tourRequests[idx] = { ...db.tourRequests[idx], status }
            commit()
            loadLocal()
        }
    }

    return (
        <div className="admin-page-pad" style={{ padding: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 20 }}>
                {[
                    ['Tổng đăng ký', items.length, '#6D28D9'],
                    ['Chưa liên hệ', items.filter(i => i.status === 'new').length, '#D97706'],
                    ['Đã hẹn', items.filter(i => i.status === 'scheduled').length, '#2563EB'],
                ].map(([label, value, color]) => (
                    <div key={label} style={{ background: '#fff', border: '1.5px solid #EDE9FE', borderRadius: 16, padding: 18 }}>
                        <div style={{ fontSize: 12, color: '#7C6D9B', fontWeight: 800 }}>{label}</div>
                        <div style={{ fontSize: 30, color, fontWeight: 900, marginTop: 6 }}>{value}</div>
                    </div>
                ))}
            </div>

            {error && <div style={{ padding: 14, borderRadius: 14, background: '#FEF2F2', color: '#DC2626', fontWeight: 700, marginBottom: 16 }}>{error}</div>}

            <div className="mobile-scroll-table" style={{ background: '#fff', border: '1.5px solid #EDE9FE', borderRadius: 18, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#F8F7FF' }}>
                            {['Phụ huynh', 'Liên hệ', 'Độ tuổi', 'Ghi chú', 'Thời gian', 'Trạng thái'].map(h => (
                                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#7C6D9B', borderBottom: '1.5px solid #DDD6FE' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {items.map(item => {
                            const status = STATUS[item.status] || STATUS.new
                            return (
                                <tr key={item.id} style={{ borderBottom: '1px solid #F1EEFF' }}>
                                    <td style={{ padding: '14px 16px', fontWeight: 800, color: '#1E1B4B' }}>{item.parentName || '—'}</td>
                                    <td style={{ padding: '14px 16px', color: '#4B4899', fontWeight: 700 }}>{item.phone || '—'}</td>
                                    <td style={{ padding: '14px 16px', color: '#7C6D9B', fontWeight: 700 }}>{item.childAge || '—'}</td>
                                    <td style={{ padding: '14px 16px', color: '#7C6D9B', maxWidth: 260 }}>{item.note || '—'}</td>
                                    <td style={{ padding: '14px 16px', color: '#7C6D9B', fontWeight: 700 }}>{fmtDateTime(item.createdAt)}</td>
                                    <td style={{ padding: '14px 16px' }}>
                                        <select value={item.status || 'new'} onChange={e => setStatus(item, e.target.value)} style={{ padding: '8px 10px', borderRadius: 10, border: '1.5px solid #DDD6FE', background: status.bg, color: status.color, fontWeight: 800 }}>
                                            {Object.entries(STATUS).map(([value, opt]) => <option key={value} value={value}>{opt.label}</option>)}
                                        </select>
                                    </td>
                                </tr>
                            )
                        })}
                        {!items.length && (
                            <tr>
                                <td colSpan={6} style={{ padding: 28, textAlign: 'center', color: '#7C6D9B', fontWeight: 700 }}>Chưa có đăng ký tham quan.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
