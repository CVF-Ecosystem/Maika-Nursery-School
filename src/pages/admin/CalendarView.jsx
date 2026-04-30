import { useState } from 'react'
import { getDB, commit } from '../../data/store'

const TYPE_COLOR = { school: '#7C3AED', celebration: '#A78BFA', meeting: '#7C3AED', health: '#16A34A', finance: '#DC2626', holiday: '#06B6D4', training: '#8B5CF6' }
const TYPE_LABEL = { school: 'Học đường', celebration: 'Lễ hội', meeting: 'Họp', health: 'Y tế', finance: 'Tài chính', holiday: 'Nghỉ lễ', training: 'Tập huấn' }
const TYPE_ICON = { school: '🏫', celebration: '🎉', meeting: '📋', health: '🏥', finance: '💰', holiday: '🌟', training: '📚' }

export default function CalendarView() {
    const [db, setDB] = useState(getDB())
    const [view, setView] = useState('list')
    const [modal, setModal] = useState(false)
    const [form, setForm] = useState({ title: '', date: '', type: 'school', desc: '' })
    const today = new Date().toISOString().split('T')[0]

    const upcoming = [...db.events].filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date))
    const past = [...db.events].filter(e => e.date < today).sort((a, b) => b.date.localeCompare(a.date))

    function addEvent() {
        if (!form.title || !form.date) return
        const ndb = getDB(); ndb.events.unshift({ ...form, id: 'e' + Date.now() })
        commit(); setDB({ ...ndb }); setModal(false); setForm({ title: '', date: '', type: 'school', desc: '' })
    }

    const is = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #DDD6FE', fontSize: 13, color: '#1E1B4B', boxSizing: 'border-box' }
    const ls = { fontSize: 12, fontWeight: 700, color: '#6B6494', display: 'block', marginBottom: 4 }

    function EventRow({ e }) {
        const col = TYPE_COLOR[e.type] || '#6B6494'; const lbl = TYPE_LABEL[e.type] || e.type; const icon = TYPE_ICON[e.type] || '📌'
        const d = new Date(e.date + 'T00:00:00')
        return (
            <div style={{ display: 'flex', gap: 14, padding: '14px 18px', borderBottom: '1px solid #EDE9FE', alignItems: 'flex-start' }}>
                <div style={{ textAlign: 'center', width: 48, flexShrink: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#7C6D9B', textTransform: 'uppercase' }}>{d.toLocaleDateString('vi-VN', { month: 'short' })}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#7C3AED', lineHeight: 1 }}>{d.getDate()}</div>
                    <div style={{ fontSize: 10, color: '#9B93C9' }}>{d.toLocaleDateString('vi-VN', { weekday: 'short' })}</div>
                </div>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: col + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{icon}</div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1E1B4B' }}>{e.title}</div>
                    {e.desc && <div style={{ fontSize: 13, color: '#6B6494', marginTop: 2 }}>{e.desc}</div>}
                    <span style={{ fontSize: 11, fontWeight: 700, color: col, background: col + '18', borderRadius: 4, padding: '2px 8px', display: 'inline-block', marginTop: 4 }}>{lbl}</span>
                </div>
                <span style={{ fontSize: 12, color: e.date === today ? '#16A34A' : '#9B93C9', fontWeight: 700, background: e.date === today ? '#F0FDF4' : 'transparent', borderRadius: 6, padding: '2px 8px', flexShrink: 0 }}>{e.date === today ? 'Hôm nay' : ''}</span>
            </div>
        )
    }

    return (
        <div style={{ padding: '28px 36px' }}>
            {modal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && setModal(false)}>
                    <div style={{ background: '#fff', borderRadius: 20, width: 440, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                        <div style={{ fontWeight: 800, fontSize: 17, color: '#1E1B4B', marginBottom: 20 }}>Thêm sự kiện</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div><label style={ls}>Tên sự kiện *</label><input style={is} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
                            <div><label style={ls}>Ngày *</label><input type="date" style={is} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
                            <div><label style={ls}>Loại</label><select style={is} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>{Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                            <div><label style={ls}>Mô tả</label><input style={is} value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} /></div>
                        </div>
                        <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
                            <button onClick={() => setModal(false)} style={{ padding: '9px 20px', borderRadius: 10, border: '1.5px solid #DDD6FE', background: '#fff', fontSize: 13, fontWeight: 700, color: '#6B6494', cursor: 'pointer' }}>Hủy</button>
                            <button onClick={addEvent} style={{ padding: '9px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Thêm</button>
                        </div>
                    </div>
                </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div><div style={{ fontWeight: 800, fontSize: 18, color: '#1E1B4B' }}>Lịch sự kiện</div><div style={{ fontSize: 13, color: '#7C6D9B', marginTop: 2 }}>{upcoming.length} sự kiện sắp tới</div></div>
                <button onClick={() => setModal(true)} style={{ padding: '10px 22px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>+ Thêm sự kiện</button>
            </div>
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(109,40,217,0.08)', marginBottom: 16 }}>
                <div style={{ padding: '16px 18px', borderBottom: '1.5px solid #EDE9FE', fontWeight: 800, fontSize: 14, color: '#7C3AED' }}>📅 Sắp tới</div>
                {upcoming.length === 0 ? <div style={{ padding: '30px', textAlign: 'center', color: '#7C6D9B' }}>Không có sự kiện sắp tới</div> : upcoming.map(e => <EventRow key={e.id} e={e} />)}
            </div>
            {past.length > 0 && <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(109,40,217,0.08)' }}>
                <div style={{ padding: '16px 18px', borderBottom: '1.5px solid #EDE9FE', fontWeight: 800, fontSize: 14, color: '#7C6D9B' }}>🔙 Đã qua</div>
                {past.slice(0, 5).map(e => <EventRow key={e.id} e={e} />)}
            </div>}
        </div>
    )
}
