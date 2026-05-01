import { useState } from 'react'
import { getDB, commit, todayStr } from '../../data/store'
import { fmtDate } from '../../utils/format'

function Avatar({ initials, size = 38 }) {
    const colors = ['#7C3AED', '#A78BFA', '#34D399', '#06B6D4', '#EC4899']
    const c = colors[(initials.charCodeAt(0) || 0) % colors.length]
    return <div style={{ width: size, height: size, borderRadius: 999, background: `linear-gradient(135deg,${c},${c}99)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: size * 0.35, flexShrink: 0 }}>{initials}</div>
}

function TeacherModal({ teacher, db, onClose, onSave }) {
    const [form, setForm] = useState(teacher || { name: '', classId: '', subject: 'Giáo viên chủ nhiệm', phone: '', email: '', joinDate: todayStr(), status: 'active', initials: '', degree: '' })
    const is = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #DDD6FE', fontSize: 13, color: '#1E1B4B', boxSizing: 'border-box' }
    const ls = { fontSize: 12, fontWeight: 700, color: '#6B6494', display: 'block', marginBottom: 4 }
    function hc(k, v) { const u = { ...form, [k]: v }; if (k === 'name') u.initials = v.split(' ').filter(Boolean).slice(-2).map(w => w[0].toUpperCase()).join(''); setForm(u) }
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{ background: '#fff', borderRadius: 20, width: 'min(480px, calc(100vw - 24px))', maxHeight: '90vh', overflowY: 'auto', padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                <div style={{ fontWeight: 800, fontSize: 17, color: '#1E1B4B', marginBottom: 20 }}>{teacher ? 'Chỉnh sửa giáo viên' : 'Thêm giáo viên mới'}</div>
                <div className="mobile-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div style={{ gridColumn: '1/-1' }}><label style={ls}>Họ và tên *</label><input style={is} value={form.name} onChange={e => hc('name', e.target.value)} /></div>
                    <div><label style={ls}>Chuyên môn</label><input style={is} value={form.subject} onChange={e => hc('subject', e.target.value)} /></div>
                    <div><label style={ls}>Phụ trách lớp</label><select style={is} value={form.classId || ''} onChange={e => hc('classId', e.target.value)}><option value="">— Không có —</option>{db.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                    <div><label style={ls}>Điện thoại</label><input style={is} value={form.phone} onChange={e => hc('phone', e.target.value)} /></div>
                    <div><label style={ls}>Email</label><input style={is} value={form.email} onChange={e => hc('email', e.target.value)} /></div>
                    <div><label style={ls}>Ngày vào làm</label><input type="date" style={is} value={form.joinDate} onChange={e => hc('joinDate', e.target.value)} /></div>
                    <div><label style={ls}>Trình độ</label><input style={is} value={form.degree} onChange={e => hc('degree', e.target.value)} /></div>
                    <div><label style={ls}>Trạng thái</label><select style={is} value={form.status} onChange={e => hc('status', e.target.value)}><option value="active">Đang làm việc</option><option value="inactive">Đã nghỉ</option></select></div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 10, border: '1.5px solid #DDD6FE', background: '#fff', fontSize: 13, fontWeight: 700, color: '#6B6494', cursor: 'pointer' }}>Hủy</button>
                    <button onClick={() => onSave(form)} style={{ padding: '9px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(90deg,#7C3AED,#A78BFA)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Lưu</button>
                </div>
            </div>
        </div>
    )
}

export default function Teachers() {
    const [db, setDB] = useState(getDB())
    const [modal, setModal] = useState(null)
    const [selected, setSelected] = useState(null)

    function saveTeacher(form) {
        const ndb = getDB()
        if (selected) { const idx = ndb.teachers.findIndex(t => t.id === selected.id); ndb.teachers[idx] = { ...selected, ...form } }
        else ndb.teachers.push({ ...form, id: 't' + Date.now() })
        commit(); setDB({ ...ndb }); setModal(null); setSelected(null)
    }

    return (
        <div className="admin-page-pad" style={{ padding: '28px 36px' }}>
            {modal === 'add' && <TeacherModal db={db} onClose={() => setModal(null)} onSave={saveTeacher} />}
            {modal === 'edit' && <TeacherModal teacher={selected} db={db} onClose={() => { setModal(null); setSelected(null) }} onSave={saveTeacher} />}
            <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 12 }}>
                <div><div style={{ fontWeight: 800, fontSize: 18, color: '#1E1B4B' }}>Quản lý giáo viên</div><div style={{ fontSize: 13, color: '#7C6D9B', marginTop: 2 }}>{db.teachers.filter(t => t.status === 'active').length} giáo viên đang làm việc</div></div>
                <button onClick={() => { setSelected(null); setModal('add') }} style={{ padding: '10px 22px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 14px rgba(109,40,217,0.35)' }}>+ Thêm giáo viên</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,300px),1fr))', gap: 18 }}>
                {db.teachers.map(t => {
                    const cls = db.classes.find(c => c.id === t.classId)
                    return (
                        <div key={t.id} style={{ background: '#fff', borderRadius: 20, padding: '22px 24px', boxShadow: '0 2px 16px rgba(109,40,217,0.08)', border: '1.5px solid #EDE9FE' }}>
                            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
                                <Avatar initials={t.initials || '?'} size={50} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 800, fontSize: 15, color: '#1E1B4B' }}>{t.name}</div>
                                    <div style={{ fontSize: 13, color: '#7C6D9B', marginTop: 2 }}>{t.subject}</div>
                                    {cls && <span style={{ fontSize: 11, fontWeight: 700, color: cls.color, background: cls.color + '18', borderRadius: 6, padding: '2px 8px', display: 'inline-block', marginTop: 4 }}>{cls.name}</span>}
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, color: t.status === 'active' ? '#16A34A' : '#DC2626', background: t.status === 'active' ? '#F0FDF4' : '#FEF2F2', borderRadius: 6, padding: '3px 8px' }}>{t.status === 'active' ? 'Đang làm' : 'Đã nghỉ'}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                                <div style={{ fontSize: 13, color: '#6B6494' }}>📞 {t.phone}</div>
                                <div style={{ fontSize: 13, color: '#6B6494' }}>✉️ {t.email}</div>
                                <div style={{ fontSize: 13, color: '#6B6494' }}>🎓 {t.degree}</div>
                                <div style={{ fontSize: 13, color: '#6B6494' }}>📅 Vào làm: {fmtDate(t.joinDate)}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => { setSelected(t); setModal('edit') }} style={{ flex: 1, padding: '8px', borderRadius: 10, border: '1.5px solid #7C3AED', background: '#fff', color: '#7C3AED', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>✏️ Chỉnh sửa</button>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
