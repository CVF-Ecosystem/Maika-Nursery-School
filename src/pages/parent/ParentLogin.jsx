import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { hasBackendAPI, loginWithBackend } from '../../data/api'
import { isLegacyBackendAllowed, isSupabaseBackend, setActiveDataBackend } from '../../data/backendMode'
import { clearApiSnapshot } from '../../data/store'
import { getCurrentProfile, signInWithPassword } from '../../features/auth/authService'
import { isSupabaseConfigured } from '../../lib/supabaseClient'

const DEMO_MODE = import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === 'true'

export default function ParentLogin() {
    const [phone, setPhone] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [err, setErr] = useState('')
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()
    const useSupabaseLogin = isSupabaseBackend() && isSupabaseConfigured
    const legacyLoginAllowed = isLegacyBackendAllowed()

    async function handleLogin(e) {
        e.preventDefault()
        setErr('')
        setLoading(true)

        if (useSupabaseLogin) {
            try {
                await signInWithPassword({ email: email.trim(), password })
                const profile = await getCurrentProfile()
                if (!profile?.is_active) throw new Error('Tài khoản chưa được kích hoạt.')
                if (profile.role !== 'parent') throw new Error('Tài khoản này không thuộc cổng phụ huynh.')
                sessionStorage.setItem('maika_role', 'parent')
                setActiveDataBackend('supabase')
                sessionStorage.removeItem('maika_api_token')
                clearApiSnapshot()
                navigate('/parent/app')
            } catch (error) {
                setErr(error.message || 'Không đăng nhập được.')
                setLoading(false)
            }
            return
        }

        const normalizedPhone = phone.replace(/\s/g, '')
        if (legacyLoginAllowed && hasBackendAPI()) {
            try {
                const session = await loginWithBackend({ role: 'parent', phone: normalizedPhone })
                sessionStorage.setItem('maika_parent_phone', normalizedPhone)
                sessionStorage.setItem('maika_role', session.user.role)
                setActiveDataBackend('api')
                sessionStorage.setItem('maika_api_token', session.token)
                clearApiSnapshot()
                navigate('/parent/app')
            } catch (error) {
                setErr(error.message)
                setLoading(false)
            }
            return
        }

        if (!legacyLoginAllowed || !DEMO_MODE) {
            setErr('Vui lòng đăng nhập bằng tài khoản email tại /login.')
            setLoading(false)
            return
        }

        // Demo: accept any registered parent phone or 0901234567
        const validPhones = ['0901234567', '0912345678', '0923456789', '0934567890', '0945678901', '0956789012', '0967890123', '0978901234', '0989012345', '0990123456', '0901234560', '0912345670', '0923456780', '0934567800', '0000']
        if (validPhones.includes(normalizedPhone)) {
            sessionStorage.setItem('maika_parent_phone', normalizedPhone)
            sessionStorage.setItem('maika_role', 'parent')
            setActiveDataBackend('local')
            navigate('/parent/app')
        } else {
            setErr(DEMO_MODE ? 'Không tìm thấy tài khoản. Demo: 0901234567' : 'Không tìm thấy tài khoản.')
            setLoading(false)
        }
    }

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#1E1B4B,#2D2870,#4C1D95)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', borderRadius: 24, padding: '40px 36px', width: 'min(400px, calc(100vw - 24px))', boxShadow: '0 24px 60px rgba(0,0,0,0.35)' }}>
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <div style={{ width: 62, height: 62, borderRadius: 18, background: 'linear-gradient(135deg,#6D28D9,#A78BFA)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, boxShadow: '0 6px 20px rgba(109,40,217,0.4)', marginBottom: 12 }}>🌸</div>
                    <div style={{ fontWeight: 900, fontSize: 20, color: '#1E1B4B' }}>Cổng Phụ Huynh</div>
                    <div style={{ fontSize: 13, color: '#7C6D9B', marginTop: 4 }}>Maika Nursery School</div>
                </div>
                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {useSupabaseLogin ? (
                        <>
                            <div>
                                <label htmlFor="parent-email" style={{ fontSize: 12, fontWeight: 700, color: '#5B5490', display: 'block', marginBottom: 5 }}>Email</label>
                                <input id="parent-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email phụ huynh" autoFocus style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1.5px solid #DDD6FE', fontSize: 14, color: '#1E1B4B', background: '#F8F7FF' }} />
                            </div>
                            <div>
                                <label htmlFor="parent-password" style={{ fontSize: 12, fontWeight: 700, color: '#5B5490', display: 'block', marginBottom: 5 }}>Mật khẩu</label>
                                <input id="parent-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Nhập mật khẩu" style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1.5px solid #DDD6FE', fontSize: 14, color: '#1E1B4B', background: '#F8F7FF' }} />
                            </div>
                        </>
                    ) : (
                        <div>
                            <label htmlFor="parent-phone" style={{ fontSize: 12, fontWeight: 700, color: '#5B5490', display: 'block', marginBottom: 5 }}>Số điện thoại</label>
                            <input id="parent-phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder={DEMO_MODE ? '0901234567' : 'Nhập số điện thoại'} autoFocus style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1.5px solid #DDD6FE', fontSize: 14, color: '#1E1B4B', background: '#F8F7FF' }} />
                        </div>
                    )}
                    {err && <div style={{ fontSize: 12, color: '#DC2626', background: '#FEF2F2', borderRadius: 8, padding: '8px 12px', fontWeight: 600 }}>{err}</div>}
                    <button type="submit" disabled={loading} style={{ padding: '13px', borderRadius: 12, border: 'none', background: loading ? '#DDD6FE' : 'linear-gradient(135deg,#6D28D9,#8B5CF6)', color: loading ? '#7C6D9B' : '#fff', fontWeight: 800, fontSize: 15, boxShadow: loading ? 'none' : '0 6px 20px rgba(109,40,217,0.4)', cursor: loading ? 'not-allowed' : 'pointer' }}>{loading ? 'Đang đăng nhập...' : 'Đăng nhập →'}</button>
                    {legacyLoginAllowed && !useSupabaseLogin && DEMO_MODE && <div style={{ fontSize: 12, color: '#9B93C9', textAlign: 'center', background: '#F5F3FF', borderRadius: 8, padding: '7px' }}>Demo: <strong style={{ color: '#6D28D9' }}>0901234567</strong></div>}
                    <button type="button" onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#7C6D9B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>← Về trang chủ</button>
                </form>
            </div>
        </div>
    )
}
