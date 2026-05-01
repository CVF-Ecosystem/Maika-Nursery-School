import { useEffect, useState, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar, { TopBar } from './Sidebar'
import { getDB, hydrateFromAPI } from '../../data/store'
import { hasBackendAPI } from '../../data/api'
import { isSupabaseSession } from '../../data/backendMode'
import ChangePassword from './ChangePassword'

// Lazy-load each admin module for code splitting
const Dashboard = lazy(() => import('./Dashboard'))
const Students = lazy(() => import('./Students'))
const Teachers = lazy(() => import('./Teachers'))
const Attendance = lazy(() => import('./Attendance'))
const DailyReports = lazy(() => import('./DailyReports'))
const Finance = lazy(() => import('./Finance'))
const Messages = lazy(() => import('./Messages'))
const CalendarView = lazy(() => import('./CalendarView'))
const Analytics = lazy(() => import('./Analytics'))
const Resources = lazy(() => import('./Resources'))
const Gamification = lazy(() => import('./Gamification'))
const Users = lazy(() => import('./Users'))
const AuditLog = lazy(() => import('./AuditLog'))
const Backups = lazy(() => import('./Backups'))
const HealthRecords = lazy(() => import('./HealthRecords'))
const Incidents = lazy(() => import('./Incidents'))
const Invoices = lazy(() => import('./Invoices'))
const Settings = lazy(() => import('./Settings'))
const Notifications = lazy(() => import('./Notifications'))
const AttendanceAdvanced = lazy(() => import('./AttendanceAdvanced'))
const MealMenu = lazy(() => import('./MealMenu'))
const MediaLibrary = lazy(() => import('./MediaLibrary'))

const PAGE_MAP = {
    dashboard: { title: 'Tổng quan', subtitle: 'Maika Nursery School', component: (nav) => <Dashboard onNav={nav} /> },
    students: { title: 'Quản lý học sinh', subtitle: null, component: () => <Students /> },
    teachers: { title: 'Quản lý giáo viên', subtitle: null, component: () => <Teachers /> },
    attendance: { title: 'Điểm danh', subtitle: 'Theo dõi chuyên cần', component: () => <Attendance /> },
    reports: { title: 'Nhật ký ngày', subtitle: 'Bữa ăn · Giấc ngủ · Tâm trạng', component: () => <DailyReports /> },
    finance: { title: 'Quản lý học phí', subtitle: 'Thu chi và tài chính', component: () => <Finance /> },
    messages: { title: 'Tin nhắn', subtitle: 'Giao tiếp với phụ huynh', component: () => <Messages /> },
    calendar: { title: 'Lịch sự kiện', subtitle: 'Lịch học và hoạt động', component: () => <CalendarView /> },
    analytics: { title: 'Báo cáo & Phân tích', subtitle: 'Thống kê tổng hợp', component: () => <Analytics /> },
    resources: { title: 'Thư viện tài nguyên', subtitle: 'Giáo cụ và học liệu', component: () => <Resources /> },
    gamification: { title: 'Thành tích & Khen thưởng', subtitle: 'Tạo động lực cho bé', component: () => <Gamification /> },
    users: { title: 'Quản lý tài khoản', subtitle: 'Phân quyền và trạng thái truy cập', component: () => <Users /> },
    audit: { title: 'Nhật ký kiểm toán', subtitle: 'Theo dõi thay đổi và truy cập hệ thống', component: () => <AuditLog /> },
    backups: { title: 'Sao lưu & khôi phục', subtitle: 'Backup dữ liệu vận hành', component: () => <Backups /> },
    health: { title: 'Hồ sơ sức khỏe', subtitle: 'Dị ứng · Thuốc · Liên hệ khẩn cấp', component: () => <HealthRecords /> },
    incidents: { title: 'Báo cáo sự cố', subtitle: 'Ghi nhận và theo dõi sự cố học sinh', component: () => <Incidents /> },
    invoices: { title: 'Hóa đơn & Biên lai', subtitle: 'Quản lý học phí nâng cao', component: () => <Invoices /> },
    settings: { title: 'Cấu hình trường học', subtitle: 'Thông tin trường · Năm học · Mức phí · Quyền riêng tư', component: () => <Settings /> },
    notifications: { title: 'Thông báo', subtitle: 'Tạo và quản lý thông báo gửi cho phụ huynh', component: () => <Notifications /> },
    attendanceAdv: { title: 'Điểm danh nâng cao', subtitle: 'Check-in · Check-out · Người đón · Mobile mode', component: () => <AttendanceAdvanced /> },
    mealMenu: { title: 'Thực đơn', subtitle: 'Kế hoạch bữa ăn tuần · Xuất bản cho phụ huynh', component: () => <MealMenu /> },
    media: { title: 'Thư viện ảnh', subtitle: 'Upload · Duyệt · Đăng ảnh hoạt động', component: () => <MediaLibrary /> },
}

function LoadingSpinner() {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: '#7C6D9B', fontSize: 14, fontWeight: 600 }}>
            <span style={{ marginRight: 10 }}>⟳</span> Đang tải...
        </div>
    )
}

