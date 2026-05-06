import { useEffect, useState, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar, { TopBar } from './Sidebar'
import { getDB, hydrateFromAPI } from '../../data/store'
import { hasBackendAPI } from '../../data/api'
import { isLegacyBackendAllowed, isSupabaseSession } from '../../data/backendMode'
import { listFacilities } from '../../features/facilities/facilityService'
import { listStudents } from '../../features/students/studentService'
import { listTeachers } from '../../features/teachers/teacherService'
import { listMessages, subscribeMessages } from '../../features/messages/messageService'
import ChangePassword from './ChangePassword'

// Lazy-load each admin module for code splitting
const Dashboard = lazy(() => import('./Dashboard'))
const Students = lazy(() => import('./Students'))
const Teachers = lazy(() => import('./Teachers'))
const Attendance = lazy(() => import('./Attendance'))
const DailyReports = lazy(() => import('./DailyReports'))
const Finance = lazy(() => import('./Finance'))
const TuitionAttendance = lazy(() => import('./TuitionAttendance'))
const FeeNotices = lazy(() => import('./FeeNotices'))
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
const TourRequests = lazy(() => import('./TourRequests'))

const PAGE_MAP = {
    dashboard: {
        title: 'Tổng quan',
        subtitle: 'Maika Nursery School',
        component: (nav, scope) => <Dashboard onNav={nav} {...scope} />,
    },
    students: { title: 'Quản lý học sinh', subtitle: null, component: (_nav, scope) => <Students {...scope} /> },
    teachers: { title: 'Quản lý giáo viên', subtitle: null, component: (_nav, scope) => <Teachers {...scope} /> },
    attendance: {
        title: 'Điểm danh',
        subtitle: 'Theo dõi chuyên cần',
        component: (_nav, scope) => <Attendance {...scope} />,
    },
    reports: {
        title: 'Nhật ký ngày',
        subtitle: 'Bữa ăn · Giấc ngủ · Tâm trạng',
        component: (_nav, scope) => <DailyReports {...scope} />,
    },
    finance: { title: 'Học phí & Biên lai', subtitle: null, component: (_nav, scope) => <Finance {...scope} /> },
    tuitionAttendance: {
        title: 'Bảng học phí từ điểm danh',
        subtitle: 'Bảng điểm danh tháng · Tự tính khoản phải thu',
        component: (_nav, scope) => <TuitionAttendance {...scope} />,
    },
    feeNotices: {
        title: 'Phiếu báo thu',
        subtitle: 'Quản lý phiếu thông báo thu · In phiếu gửi phụ huynh',
        component: (_nav, scope) => <FeeNotices {...scope} />,
    },
    messages: {
        title: 'Tin nhắn',
        subtitle: 'Giao tiếp với phụ huynh',
        component: (_nav, scope) => <Messages {...scope} />,
    },
    calendar: { title: 'Lịch sự kiện', subtitle: 'Lịch học và hoạt động', component: () => <CalendarView /> },
    analytics: { title: 'Báo cáo & Phân tích', subtitle: 'Thống kê tổng hợp', component: () => <Analytics /> },
    resources: { title: 'Thư viện tài nguyên', subtitle: 'Giáo cụ và học liệu', component: () => <Resources /> },
    gamification: {
        title: 'Thành tích & Khen thưởng',
        subtitle: 'Tạo động lực cho bé',
        component: () => <Gamification />,
    },
    users: { title: 'Quản lý tài khoản', subtitle: null, component: (_nav, scope) => <Users {...scope} /> },
    audit: { title: 'Nhật ký kiểm toán', subtitle: null, component: () => <AuditLog /> },
    backups: { title: 'Sao lưu & dung lượng', subtitle: null, component: () => <Backups /> },
    health: {
        title: 'Hồ sơ sức khỏe',
        subtitle: 'Dị ứng · Thuốc · Liên hệ khẩn cấp',
        component: (_nav, scope) => <HealthRecords {...scope} />,
    },
    incidents: {
        title: 'Báo cáo sự cố',
        subtitle: 'Ghi nhận và theo dõi sự cố học sinh',
        component: (_nav, scope) => <Incidents {...scope} />,
    },
    invoices: {
        title: 'Hóa đơn & Biên lai',
        subtitle: 'Quản lý học phí nâng cao',
        component: (_nav, scope) => <Invoices {...scope} />,
    },
    settings: { title: 'Cấu hình trường học', subtitle: null, component: () => <Settings /> },
    notifications: {
        title: 'Thông báo',
        subtitle: 'Tạo và quản lý thông báo gửi cho phụ huynh',
        component: () => <Notifications />,
    },
    tourRequests: {
        title: 'Đăng ký tham quan',
        subtitle: 'Yêu cầu tuyển sinh từ landing page',
        component: () => <TourRequests />,
    },
    attendanceAdv: {
        title: 'Điểm danh nâng cao',
        subtitle: 'Check-in · Check-out · Người đón · Mobile mode',
        component: (_nav, scope) => <AttendanceAdvanced {...scope} />,
    },
    mealMenu: {
        title: 'Thực đơn',
        subtitle: 'Kế hoạch bữa ăn tuần · Xuất bản cho phụ huynh',
        component: () => <MealMenu />,
    },
    media: {
        title: 'Thư viện ảnh',
        subtitle: 'Upload · Duyệt · Đăng ảnh hoạt động',
        component: (_nav, scope) => <MediaLibrary {...scope} />,
    },
}

function LoadingSpinner() {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 300,
                color: '#7C6D9B',
                fontSize: 14,
                fontWeight: 600,
            }}
        >
            <span style={{ marginRight: 10 }}>⟳</span> Đang tải...
        </div>
    )
}

