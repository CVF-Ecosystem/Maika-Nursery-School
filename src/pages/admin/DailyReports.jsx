import { useState, useMemo } from 'react'
import { getDB, commit, todayStr } from '../../data/store'
import { fmtDate } from '../../utils/format'

function Avatar({ initials, size = 36 }) {
    const colors = ['#7C3AED', '#A78BFA', '#34D399', '#06B6D4', '#EC4899']
    const c = colors[(initials.charCodeAt(0) || 0) % colors.length]
    return <div style={{ width: size, height: size, borderRadius: 999, background: `linear-gradient(135deg,${c},${c}99)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: size * 0.35, flexShrink: 0 }}>{initials}</div>
}

function ReportChip({ icon, label, value }) {
    return <div style={{ background: '#F8F7FF', borderRadius: 8, padding: '6px 10px' }}><div style={{ fontSize: 10, color: '#7C6D9B', fontWeight: 700 }}>{icon} {label}</div><div style={{ fontSize: 12, fontWeight: 700, color: '#1E1B4B', marginTop: 1 }}>{value || '—'}</div></div>
}

function EditModal({ student, report, onClose, onSave }) {
    const mealOpts = ['Ăn hết suất', 'Ăn được 3/4', 'Ăn được 1/2', 'Ăn ít', 'Không ăn']
    const moodOpts = ['Vui vẻ', 'Hào hứng', 'Bình thường', 'Mệt mỏi', 'Buồn ngủ', 'Khó chịu']
    const actOpts = ['Vẽ tranh', 'Đọc sách', 'Hát nhạc', 'Vận động', 'Kể chuyện', 'Chơi cát', 'Làm thủ công']
    const [form, setForm] = useState(report || { breakfast: 'Ăn hết suất', lunch: 'Ăn hết suất', snack: 'Ăn hết suất', napDuration: 90, mood: 'Vui vẻ', activities: [], note: '', health: 'Bình thường' })
    const is = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #DDD6FE', fontSize: 13, color: '#1E1B4B', boxSizing: 'border-box' }
    const ls = { fontSize: 12, fontWeight: 700, color: '#6B6494', display: 'block', marginBottom: 4 }
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{ background: '#fff', borderRadius: 20, width: 'min(480px, calc(100vw - 24px))', padding: 28, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#1E1B4B', marginBottom: 4 }}>Nhật ký: {student?.name}</div>
                <div style={{ fontSize: 12, color: '#7C6D9B', marginBottom: 18 }}>Ngày {fmtDate(todayStr())}</div>
                <div className="mobile-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[['breakfast', '🍳 Bữa sáng'], ['lunch', '🍱 Bữa trưa'], ['snack', '🍎 Bữa xế']].map(([key, lbl]) => (
                        <div key={key}><label style={ls}>{lbl}</label><select style={is} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}>{mealOpts.map(o => <option key={o}>{o}</option>)}</select></div>
                    ))}
                    <div><label style={ls}>😴 Ngủ trưa (phút)</label><input type="number" min={0} max={180} step={15} style={is} value={form.napDuration} onChange={e => setForm({ ...form, napDuration: +e.target.value })} /></div>
                    <div><label style={ls}>😊 Tâm trạng</label><select style={is} value={form.mood} onChange={e => setForm({ ...form, mood: e.target.value })}>{moodOpts.map(o => <option key={o}>{o}</option>)}</select></div>
                    <div><label style={ls}>🏥 Sức khỏe</label><select style={is} value={form.health} onChange={e => setForm({ ...form, health: e.target.value })}>{['Bình thường', 'Sốt nhẹ', 'Ho', 'Đau bụng', 'Dị ứng'].map(o => <option key={o}>{o}</option>)}</select></div>
                    <div style={{ gridColumn: '1/-1' }}>
                        <label style={ls}>🎨 Hoạt động</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {actOpts.map(a => { const active = (form.activities || []).includes(a); return <button key={a} onClick={() => { const acts = form.activities || []; setForm({ ...form, activities: active ? acts.filter(x => x !== a) : [...acts, a] }) }} style={{ padding: '4px 12px', borderRadius: 20, border: `1.5px solid ${active ? '#7C3AED' : '#DDD6FE'}`, background: active ? '#EDE9FE' : '#fff', color: active ? '#7C3AED' : '#6B6494', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{a}</button> })}
                        </div>
                    </div>
                    <div style={{ gridColumn: '1/-1' }}><label style={ls}>💬 Ghi chú thêm</label><textarea style={{ ...is, resize: 'vertical', minHeight: 60 }} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Ghi chú cho phụ huynh..." /></div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 10, border: '1.5px solid #DDD6FE', background: '#fff', fontSize: 13, fontWeight: 700, color: '#6B6494', cursor: 'pointer' }}>Hủy</button>
                    <button onClick={() => onSave(form)} style={{ padding: '9px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Lưu nhật ký</button>
                </div>
            </div>
        </div>
    )
}

export default function DailyReports() {
    const [db, setDB] = useState(getDB())
    const [selDate, setSelDate] = useState(todayStr())
    const [filterClass, setFilterClass] = useState('all')
    const [editing, setEditing] = useState(null)
    const moodColors = { 'Vui vẻ': '#16A34A', 'Hào hứng': '#7C3AED', 'Bình thường': '#6B6494', 'Mệt mỏi': '#D97706', 'Buồn ngủ': '#0891B2' }
    const students = useMemo(() => { let s = db.students.filter(st => st.status === 'active'); if (filterClass !== 'all') s = s.filter(st => st.classId === filterClass); return s }, [db, filterClass])
    const reportMap = useMemo(() => { const map = {}; db.dailyReports.filter(r => r.date === selDate).forEach(r => { map[r.studentId] = r }); return map }, [db, selDate])
    const sel = { padding: '8px 12px', borderRadius: 10, border: '1.5px solid #DDD6FE', fontSize: 13, color: '#1E1B4B', background: '#fff' }
    function saveReport(studentId, data) {
        const ndb = getDB(); const idx = ndb.dailyReports.findIndex(r => r.date === selDate && r.studentId === studentId)
        const rec = { id: `dr-${selDate}-${studentId}`, studentId, date: selDate, ...data }
        if (idx >= 0) ndb.dailyReports[idx] = rec; else ndb.dailyReports.push(rec)
        commit(); setDB({ ...ndb }); setEditing(null)
    }
    return (
        <div className="admin-page-pad" style={{ padding: '28px 36px' }}>
            {editing && <EditModal student={db.students.find(s => s.id === editing)} report={reportMap[editing]} onClose={() => setEditing(null)} onSave={data => saveReport(editing, data)} />}
            <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 20, gap: 12 }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <select value={filterClass} onChange={e => setFilterClass(e.target.value)} style={sel}><option value="all">Tất cả lớp</option>{db.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                    <input type="date" value={selDate} onChange={e => setSelDate(e.target.value)} style={sel} />
                </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,320px),1fr))', gap: 14 }}>
                {students.map(s => {
                    const r = reportMap[s.id]; const cls = db.classes.find(c => c.id === s.classId)
                    return (
                        <div key={s.id} style={{ background: '#fff', borderRadius: 16, padding: '16px 18px', boxShadow: '0 2px 14px rgba(109,40,217,0.07)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 999, background: 'linear-gradient(135deg,#7C3AED,#A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14 }}>{s.initials || '?'}</div>
                                    <div><div style={{ fontWeight: 700, fontSize: 13, color: '#1E1B4B' }}>{s.name}</div><span style={{ fontSize: 10, fontWeight: 700, color: cls?.color || '#6B6494' }}>{cls?.name}</span></div>
                                </div>
                                <button onClick={() => setEditing(s.id)} style={{ padding: '5px 12px', borderRadius: 8, border: '1.5px solid #7C3AED', background: '#fff', color: '#7C3AED', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{r ? 'Sửa' : 'Ghi nhật ký'}</button>
                            </div>
                            {r ? <div className="mobile-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <ReportChip icon="🍳" label="Sáng" value={r.breakfast} />
                                <ReportChip icon="🍱" label="Trưa" value={r.lunch} />
                                <ReportChip icon="🍎" label="Xế" value={r.snack} />
                                <ReportChip icon="😴" label="Ngủ" value={r.napDuration > 0 ? `${r.napDuration} phút` : 'Không ngủ'} />
                                <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontSize: 11, color: '#6B6494', fontWeight: 700 }}>Tâm trạng:</span>
                                    <span style={{ fontSize: 12, fontWeight: 800, color: moodColors[r.mood] || '#6B6494' }}>{r.mood}</span>
                                    {r.note && <span style={{ fontSize: 11, color: '#6B6494', fontStyle: 'italic' }}>· {r.note}</span>}
                                </div>
                            </div> : <div style={{ textAlign: 'center', padding: '16px 0', color: '#7C6D9B', fontSize: 13 }}>Chưa có nhật ký hôm nay</div>}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
