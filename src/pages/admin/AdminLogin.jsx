import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { hasBackendAPI, loginWithBackend } from '../../data/api'
import { clearApiSnapshot } from '../../data/store'
import { getCurrentProfile, portalPathForRole, signInWithPassword } from '../../features/auth/authService'
import { isSupabaseBackend, setActiveDataBackend } from '../../data/backendMode'
import { isSupabaseConfigured } from '../../lib/supabaseClient'

const DEMO_PASS = ['123456', 'maika']
const DEMO_MODE = import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === 'true'

export default function AdminLogin({ defaultRole = 'admin', lockedRole = false, title = 'Chào mừng trở lại', subtitle = 'Đăng nhập để quản lý trường', backTo = '/' }) {
    const [role, setRole] = useState(defaultRole)
    const [email, setEmail] = useState('')
    const [pass, setPass] = useState('')
    const [err, setErr] = useState('')
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()

    async function handleLogin(e) {
        e.preventDefault()
        setLoading(true)
        setErr('')
        if (isSupabaseBackend() && isSupabaseConfigured && email.trim()) {
            try {
                await signInWithPassword({ email: email.trim(), password: pass })
                const profile = await getCurrentProfile()
                if (!profile?.is_active) throw new Error('Tài khoản chưa được kích hoạt.')
                if (lockedRole && profile.role !== defaultRole) throw new Error('Tài khoản không đúng cổng đăng nhập.')
                sessionStorage.setItem('maika_role', profile.role)
                setActiveDataBackend('supabase')
                sessionStorage.removeItem('maika_api_token')
                clearApiSnapshot()
                navigate(portalPathForRole(profile.role))
            } catch (error) {
                setErr(error.message)
                setLoading(false)
            }
            return
        }

        if (hasBackendAPI()) {
            try {
                const session = await loginWithBackend({ role, password: pass })
                sessionStorage.setItem('maika_role', session.user.role)
                setActiveDataBackend('api')
                sessionStorage.setItem('maika_api_token', session.token)
                if (session.mustChangePassword) {
                    sessionStorage.setItem('maika_must_change_password', 'true')
                } else {
                    sessionStorage.removeItem('maika_must_change_password')
                }
                clearApiSnapshot()
                navigate(portalPathForRole(session.user.role))
            } catch (error) {
                setErr(error.message)
                setLoading(false)
            }
            return
        }

        setTimeout(() => {
            if (DEMO_PASS.includes(pass)) {
                sessionStorage.setItem('maika_role', role)
                setActiveDataBackend('local')
                navigate(portalPathForRole(role))
            } else {
                setErr(DEMO_MODE ? 'Mật khẩu không đúng. Thử: 123456' : 'Mật khẩu không đúng.')
                setLoading(false)
            }
        }, 500)
    }

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#1E1B4B 0%,#2D2870 50%,#4C1D95 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'rgba(167,139,250,0.08)', top: -100, right: -100, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'rgba(124,58,237,0.1)', bottom: -80, left: -80, pointerEvents: 'none' }} />
            <div style={{ textAlign: 'center', maxWidth: 420, width: '100%', padding: '0 24px', position: 'relative', zIndex: 1 }}>
                <div style={{ marginBottom: 32 }}>
                    <div style={{ width: 76, height: 76, borderRadius: 22, background: 'linear-gradient(135deg,#6D28D9,#A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42, margin: '0 auto 16px', boxShadow: '0 8px 32px rgba(109,40,217,0.5)' }}>🌸</div>
                    <div style={{ fontWeight: 900, fontSize: 34, color: '#fff', letterSpacing: -1 }}>Maika</div>
                    <div style={{ fontSize: 14, color: '#A78BFA', fontWeight: 600, marginTop: 4 }}>Hệ thống quản lý nhà trẻ</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.97)', borderRadius: 24, padding: '36px 32px', boxShadow: '0 24px 60px rgba(0,0,0,0.3)' }}>
                    <div style={{ fontWeight: 800, fontSize: 20, color: '#1E1B4B', marginBottom: 8 }}>{title}</div>
                    <div style={{ fontSize: 13, color: '#7C6D9B', marginBottom: 28 }}>{subtitle}</div>
                    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {isSupabaseBackend() && isSupabaseConfigured && (
                            <div style={{ textAlign: 'left' }}>
                                <label htmlFor="admin-email" style={{ fontSize: 12, fontWeight: 700, color: '#5B5490', display: 'block', marginBottom: 6 }}>Email Supabase</label>
                                <input id="admin-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={defaultRole === 'teacher' ? 'teacher.cs1@maika.test' : 'admin@maika.test'} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1.5px solid #DDD6FE', fontSize: 14, color: '#1E1B4B', background: '#F8F7FF' }} />
                            </div>
                        )}
                        {!lockedRole && (
                            <div style={{ textAlign: 'left' }}>
                                <label htmlFor="admin-role" style={{ fontSize: 12, fontWeight: 700, color: '#5B5490', display: 'block', marginBottom: 6 }}>Vai trò</label>
                                <select id="admin-role" value={role} onChange={e => setRole(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1.5px solid #DDD6FE', fontSize: 14, color: '#1E1B4B', background: '#F8F7FF' }}>
                                    <option value="admin">👑 Hiệu trưởng / Admin</option>
                                    <option value="teacher">👩‍🏫 Giáo viên</option>
                                </select>
                            </div>
                        )}
                        <div style={{ textAlign: 'left' }}>
                            <label htmlFor="admin-password" style={{ fontSize: 12, fontWeight: 700, color: '#5B5490', display: 'block', marginBottom: 6 }}>Mật khẩu</label>
                            <input id="admin-password" type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="Nhập mật khẩu..." autoFocus style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1.5px solid #DDD6FE', fontSize: 14, color: '#1E1B4B', background: '#F8F7FF' }} />
                        </div>
                        {err && <div style={{ fontSize: 12, color: '#DC2626', fontWeight: 600, background: '#FEF2F2', borderRadius: 10, padding: '10px 14px' }}>{err}</div>}
                        <button type="submit" disabled={loading} style={{ padding: '14px', borderRadius: 14, border: 'none', background: loading ? '#DDD6FE' : 'linear-gradient(135deg,#6D28D9,#8B5CF6)', color: loading ? '#7C6D9B' : '#fff', fontWeight: 800, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 6px 20px rgba(109,40,217,0.4)', marginTop: 4 }}>
                            {loading ? 'Đang đăng nhập...' : 'Đăng nhập →'}
                        </button>
                    </form>
                    {DEMO_MODE && <div style={{ marginTop: 16, fontSize: 12, color: '#9B93C9', background: '#F5F3FF', borderRadius: 8, padding: '8px 12px' }}>
                        Demo: mật khẩu <strong style={{ color: '#6D28D9' }}>123456</strong>
                    </div>}
                    <button onClick={() => navigate(backTo)} style={{ marginTop: 12, background: 'none', border: 'none', color: '#7C6D9B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>← Về trang chủ</button>
                </div>
            </div>
        </div>
    )
}
