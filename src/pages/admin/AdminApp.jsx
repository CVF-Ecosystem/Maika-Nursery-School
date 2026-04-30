import { useState, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar, { TopBar } from './Sidebar'
import { getDB } from '../../data/store'

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
    const db = getDB()
    const unread = db.messages.filter(m => !m.read && m.fromRole === 'parent').length

    function handleNav(p) {
        setPage(p)
        localStorage.setItem('maika_page', p)
    }

    // Guard: must be logged in
    if (!sessionStorage.getItem('maika_role')) {
        navigate('/admin')
        return null
    }

    const current = PAGE_MAP[page] || PAGE_MAP.dashboard
    const db2 = getDB()
    const activeStudents = db2.students.filter(s => s.status === 'active').length
    const activeTeachers = db2.teachers.filter(t => t.status === 'active').length
    const subtitle = current.subtitle ??
        (page === 'students' ? `${activeStudents} học sinh đang học` :
            page === 'teachers' ? `${activeTeachers} giáo viên` : '')

    return (
        <div style={{ display: 'flex', minHeight: '100vh', width: '100vw' }}>
            <Sidebar active={page} onNav={handleNav} unreadCount={unread} />
            <div style={{ marginLeft: 248, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', minWidth: 0 }}>
                <TopBar title={current.title} subtitle={subtitle} />
                <main style={{ flex: 1, overflowY: 'auto', background: '#F5F3FF' }}>
                    <Suspense fallback={<LoadingSpinner />}>
                        {current.component(handleNav)}
                    </Suspense>
                </main>
                <button onClick={() => navigate('/')} style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999, padding: '10px 20px', borderRadius: 50, background: 'linear-gradient(135deg,#1E1B4B,#2D2870)', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', boxShadow: '0 4px 16px rgba(30,27,75,0.4)' }}>
                    🌸 Trang chủ
                </button>
            </div>
        </div>
    )
}
