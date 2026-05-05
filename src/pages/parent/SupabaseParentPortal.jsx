import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from '../../features/auth/authService'
import {
    listMessages,
    markMessageRead,
    sendMessage,
    sendReply,
    subscribeMessages,
} from '../../features/messages/messageService'
import { listMyLinkedStudents } from '../../features/parents/parentService'
import { listFeeNoticeItems, listFeeNotices } from '../../features/payments/feeNoticeService'
import {
    getPushPermission,
    isPushSubscribed,
    isPushSupported,
    subscribeToPush,
    unsubscribeFromPush,
} from '../../features/push/pushService'
import { sanitizeText } from '../../utils/security'
import { fmtMoney } from '../../utils/format'

const AttendanceAdvanced = lazy(() => import('../admin/AttendanceAdvanced'))
const MediaLibrary = lazy(() => import('../admin/MediaLibrary'))
const MealMenu = lazy(() => import('../admin/MealMenu'))
const NotificationCenter = lazy(() => import('./NotificationCenter'))
const HealthRecords = lazy(() => import('../admin/HealthRecords'))
const Incidents = lazy(() => import('../admin/Incidents'))
const Invoices = lazy(() => import('../admin/Invoices'))
const ConsentPanel = lazy(() => import('./ConsentPanel'))

const TABS = [
    ['overview', 'Tổng quan'],
    ['attendance', 'Điểm danh'],
    ['notifications', 'Thông báo'],
    ['mealMenu', 'Thực đơn'],
    ['gallery', 'Hình ảnh'],
    ['health', 'Sức khỏe'],
    ['incidents', 'Sự cố'],
    ['invoices', 'Học phí'],
    ['messages', 'Tin nhắn'],
    ['privacy', 'Quyền riêng tư'],
]

function Loading() {
    return <div style={{ padding: 40, textAlign: 'center', color: '#7C6D9B', fontWeight: 800 }}>Đang tải...</div>
}

