import { Component } from 'react'

async function logClientError(message, stack, componentStack) {
    try {
        const { requireSupabase } = await import('../lib/supabaseClient')
        const client = requireSupabase()
        const { data: userData } = await client.auth.getUser()
        const userId = userData.user?.id || null
        let profile = null
        if (userId) {
            const { data } = await client.from('profiles').select('role, full_name').eq('id', userId).maybeSingle()
            profile = data
        }
        await client.from('audit_logs').insert({
            actor_id: userId,
            actor_role: profile?.role || null,
            actor_name: profile?.full_name || null,
            action: 'client_error',
            entity_type: 'ui',
            metadata: {
                message: message.slice(0, 500),
                stack: (stack || '').slice(0, 2000),
                componentStack: (componentStack || '').slice(0, 2000),
                url: window.location.href,
                userAgent: navigator.userAgent,
            },
        })
    } catch {
        /* fire-and-forget — never throw from error boundary */
    }
}

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props)
        this.state = { error: null }
    }

    static getDerivedStateFromError(error) {
        return { error }
    }

    componentDidCatch(error, info) {
        const message = error?.message || 'Unknown error'
        const stack = error?.stack || ''
        const componentStack = info?.componentStack || ''

        if (import.meta.env.PROD) {
            console.error('[Maika UI error]', message)
            logClientError(message, stack, componentStack)
        } else {
            console.error('[Maika UI error]', { message, stack, componentStack, url: window.location.href })
        }
    }

    render() {
        if (!this.state.error) return this.props.children

        const msg = this.state.error?.message || 'Lỗi không xác định'

        return (
            <main
                style={{
                    minHeight: '100vh',
                    display: 'grid',
                    placeItems: 'center',
                    background: '#F5F3FF',
                    padding: 24,
                }}
            >
                <section
                    style={{
                        width: 'min(520px, 100%)',
                        background: '#fff',
                        borderRadius: 16,
                        padding: 28,
                        boxShadow: '0 18px 48px rgba(109,40,217,0.16)',
                        textAlign: 'center',
                    }}
                >
                    <div
                        style={{
                            width: 58,
                            height: 58,
                            margin: '0 auto 16px',
                            borderRadius: 18,
                            display: 'grid',
                            placeItems: 'center',
                            background: '#FEF2F2',
                            color: '#DC2626',
                            fontSize: 28,
                            fontWeight: 900,
                        }}
                    >
                        !
                    </div>
                    <h1 style={{ margin: '0 0 10px', color: '#1E1B4B', fontSize: 22 }}>Ứng dụng gặp lỗi</h1>
                    <p style={{ margin: '0 0 16px', color: '#5B5490', lineHeight: 1.6, fontWeight: 700 }}>
                        Vui lòng tải lại trang. Nếu lỗi vẫn tiếp diễn, hãy liên hệ quản trị viên.
                    </p>
                    {!import.meta.env.PROD && (
                        <pre
                            style={{
                                margin: '0 0 16px',
                                background: '#FEF2F2',
                                borderRadius: 8,
                                padding: '10px 14px',
                                fontSize: 12,
                                color: '#991B1B',
                                textAlign: 'left',
                                overflowX: 'auto',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                            }}
                        >
                            {msg}
                        </pre>
                    )}
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                border: 'none',
                                borderRadius: 12,
                                padding: '11px 18px',
                                background: '#6D28D9',
                                color: '#fff',
                                fontWeight: 900,
                                cursor: 'pointer',
                            }}
                        >
                            Tải lại
                        </button>
                        <a
                            href="/"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                borderRadius: 12,
                                padding: '11px 18px',
                                background: '#EDE9FE',
                                color: '#6D28D9',
                                fontWeight: 900,
                                textDecoration: 'none',
                            }}
                        >
                            Về trang chủ
                        </a>
                        <a
                            href="mailto:info@maika.edu.vn"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                borderRadius: 12,
                                padding: '11px 18px',
                                background: '#F3F4F6',
                                color: '#374151',
                                fontWeight: 900,
                                textDecoration: 'none',
                            }}
                        >
                            Báo lỗi
                        </a>
                    </div>
                </section>
            </main>
        )
    }
}