export default function AdminApp() {
    const navigate = useNavigate()
    const [page, setPage] = useState(() => localStorage.getItem('maika_page') || 'dashboard')
    const [loadingData, setLoadingData] = useState(isLegacyBackendAllowed() && hasBackendAPI())
    const [mustChangePassword, setMustChangePassword] = useState(
        () => sessionStorage.getItem('maika_must_change_password') === 'true',
    )
    const [showChangePassword, setShowChangePassword] = useState(false)
    const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 900 : false))
    const [sidebarOpen, setSidebarOpen] = useState(() =>
        typeof window !== 'undefined' ? window.innerWidth > 900 : true,
    )
    const [facilities, setFacilities] = useState([])
    const [selectedFacilityId, setSelectedFacilityId] = useState(
        () => localStorage.getItem('maika_admin_facility_id') || '',
    )
    const [scopeStats, setScopeStats] = useState({ students: 0, teachers: 0 })
    const [supabaseUnread, setSupabaseUnread] = useState(0)
    const legacyMode = isLegacyBackendAllowed() && !isSupabaseSession()
    const supabaseMode = isSupabaseSession()
    const db = legacyMode ? getDB() : { messages: [], students: [], teachers: [] }
    const unread = supabaseMode ? supabaseUnread : db.messages.filter(m => !m.read && m.fromRole === 'parent').length

    function handleNav(p) {
        setPage(p)
        localStorage.setItem('maika_page', p)
        if (isMobile) setSidebarOpen(false)
    }

    useEffect(() => {
        if (!legacyMode || !hasBackendAPI() || !sessionStorage.getItem('maika_role')) return
        let mounted = true
        hydrateFromAPI()
            .catch(() => {})
            .finally(() => {
                if (mounted) setLoadingData(false)
            })
        return () => {
            mounted = false
        }
    }, [legacyMode])

    useEffect(() => {
        if (!supabaseMode) return
        let mounted = true
        listFacilities()
            .then(items => {
                if (!mounted) return
                setFacilities(items)
                const exists = items.some(item => item.id === selectedFacilityId)
                const next = exists ? selectedFacilityId : items[0]?.id || ''
                if (next && next !== selectedFacilityId) {
                    setSelectedFacilityId(next)
                    localStorage.setItem('maika_admin_facility_id', next)
                }
            })
            .catch(() => {
                if (mounted) setFacilities([])
            })
        return () => {
            mounted = false
        }
    }, [supabaseMode, selectedFacilityId])

    useEffect(() => {
        if (!supabaseMode || !selectedFacilityId) return
        let mounted = true
        Promise.all([
            listStudents({ facilityId: selectedFacilityId, status: 'active' }),
            listTeachers({ facilityId: selectedFacilityId, status: 'active' }),
        ])
            .then(([students, teachers]) => {
                if (mounted) setScopeStats({ students: students.length, teachers: teachers.length })
            })
            .catch(() => {
                if (mounted) setScopeStats({ students: 0, teachers: 0 })
            })
        return () => {
            mounted = false
        }
    }, [supabaseMode, selectedFacilityId])

    useEffect(() => {
        if (!supabaseMode) return
        let mounted = true
        listMessages({ facilityId: selectedFacilityId })
            .then(msgs => {
                if (mounted) setSupabaseUnread(msgs.filter(m => !m.is_read && m.from_role === 'parent').length)
            })
            .catch(() => {})
        const unsub = subscribeMessages({
            facilityId: selectedFacilityId,
            onChange: ({ eventType, record, oldRecord }) => {
                if (!record || record.parent_message_id) return
                if (eventType === 'INSERT' && record.from_role === 'parent' && !record.is_read) {
                    setSupabaseUnread(prev => prev + 1)
                }
                if (
                    eventType === 'UPDATE' &&
                    record.from_role === 'parent' &&
                    oldRecord?.is_read === false &&
                    record.is_read
                ) {
                    setSupabaseUnread(prev => Math.max(0, prev - 1))
                }
            },
        })
        return () => {
            mounted = false
            unsub()
        }
    }, [supabaseMode, selectedFacilityId])

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
    const db2 = legacyMode ? getDB() : { students: [], teachers: [] }
    const activeStudents = supabaseMode ? scopeStats.students : db2.students.filter(s => s.status === 'active').length
    const activeTeachers = supabaseMode ? scopeStats.teachers : db2.teachers.filter(t => t.status === 'active').length
    const subtitle =
        current.subtitle ??
        (page === 'students'
            ? `${activeStudents} học sinh đang học`
            : page === 'teachers'
              ? `${activeTeachers} giáo viên`
              : '')
    const selectedFacility = facilities.find(f => f.id === selectedFacilityId) || null
    const scope = { selectedFacilityId, selectedFacility, facilities, scopeStats }

    function handleFacilityChange(id) {
        setSelectedFacilityId(id)
        localStorage.setItem('maika_admin_facility_id', id)
    }

    function handlePasswordChanged() {
        sessionStorage.removeItem('maika_must_change_password')
        setMustChangePassword(false)
        setShowChangePassword(false)
    }

    return (
        <div style={{ display: 'flex', minHeight: '100vh', width: '100vw', overflowX: 'hidden' }}>
            {/* Force change password overlay — blocks app until changed */}
            {mustChangePassword && <ChangePassword forced onSuccess={handlePasswordChanged} />}
            {/* Optional change password modal */}
            {!mustChangePassword && showChangePassword && <ChangePassword onSuccess={handlePasswordChanged} />}

            {isMobile && sidebarOpen && (
                <button
                    onClick={() => setSidebarOpen(false)}
                    aria-label="Đóng menu"
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 1100,
                        border: 'none',
                        background: 'rgba(15,13,46,0.46)',
                    }}
                />
            )}
            <Sidebar
                active={page}
                onNav={handleNav}
                unreadCount={unread}
                isMobile={isMobile}
                isOpen={!isMobile || sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />
            <div
                style={{
                    marginLeft: isMobile ? 0 : 248,
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: '100vh',
                    minWidth: 0,
                    width: isMobile ? '100%' : 'auto',
                }}
            >
                <TopBar
                    title={current.title}
                    subtitle={subtitle}
                    onChangePassword={() => setShowChangePassword(true)}
                    isMobile={isMobile}
                    onMenuClick={() => setSidebarOpen(true)}
                    facilities={supabaseMode ? facilities : []}
                    selectedFacilityId={selectedFacilityId}
                    onFacilityChange={handleFacilityChange}
                />
                <main
                    className="admin-main-content"
                    style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', background: '#F5F3FF' }}
                >
                    <Suspense fallback={<LoadingSpinner />}>{current.component(handleNav, scope)}</Suspense>
                </main>
            </div>
        </div>
    )
}