function ParentFeeNotices({ student }) {
    const [notices, setNotices] = useState([])
    const [itemsByNotice, setItemsByNotice] = useState({})
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let mounted = true
        async function load() {
            setLoading(true)
            try {
                const data = await listFeeNotices({ facilityId: student.facilityId })
                const studentNotices = data.filter(notice => notice.student_id === student.id).slice(0, 6)
                const pairs = await Promise.all(
                    studentNotices.map(async notice => [notice.id, await listFeeNoticeItems({ noticeId: notice.id })]),
                )
                if (!mounted) return
                setNotices(studentNotices)
                setItemsByNotice(Object.fromEntries(pairs))
            } finally {
                if (mounted) setLoading(false)
            }
        }
        load()
        return () => {
            mounted = false
        }
    }, [student.facilityId, student.id])

    if (loading) {
        return <div style={{ padding: 18, color: '#7C6D9B', fontWeight: 800 }}>Đang tải phiếu báo thu...</div>
    }
    if (!notices.length) return null

    const statusLabel = {
        draft: 'Chưa gửi',
        sent: 'Đã gửi',
        paid: 'Đã thanh toán',
        cancelled: 'Đã hủy',
        adjusted: 'Điều chỉnh',
    }

    return (
        <div style={{ display: 'grid', gap: 12, marginBottom: 18 }}>
            {notices.map(notice => {
                const items = itemsByNotice[notice.id] || []
                const isPaid = notice.status === 'paid'
                return (
                    <div
                        key={notice.id}
                        style={{
                            background: '#fff',
                            borderRadius: 14,
                            border: '1px solid #EDE9FE',
                            overflow: 'hidden',
                            boxShadow: '0 2px 14px rgba(109,40,217,0.07)',
                        }}
                    >
                        <div
                            style={{
                                padding: '12px 14px',
                                background: '#F8F7FF',
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: 12,
                            }}
                        >
                            <div>
                                <div style={{ fontWeight: 900, color: '#1E1B4B' }}>
                                    Phiếu báo thu {notice.year_month}
                                </div>
                                <div style={{ fontSize: 12, color: '#7C6D9B', marginTop: 2 }}>
                                    {notice.notice_number || ''}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ color: isPaid ? '#059669' : '#DC2626', fontWeight: 900 }}>
                                    {fmtMoney(notice.total_amount)}
                                </div>
                                <div style={{ fontSize: 12, color: '#7C6D9B', fontWeight: 700 }}>
                                    {statusLabel[notice.status] || notice.status}
                                </div>
                            </div>
                        </div>
                        <div style={{ padding: '10px 14px', display: 'grid', gap: 6 }}>
                            {items.map(item => (
                                <div
                                    key={item.id}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        gap: 12,
                                        fontSize: 13,
                                        color: '#1E1B4B',
                                    }}
                                >
                                    <span>
                                        {item.name}
                                        {Number(item.quantity) !== 1 && (
                                            <span style={{ color: '#7C6D9B' }}>
                                                {' '}
                                                x {item.quantity} {item.unit}
                                            </span>
                                        )}
                                    </span>
                                    <span style={{ fontWeight: 800, color: item.amount < 0 ? '#059669' : '#1E1B4B' }}>
                                        {item.amount < 0 ? '-' : ''}
                                        {fmtMoney(Math.abs(item.amount))}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

function PushBanner({ students }) {
    const [show, setShow] = useState(false)
    const [subscribed, setSubscribed] = useState(false)
    const [loading, setLoading] = useState(false)
    const [msg, setMsg] = useState('')
    const dismissed = useRef(false)

    useEffect(() => {
        if (!isPushSupported()) return
        const count = Number(localStorage.getItem('maika-visit-count') || 0) + 1
        localStorage.setItem('maika-visit-count', String(count))
        getPushPermission().then(perm => {
            if (perm === 'granted') {
                isPushSubscribed().then(s => setSubscribed(s))
            } else if (perm === 'default' && count >= 2 && !localStorage.getItem('maika-push-dismissed')) {
                setShow(true)
            }
        })
    }, [])

    async function enable() {
        setLoading(true)
        try {
            const studentIds = students.map(s => s.id)
            const facilityId = students[0]?.facilityId || null
            await subscribeToPush({ facilityId, studentIds })
            setSubscribed(true)
            setShow(false)
            setMsg('Đã bật thông báo!')
            setTimeout(() => setMsg(''), 3000)
        } catch (e) {
            setMsg(e.message || 'Không bật được thông báo.')
        } finally {
            setLoading(false)
        }
    }

    async function disable() {
        setLoading(true)
        try {
            await unsubscribeFromPush()
            setSubscribed(false)
            setMsg('Đã tắt thông báo.')
            setTimeout(() => setMsg(''), 3000)
        } catch {
            /* ignore */
        } finally {
            setLoading(false)
        }
    }

    function dismiss() {
        localStorage.setItem('maika-push-dismissed', '1')
        setShow(false)
        dismissed.current = true
    }

    if (!isPushSupported()) return null

    return (
        <>
            {msg && (
                <div
                    style={{
                        background: '#ECFDF5',
                        color: '#059669',
                        borderRadius: 10,
                        padding: '10px 14px',
                        fontSize: 13,
                        fontWeight: 700,
                        marginBottom: 12,
                    }}
                >
                    {msg}
                </div>
            )}
            {subscribed && (
                <div
                    style={{
                        background: '#F5F3FF',
                        borderRadius: 10,
                        padding: '12px 16px',
                        fontSize: 15,
                        fontWeight: 700,
                        color: '#5B21B6',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 12,
                    }}
                >
                    🔔 Thông báo push đã bật
                    <button
                        onClick={disable}
                        disabled={loading}
                        aria-label="Tắt thông báo push"
                        style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: '#4C4376',
                            background: 'none',
                            border: '1px solid #DDD6FE',
                            borderRadius: 8,
                            cursor: 'pointer',
                            padding: '6px 12px',
                        }}
                    >
                        Tắt
                    </button>
                </div>
            )}
            {show && !subscribed && (
                <div
                    style={{
                        background: 'linear-gradient(135deg,#7C3AED,#4C1D95)',
                        borderRadius: 14,
                        padding: '18px 20px',
                        color: '#fff',
                        marginBottom: 16,
                    }}
                >
                    <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 8 }}>🔔 Nhận thông báo tức thì</div>
                    <div style={{ fontSize: 15, color: '#EDE9FE', marginBottom: 16, lineHeight: 1.6 }}>
                        Biết ngay khi bé vắng mặt, có sự cố, hoặc hóa đơn mới — không cần mở app.
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button
                            onClick={enable}
                            disabled={loading}
                            aria-label="Bật thông báo đẩy"
                            style={{
                                padding: '11px 20px',
                                borderRadius: 10,
                                border: 'none',
                                background: '#fff',
                                color: '#4C1D95',
                                fontWeight: 800,
                                fontSize: 15,
                                cursor: 'pointer',
                            }}
                        >
                            {loading ? 'Đang bật...' : 'Bật thông báo'}
                        </button>
                        <button
                            onClick={dismiss}
                            aria-label="Để sau, đóng banner"
                            style={{
                                padding: '11px 16px',
                                borderRadius: 10,
                                border: '1px solid rgba(255,255,255,0.3)',
                                background: 'transparent',
                                color: '#EDE9FE',
                                fontWeight: 700,
                                fontSize: 15,
                                cursor: 'pointer',
                            }}
                        >
                            Để sau
                        </button>
                    </div>
                </div>
            )}
        </>
    )
}

