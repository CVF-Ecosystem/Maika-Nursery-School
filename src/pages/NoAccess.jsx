import { Link, useSearchParams } from 'react-router-dom'

const MESSAGES = {
    locked: 'Tài khoản của bạn đang bị khóa. Vui lòng liên hệ quản trị viên Maika.',
    'no-facility': 'Tài khoản giáo viên chưa được gán cơ sở. Vui lòng nhờ admin cấu hình trước khi sử dụng.',
}

export default function NoAccess() {
    const [params] = useSearchParams()
    const reason = params.get('reason')

    return (
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F5F3FF', padding: 24 }}>
            <section style={{ width: 'min(440px, 100%)', background: '#fff', borderRadius: 18, padding: 28, boxShadow: '0 18px 48px rgba(109,40,217,0.16)', textAlign: 'center' }}>
                <div style={{ width: 58, height: 58, margin: '0 auto 16px', borderRadius: 18, display: 'grid', placeItems: 'center', background: '#FEF2F2', color: '#DC2626', fontSize: 28, fontWeight: 900 }}>!</div>
                <h1 style={{ margin: '0 0 10px', color: '#1E1B4B', fontSize: 22 }}>Không thể truy cập</h1>
                <p style={{ margin: '0 0 22px', color: '#5B5490', lineHeight: 1.6, fontWeight: 700 }}>{MESSAGES[reason] || 'Tài khoản hiện không có quyền vào khu vực này.'}</p>
                <Link to="/login" style={{ display: 'inline-block', padding: '11px 18px', borderRadius: 12, background: '#6D28D9', color: '#fff', textDecoration: 'none', fontWeight: 900 }}>Quay lại đăng nhập</Link>
            </section>
        </main>
    )
}
