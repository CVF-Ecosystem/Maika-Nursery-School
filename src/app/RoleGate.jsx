import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { isSupabaseBackend } from '../data/backendMode'
import { getCurrentProfile, portalPathForRole } from '../features/auth/authService'

const DEMO_MODE = import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === 'true'

export default function RoleGate({ allowedRoles, loginPath, children }) {
    const activeBackend = typeof sessionStorage === 'undefined'
        ? ''
        : sessionStorage.getItem('maika_data_backend')
    const legacyDemoSession = DEMO_MODE && (activeBackend === 'local' || activeBackend === 'api')
    const supabaseMode = isSupabaseBackend() && !legacyDemoSession
    const [profile, setProfile] = useState(undefined)

    useEffect(() => {
        let mounted = true
        if (!supabaseMode) {
            setProfile(null)
            return () => { mounted = false }
        }

        setProfile(undefined)
        getCurrentProfile()
            .then(data => { if (mounted) setProfile(data) })
            .catch(() => { if (mounted) setProfile(null) })

        return () => { mounted = false }
    }, [supabaseMode])

    if (supabaseMode) {
        if (profile === undefined) return <div style={{ padding: 24, fontWeight: 800, color: '#5B5490' }}>Đang kiểm tra quyền truy cập...</div>
        if (!profile) return <Navigate to={loginPath} replace />
        if (!profile.is_active) return <Navigate to="/no-access?reason=locked" replace />
        if (profile.role === 'teacher' && !profile.facility_id) return <Navigate to="/no-access?reason=no-facility" replace />
        if (allowedRoles?.length && !allowedRoles.includes(profile.role)) {
            return <Navigate to={portalPathForRole(profile.role)} replace />
        }
        return children
    }

    const role = sessionStorage.getItem('maika_role')
    if (!role) return <Navigate to={loginPath} replace />
    if (allowedRoles?.length && !allowedRoles.includes(role)) {
        return <Navigate to={portalPathForRole(role)} replace />
    }
    return children
}