function PWAInstallBanner() {
    const [prompt, setPrompt] = useState(null)
    const [show, setShow] = useState(false)

    useEffect(() => {
        const count = Number(localStorage.getItem('maika-visit-count') || 0)
        if (count < 2 || localStorage.getItem('maika-pwa-dismissed')) return
        const handler = e => {
            e.preventDefault()
            setPrompt(e)
            setShow(true)
        }
        window.addEventListener('beforeinstallprompt', handler)
        return () => window.removeEventListener('beforeinstallprompt', handler)
    }, [])

    if (!show || !prompt) return null

    async function install() {
        prompt.prompt()
        const { outcome } = await prompt.userChoice
        if (outcome === 'accepted') localStorage.setItem('maika-pwa-dismissed', '1')
        setShow(false)
    }

    return (
        <div
            style={{
                background: '#fff',
                border: '1.5px solid #DDD6FE',
                borderRadius: 14,
                padding: '16px 18px',
                marginBottom: 14,
                display: 'flex',
                gap: 12,
                alignItems: 'center',
            }}
        >
            <div style={{ fontSize: 32 }} aria-hidden="true">
                📱
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#1E1B4B' }}>Thêm vào màn hình chính</div>
                <div style={{ fontSize: 14, color: '#4C4376', marginTop: 2 }}>
                    Truy cập nhanh như app thật, không cần qua trình duyệt
                </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                    onClick={install}
                    aria-label="Cài đặt ứng dụng vào màn hình chính"
                    style={{
                        padding: '10px 16px',
                        borderRadius: 10,
                        border: 'none',
                        background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: 14,
                        cursor: 'pointer',
                    }}
                >
                    Cài đặt
                </button>
                <button
                    onClick={() => {
                        localStorage.setItem('maika-pwa-dismissed', '1')
                        setShow(false)
                    }}
                    aria-label="Đóng gợi ý cài đặt"
                    style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1px solid #DDD6FE',
                        background: '#fff',
                        color: '#4C4376',
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: 'pointer',
                    }}
                >
                    ✕
                </button>
            </div>
        </div>
    )
}

function upsertById(items, item) {
    if (!item?.id) return items
    if (items.some(existing => existing.id === item.id)) {
        return items.map(existing => (existing.id === item.id ? { ...existing, ...item } : existing))
    }
    return [item, ...items]
}

function appendReplyOnce(replies = [], reply) {
    if (!reply?.id) return replies
    if (replies.some(existing => existing.id === reply.id)) {
        return replies.map(existing => (existing.id === reply.id ? { ...existing, ...reply } : existing))
    }
    return [...replies, reply]
}

