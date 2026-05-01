import { useEffect, useState } from 'react'
import { apiRequest, hasBackendAPI } from '../../data/api'

function fmtSize(bytes = 0) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fmtDate(value) {
    return value ? new Date(value).toLocaleString('vi-VN') : '—'
}

function SchedulerStatus({ scheduler }) {
    if (!scheduler) return null
    const { enabled, cron, retentionCount, retentionDays, lastRun, lastResult } = scheduler
    return (
        <div style={{ background: enabled ? '#F0FDF4' : '#F8F7FF', borderRadius: 14, padding: '16px 20px', marginBottom: 20, border: `1.5px solid ${enabled ? '#BBF7D0' : '#DDD6FE'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: 999, background: enabled ? '#16A34A' : '#6B6494' }} aria-hidden="true" />
                <span style={{ fontWeight: 800, fontSize: 14, color: enabled ? '#16A34A' : '#6B6494' }}>
                    Lịch backup tự động: {enabled ? 'ĐÃ BẬT' : 'Chưa bật'}
                </span>
            </div>
            {enabled && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 10 }}>
                    <div style={{ background: '#fff', borderRadius: 10, padding: '10px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#7C6D9B', marginBottom: 2 }}>LỊCH CRON</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1E1B4B', fontFamily: 'monospace' }}>{cron}</div>
                    </div>
                    <div style={{ background: '#fff', borderRadius: 10, padding: '10px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#7C6D9B', marginBottom: 2 }}>GIỮ TỐI ĐA</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1E1B4B' }}>{retentionCount} bản · {retentionDays} ngày</div>
                    </div>
                    <div style={{ background: '#fff', borderRadius: 10, padding: '10px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#7C6D9B', marginBottom: 2 }}>LẦN CHẠY CUỐI</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: lastResult?.success === false ? '#DC2626' : '#1E1B4B' }}>
                            {lastRun ? fmtDate(lastRun) : 'Chưa chạy'}
                            {lastResult?.success === false && <span style={{ color: '#DC2626', fontSize: 11, display: 'block' }}>Lỗi: {lastResult.error}</span>}
                            {lastResult?.success && <span style={{ color: '#16A34A', fontSize: 11, display: 'block' }}>✓ {lastResult.backup}{lastResult.deletedOld > 0 ? `, xóa ${lastResult.deletedOld} cũ` : ''}</span>}
                        </div>
                    </div>
                </div>
            )}
            {!enabled && (
                <div style={{ fontSize: 13, color: '#7C6D9B', marginTop: 4 }}>
                    Đặt <code style={{ background: '#EDE9FE', padding: '1px 6px', borderRadius: 4 }}>MAIKA_BACKUP_SCHEDULE_ENABLED=true</code> và
                    <code style={{ background: '#EDE9FE', padding: '1px 6px', borderRadius: 4, marginLeft: 4 }}>MAIKA_BACKUP_CRON=0 2 * * *</code> để bật.
                </div>
            )}
        </div>
    )
}

export default function Backups() {
    const [backups, setBackups] = useState([])
    const [scheduler, setScheduler] = useState(null)
    const [loading, setLoading] = useState(hasBackendAPI())
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')

    async function loadBackups() {
        if (!hasBackendAPI()) return
        setLoading(true)
        setError('')
        try {
            const body = await apiRequest('/api/backups')
            setBackups(body.data || [])
            setScheduler(body.scheduler || null)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadBackups() }, [])

    async function createNewBackup() {
        setMessage('')
        setError('')
        try {
            const body = await apiRequest('/api/backups', {
                method: 'POST',
                body: JSON.stringify({ reason: 'manual-ui' }),
            })
            setMessage(`Đã tạo backup ${body.data.name}`)
            await loadBackups()
        } catch (err) {
            setError(err.message)
        }
    }

    async function restore(name) {
        if (!confirm(`Khôi phục backup ${name}? Dữ liệu hiện tại sẽ được thay bằng snapshot này.`)) return
        setMessage('')
        setError('')
        try {
            await apiRequest(`/api/backups/${encodeURIComponent(name)}/restore`, { method: 'POST' })
            setMessage(`Đã khôi phục backup ${name}`)
        } catch (err) {
            setError(err.message)
        }
    }

    const apiBase = import.meta.env.VITE_API_URL?.replace(/\/$/, '')

    async function downloadBackup(name) {
        setError('')
        try {
            const response = await fetch(`${apiBase}/api/backups/${encodeURIComponent(name)}/download`, {
                headers: { Authorization: `Bearer ${sessionStorage.getItem('maika_api_token') || ''}` },
            })
            if (!response.ok) throw new Error('Không tải được backup.')
            const blob = await response.blob()
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = name
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)
        } catch (err) {
            setError(err.message)
        }
    }

    if (!hasBackendAPI()) {
        return (
            <div style={{ padding: '28px 36px' }}>
                <div style={{ background: '#fff', borderRadius: 16, padding: 28, boxShadow: '0 2px 16px rgba(109,40,217,0.08)' }}>
                    <div style={{ fontWeight: 800, fontSize: 18, color: '#1E1B4B', marginBottom: 8 }}>Sao lưu & khôi phục</div>
                    <div style={{ color: '#7C6D9B', fontSize: 14, lineHeight: 1.7 }}>Chức năng sao lưu dữ liệu đang được chuẩn bị cho môi trường vận hành chính thức.</div>
                </div>
            </div>
        )
    }

    return (
        <div style={{ padding: '28px 36px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <div style={{ fontWeight: 800, fontSize: 18, color: '#1E1B4B' }}>Sao lưu & khôi phục</div>
                    <div style={{ fontSize: 13, color: '#7C6D9B', marginTop: 2 }}>{backups.length} bản sao lưu</div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={loadBackups} style={{ padding: '9px 18px', borderRadius: 10, border: '1.5px solid #DDD6FE', background: '#fff', color: '#7C3AED', fontWeight: 800, fontSize: 13, cursor: 'pointer' }} aria-label="Làm mới danh sách backup">Làm mới</button>
                    <button onClick={createNewBackup} style={{ padding: '10px 22px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 14px rgba(109,40,217,0.35)' }} aria-label="Tạo backup mới">+ Tạo backup</button>
                </div>
            </div>

            <SchedulerStatus scheduler={scheduler} />

            {message && <div style={{ color: '#059669', background: '#ECFDF5', borderRadius: 10, padding: '10px 14px', fontSize: 12, fontWeight: 700, marginBottom: 16 }} role="alert">{message}</div>}
            {error && <div style={{ color: '#DC2626', background: '#FEF2F2', borderRadius: 10, padding: '10px 14px', fontSize: 12, fontWeight: 700, marginBottom: 16 }} role="alert">{error}</div>}

            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(109,40,217,0.08)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }} role="table" aria-label="Danh sách backup">
                    <thead>
                        <tr style={{ background: '#F8F7FF' }}>
                            {['Tên file', 'Thời gian', 'Dung lượng', 'Collections', ''].map(h => (
                                <th key={h} scope="col" style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#7C6D9B', borderBottom: '1.5px solid #DDD6FE' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {backups.map(backup => (
                            <tr key={backup.name} style={{ borderBottom: '1px solid #EDE9FE' }}>
                                <td style={{ padding: '12px 16px' }}>
                                    <div style={{ fontWeight: 800, fontSize: 13, color: '#1E1B4B' }}>{backup.name}</div>
                                    <div style={{ fontSize: 11, color: '#9B93C9' }}>{backup.reason || 'manual'}{backup.actor?.name ? ` · ${backup.actor.name}` : ''}</div>
                                </td>
                                <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B6494' }}>{fmtDate(backup.createdAt || backup.modifiedAt)}</td>
                                <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B6494' }}>{fmtSize(backup.size)}</td>
                                <td style={{ padding: '12px 16px', fontSize: 12, color: '#1E1B4B', maxWidth: 280 }}>
                                    {backup.collections ? Object.entries(backup.collections).map(([k, v]) => `${k}: ${v}`).join(' · ') : '—'}
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button onClick={() => downloadBackup(backup.name)} style={{ padding: '5px 12px', borderRadius: 8, border: '1.5px solid #7C3AED', background: '#fff', color: '#7C3AED', fontWeight: 700, fontSize: 12, cursor: 'pointer' }} aria-label={`Tải backup ${backup.name}`}>Tải</button>
                                        <button onClick={() => restore(backup.name)} style={{ padding: '5px 12px', borderRadius: 8, border: '1.5px solid #DC2626', background: '#fff', color: '#DC2626', fontWeight: 700, fontSize: 12, cursor: 'pointer' }} aria-label={`Khôi phục backup ${backup.name}`}>Khôi phục</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {loading && <div style={{ textAlign: 'center', padding: 36, color: '#7C6D9B', fontSize: 14 }}>Đang tải backup...</div>}
                {!loading && backups.length === 0 && <div style={{ textAlign: 'center', padding: 36, color: '#7C6D9B', fontSize: 14 }}>Chưa có backup nào</div>}
            </div>
        </div>
    )
}
