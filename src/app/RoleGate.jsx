import { Navigate } from 'react-router-dom'
import { portalPathForRole } from '../features/auth/authService'

export default function RoleGate({ allowedRoles, loginPath, children }) {
    const role = sessionStorage.getItem('maika_role')
    if (!role) return <Navigate to={loginPath} replace />
    if (allowedRoles?.length && !allowedRoles.includes(role)) {
        return <Navigate to={portalPathForRole(role)} replace />
    }
    return children
}