function ParentMessages({ student }) {
    const [messages, setMessages] = useState([])
    const [selectedId, setSelectedId] = useState('')
    const [body, setBody] = useState('')
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const facilityId = student?.facilityId
    const selected = messages.find(item => item.id === selectedId) || messages[0]

    useEffect(() => {
        let mounted = true
        setLoading(true)
        listMessages({ facilityId })
            .then(items => {
                if (!mounted) return
                setMessages(items)
                setSelectedId(items[0]?.id || '')
            })
            .catch(() => {})
            .finally(() => {
                if (mounted) setLoading(false)
            })
        return () => {
            mounted = false
        }
    }, [facilityId])

    useEffect(() => {
        if (!facilityId) return undefined
        return subscribeMessages({
            facilityId,
            onChange: ({ eventType, record }) => {
                if (!record) return
                setMessages(prev => {
                    if (record.parent_message_id) {
                        return prev.map(item =>
                            item.id === record.parent_message_id
                                ? { ...item, replies: appendReplyOnce(item.replies, record) }
                                : item,
                        )
                    }
                    if (eventType === 'INSERT') return upsertById(prev, { ...record, replies: record.replies || [] })
                    if (eventType === 'UPDATE')
                        return prev.map(item => (item.id === record.id ? { ...item, ...record } : item))
                    if (eventType === 'DELETE') return prev.filter(item => item.id !== record.id)
                    return prev
                })
            },
        })
    }, [facilityId])

    useEffect(() => {
        if (selected?.id && !selected.is_read && selected.from_role !== 'parent' && !selected.is_broadcast) {
            markMessageRead(selected.id).catch(() => {})
        }
    }, [selected?.id, selected?.is_read, selected?.from_role, selected?.is_broadcast])

    async function handleSend() {
        if (!body.trim() || !student || sending) return
        const cleanBody = sanitizeText(body)
        setSending(true)
        try {
            if (selected) {
                const reply = await sendReply({
                    parentMessageId: selected.id,
                    facilityId,
                    studentId: student.id,
                    body: cleanBody,
                })
                setMessages(prev =>
                    prev.map(item =>
                        item.id === selected.id ? { ...item, replies: appendReplyOnce(item.replies, reply) } : item,
                    ),
                )
            } else {
                const msg = await sendMessage({
                    facilityId,
                    studentId: student.id,
                    subject: `Tin nhắn về ${student.name}`,
                    body: cleanBody,
                    isBroadcast: false,
                })
                setMessages(prev => upsertById(prev, msg))
                setSelectedId(msg.id)
            }
            setBody('')
        } finally {
            setSending(false)
        }
    }

    if (loading) return <Loading />

    return (
        <div style={{ display: 'grid', gap: 12 }}>
            <div
                style={{
                    background: '#fff',
                    borderRadius: 16,
                    overflow: 'hidden',
                    boxShadow: '0 2px 16px rgba(109,40,217,0.08)',
                }}
            >
                {messages.length === 0 && (
                    <div style={{ padding: 20, color: '#4C4376', fontWeight: 700 }}>
                        Chưa có tin nhắn. Phụ huynh có thể gửi lời nhắn đầu tiên ở bên dưới.
                    </div>
                )}
                {messages.map(item => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        style={{
                            width: '100%',
                            textAlign: 'left',
                            border: 'none',
                            borderBottom: '1px solid #EDE9FE',
                            background: selected?.id === item.id ? '#F5F3FF' : '#fff',
                            padding: 14,
                            color: '#1E1B4B',
                        }}
                    >
                        <div style={{ fontWeight: 900, fontSize: 16 }}>{item.subject || item.body}</div>
                        <div style={{ color: '#4C4376', fontSize: 14, marginTop: 4 }}>
                            {item.from_name || 'Maika School'} · {new Date(item.created_at).toLocaleDateString('vi-VN')}
                        </div>
                    </button>
                ))}
            </div>

            {selected && (
                <div
                    style={{
                        background: '#fff',
                        borderRadius: 16,
                        padding: 16,
                        boxShadow: '0 2px 16px rgba(109,40,217,0.08)',
                    }}
                >
                    <div style={{ color: '#1E1B4B', fontWeight: 800, marginBottom: 10 }}>
                        {selected.subject || 'Tin nhắn'}
                    </div>
                    {[selected, ...(selected.replies || [])].map(item => {
                        const mine = item.from_role === 'parent'
                        return (
                            <div
                                key={item.id}
                                style={{
                                    display: 'flex',
                                    justifyContent: mine ? 'flex-end' : 'flex-start',
                                    marginBottom: 10,
                                }}
                            >
                                <div
                                    style={{
                                        maxWidth: '82%',
                                        background: mine ? '#EDE9FE' : '#F8F7FF',
                                        borderRadius: 14,
                                        padding: 12,
                                        color: '#1E1B4B',
                                        fontWeight: 650,
                                    }}
                                >
                                    <div>{item.body}</div>
                                    <div style={{ color: '#4C4376', fontSize: 12, marginTop: 6 }}>
                                        {item.from_name || (mine ? 'Phụ huynh' : 'Maika School')}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            <div
                style={{
                    background: '#fff',
                    borderRadius: 16,
                    padding: 14,
                    boxShadow: '0 2px 16px rgba(109,40,217,0.08)',
                }}
            >
                <textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    rows={4}
                    placeholder={selected ? 'Nhập phản hồi...' : 'Nhập tin nhắn cho nhà trường...'}
                    style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        border: '1.5px solid #DDD6FE',
                        borderRadius: 12,
                        padding: 12,
                        fontSize: 16,
                        resize: 'vertical',
                    }}
                />
                <button
                    type="button"
                    onClick={handleSend}
                    disabled={sending || !body.trim()}
                    style={{
                        marginTop: 10,
                        width: '100%',
                        minHeight: 46,
                        border: 'none',
                        borderRadius: 12,
                        background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)',
                        color: '#fff',
                        fontWeight: 900,
                        fontSize: 16,
                        opacity: sending || !body.trim() ? 0.6 : 1,
                    }}
                >
                    Gửi tin nhắn
                </button>
            </div>
        </div>
    )
}

export default function SupabaseParentPortal() {
    const navigate = useNavigate()
    const [students, setStudents] = useState([])
    const [studentId, setStudentId] = useState('')
    const [tab, setTab] = useState('overview')
    const [err, setErr] = useState('')
    const [loading, setLoading] = useState(true)
    const [online, setOnline] = useState(navigator.onLine)

    useEffect(() => {
        const up = () => setOnline(true)
        const down = () => setOnline(false)
        window.addEventListener('online', up)
        window.addEventListener('offline', down)
        return () => {
            window.removeEventListener('online', up)
            window.removeEventListener('offline', down)
        }
    }, [])

    useEffect(() => {
        listMyLinkedStudents()
            .then(items => {
                setStudents(items)
                setStudentId(items[0]?.id || '')
                localStorage.setItem('maika-parent-students', JSON.stringify(items))
            })
            .catch(error => {
                const cached = localStorage.getItem('maika-parent-students')
                if (cached) {
                    const items = JSON.parse(cached)
                    setStudents(items)
                    setStudentId(items[0]?.id || '')
                } else {
                    setErr(error.message)
                }
            })
            .finally(() => setLoading(false))
    }, [])

    async function logout() {
        await signOut().catch(() => {})
        sessionStorage.clear()
        navigate('/parent')
    }

    if (loading) return <Loading />

    const student = students.find(item => item.id === studentId) || students[0]

    return (
        <div className="parent-portal" style={{ minHeight: '100vh', background: '#F5F3FF' }}>
            {!online && (
                <div
                    role="alert"
                    style={{
                        background: '#FFFBEB',
                        borderBottom: '1px solid #FCD34D',
                        padding: '10px 16px',
                        textAlign: 'center',
                        fontSize: 15,
                        fontWeight: 700,
                        color: '#92400E',
                        zIndex: 100,
                    }}
                >
                    📡 Đang xem dữ liệu offline — kết nối lại để cập nhật mới nhất
                </div>
            )}
            <header
                style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 50,
                    background: 'linear-gradient(135deg,#1E1B4B,#4C1D95)',
                    color: '#fff',
                    padding: '14px clamp(12px, 4vw, 20px)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                        <div style={{ fontWeight: 900, fontSize: 20 }}>Cổng phụ huynh</div>
                        <div style={{ color: '#C4B5FD', fontSize: 14, fontWeight: 700 }}>
                            Thông tin học tập và sinh hoạt của bé
                        </div>
                    </div>
                    <button
                        onClick={logout}
                        aria-label="Đăng xuất khỏi cổng phụ huynh"
                        style={{
                            border: '1px solid rgba(255,255,255,0.28)',
                            background: 'rgba(255,255,255,0.1)',
                            color: '#fff',
                            borderRadius: 10,
                            padding: '10px 14px',
                            fontWeight: 800,
                            fontSize: 14,
                        }}
                    >
                        Đăng xuất
                    </button>
                </div>
                <nav aria-label="Điều hướng chính">
                    <div
                        role="tablist"
                        aria-label="Các mục trong cổng phụ huynh"
                        style={{
                            display: 'flex',
                            gap: 8,
                            marginTop: 14,
                            overflowX: 'auto',
                            WebkitOverflowScrolling: 'touch',
                            paddingBottom: 2,
                        }}
                    >
                        {students.length > 1 && (
                            <select
                                value={studentId}
                                onChange={e => setStudentId(e.target.value)}
                                aria-label="Chọn học sinh"
                                style={{
                                    padding: '10px 12px',
                                    borderRadius: 10,
                                    border: 'none',
                                    fontWeight: 800,
                                    color: '#1E1B4B',
                                    flexShrink: 0,
                                    fontSize: 14,
                                }}
                            >
                                {students.map(item => (
                                    <option key={item.id} value={item.id}>
                                        {item.name}
                                    </option>
                                ))}
                            </select>
                        )}
                        {TABS.map(([id, label]) => (
                            <button
                                key={id}
                                role="tab"
                                aria-selected={tab === id}
                                onClick={() => setTab(id)}
                                style={{
                                    border: 'none',
                                    borderRadius: 10,
                                    padding: '11px 14px',
                                    background: tab === id ? '#fff' : 'rgba(255,255,255,0.1)',
                                    color: tab === id ? '#4C1D95' : '#fff',
                                    fontWeight: 900,
                                    flexShrink: 0,
                                    fontSize: 14,
                                }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </nav>
            </header>
            <main role="main" style={{ maxWidth: 980, margin: '0 auto', padding: 'clamp(12px, 4vw, 20px)' }}>
                {err && (
                    <div
                        style={{
                            background: '#FEF2F2',
                            color: '#DC2626',
                            borderRadius: 12,
                            padding: 12,
                            fontWeight: 800,
                        }}
                    >
                        {err}
                    </div>
                )}
                <PWAInstallBanner />
                {students.length > 0 && <PushBanner students={students} />}
                {!student && !err && (
                    <div
                        style={{ background: '#fff', borderRadius: 16, padding: 28, color: '#7C6D9B', fontWeight: 800 }}
                    >
                        Tài khoản phụ huynh chưa được liên kết học sinh.
                    </div>
                )}
                {student && tab === 'overview' && (
                    <div
                        style={{
                            background: '#fff',
                            borderRadius: 16,
                            padding: 24,
                            boxShadow: '0 2px 16px rgba(109,40,217,0.08)',
                        }}
                    >
                        <div style={{ fontWeight: 900, fontSize: 24, color: '#1E1B4B' }}>{student.name}</div>
                        <div style={{ color: '#4C4376', marginTop: 6, fontSize: 16, fontWeight: 600 }}>
                            {student.className || 'Chưa có lớp'} · {student.parentName || 'Phụ huynh'}
                        </div>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
                                gap: 12,
                                marginTop: 20,
                            }}
                        >
                            {[
                                ['Ngày sinh', student.dob || '—'],
                                [
                                    'Giới tính',
                                    student.gender === 'male' ? 'Nam' : student.gender === 'female' ? 'Nữ' : 'Chưa rõ',
                                ],
                                ['Lớp', student.className || '—'],
                                ['Trạng thái', student.status === 'active' ? 'Đang học' : 'Nghỉ học'],
                            ].map(([label, value]) => (
                                <div key={label} style={{ background: '#F8F7FF', borderRadius: 12, padding: 16 }}>
                                    <div style={{ fontSize: 13, color: '#4C4376', fontWeight: 700 }}>{label}</div>
                                    <div style={{ color: '#1E1B4B', fontWeight: 800, marginTop: 4, fontSize: 17 }}>
                                        {value}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {student && tab === 'attendance' && (
                    <Suspense fallback={<Loading />}>
                        <AttendanceAdvanced readOnly filterStudentId={student.id} />
                    </Suspense>
                )}
                {student && tab === 'notifications' && (
                    <Suspense fallback={<Loading />}>
                        <NotificationCenter studentId={student.id} classId={student.className} />
                    </Suspense>
                )}
                {student && tab === 'mealMenu' && (
                    <Suspense fallback={<Loading />}>
                        <MealMenu readOnly />
                    </Suspense>
                )}
                {student && tab === 'gallery' && (
                    <Suspense fallback={<Loading />}>
                        <MediaLibrary readOnly forParent />
                    </Suspense>
                )}
                {student && tab === 'health' && (
                    <Suspense fallback={<Loading />}>
                        <HealthRecords readOnly filterStudentId={student.id} />
                    </Suspense>
                )}
                {student && tab === 'incidents' && (
                    <Suspense fallback={<Loading />}>
                        <Incidents readOnly filterStudentId={student.id} />
                    </Suspense>
                )}
                {student && tab === 'invoices' && (
                    <>
                        <ParentFeeNotices student={student} />
                        <Suspense fallback={<Loading />}>
                            <Invoices readOnly filterStudentId={student.id} />
                        </Suspense>
                    </>
                )}
                {student && tab === 'messages' && <ParentMessages student={student} />}
                {student && tab === 'privacy' && (
                    <Suspense fallback={<Loading />}>
                        <ConsentPanel studentId={student.id} studentName={student.name} />
                    </Suspense>
                )}
            </main>
        </div>
    )
}
