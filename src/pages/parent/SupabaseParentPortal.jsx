import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from '../../features/auth/authService'
import { listMyLinkedStudents } from '../../features/parents/parentService'
import { getPushPermission, isPushSubscribed, isPushSupported, subscribeToPush, unsubscribeFromPush } from '../../features/push/pushService'

const AttendanceAdvanced = lazy(() => import('../admin/AttendanceAdvanced'))
const MediaLibrary = lazy(() => import('../admin/MediaLibrary'))
const MealMenu = lazy(() => import('../admin/MealMenu'))
const NotificationCenter = lazy(() => import('./NotificationCenter'))
const HealthRecords = lazy(() => import('../admin/HealthRecords'))
const Incidents = lazy(() => import('../admin/Incidents'))
const Invoices = lazy(() => import('../admin/Invoices'))
const ConsentPanel = lazy(() => import('./ConsentPanel'))

const TABS = [
    ['overview', 'Tổng quan'],
    ['attendance', 'Điểm danh'],
    ['notifications', 'Thông báo'],
    ['mealMenu', 'Thực đơn'],
    ['gallery', 'Hình ảnh'],
    ['health', 'Sức khỏe'],
    ['incidents', 'Sự cố'],
    ['invoices', 'Học phí'],
    ['privacy', 'Quyền riêng tư'],
]

function Loading() {
    return <div style={{ padding: 40, textAlign: 'center', color: '#7C6D9B', fontWeight: 800 }}>Đang tải...</div>
}

