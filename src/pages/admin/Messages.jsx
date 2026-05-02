import { useState, useEffect } from 'react'
import { getDB, commit } from '../../data/store'
import { sanitizeText } from '../../utils/security'
import { isSupabaseSession } from '../../data/backendMode'
import {
    listMessages,
    sendMessage,
    sendReply,
    markMessageRead,
    subscribeMessages,
} from '../../features/messages/messageService'
import { sendPushForEvent } from '../../features/push/pushService'

// ─── Supabase branch ────────────────────────────────────────────────────────

function upsertById(items, item) {
    if (!item?.id) return items
    const exists = items.some(x => x.id === item.id)
    if (exists) return items.map(x => (x.id === item.id ? { ...x, ...item } : x))
    return [item, ...items]
}

function appendReplyOnce(replies = [], reply) {
    if (!reply?.id) return replies
    if (replies.some(item => item.id === reply.id)) {
        return replies.map(item => (item.id === reply.id ? { ...item, ...reply } : item))
    }
    return [...replies, reply]
}

function SupabaseMessages({ selectedFacilityId }) {
    const [messages, setMessages] = useState([])
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState(null)
    const [reply, setReply] = useState('')
    const [sending, setSending] = useState(false)
    const [showCompose, setShowCompose] = useState(false)
    const [compose, setCompose] = useState({ subject: '', body: '' })
    const [mobileView, setMobileView] = useState('list')

    useEffect(() => {
        let mounted = true
        setLoading(true)
        listMessages({ facilityId: selectedFacilityId })
            .then(data => {
                if (mounted) setMessages(data)
            })
            .catch(() => {})
            .finally(() => {
                if (mounted) setLoading(false)
            })
        return () => {
            mounted = false
        }
    }, [selectedFacilityId])

    useEffect(() => {
        return subscribeMessages({
            facilityId: selectedFacilityId,
            onChange: ({ eventType, record }) => {
                if (!record) return
                setMessages(prev => {
                    if (record.parent_message_id) {
                        return prev.map(m =>
                            m.id === record.parent_message_id
                                ? { ...m, replies: appendReplyOnce(m.replies, record) }
                                : m,
                        )
                    }
                    if (eventType === 'INSERT') return upsertById(prev, { ...record, replies: record.replies || [] })
                    if (eventType === 'UPDATE') return prev.map(m => (m.id === record.id ? { ...m, ...record } : m))
                    if (eventType === 'DELETE') return prev.filter(m => m.id !== record.id)
                    return prev
                })
                if (record.parent_message_id) {
                    setSelected(prev =>
                        prev?.id === record.parent_message_id
                            ? { ...prev, replies: appendReplyOnce(prev.replies, record) }
                            : prev,
                    )
                }
            },
        })
    }, [selectedFacilityId, selected?.id])

    async function handleSelect(m) {
        setSelected({ ...m })
        setMobileView('detail')
        if (!m.is_read && m.from_role === 'parent') {
            markMessageRead(m.id).catch(() => {})
            setMessages(prev => prev.map(x => (x.id === m.id ? { ...x, is_read: true } : x)))
        }
    }

    async function handleReply() {
        if (!reply.trim() || !selected || sending) return
        const body = sanitizeText(reply)
        const optimistic = {
            id: 'opt-' + Date.now(),
            from_role: 'admin',
            from_name: 'Maika School',
            body,
            created_at: new Date().toISOString(),
        }
        const prevSelected = selected
        setSelected(prev => ({ ...prev, replies: [...(prev.replies || []), optimistic] }))
        setReply('')
        setSending(true)
        try {
            const saved = await sendReply({
                parentMessageId: selected.id,
                facilityId: selectedFacilityId,
                toUserId: selected.from_user_id,
                studentId: selected.student_id,
                body,
            })
            setSelected(prev => ({
                ...prev,
                replies: (prev.replies || []).map(r => (r.id === optimistic.id ? saved : r)),
            }))
            sendPushForEvent({
                facilityId: selectedFacilityId,
                title: 'Maika School đã phản hồi tin nhắn',
                body: body.slice(0, 80),
                url: '/parent',
            }).catch(() => {})
        } catch {
            setSelected(prevSelected)
            setReply(body)
        } finally {
            setSending(false)
        }
    }

    async function handleBroadcast() {
        if (!compose.subject.trim() || !compose.body.trim()) return
        const subject = sanitizeText(compose.subject)
        const body = sanitizeText(compose.body)
        setSending(true)
        try {
            const msg = await sendMessage({ facilityId: selectedFacilityId, subject, body, isBroadcast: true })
            setMessages(prev => upsertById(prev, msg))
            setShowCompose(false)
            setCompose({ subject: '', body: '' })
            sendPushForEvent({
                facilityId: selectedFacilityId,
                title: subject,
                body: body.slice(0, 80),
                url: '/parent',
            }).catch(() => {})
        } catch {
            setCompose({ subject, body })
            setShowCompose(true)
        } finally {
            setSending(false)
        }
    }

    const unread = messages.filter(m => !m.is_read && m.from_role === 'parent').length

    if (loading)
        return (
            <div style={{ padding: '28px 36px' }}>
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="skeleton" style={{ height: 60, marginBottom: 10, borderRadius: 12 }} />
                ))}
            </div>
        )

    return (
        <div className="admin-page-pad" style={{ padding: '28px 36px' }}>
            <div
                className="mobile-stack"
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 20,
                    gap: 12,
                }}
            >
                <div style={{ fontSize: 13, color: '#7C6D9B', fontWeight: 700 }}>{unread} tin nhắn chưa đọc</div>
                <button
                    onClick={() => setShowCompose(true)}
                    style={{
                        padding: '10px 22px',
                        borderRadius: 12,
                        border: 'none',
                        background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: 14,
                        cursor: 'pointer',
                    }}
                >
                    📣 Thông báo toàn trường
                </button>
            </div>

            {showCompose && (
                <div
                    style={{
                        background: '#fff',
                        borderRadius: 16,
                        padding: 24,
                        marginBottom: 20,
                        boxShadow: '0 4px 20px rgba(109,40,217,0.12)',
                        border: '1.5px solid #EDE9FE',
                    }}
                >
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#1E1B4B', marginBottom: 14 }}>
                        📣 Gửi thông báo
                    </div>
                    <input
                        value={compose.subject}
                        onChange={e => setCompose({ ...compose, subject: e.target.value })}
                        placeholder="Tiêu đề thông báo..."
                        style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: 10,
                            border: '1.5px solid #DDD6FE',
                            fontSize: 14,
                            marginBottom: 10,
                            boxSizing: 'border-box',
                        }}
                    />
                    <textarea
                        value={compose.body}
                        onChange={e => setCompose({ ...compose, body: e.target.value })}
                        rows={4}
                        placeholder="Nội dung thông báo..."
                        style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: 10,
                            border: '1.5px solid #DDD6FE',
                            fontSize: 14,
                            resize: 'vertical',
                            boxSizing: 'border-box',
                        }}
                    />
                    <div style={{ display: 'flex', gap: 10, marginTop: 12, justifyContent: 'flex-end' }}>
                        <button
                            onClick={() => setShowCompose(false)}
                            style={{
                                padding: '9px 20px',
                                borderRadius: 10,
                                border: '1.5px solid #DDD6FE',
                                background: '#fff',
                                fontSize: 13,
                                fontWeight: 700,
                                color: '#6B6494',
                                cursor: 'pointer',
                            }}
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleBroadcast}
                            disabled={sending}
                            style={{
                                padding: '9px 24px',
                                borderRadius: 10,
                                border: 'none',
                                background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)',
                                color: '#fff',
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: 'pointer',
                                opacity: sending ? 0.7 : 1,
                            }}
                        >
                            Gửi đi
                        </button>
                    </div>
                </div>
            )}

            <div
                className="mobile-two-col"
                style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: 16, minHeight: 400 }}
            >
                <div
                    className={mobileView === 'detail' ? 'hide-mobile' : ''}
                    style={{
                        background: '#fff',
                        borderRadius: 16,
                        overflow: 'hidden',
                        boxShadow: '0 2px 16px rgba(109,40,217,0.08)',
                    }}
                >
                    {messages.length === 0 && (
                        <div style={{ padding: 24, textAlign: 'center', color: '#9B93C9', fontSize: 13 }}>
                            Chưa có tin nhắn nào
                        </div>
                    )}
                    {messages.map(m => (
                        <div
                            key={m.id}
                            onClick={() => handleSelect(m)}
                            style={{
                                padding: '14px 16px',
                                borderBottom: '1px solid #EDE9FE',
                                cursor: 'pointer',
                                background: selected?.id === m.id ? '#F5F3FF' : m.is_read ? '#fff' : '#F8F7FF',
                                borderLeft: `3px solid ${selected?.id === m.id ? '#7C3AED' : m.is_read ? 'transparent' : '#A78BFA'}`,
                            }}
                        >
                            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                <div
                                    style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 999,
                                        background:
                                            m.from_role === 'admin' || m.from_role === 'teacher'
                                                ? 'linear-gradient(135deg,#1E1B4B,#4C1D95)'
                                                : 'linear-gradient(135deg,#7C3AED,#A78BFA)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#fff',
                                        fontWeight: 800,
                                        fontSize: 13,
                                        flexShrink: 0,
                                    }}
                                >
                                    {(m.from_name || '?').charAt(0).toUpperCase()}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                                        <span
                                            style={{
                                                fontWeight: m.is_read ? 600 : 800,
                                                fontSize: 13,
                                                color: '#1E1B4B',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {m.from_name}
                                        </span>
                                        {!m.is_read && m.from_role === 'parent' && (
                                            <div
                                                style={{
                                                    width: 8,
                                                    height: 8,
                                                    borderRadius: 999,
                                                    background: '#7C3AED',
                                                    flexShrink: 0,
                                                    marginTop: 4,
                                                }}
                                            />
                                        )}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 12,
                                            color: '#6B6494',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {m.subject || m.body}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#9B93C9', marginTop: 2 }}>
                                        {new Date(m.created_at).toLocaleDateString('vi-VN')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div
                    className={mobileView === 'list' ? 'hide-mobile' : ''}
                    style={{
                        background: '#fff',
                        borderRadius: 16,
                        boxShadow: '0 2px 16px rgba(109,40,217,0.08)',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    {selected ? (
                        <>
                            <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDE9FE' }}>
                                <button
                                    onClick={() => setMobileView('list')}
                                    className="show-mobile-only"
                                    style={{
                                        display: 'none',
                                        marginBottom: 10,
                                        background: 'none',
                                        border: 'none',
                                        color: '#7C3AED',
                                        fontWeight: 800,
                                        fontSize: 14,
                                        padding: 0,
                                        cursor: 'pointer',
                                    }}
                                >
                                    ← Danh sách tin nhắn
                                </button>
                                <div style={{ fontWeight: 800, fontSize: 16, color: '#1E1B4B', marginBottom: 4 }}>
                                    {selected.subject || '(Không có tiêu đề)'}
                                </div>
                                <div style={{ fontSize: 12, color: '#6B6494' }}>
                                    Từ: <strong>{selected.from_name}</strong> ·{' '}
                                    {new Date(selected.created_at).toLocaleString('vi-VN')}
                                </div>
                            </div>
                            <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto' }}>
                                <div
                                    style={{
                                        fontSize: 14,
                                        color: '#1E1B4B',
                                        lineHeight: 1.8,
                                        whiteSpace: 'pre-wrap',
                                        marginBottom: 16,
                                    }}
                                >
                                    {selected.body}
                                </div>
                                {(selected.replies || []).map((r, i) => (
                                    <div
                                        key={r.id || i}
                                        style={{
                                            background:
                                                r.from_role === 'admin' || r.from_role === 'teacher'
                                                    ? '#EDE9FE'
                                                    : '#F5F3FF',
                                            borderRadius: 12,
                                            padding: '12px 14px',
                                            marginBottom: 8,
                                        }}
                                    >
                                        <div
                                            style={{ fontSize: 11, fontWeight: 800, color: '#7C3AED', marginBottom: 4 }}
                                        >
                                            {r.from_name}
                                        </div>
                                        <div style={{ fontSize: 14, color: '#1E1B4B', lineHeight: 1.7 }}>{r.body}</div>
                                    </div>
                                ))}
                            </div>
                            {selected.from_role === 'parent' && (
                                <div
                                    className="mobile-stack"
                                    style={{
                                        padding: '16px 24px',
                                        borderTop: '1px solid #EDE9FE',
                                        display: 'flex',
                                        gap: 10,
                                    }}
                                >
                                    <input
                                        value={reply}
                                        onChange={e => setReply(e.target.value)}
                                        placeholder="Nhập phản hồi..."
                                        style={{
                                            flex: 1,
                                            padding: '10px 14px',
                                            borderRadius: 10,
                                            border: '1.5px solid #DDD6FE',
                                            fontSize: 14,
                                        }}
                                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleReply()}
                                    />
                                    <button
                                        onClick={handleReply}
                                        disabled={sending}
                                        style={{
                                            padding: '10px 20px',
                                            borderRadius: 10,
                                            border: 'none',
                                            background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)',
                                            color: '#fff',
                                            fontWeight: 700,
                                            fontSize: 14,
                                            cursor: 'pointer',
                                            opacity: sending ? 0.7 : 1,
                                        }}
                                    >
                                        Gửi
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div
                            style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#7C6D9B',
                                fontSize: 14,
                            }}
                        >
                            Chọn một tin nhắn để xem
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// ─── Legacy branch ───────────────────────────────────────────────────────────

function LegacyMessages() {
    const [db, setDB] = useState(getDB())
    const [selected, setSelected] = useState(null)
    const [reply, setReply] = useState('')
    const [showCompose, setShowCompose] = useState(false)
    const [compose, setCompose] = useState({ subject: '', content: '', broadcast: false })
    const [mobileView, setMobileView] = useState('list')

    function markRead(id) {
        const ndb = getDB()
        const idx = ndb.messages.findIndex(m => m.id === id)
        if (idx >= 0) ndb.messages[idx].read = true
        commit()
        setDB({ ...ndb })
        setSelected(ndb.messages[idx])
    }

    function sendReplyLocal() {
        if (!reply.trim() || !selected) return
        const ndb = getDB()
        const idx = ndb.messages.findIndex(m => m.id === selected.id)
        if (idx >= 0) {
            if (!ndb.messages[idx].replies) ndb.messages[idx].replies = []
            ndb.messages[idx].replies.push({
                fromRole: 'admin',
                fromName: 'Maika School',
                content: sanitizeText(reply),
                date: new Date().toISOString(),
            })
        }
        commit()
        setDB({ ...ndb })
        setSelected(ndb.messages[idx])
        setReply('')
    }

    function sendBroadcast() {
        const ndb = getDB()
        ndb.messages.unshift({
            id: 'm' + Date.now(),
            fromRole: 'admin',
            fromName: 'Maika School',
            subject: sanitizeText(compose.subject),
            content: sanitizeText(compose.content),
            date: new Date().toISOString(),
            read: true,
            broadcast: true,
            replies: [],
        })
        commit()
        setDB({ ...ndb })
        setShowCompose(false)
        setCompose({ subject: '', content: '', broadcast: false })
    }

    const unread = db.messages.filter(m => !m.read && m.fromRole === 'parent')
    const sorted = [...db.messages].sort((a, b) => new Date(b.date) - new Date(a.date))

    return (
        <div className="admin-page-pad" style={{ padding: '28px 36px' }}>
            <div
                className="mobile-stack"
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 20,
                    gap: 12,
                }}
            >
                <div style={{ fontSize: 13, color: '#7C6D9B', fontWeight: 700 }}>{unread.length} tin nhắn chưa đọc</div>
                <button
                    onClick={() => setShowCompose(true)}
                    style={{
                        padding: '10px 22px',
                        borderRadius: 12,
                        border: 'none',
                        background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: 14,
                        cursor: 'pointer',
                    }}
                >
                    📣 Thông báo toàn trường
                </button>
            </div>
            {showCompose && (
                <div
                    style={{
                        background: '#fff',
                        borderRadius: 16,
                        padding: 24,
                        marginBottom: 20,
                        boxShadow: '0 4px 20px rgba(109,40,217,0.12)',
                        border: '1.5px solid #EDE9FE',
                    }}
                >
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#1E1B4B', marginBottom: 14 }}>
                        📣 Gửi thông báo
                    </div>
                    <input
                        value={compose.subject}
                        onChange={e => setCompose({ ...compose, subject: e.target.value })}
                        placeholder="Tiêu đề thông báo..."
                        style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: 10,
                            border: '1.5px solid #DDD6FE',
                            fontSize: 14,
                            marginBottom: 10,
                        }}
                    />
                    <textarea
                        value={compose.content}
                        onChange={e => setCompose({ ...compose, content: e.target.value })}
                        rows={4}
                        placeholder="Nội dung thông báo..."
                        style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: 10,
                            border: '1.5px solid #DDD6FE',
                            fontSize: 14,
                            resize: 'vertical',
                        }}
                    />
                    <div style={{ display: 'flex', gap: 10, marginTop: 12, justifyContent: 'flex-end' }}>
                        <button
                            onClick={() => setShowCompose(false)}
                            style={{
                                padding: '9px 20px',
                                borderRadius: 10,
                                border: '1.5px solid #DDD6FE',
                                background: '#fff',
                                fontSize: 13,
                                fontWeight: 700,
                                color: '#6B6494',
                                cursor: 'pointer',
                            }}
                        >
                            Hủy
                        </button>
                        <button
                            onClick={sendBroadcast}
                            style={{
                                padding: '9px 24px',
                                borderRadius: 10,
                                border: 'none',
                                background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)',
                                color: '#fff',
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: 'pointer',
                            }}
                        >
                            Gửi đi
                        </button>
                    </div>
                </div>
            )}
            <div
                className="mobile-two-col"
                style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: 16, minHeight: 400 }}
            >
                <div
                    className={mobileView === 'detail' ? 'hide-mobile' : ''}
                    style={{
                        background: '#fff',
                        borderRadius: 16,
                        overflow: 'hidden',
                        boxShadow: '0 2px 16px rgba(109,40,217,0.08)',
                    }}
                >
                    {sorted.map(m => (
                        <div
                            key={m.id}
                            onClick={() => {
                                setSelected(m)
                                setMobileView('detail')
                                markRead(m.id)
                            }}
                            style={{
                                padding: '14px 16px',
                                borderBottom: '1px solid #EDE9FE',
                                cursor: 'pointer',
                                background: selected?.id === m.id ? '#F5F3FF' : m.read ? '#fff' : '#F8F7FF',
                                borderLeft: `3px solid ${selected?.id === m.id ? '#7C3AED' : m.read ? 'transparent' : '#A78BFA'}`,
                            }}
                        >
                            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                <div
                                    style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 999,
                                        background:
                                            m.fromRole === 'admin'
                                                ? 'linear-gradient(135deg,#1E1B4B,#4C1D95)'
                                                : 'linear-gradient(135deg,#7C3AED,#A78BFA)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#fff',
                                        fontWeight: 800,
                                        fontSize: 13,
                                        flexShrink: 0,
                                    }}
                                >
                                    {m.fromName.charAt(0)}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                                        <span
                                            style={{ fontWeight: m.read ? 600 : 800, fontSize: 13, color: '#1E1B4B' }}
                                        >
                                            {m.fromName}
                                        </span>
                                        {!m.read && m.fromRole === 'parent' && (
                                            <div
                                                style={{
                                                    width: 8,
                                                    height: 8,
                                                    borderRadius: 999,
                                                    background: '#7C3AED',
                                                    flexShrink: 0,
                                                    marginTop: 4,
                                                }}
                                            />
                                        )}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 12,
                                            color: '#6B6494',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {m.subject}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#9B93C9', marginTop: 2 }}>
                                        {new Date(m.date).toLocaleDateString('vi-VN')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <div
                    className={mobileView === 'list' ? 'hide-mobile' : ''}
                    style={{
                        background: '#fff',
                        borderRadius: 16,
                        boxShadow: '0 2px 16px rgba(109,40,217,0.08)',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    {selected ? (
                        <>
                            <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDE9FE' }}>
                                <button
                                    onClick={() => setMobileView('list')}
                                    className="show-mobile-only"
                                    style={{
                                        display: 'none',
                                        marginBottom: 10,
                                        background: 'none',
                                        border: 'none',
                                        color: '#7C3AED',
                                        fontWeight: 800,
                                        fontSize: 14,
                                        padding: 0,
                                        cursor: 'pointer',
                                    }}
                                >
                                    ← Danh sách tin nhắn
                                </button>
                                <div style={{ fontWeight: 800, fontSize: 16, color: '#1E1B4B', marginBottom: 4 }}>
                                    {selected.subject}
                                </div>
                                <div style={{ fontSize: 12, color: '#6B6494' }}>
                                    Từ: <strong>{selected.fromName}</strong> ·{' '}
                                    {new Date(selected.date).toLocaleString('vi-VN')}
                                </div>
                            </div>
                            <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto' }}>
                                <div
                                    style={{
                                        fontSize: 14,
                                        color: '#1E1B4B',
                                        lineHeight: 1.8,
                                        whiteSpace: 'pre-wrap',
                                        marginBottom: 16,
                                    }}
                                >
                                    {selected.content}
                                </div>
                                {(selected.replies || []).map((r, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            background: r.fromRole === 'admin' ? '#EDE9FE' : '#F5F3FF',
                                            borderRadius: 12,
                                            padding: '12px 14px',
                                            marginBottom: 8,
                                        }}
                                    >
                                        <div
                                            style={{ fontSize: 11, fontWeight: 800, color: '#7C3AED', marginBottom: 4 }}
                                        >
                                            {r.fromName}
                                        </div>
                                        <div style={{ fontSize: 14, color: '#1E1B4B', lineHeight: 1.7 }}>
                                            {r.content}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {selected.fromRole === 'parent' && (
                                <div
                                    className="mobile-stack"
                                    style={{
                                        padding: '16px 24px',
                                        borderTop: '1px solid #EDE9FE',
                                        display: 'flex',
                                        gap: 10,
                                    }}
                                >
                                    <input
                                        value={reply}
                                        onChange={e => setReply(e.target.value)}
                                        placeholder="Nhập phản hồi..."
                                        style={{
                                            flex: 1,
                                            padding: '10px 14px',
                                            borderRadius: 10,
                                            border: '1.5px solid #DDD6FE',
                                            fontSize: 14,
                                        }}
                                        onKeyDown={e => e.key === 'Enter' && sendReplyLocal()}
                                    />
                                    <button
                                        onClick={sendReplyLocal}
                                        style={{
                                            padding: '10px 20px',
                                            borderRadius: 10,
                                            border: 'none',
                                            background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)',
                                            color: '#fff',
                                            fontWeight: 700,
                                            fontSize: 14,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        Gửi
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div
                            style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#7C6D9B',
                                fontSize: 14,
                            }}
                        >
                            Chọn một tin nhắn để xem
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export default function Messages({ selectedFacilityId }) {
    if (isSupabaseSession()) return <SupabaseMessages selectedFacilityId={selectedFacilityId} />
    return <LegacyMessages />
}
