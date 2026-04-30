import { useEffect, useMemo, useState } from 'react'
import { apiRequest, hasBackendAPI } from '../../data/api'

const ACTION_LABEL = {
    login_success: 'Đăng nhập',
    login_failed: 'Đăng nhập lỗi',
    user_created: 'Tạo tài khoản',
    user_updated: 'Sửa tài khoản',
    snapshot_replaced: 'Đồng bộ dữ liệu',
    record_created: 'Tạo dữ liệu',
    record_updated: 'Sửa dữ liệu',
    record_deleted: 'Xóa dữ liệu',
    file_uploaded: 'Tải file',
}

const ACTION_COLOR = {
    login_success: ['#16A34A', '#F0FDF4'],
    login_failed: ['#DC2626', '#FEF2F2'],
    user_created: ['#7C3AED', '#F5F3FF'],
    user_updated: ['#7C3AED', '#F5F3FF'],
    snapshot_replaced: ['#0891B2', '#ECFEFF'],
    record_created: ['#059669', '#ECFDF5'],
    record_updated: ['#D97706', '#FFFBEB'],
    record_deleted: ['#DC2626', '#FEF2F2'],
    file_uploaded: ['#2563EB', '#EFF6FF'],
}

function fmtDateTime(value) {
    return new Date(value).toLocaleString('vi-VN')
}

function ActionBadge({ action }) {
    const [color, bg] = ACTION_COLOR[action] || ['#6B6494', '#F5F5F4']
    return <span style={{ color, background: bg, borderRadius: 6, padding: '3px 9px', fontWeight: 800, fontSize: 11 }}>{ACTION_LABEL[action] || action}</span>
}

export default function AuditLog() {
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(hasBackendAPI())
    const [error, setError] = useState('')
    const [filters, setFilters] = useState({ action: 'all', entityType: 'all' })

    async function loadLogs() {
        if (!hasBackendAPI()) return
        setLoading(true)
        setError('')
        const params = new URLSearchParams({ limit: '200' })
        if (filters.action !== 'all') params.set('action', filters.action)
        if (filters.entityType !== 'all') params.set('entityType', filters.entityType)
        try {
            const body = await apiRequest(`/api/audit-logs?${params}`)
            setLogs(body.data || [])
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadLogs() }, [filters.action, filters.entityType])

    const actions = useMemo(() => ['all', ...new Set(logs.map(log => log.action))], [logs])
    const entityTypes = useMemo(() => ['all', ...new Set(logs.map(log => log.entity_type))], [logs])
    const sel = { padding: '9px 14px', borderRadius: 10, border: '1.5px solid #DDD6FE', fontSize: 13, color: '#1E1B4B', background: '#fff' }

    if (!hasBackendAPI()) {
        return (
            <div style={{ padding: '28px 36px' }}>
                <div style={{ background: '#fff', borderRadius: 16, padding: 28, boxShadow: '0 2px 16px rgba(109,40,217,0.08)' }}>
                    <div style={{ fontWeight: 800, fontSize: 18, color: '#1E1B4B', marginBottom: 8 }}>Nhật ký kiểm toán</div>
                    <div style={{ color: '#7C6D9B', fontSize: 14, lineHeight: 1.7 }}>Audit log cần backend. Tạo `.env` từ `.env.example`, bật `VITE_API_URL`, chạy `npm run api:dev`, rồi restart frontend.</div>
                </div>
            </div>
        )
    }

    return (
        <div style={{ padding: '28px 36px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <div style={{ fontWeight: 800, fontSize: 18, color: '#1E1B4B' }}>Nhật ký kiểm toán</div>
                    <div style={{ fontSize: 13, color: '#7C6D9B', marginTop: 2 }}>{logs.length} sự kiện gần nhất</div>
                </div>
                <button onClick={loadLogs} style={{ padding: '9px 18px', borderRadius: 10, border: '1.5px solid #DDD6FE', background: '#fff', color: '#7C3AED', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>Làm mới</button>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <select value={filters.action} onChange={e => setFilters({ ...filters, action: e.target.value })} style={sel}>
                    {actions.map(action => <option key={action} value={action}>{action === 'all' ? 'Tất cả hành động' : ACTION_LABEL[action] || action}</option>)}
                </select>
                <select value={filters.entityType} onChange={e => setFilters({ ...filters, entityType: e.target.value })} style={sel}>
                    {entityTypes.map(entity => <option key={entity} value={entity}>{entity === 'all' ? 'Tất cả đối tượng' : entity}</option>)}
                </select>
            </div>

            {error && <div style={{ color: '#DC2626', background: '#FEF2F2', borderRadius: 10, padding: '10px 14px', fontSize: 12, fontWeight: 700, marginBottom: 16 }}>{error}</div>}

            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(109,40,217,0.08)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#F8F7FF' }}>
                            {['Thời gian', 'Hành động', 'Người dùng', 'Đối tượng', 'Mô tả'].map(h => <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#7C6D9B', borderBottom: '1.5px solid #DDD6FE' }}>{h}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map(log => (
                            <tr key={log.id} style={{ borderBottom: '1px solid #EDE9FE' }}>
                                <td style={{ padding: '12px 16px', fontSize: 12, color: '#6B6494', whiteSpace: 'nowrap' }}>{fmtDateTime(log.created_at)}</td>
                                <td style={{ padding: '12px 16px' }}><ActionBadge action={log.action} /></td>
                                <td style={{ padding: '12px 16px' }}>
                                    <div style={{ fontWeight: 800, fontSize: 13, color: '#1E1B4B' }}>{log.actor_name || 'Hệ thống'}</div>
                                    <div style={{ fontSize: 11, color: '#9B93C9' }}>{log.actor_role || '—'}</div>
                                </td>
                                <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B6494' }}>{log.entity_type}{log.entity_id ? ` · ${log.entity_id}` : ''}</td>
                                <td style={{ padding: '12px 16px', fontSize: 13, color: '#1E1B4B', fontWeight: 700 }}>{log.summary}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {loading && <div style={{ textAlign: 'center', padding: 36, color: '#7C6D9B', fontSize: 14 }}>Đang tải nhật ký...</div>}
                {!loading && logs.length === 0 && <div style={{ textAlign: 'center', padding: 36, color: '#7C6D9B', fontSize: 14 }}>Chưa có nhật ký</div>}
            </div>
        </div>
    )
}
