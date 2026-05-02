import { useState } from 'react'
import { getDB, commit } from '../../data/store'
import { fmtDate } from '../../utils/format'
import ModalCloseButton from '../../components/ModalCloseButton'

const BADGE_ICON = { star: '⭐', book: '📖', music: '🎵', crown: '👑', heart: '❤️', rocket: '🚀', art: '🎨' }
const BADGE_NAME_LIST = [
    { id: 'star', label: 'Ngôi sao tuần' },
    { id: 'book', label: 'Sâu đọc sách' },
    { id: 'music', label: 'Họa mi nhí' },
    { id: 'crown', label: 'Học sinh xuất sắc' },
    { id: 'heart', label: 'Bạn tốt' },
    { id: 'rocket', label: 'Tiến bộ vượt bậc' },
    { id: 'art', label: 'Nghệ sĩ nhí' },
]

export default function Gamification() {
    const [db, setDB] = useState(getDB())
    const [modal, setModal] = useState(false)
    const [form, setForm] = useState({ studentId: '', badge: 'star', note: '' })

    function awardBadge() {
        if (!form.studentId) return
        const ndb = getDB()
        const bname = BADGE_NAME_LIST.find(b => b.id === form.badge)?.label || form.badge
        ndb.badges.unshift({
            id: 'b' + Date.now(),
            studentId: form.studentId,
            badge: form.badge,
            name: bname,
            earnedDate: new Date().toISOString().split('T')[0],
            note: form.note,
        })
        commit()
        setDB({ ...ndb })
        setModal(false)
        setForm({ studentId: '', badge: 'star', note: '' })
    }

    const is = {
        width: '100%',
        padding: '8px 12px',
        borderRadius: 8,
        border: '1.5px solid #DDD6FE',
        fontSize: 13,
        color: '#1E1B4B',
        boxSizing: 'border-box',
    }
    const ls = { fontSize: 12, fontWeight: 700, color: '#6B6494', display: 'block', marginBottom: 4 }

    return (
        <div className="admin-page-pad" style={{ padding: '28px 36px' }}>
            {modal && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.4)',
                        zIndex: 1000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <div
                        style={{
                            position: 'relative',
                            background: '#fff',
                            borderRadius: 20,
                            width: 'min(420px, calc(100vw - 24px))',
                            padding: 28,
                            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                        }}
                    >
                        <ModalCloseButton onClick={() => setModal(false)} />
                        <div style={{ fontWeight: 800, fontSize: 17, color: '#1E1B4B', marginBottom: 20 }}>
                            🏆 Trao thành tích
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                                <label style={ls}>Học sinh</label>
                                <select
                                    style={is}
                                    value={form.studentId}
                                    onChange={e => setForm({ ...form, studentId: e.target.value })}
                                >
                                    <option value="">— Chọn học sinh —</option>
                                    {db.students
                                        .filter(s => s.status === 'active')
                                        .map(s => (
                                            <option key={s.id} value={s.id}>
                                                {s.name}
                                            </option>
                                        ))}
                                </select>
                            </div>
                            <div>
                                <label style={ls}>Loại thành tích</label>
                                <select
                                    style={is}
                                    value={form.badge}
                                    onChange={e => setForm({ ...form, badge: e.target.value })}
                                >
                                    {BADGE_NAME_LIST.map(b => (
                                        <option key={b.id} value={b.id}>
                                            {BADGE_ICON[b.id]} {b.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={ls}>Ghi chú</label>
                                <input
                                    style={is}
                                    value={form.note}
                                    onChange={e => setForm({ ...form, note: e.target.value })}
                                    placeholder="Lý do trao thành tích..."
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setModal(false)}
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
                                onClick={awardBadge}
                                style={{
                                    padding: '9px 24px',
                                    borderRadius: 10,
                                    border: 'none',
                                    background: 'linear-gradient(135deg,#F59E0B,#FBBF24)',
                                    color: '#1E1B4B',
                                    fontSize: 13,
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                }}
                            >
                                🏆 Trao thành tích
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div
                className="mobile-stack"
                style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 24, gap: 12 }}
            >
                <button
                    onClick={() => setModal(true)}
                    style={{
                        padding: '10px 22px',
                        borderRadius: 12,
                        border: 'none',
                        background: 'linear-gradient(135deg,#F59E0B,#FBBF24)',
                        color: '#1E1B4B',
                        fontWeight: 800,
                        fontSize: 14,
                        cursor: 'pointer',
                    }}
                >
                    🏆 Trao thành tích
                </button>
            </div>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,260px),1fr))',
                    gap: 16,
                }}
            >
                {db.students
                    .filter(s => s.status === 'active')
                    .map(s => {
                        const badges = db.badges.filter(b => b.studentId === s.id)
                        if (badges.length === 0) return null
                        return (
                            <div
                                key={s.id}
                                style={{
                                    background: '#fff',
                                    borderRadius: 18,
                                    padding: '20px 22px',
                                    boxShadow: '0 2px 16px rgba(109,40,217,0.08)',
                                    border: '1.5px solid #EDE9FE',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                                    <div
                                        style={{
                                            width: 42,
                                            height: 42,
                                            borderRadius: 12,
                                            background: 'linear-gradient(135deg,#7C3AED,#A78BFA)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#fff',
                                            fontWeight: 800,
                                            fontSize: 15,
                                        }}
                                    >
                                        {s.initials || '?'}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 14, color: '#1E1B4B' }}>{s.name}</div>
                                        <div style={{ fontSize: 12, color: '#7C6D9B' }}>{badges.length} thành tích</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {badges.map(b => (
                                        <div
                                            key={b.id}
                                            style={{
                                                background: 'linear-gradient(135deg,#FEF3C7,#FFFBEB)',
                                                border: '1.5px solid #F59E0B',
                                                borderRadius: 10,
                                                padding: '8px 12px',
                                                display: 'flex',
                                                gap: 6,
                                                alignItems: 'center',
                                            }}
                                        >
                                            <span style={{ fontSize: 18 }}>{BADGE_ICON[b.badge] || '🌟'}</span>
                                            <div>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E' }}>
                                                    {b.name}
                                                </div>
                                                <div style={{ fontSize: 10, color: '#A16207' }}>
                                                    {fmtDate(b.earnedDate)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })
                    .filter(Boolean)}
            </div>
        </div>
    )
}
