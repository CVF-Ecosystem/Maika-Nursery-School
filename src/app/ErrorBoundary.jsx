import { Component } from 'react'

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props)
        this.state = { error: null }
    }

    static getDerivedStateFromError(error) {
        return { error }
    }

    componentDidCatch(error, info) {
        const payload = {
            message: error?.message || 'Unknown error',
            stack: error?.stack || '',
            componentStack: info?.componentStack || '',
            url: window.location.href,
            at: new Date().toISOString(),
        }

        if (import.meta.env.PROD) {
            console.error('[Maika UI error]', payload.message)
        } else {
            console.error('[Maika UI error]', payload)
        }
    }

    render() {
        if (!this.state.error) return this.props.children

        return (
            <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F5F3FF', padding: 24 }}>
                <section style={{ width: 'min(520px, 100%)', background: '#fff', borderRadius: 16, padding: 28, boxShadow: '0 18px 48px rgba(109,40,217,0.16)', textAlign: 'center' }}>
                    <div style={{ width: 58, height: 58, margin: '0 auto 16px', borderRadius: 18, display: 'grid', placeItems: 'center', background: '#FEF2F2', color: '#DC2626', fontSize: 28, fontWeight: 900 }}>!</div>
                    <h1 style={{ margin: '0 0 10px', color: '#1E1B4B', fontSize: 22 }}>Ứng dụng gặp lỗi</h1>
                    <p style={{ margin: '0 0 22px', color: '#5B5490', lineHeight: 1.6, fontWeight: 700 }}>
                        Vui lòng tải lại trang. Nếu lỗi vẫn tiếp diễn, hãy liên hệ quản trị viên Maika.
                    </p>
                    <button onClick={() => window.location.reload()} style={{ border: 'none', borderRadius: 12, padding: '11px 18px', background: '#6D28D9', color: '#fff', fontWeight: 900, cursor: 'pointer' }}>
                        Tải lại
                    </button>
                </section>
            </main>
        )
    }
}