function PushBanner({ students }) {
    const [show, setShow] = useState(false)
    const [subscribed, setSubscribed] = useState(false)
    const [loading, setLoading] = useState(false)
    const [msg, setMsg] = useState('')
    const dismissed = useRef(false)

    useEffect(() => {
        if (!isPushSupported()) return
        const count = Number(localStorage.getItem('maika-visit-count') || 0) + 1
        localStorage.setItem('maika-visit-count', String(count))
        getPushPermission().then(perm => {
            if (perm === 'granted') {
                isPushSubscribed().then(s => setSubscribed(s))
            } else if (perm === 'default' && count >= 2 && !localStorage.getItem('maika-push-dismissed')) {
                setShow(true)
            }
        })
    }, [])

    async function enable() {
        setLoading(true)
        try {
            const studentIds = students.map(s => s.id)
            const facilityId = students[0]?.facilityId || null
            await subscribeToPush({ facilityId, studentIds })
            setSubscribed(true)
            setShow(false)
            setMsg('Đã bật thông báo!')
            setTimeout(() => setMsg(''), 3000)
        } catch (e) {
            setMsg(e.message || 'Không bật được thông báo.')
        } finally {
            setLoading(false)
        }
    }

    async function disable() {
        setLoading(true)
        try {
            await unsubscribeFromPush()
            setSubscribed(false)
            setMsg('Đã tắt thông báo.')
            setTimeout(() => setMsg(''), 3000)
        } catch { /* ignore */ } finally {
            setLoading(false)
        }
    }

    function dismiss() {
        localStorage.setItem('maika-push-dismissed', '1')
        setShow(false)
        dismissed.current = true
    }

    if (!isPushSupported()) return null

    return (
        <>
            {msg && <div style={{ background: '#ECFDF5', color: '#059669', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{msg}</div>}
            {subscribed && (
                <div style={{ background: '#F5F3FF', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 700, color: '#7C3AED', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    🔔 Thông báo push đã bật
                    <button onClick={disable} disabled={loading} style={{ fontSize: 11, fontWeight: 700, color: '#9B93C9', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>Tắt</button>
                </div>
            )}
            {show && !subscribed && (
                <div style={{ background: 'linear-gradient(135deg,#7C3AED,#4C1D95)', borderRadius: 14, padding: '16px 18px', color: '#fff', marginBottom: 16 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>🔔 Nhận thông báo tức thì</div>
                    <div style={{ fontSize: 13, color: '#DDD6FE', marginBottom: 14 }}>Biết ngay khi bé vắng mặt, có sự cố, hoặc hóa đơn mới — không cần mở app.</div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={enable} disabled={loading} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: '#fff', color: '#4C1D95', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                            {loading ? 'Đang bật...' : 'Bật thông báo'}
                        </button>
                        <button onClick={dismiss} style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#DDD6FE', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Để sau</button>
                    </div>
                </div>
            )}
        </>
    )
}

function PWAInstallBanner() {
    const [prompt, setPrompt] = useState(null)
    const [show, setShow] = useState(false)

    useEffect(() => {
        const count = Number(localStorage.getItem('maika-visit-count') || 0)
        if (count < 2 || localStorage.getItem('maika-pwa-dismissed')) return
        const handler = e => { e.preventDefault(); setPrompt(e); setShow(true) }
        window.addEventListener('beforeinstallprompt', handler)
        return () => window.removeEventListener('beforeinstallprompt', handler)
    }, [])

    if (!show || !prompt) return null

    async function install() {
        prompt.prompt()
        const { outcome } = await prompt.userChoice
        if (outcome === 'accepted') localStorage.setItem('maika-pwa-dismissed', '1')
        setShow(false)
    }

    return (
        <div style={{ background: '#fff', border: '1.5px solid #DDD6FE', borderRadius: 14, padding: '14px 16px', marginBottom: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ fontSize: 28 }}>📱</div>
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#1E1B4B' }}>Thêm vào màn hình chính</div>
                <div style={{ fontSize: 12, color: '#7C6D9B' }}>Truy cập nhanh như app thật, không cần qua trình duyệt</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={install} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>Cài đặt</button>
                <button onClick={() => { localStorage.setItem('maika-pwa-dismissed', '1'); setShow(false) }} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #DDD6FE', background: '#fff', color: '#9B93C9', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>✕</button>
            </div>
        </div>
    )
}

export default function SupabaseParentPortal() {
    const navigate = useNavigate()
    const [students, setStudents] = useState([])
    const [studentId, setStudentId] = useState('')
    const [tab, setTab] = useState('overview')
    const [err, setErr] = useState('')
    const [loading, setLoading] = useState(true)
    const [online, setOnline] = useState(navigator.onLine)

    useEffect(() => {
        const up = () => setOnline(true)
        const down = () => setOnline(false)
        window.addEventListener('online', up)
        window.addEventListener('offline', down)
        return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
    }, [])

    useEffect(() => {
        listMyLinkedStudents()
            .then(items => {
                setStudents(items)
                setStudentId(items[0]?.id || '')
                localStorage.setItem('maika-parent-students', JSON.stringify(items))
            })
            .catch(error => {
                const cached = localStorage.getItem('maika-parent-students')
                if (cached) {
                    const items = JSON.parse(cached)
                    setStudents(items)
                    setStudentId(items[0]?.id || '')
                } else {
                    setErr(error.message)
                }
            })
            .finally(() => setLoading(false))
    }, [])

    async function logout() {
        await signOut().catch(() => {})
        sessionStorage.clear()
        navigate('/login')
    }

    if (loading) return <Loading />

    const student = students.find(item => item.id === studentId) || students[0]

    return (
        <div style={{ minHeight: '100vh', background: '#F5F3FF' }}>
            {!online && (
                <div style={{ background: '#FFFBEB', borderBottom: '1px solid #FCD34D', padding: '8px 16px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#92400E', zIndex: 100 }}>
                    📡 Đang xem dữ liệu offline — kết nối lại để cập nhật mới nhất
                </div>
            )}
            <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'linear-gradient(135deg,#1E1B4B,#4C1D95)', color: '#fff', padding: '14px clamp(12px, 4vw, 20px)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                        <div style={{ fontWeight: 900, fontSize: 18 }}>Cổng phụ huynh</div>
                        <div style={{ color: '#C4B5FD', fontSize: 12, fontWeight: 700 }}>Thông tin học tập và sinh hoạt của bé</div>
                    </div>
                    <button onClick={logout} style={{ border: '1px solid rgba(255,255,255,0.28)', background: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: 10, padding: '8px 10px', fontWeight: 800, fontSize: 12 }}>
                        Đăng xuất
                    </button>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 2 }}>
                    {students.length > 1 && (
                        <select value={studentId} onChange={e => setStudentId(e.target.value)} style={{ padding: '9px 12px', borderRadius: 10, border: 'none', fontWeight: 800, color: '#1E1B4B', flexShrink: 0 }}>
                            {students.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                    )}
                    {TABS.map(([id, label]) => (
                        <button key={id} onClick={() => setTab(id)} style={{ border: 'none', borderRadius: 10, padding: '9px 12px', background: tab === id ? '#fff' : 'rgba(255,255,255,0.1)', color: tab === id ? '#4C1D95' : '#fff', fontWeight: 900, flexShrink: 0 }}>
                            {label}
                        </button>
                    ))}
                </div>
            </header>
            <main style={{ maxWidth: 980, margin: '0 auto', padding: 'clamp(12px, 4vw, 20px)' }}>
                {err && <div style={{ background: '#FEF2F2', color: '#DC2626', borderRadius: 12, padding: 12, fontWeight: 800 }}>{err}</div>}
                <PWAInstallBanner />
                {students.length > 0 && <PushBanner students={students} />}
                {!student && !err && <div style={{ background: '#fff', borderRadius: 16, padding: 28, color: '#7C6D9B', fontWeight: 800 }}>Tài khoản phụ huynh chưa được liên kết học sinh.</div>}
                {student && tab === 'overview' && (
                    <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 16px rgba(109,40,217,0.08)' }}>
                        <div style={{ fontWeight: 900, fontSize: 22, color: '#1E1B4B' }}>{student.name}</div>
                        <div style={{ color: '#7C6D9B', marginTop: 6 }}>{student.className || 'Chưa có lớp'} · {student.parentName || 'Phụ huynh'}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginTop: 20 }}>
                            {[['Ngày sinh', student.dob || '—'], ['Giới tính', student.gender === 'male' ? 'Nam' : student.gender === 'female' ? 'Nữ' : 'Chưa rõ'], ['Lớp', student.className || '—'], ['Trạng thái', student.status === 'active' ? 'Đang học' : 'Nghỉ học']].map(([label, value]) => (
                                <div key={label} style={{ background: '#F8F7FF', borderRadius: 12, padding: 14 }}>
                                    <div style={{ fontSize: 11, color: '#7C6D9B', fontWeight: 900 }}>{label}</div>
                                    <div style={{ color: '#1E1B4B', fontWeight: 800, marginTop: 4 }}>{value}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {student && tab === 'attendance' && (
                    <Suspense fallback={<Loading />}>
                        <AttendanceAdvanced readOnly filterStudentId={student.id} />
                    </Suspense>
                )}
                {student && tab === 'notifications' && (
                    <Suspense fallback={<Loading />}>
                        <NotificationCenter studentId={student.id} classId={student.className} />
                    </Suspense>
                )}
                {student && tab === 'mealMenu' && (
                    <Suspense fallback={<Loading />}>
                        <MealMenu readOnly />
                    </Suspense>
                )}
                {student && tab === 'gallery' && (
                    <Suspense fallback={<Loading />}>
                        <MediaLibrary readOnly forParent />
                    </Suspense>
                )}
                {student && tab === 'health' && (
                    <Suspense fallback={<Loading />}>
                        <HealthRecords readOnly filterStudentId={student.id} />
                    </Suspense>
                )}
                {student && tab === 'incidents' && (
                    <Suspense fallback={<Loading />}>
                        <Incidents readOnly filterStudentId={student.id} />
                    </Suspense>
                )}
                {student && tab === 'invoices' && (
                    <Suspense fallback={<Loading />}>
                        <Invoices readOnly filterStudentId={student.id} />
                    </Suspense>
                )}
                {student && tab === 'privacy' && (
                    <Suspense fallback={<Loading />}>
                        <ConsentPanel studentId={student.id} studentName={student.name} />
                    </Suspense>
                )}
            </main>
        </div>
    )
}
