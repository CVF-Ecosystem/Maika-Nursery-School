import { Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/landing/Landing'
import ParentLogin from './pages/parent/ParentLogin'
import ParentPortal from './pages/parent/ParentPortal'
import AdminLogin from './pages/admin/AdminLogin'
import AdminApp from './pages/admin/AdminApp'
import RoleGate from './app/RoleGate'
import NoAccess from './pages/NoAccess'
import Privacy from './pages/Privacy'
import TeacherLogin from './portals/teacher/TeacherLogin'
import TeacherApp from './portals/teacher/TeacherApp'

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route
                path="/login"
                element={
                    <AdminLogin
                        defaultRole="admin"
                        title="Đăng nhập nhân sự Maika"
                        subtitle="Dành cho ban giám hiệu và giáo viên. Phụ huynh dùng Cổng phụ huynh."
                    />
                }
            />
            <Route path="/parent" element={<ParentLogin />} />
            <Route
                path="/parent/app"
                element={
                    <RoleGate allowedRoles={['parent']} loginPath="/parent">
                        <ParentPortal />
                    </RoleGate>
                }
            />
            <Route path="/parent/portal" element={<Navigate to="/parent/app" replace />} />
            <Route path="/teacher" element={<TeacherLogin />} />
            <Route
                path="/teacher/app"
                element={
                    <RoleGate allowedRoles={['teacher']} loginPath="/teacher">
                        <TeacherApp />
                    </RoleGate>
                }
            />
            <Route path="/admin" element={<AdminLogin defaultRole="admin" lockedRole />} />
            <Route
                path="/admin/app"
                element={
                    <RoleGate allowedRoles={['admin']} loginPath="/admin">
                        <AdminApp />
                    </RoleGate>
                }
            />
            <Route path="/no-access" element={<NoAccess />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}
