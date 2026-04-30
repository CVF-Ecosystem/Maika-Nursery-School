import { useState } from 'react'
import { apiRequest } from '../../data/api'

export default function ChangePassword({ onSuccess, forced = false }) {
    const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const is = { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #DDD6FE', fontSize: 14, color: '#1E1B4B', boxSizing: 'border-box' }
    const ls = { fontSize: 12, fontWeight: 700, color: '#6B6494', display: 'block', marginBottom: 6 }

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')
        if (form.newPassword.length < 6) { setError('Mật khẩu mới phải từ 6 ký tự.'); return }
        if (form.newPassword !== form.confirmPassword) { setError('Mật khẩu xác nhận không khớp.'); return }
        if (form.newPassword === form.currentPassword) { setError('Mật khẩu mới phải khác mật khẩu hiện tại.'); return }
        setLoading(true)
        try {
            await apiRequest('/api/auth/change-password', {
                method: 'POST',
                body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
            })
            onSuccess?.()
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div
            style={{ position: 'fixed', inset: 0, background: forced ? 'rgba(30,27,75,0.85)' : 'rgba(0,0,0,0.4)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            role="dialog"
            aria-modal="true"
            aria-label="Đổi mật khẩu"
        >
            <div style={{ background: '#fff', borderRadius: 20, width: 420, padding: 32, boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }}>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg,#7C3AED,#A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 12px' }}>🔐</div>
                    <div style={{ fontWeight: 900, fontSize: 18, color: '#1E1B4B' }}>Đổi mật khẩu</div>
                    {forced && (
                        <div style={{ fontSize: 13, color: '#D97706', fontWeight: 700, marginTop: 6, background: '#FFFBEB', borderRadius: 8, padding: '6px 12px' }}>
                            Tài khoản yêu cầu đổi mật khẩu trước khi tiếp tục
                        </div>
                    )}
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                        <label style={ls} htmlFor="cp-current">Mật khẩu hiện tại *</label>
                        <input
                            id="cp-current"
                            type="password"
                            style={is}
                            value={form.currentPassword}
                            onChange={e => setForm({ ...form, currentPassword: e.target.value })}
                            autoComplete="current-password"
                            required
                            aria-required="true"
                        />
                    </div>
                    <div>
                        <label style={ls} htmlFor="cp-new">Mật khẩu mới * (tối thiểu 6 ký tự)</label>
                        <input
                            id="cp-new"
                            type="password"
                            style={is}
                            value={form.newPassword}
                            onChange={e => setForm({ ...form, newPassword: e.target.value })}
                            autoComplete="new-password"
                            required
                            aria-required="true"
                            minLength={6}
                        />
                        {form.newPassword.length > 0 && form.newPassword.length < 6 && (
                            <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>Cần thêm {6 - form.newPassword.length} ký tự nữa</div>
                        )}
                    </div>
                    <div>
                        <label style={ls} htmlFor="cp-confirm">Xác nhận mật khẩu mới *</label>
                        <input
                            id="cp-confirm"
                            type="password"
                            style={{ ...is, borderColor: form.confirmPassword && form.confirmPassword !== form.newPassword ? '#DC2626' : '#DDD6FE' }}
                            value={form.confirmPassword}
                            onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                            autoComplete="new-password"
                            required
                            aria-required="true"
                        />
                        {form.confirmPassword && form.confirmPassword !== form.newPassword && (
                            <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>Mật khẩu không khớp</div>
                        )}
                    </div>

                    {error && (
                        <div style={{ color: '#DC2626', background: '#FEF2F2', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 700 }} role="alert">{error}</div>
                    )}

                    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                        {!forced && (
                            <button
                                type="button"
                                onClick={() => onSuccess?.()}
                                style={{ flex: 1, padding: '11px', borderRadius: 12, border: '1.5px solid #DDD6FE', background: '#fff', fontSize: 14, fontWeight: 700, color: '#6B6494', cursor: 'pointer' }}
                            >
                                Bỏ qua
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={loading || form.newPassword.length < 6 || form.newPassword !== form.confirmPassword}
                            style={{ flex: 2, padding: '11px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
                        >
                            {loading ? 'Đang lưu...' : 'Đổi mật khẩu'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
