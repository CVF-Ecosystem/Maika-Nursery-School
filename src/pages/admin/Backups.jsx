import { useEffect, useState } from 'react'
import { apiRequest, hasBackendAPI } from '../../data/api'
import { isSupabaseSession } from '../../data/backendMode'
import { createArchivedMediaDownload, deleteArchivedMedia, getMediaStorageSummary } from '../../features/media/storageMaintenanceService'

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
                    Lịch sao lưu tự động chưa bật. Vui lòng kiểm tra cấu hình vận hành trước khi dùng chính thức.
                </div>
            )}
        </div>
    )
}

export default function Backups() {
    if (isSupabaseSession()) return <SupabaseStorageMaintenance />

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
            <div className="admin-page-pad" style={{ padding: '28px 36px' }}>
                <div style={{ background: '#fff', borderRadius: 16, padding: 28, boxShadow: '0 2px 16px rgba(109,40,217,0.08)' }}>
                    <div style={{ color: '#7C6D9B', fontSize: 14, lineHeight: 1.7 }}>Chức năng sao lưu dữ liệu đang được chuẩn bị cho môi trường vận hành chính thức.</div>
                </div>
            </div>
        )
    }

    return (
        <div className="admin-page-pad" style={{ padding: '28px 36px' }}>
            <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12 }}>
                <div style={{ fontSize: 13, color: '#7C6D9B', fontWeight: 700 }}>{backups.length} bản sao lưu</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button onClick={loadBackups} style={{ padding: '9px 18px', borderRadius: 10, border: '1.5px solid #DDD6FE', background: '#fff', color: '#7C3AED', fontWeight: 800, fontSize: 13, cursor: 'pointer' }} aria-label="Làm mới danh sách backup">Làm mới</button>
                    <button onClick={createNewBackup} style={{ padding: '10px 22px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 14px rgba(109,40,217,0.35)' }} aria-label="Tạo backup mới">+ Tạo backup</button>
                </div>
            </div>

            <SchedulerStatus scheduler={scheduler} />

            {message && <div style={{ color: '#059669', background: '#ECFDF5', borderRadius: 10, padding: '10px 14px', fontSize: 12, fontWeight: 700, marginBottom: 16 }} role="alert">{message}</div>}
            {error && <div style={{ color: '#DC2626', background: '#FEF2F2', borderRadius: 10, padding: '10px 14px', fontSize: 12, fontWeight: 700, marginBottom: 16 }} role="alert">{error}</div>}

            <div className="mobile-scroll-table" style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(109,40,217,0.08)', overflow: 'hidden' }}>
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

