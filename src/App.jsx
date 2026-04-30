import { Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/landing/Landing'
import ParentLogin from './pages/parent/ParentLogin'
import ParentPortal from './pages/parent/ParentPortal'
import AdminLogin from './pages/admin/AdminLogin'
import AdminApp from './pages/admin/AdminApp'

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/parent" element={<ParentLogin />} />
            <Route path="/parent/portal" element={<ParentPortal />} />
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/admin/app" element={<AdminApp />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}
