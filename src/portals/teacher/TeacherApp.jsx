import { lazy, Suspense, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getOfflineQueueCount, isOnline, syncOfflineQueue } from '../../features/offline/offlineSyncService'

const AttendanceAdvanced = lazy(() => import('../../pages/admin/AttendanceAdvanced'))
const DailyReports = lazy(() => import('../../pages/admin/DailyReports'))
const MediaLibrary = lazy(() => import('../../pages/admin/MediaLibrary'))

const TABS = [
    { id: 'attendance', label: 'Điểm danh', icon: '✓', component: <AttendanceAdvanced /> },
    { id: 'reports', label: 'Nhật ký', icon: '☰', component: <DailyReports /> },
    { id: 'media', label: 'Ảnh', icon: '▧', component: <MediaLibrary /> },
]

function Loading() {
    return <div style={{ padding: 32, textAlign: 'center', color: '#7C6D9B', fontWeight: 800 }}>Đang tải...</div>
}

export default function TeacherApp() {
    const [tab, setTab] = useState('attendance')
    const [online, setOnline] = useState(isOnline())
    const [pending, setPending] = useState(getOfflineQueueCount())
    const navigate = useNavigate()
    const current = TABS.find(item => item.id === tab) || TABS[0]

    function logout() {
        sessionStorage.removeItem('maika_role')
        sessionStorage.removeItem('maika_api_token')
        sessionStorage.removeItem('maika_must_change_password')
        sessionStorage.removeItem('maika_data_backend')
        navigate('/teacher')
    }

    useEffect(() => {
        function refreshStatus() {
            setOnline(isOnline())
            setPending(getOfflineQueueCount())
        }
        function handleOnline() {
            refreshStatus()
            syncOfflineQueue().finally(refreshStatus)
        }
        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', refreshStatus)
        window.addEventListener('maika-offline-queue-changed', refreshStatus)
        handleOnline()
        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', refreshStatus)
            window.removeEventListener('maika-offline-queue-changed', refreshStatus)
        }
    }, [])

    return (
        <div style={{ minHeight: '100vh', background: '#F5F3FF' }}>
            <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'linear-gradient(135deg,#1E1B4B,#4C1D95)', color: '#fff', padding: '14px 16px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                        <div style={{ fontWeight: 900, fontSize: 18 }}>Cổng giáo viên</div>
                        <div style={{ color: '#C4B5FD', fontSize: 12, fontWeight: 700 }}>Công cụ hằng ngày cho giáo viên</div>
                        <div style={{ color: '#DDD6FE', fontSize: 11, fontWeight: 800, marginTop: 2 }}>
                            {online ? 'Online' : 'Offline'}{pending > 0 ? ` · ${pending} mục chờ đồng bộ` : ' · Đã đồng bộ'}
                        </div>
                    </div>
                    <button onClick={logout} style={{ border: '1px solid rgba(255,255,255,0.28)', background: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: 10, padding: '8px 10px', fontWeight: 800, fontSize: 12 }}>
                        Đăng xuất
                    </button>
                </div>
                <nav style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 14 }}>
                    {TABS.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setTab(item.id)}
                            style={{
                                border: 'none',
                                borderRadius: 12,
                                padding: '10px 8px',
                                background: tab === item.id ? '#fff' : 'rgba(255,255,255,0.1)',
                                color: tab === item.id ? '#4C1D95' : '#fff',
                                fontWeight: 900,
                                fontSize: 13,
                            }}
                        >
                            <span style={{ display: 'block', fontSize: 18, marginBottom: 2 }}>{item.icon}</span>
                            {item.label}
                        </button>
                    ))}
                </nav>
            </header>
            <main style={{ padding: '16px', maxWidth: 960, margin: '0 auto' }}>
                <div style={{ marginBottom: 12 }}>
                    <div style={{ color: '#1E1B4B', fontSize: 20, fontWeight: 900 }}>{current.label}</div>
                </div>
                <Suspense fallback={<Loading />}>
                    {current.component}
                </Suspense>
            </main>
        </div>
    )
}