function SupabaseStorageMaintenance() {
    const [summary, setSummary] = useState(null)
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')

    async function loadSummary() {
        setLoading(true)
        setError('')
        try {
            setSummary(await getMediaStorageSummary())
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadSummary() }, [])

    async function downloadArchived() {
        setBusy(true)
        setMessage('')
        setError('')
        try {
            const result = await createArchivedMediaDownload()
            if (!result.files?.length) {
                setMessage('Không có ảnh lưu trữ để tải.')
                return
            }
            for (const file of result.files) {
                const response = await fetch(file.signedUrl)
                if (!response.ok) throw new Error(`Không tải được ${file.name}.`)
                const blob = await response.blob()
                const url = URL.createObjectURL(blob)
                const link = document.createElement('a')
                link.href = url
                link.download = file.name || 'maika-media'
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                URL.revokeObjectURL(url)
            }
            setMessage(`Đã tải ${result.files.length} ảnh lưu trữ xuống máy.`)
        } catch (err) {
            setError(err.message)
        } finally {
            setBusy(false)
        }
    }

    async function removeArchived() {
        if (!confirm('Xóa toàn bộ ảnh đang ở trạng thái lưu trữ khỏi hệ thống? Hãy tải ảnh xuống máy trước khi xóa.')) return
        setBusy(true)
        setMessage('')
        setError('')
        try {
            const result = await deleteArchivedMedia()
            setMessage(`Đã xóa ${result.deletedCount || 0} ảnh lưu trữ khỏi hệ thống.`)
            await loadSummary()
        } catch (err) {
            setError(err.message)
        } finally {
            setBusy(false)
        }
    }

    const ratio = summary?.usageRatio || 0
    const percent = Math.min(100, Math.round(ratio * 100))
    const barColor = summary?.isWarning ? '#DC2626' : percent >= 70 ? '#F59E0B' : '#16A34A'

    return (
        <div className="admin-page-pad" style={{ padding: '28px 36px' }}>
            <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <button onClick={loadSummary} disabled={loading || busy} style={{ padding: '9px 18px', borderRadius: 10, border: '1.5px solid #DDD6FE', background: '#fff', color: '#7C3AED', fontWeight: 800, fontSize: 13, cursor: loading || busy ? 'wait' : 'pointer' }}>Làm mới</button>
            </div>

            {message && <div style={{ color: '#059669', background: '#ECFDF5', borderRadius: 10, padding: '10px 14px', fontSize: 12, fontWeight: 700, marginBottom: 16 }} role="alert">{message}</div>}
            {error && <div style={{ color: '#DC2626', background: '#FEF2F2', borderRadius: 10, padding: '10px 14px', fontSize: 12, fontWeight: 700, marginBottom: 16 }} role="alert">{error}</div>}

            <section style={{ background: '#fff', borderRadius: 16, padding: 22, boxShadow: '0 2px 16px rgba(109,40,217,0.08)', marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12, marginBottom: 18 }}>
                    <Metric label="Đã dùng" value={loading ? 'Đang tải...' : fmtSize(summary?.totalBytes || 0)} />
                    <Metric label="Số file ảnh" value={loading ? '—' : `${summary?.objectCount || 0}`} />
                    <Metric label="Ảnh lưu trữ" value={loading ? '—' : `${summary?.archivedCount || 0} file`} />
                    <Metric label="Có thể dọn" value={loading ? '—' : fmtSize(summary?.archivedBytes || 0)} />
                </div>

                <div style={{ height: 12, background: '#F3F4F6', borderRadius: 999, overflow: 'hidden', marginBottom: 10 }}>
                    <div style={{ width: `${percent}%`, height: '100%', background: barColor, transition: 'width 240ms ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', fontSize: 12, color: '#7C6D9B', fontWeight: 700 }}>
                    <span>{percent}% so với ngưỡng cảnh báo {fmtSize(summary?.warningBytes || 0)}</span>
                    <span>{summary?.updatedAt ? `Cập nhật ${fmtDate(summary.updatedAt)}` : ''}</span>
                </div>
                {summary?.isWarning && (
                    <div style={{ marginTop: 14, background: '#FEF2F2', color: '#DC2626', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontWeight: 800 }}>
                        Dung lượng ảnh đã vượt ngưỡng cảnh báo. Hãy tải ảnh lưu trữ xuống máy rồi xóa khỏi hệ thống nếu không còn cần hiển thị trên cổng phụ huynh.
                    </div>
                )}
            </section>

            <section style={{ background: '#fff', borderRadius: 16, padding: 22, boxShadow: '0 2px 16px rgba(109,40,217,0.08)' }}>
                <div style={{ fontWeight: 800, color: '#1E1B4B', marginBottom: 8 }}>Dọn ảnh lưu trữ</div>
                <div style={{ color: '#7C6D9B', fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>
                    Ảnh cần xóa nên được chuyển sang trạng thái lưu trữ trong Thư viện ảnh. Tải về máy trước, sau đó mới xóa khỏi hệ thống.
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button onClick={downloadArchived} disabled={busy || loading || !summary?.archivedCount} style={{ padding: '10px 18px', borderRadius: 10, border: '1.5px solid #7C3AED', background: '#fff', color: '#7C3AED', fontWeight: 800, cursor: busy ? 'wait' : 'pointer' }}>Tải ảnh lưu trữ</button>
                    <button onClick={removeArchived} disabled={busy || loading || !summary?.archivedCount} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: '#DC2626', color: '#fff', fontWeight: 900, cursor: busy ? 'wait' : 'pointer' }}>Xóa khỏi hệ thống</button>
                </div>
            </section>
        </div>
    )
}

function Metric({ label, value }) {
    return (
        <div style={{ background: '#F8F7FF', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: '#7C6D9B', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#1E1B4B' }}>{value}</div>
        </div>
    )
}
