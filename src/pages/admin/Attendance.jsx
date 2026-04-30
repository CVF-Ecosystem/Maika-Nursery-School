import { useState, useMemo } from 'react'
import { getDB, commit, todayStr } from '../../data/store'
import { fmtDate } from '../../utils/format'

function Avatar({ initials, size = 36 }) {
    const colors = ['#7C3AED', '#A78BFA', '#34D399', '#06B6D4', '#EC4899']
    const c = colors[(initials.charCodeAt(0) || 0) % colors.length]
    return <div style={{ width: size, height: size, borderRadius: 999, background: `linear-gradient(135deg,${c},${c}99)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: size * 0.35, flexShrink: 0 }}>{initials}</div>
}

export default function Attendance() {
    const [db, setDB] = useState(getDB())
    const [selDate, setSelDate] = useState(todayStr())
    const [filterClass, setFilterClass] = useState('all')

    const students = useMemo(() => {
        let s = db.students.filter(st => st.status === 'active')
        if (filterClass !== 'all') s = s.filter(st => st.classId === filterClass)
        return s
    }, [db, filterClass])

    const attMap = useMemo(() => {
        const map = {}
        db.attendance.filter(a => a.date === selDate).forEach(a => { map[a.studentId] = a })
        return map
    }, [db, selDate])

    function setStatus(studentId, status) {
        const ndb = getDB()
        const existIdx = ndb.attendance.findIndex(a => a.date === selDate && a.studentId === studentId)
        const rec = { id: `att-${selDate}-${studentId}`, studentId, date: selDate, status, note: '' }
        if (existIdx >= 0) ndb.attendance[existIdx] = rec; else ndb.attendance.push(rec)
        commit(); setDB({ ...ndb })
    }

    function markAll(status) {
        const ndb = getDB()
        ndb.attendance = ndb.attendance.filter(a => !(a.date === selDate && students.some(s => s.id === a.studentId)))
        students.forEach(s => ndb.attendance.push({ id: `att-${selDate}-${s.id}`, studentId: s.id, date: selDate, status, note: '' }))
        commit(); setDB({ ...ndb })
    }

    const present = students.filter(s => attMap[s.id]?.status === 'present').length
    const absent = students.filter(s => attMap[s.id]?.status === 'absent').length
    const late = students.filter(s => attMap[s.id]?.status === 'late').length
    const unmarked = students.length - (present + absent + late)
    const btn = (active, color) => ({ padding: '5px 12px', borderRadius: 8, border: `1.5px solid ${active ? color : '#DDD6FE'}`, background: active ? color : '#fff', color: active ? '#fff' : '#6B6494', fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s' })
    const sel = { padding: '8px 12px', borderRadius: 10, border: '1.5px solid #DDD6FE', fontSize: 13, color: '#1E1B4B', background: '#fff' }

    return (
        <div style={{ padding: '28px 36px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div><div style={{ fontWeight: 800, fontSize: 18, color: '#1E1B4B' }}>Điểm danh</div><div style={{ fontSize: 13, color: '#7C6D9B', marginTop: 2 }}>Ghi chép chuyên cần hàng ngày</div></div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <select value={filterClass} onChange={e => setFilterClass(e.target.value)} style={sel}><option value="all">Tất cả lớp</option>{db.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                    <input type="date" value={selDate} onChange={e => setSelDate(e.target.value)} style={sel} />
                </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
                {[['✅', 'Có mặt', present, '#16A34A', '#F0FDF4'], ['⏰', 'Đi trễ', late, '#7C3AED', '#F5F3FF'], ['❌', 'Vắng mặt', absent, '#DC2626', '#FEF2F2'], ['⬜', 'Chưa điểm danh', unmarked, '#6B6494', '#F5F5F4']].map(([icon, lbl, cnt, col, bg]) => (
                    <div key={lbl} style={{ background: bg, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 24 }}>{icon}</span>
                        <div><div style={{ fontWeight: 900, fontSize: 24, color: col, lineHeight: 1 }}>{cnt}</div><div style={{ fontSize: 12, color: col, fontWeight: 700 }}>{lbl}</div></div>
                    </div>
                ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#6B6494', fontWeight: 700 }}>Điểm danh nhanh:</span>
                <button onClick={() => markAll('present')} style={{ ...btn(false, '#16A34A'), background: '#F0FDF4', color: '#16A34A', border: '1.5px solid #16A34A' }}>✅ Điểm danh tất cả</button>
                <button onClick={() => markAll('absent')} style={{ ...btn(false, '#DC2626'), background: '#FEF2F2', color: '#DC2626', border: '1.5px solid #DC2626' }}>❌ Vắng hết</button>
            </div>
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(109,40,217,0.08)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: '#F8F7FF' }}>
                        {['Học sinh', 'Lớp', 'Trạng thái'].map(h => <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#7C6D9B', borderBottom: '1.5px solid #DDD6FE' }}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                        {students.map(s => {
                            const att = attMap[s.id]; const cls = db.classes.find(c => c.id === s.classId)
                            return (
                                <tr key={s.id} style={{ borderBottom: '1px solid #EDE9FE' }}>
                                    <td style={{ padding: '10px 16px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar initials={s.initials || '?'} size={32} /><span style={{ fontWeight: 700, fontSize: 13 }}>{s.name}</span></div></td>
                                    <td style={{ padding: '10px 16px' }}><span style={{ fontSize: 11, fontWeight: 700, color: cls?.color || '#6B6494', background: (cls?.color || '#6B6494') + '18', borderRadius: 6, padding: '2px 8px' }}>{cls?.name}</span></td>
                                    <td style={{ padding: '10px 16px' }}><div style={{ display: 'flex', gap: 8, justifyContent: 'flex-start' }}>
                                        <button onClick={() => setStatus(s.id, 'present')} style={btn(att?.status === 'present', '#16A34A')}>✅ Có mặt</button>
                                        <button onClick={() => setStatus(s.id, 'late')} style={btn(att?.status === 'late', '#7C3AED')}>⏰ Trễ</button>
                                        <button onClick={() => setStatus(s.id, 'absent')} style={btn(att?.status === 'absent', '#DC2626')}>❌ Vắng</button>
                                    </div></td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