export default function AdminApp() {
    const navigate = useNavigate()
    const [page, setPage] = useState(() => localStorage.getItem('maika_page') || 'dashboard')
    const [loadingData, setLoadingData] = useState(hasBackendAPI())
    const [mustChangePassword, setMustChangePassword] = useState(
        () => sessionStorage.getItem('maika_must_change_password') === 'true'
    )
    const [showChangePassword, setShowChangePassword] = useState(false)
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 900 : false)
    const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== 'undefined' ? window.innerWidth > 900 : true)
    const db = getDB()
    const unread = db.messages.filter(m => !m.read && m.fromRole === 'parent').length

    function handleNav(p) {
        setPage(p)
        localStorage.setItem('maika_page', p)
        if (isMobile) setSidebarOpen(false)
    }

    useEffect(() => {
        if (!hasBackendAPI() || !sessionStorage.getItem('maika_role')) return
        let mounted = true
        hydrateFromAPI()
            .catch(() => { })
            .finally(() => { if (mounted) setLoadingData(false) })
        return () => { mounted = false }
    }, [])

    useEffect(() => {
        function syncLayout() {
            const nextMobile = window.innerWidth <= 900
            setIsMobile(nextMobile)
            setSidebarOpen(!nextMobile)
        }
        syncLayout()
        window.addEventListener('resize', syncLayout)
        return () => window.removeEventListener('resize', syncLayout)
    }, [])

    // Guard: must be logged in
    if (!sessionStorage.getItem('maika_role')) {
        navigate('/admin')
        return null
    }

    if (loadingData) return <LoadingSpinner />

    const current = PAGE_MAP[page] || PAGE_MAP.dashboard
    const db2 = getDB()
    const activeStudents = db2.students.filter(s => s.status === 'active').length
    const activeTeachers = db2.teachers.filter(t => t.status === 'active').length
    const subtitle = current.subtitle ??
        (page === 'students' ? (isSupabaseSession() ? 'Danh sách học sinh theo cơ sở' : `${activeStudents} học sinh đang học`) :
            page === 'teachers' ? `${activeTeachers} giáo viên` : '')

    function handlePasswordChanged() {
        sessionStorage.removeItem('maika_must_change_password')
        setMustChangePassword(false)
        setShowChangePassword(false)
    }

    return (
        <div style={{ display: 'flex', minHeight: '100vh', width: '100vw', overflowX: 'hidden' }}>
            {/* Force change password overlay — blocks app until changed */}
            {mustChangePassword && (
                <ChangePassword forced onSuccess={handlePasswordChanged} />
            )}
            {/* Optional change password modal */}
            {!mustChangePassword && showChangePassword && (
                <ChangePassword onSuccess={handlePasswordChanged} />
            )}

            {isMobile && sidebarOpen && (
                <button
                    onClick={() => setSidebarOpen(false)}
                    aria-label="Đóng menu"
                    style={{ position: 'fixed', inset: 0, zIndex: 1100, border: 'none', background: 'rgba(15,13,46,0.46)' }}
                />
            )}
            <Sidebar active={page} onNav={handleNav} unreadCount={unread} isMobile={isMobile} isOpen={!isMobile || sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <div style={{ marginLeft: isMobile ? 0 : 248, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', minWidth: 0, width: isMobile ? '100%' : 'auto' }}>
                <TopBar
                    title={current.title}
                    subtitle={subtitle}
                    onChangePassword={() => setShowChangePassword(true)}
                    isMobile={isMobile}
                    onMenuClick={() => setSidebarOpen(true)}
                />
                <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', background: '#F5F3FF' }}>
                    <Suspense fallback={<LoadingSpinner />}>
                        {current.component(handleNav)}
                    </Suspense>
                </main>
                <button onClick={() => navigate('/')} style={{ position: 'fixed', bottom: isMobile ? 12 : 20, right: isMobile ? 12 : 20, zIndex: 999, padding: isMobile ? '10px 12px' : '10px 20px', borderRadius: 50, background: 'linear-gradient(135deg,#1E1B4B,#2D2870)', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', boxShadow: '0 4px 16px rgba(30,27,75,0.4)' }}>
                    {isMobile ? '🌸' : '🌸 Trang chủ'}
                </button>
            </div>
        </div>
    )
}
