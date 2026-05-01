import { useState, useMemo, useRef } from 'react'
import { getDB, commit, todayStr } from '../../data/store'
import { fmtDate } from '../../utils/format'
import { sanitizeText } from '../../utils/security'
import { isSupabaseSession } from '../../data/backendMode'
import SupabaseStudentsPanel from '../../features/students/SupabaseStudentsPanel'

function Avatar({ initials, size = 38 }) {
    const colors = ['#7C3AED', '#A78BFA', '#34D399', '#06B6D4', '#EC4899']
    const c = colors[(initials.charCodeAt(0) || 0) % colors.length]
    return <div style={{ width: size, height: size, borderRadius: 999, background: `linear-gradient(135deg,${c},${c}99)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: size * 0.35, flexShrink: 0 }}>{initials}</div>
}

function Badge({ status }) {
    const map = { active: ['#16A34A', '#F0FDF4', 'Đang học'], inactive: ['#DC2626', '#FEF2F2', 'Nghỉ học'] }
    const [col, bg, label] = map[status] || ['#6B6494', '#F5F5F4', 'Không rõ']
    return <span style={{ background: bg, color: col, borderRadius: 6, fontSize: 11, fontWeight: 700, padding: '2px 8px' }}>{label}</span>
}

function InfoRow({ label, value }) {
    return <div style={{ background: '#F8F7FF', borderRadius: 8, padding: '8px 12px' }}><div style={{ fontSize: 10, fontWeight: 700, color: '#7C6D9B', marginBottom: 2 }}>{label.toUpperCase()}</div><div style={{ fontSize: 13, fontWeight: 600, color: '#1E1B4B' }}>{value || '—'}</div></div>
}

function exportCSV(students, classes) {
    const headers = ['Họ tên', 'Ngày sinh', 'Lớp', 'Giới tính', 'Phụ huynh', 'Điện thoại', 'Email PH', 'Ngày nhập học', 'Trạng thái']
    const genderLabel = gender => gender === 'male' ? 'Nam' : gender === 'female' ? 'Nữ' : ''
    const rows = students.map(s => { const cls = classes.find(c => c.id === s.classId); return [s.name, s.dob, cls?.name || '', genderLabel(s.gender), s.parentName, s.parentPhone, s.parentEmail, s.enrollDate, s.status === 'active' ? 'Đang học' : 'Nghỉ học'] })
    const csv = [headers, ...rows].map(r => r.map(v => `"${(v || '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'maika-hoc-sinh.csv'
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
}

function StudentModal({ student, db, onClose, onSave }) {
    const [form, setForm] = useState(student || { name: '', dob: '', classId: 'c1', gender: 'unknown', parentName: '', parentPhone: '', parentEmail: '', enrollDate: todayStr(), status: 'active', initials: '' })
    const is = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #DDD6FE', fontSize: 13, color: '#1E1B4B', boxSizing: 'border-box' }
    const ls = { fontSize: 12, fontWeight: 700, color: '#6B6494', display: 'block', marginBottom: 4 }
    function hc(k, v) { const u = { ...form, [k]: v }; if (k === 'name') u.initials = v.split(' ').filter(Boolean).slice(-2).map(w => w[0].toUpperCase()).join(''); setForm(u) }
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{ background: '#fff', borderRadius: 20, width: 'min(540px, calc(100vw - 24px))', maxHeight: '90vh', overflowY: 'auto', padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                <div style={{ fontWeight: 800, fontSize: 17, color: '#1E1B4B', marginBottom: 20 }}>{student ? 'Chỉnh sửa học sinh' : 'Thêm học sinh mới'}</div>
                <div className="mobile-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div style={{ gridColumn: '1/-1' }}><label style={ls} htmlFor="student-name">Họ và tên *</label><input id="student-name" style={is} value={form.name} onChange={e => hc('name', e.target.value)} placeholder="VD: Nguyễn Minh An" /></div>
                    <div><label style={ls} htmlFor="student-dob">Ngày sinh *</label><input id="student-dob" type="date" style={is} value={form.dob} onChange={e => hc('dob', e.target.value)} /></div>
                    <div><label style={ls}>Giới tính</label><select style={is} value={form.gender} onChange={e => hc('gender', e.target.value)}><option value="unknown">Chưa rõ</option><option value="male">Nam</option><option value="female">Nữ</option></select></div>
                    <div><label style={ls}>Lớp *</label><select style={is} value={form.classId} onChange={e => hc('classId', e.target.value)}>{db.classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.ageGroup})</option>)}</select></div>
                    <div><label style={ls}>Ngày nhập học</label><input type="date" style={is} value={form.enrollDate} onChange={e => hc('enrollDate', e.target.value)} /></div>
                    <div style={{ gridColumn: '1/-1', background: '#FFF7ED', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#7C3AED', marginBottom: 10 }}>Thông tin phụ huynh</div>
                        <div className="mobile-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div style={{ gridColumn: '1/-1' }}><label style={ls} htmlFor="student-parent-name">Tên phụ huynh *</label><input id="student-parent-name" style={is} value={form.parentName} onChange={e => hc('parentName', e.target.value)} /></div>
                            <div><label style={ls} htmlFor="student-parent-phone">Số điện thoại</label><input id="student-parent-phone" style={is} value={form.parentPhone} onChange={e => hc('parentPhone', e.target.value)} /></div>
                            <div><label style={ls} htmlFor="student-parent-email">Email</label><input id="student-parent-email" style={is} value={form.parentEmail} onChange={e => hc('parentEmail', e.target.value)} /></div>
                        </div>
                    </div>
                    <div><label style={ls}>Trạng thái</label><select style={is} value={form.status} onChange={e => hc('status', e.target.value)}><option value="active">Đang học</option><option value="inactive">Nghỉ học</option></select></div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 10, border: '1.5px solid #DDD6FE', background: '#fff', fontSize: 13, fontWeight: 700, color: '#6B6494', cursor: 'pointer' }}>Hủy</button>
                    <button onClick={() => onSave(form)} style={{ padding: '9px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(90deg,#7C3AED,#A78BFA)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Lưu</button>
                </div>
            </div>
        </div>
    )
}

export default function Students(props) {
    if (isSupabaseSession()) return <SupabaseStudentsPanel {...props} />

    const [db, setDB] = useState(getDB())
    const [search, setSearch] = useState('')
    const [filterClass, setFilterClass] = useState('all')
    const [filterStatus, setFilterStatus] = useState('all')
    const [modal, setModal] = useState(null)
    const [selected, setSelected] = useState(null)
    const [importMsg, setImportMsg] = useState('')
    const fileRef = useRef()

    const filtered = useMemo(() => db.students.filter(s => {
        if (filterClass !== 'all' && s.classId !== filterClass) return false
        if (filterStatus !== 'all' && s.status !== filterStatus) return false
        if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !(s.parentName || '').toLowerCase().includes(search.toLowerCase())) return false
        return true
    }), [db, search, filterClass, filterStatus])

    function saveStudent(form) {
        const ndb = getDB()
        if (selected) { const idx = ndb.students.findIndex(s => s.id === selected.id); ndb.students[idx] = { ...selected, ...form } }
        else ndb.students.push({ ...form, id: 's' + Date.now() })
        commit(); setDB({ ...ndb }); setModal(null); setSelected(null)
    }

    function deleteStudent(id) {
        const ndb = getDB(); ndb.students = ndb.students.filter(s => s.id !== id)
        commit(); setDB({ ...ndb }); setModal(null); setSelected(null)
    }

    const sel = { padding: '9px 14px', borderRadius: 10, border: '1.5px solid #DDD6FE', fontSize: 13, color: '#1E1B4B', background: '#fff' }

    return (
        <div className="admin-page-pad" style={{ padding: '28px 36px' }}>
            {modal === 'add' && <StudentModal db={db} onClose={() => setModal(null)} onSave={saveStudent} />}
            {modal === 'edit' && <StudentModal student={selected} db={db} onClose={() => { setModal(null); setSelected(null) }} onSave={saveStudent} />}
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => {
                const file = e.target.files[0]; if (!file) return
                const reader = new FileReader()
                reader.onload = ev => {
                    try {
                        const lines = ev.target.result.trim().split('\n').slice(1)
                        const imported = lines.map(line => {
                            const cols = line.split(',').map(v => v.replace(/^"|"$/g, '').trim())
                            const [name, dob, , gender, parentName, parentPhone, parentEmail, enrollDate] = cols
                            const safeName = sanitizeText(name)
                            const initials = safeName.split(' ').filter(Boolean).slice(-2).map(w => w[0].toUpperCase()).join('')
                            return { id: 's' + Date.now() + Math.random(), name: safeName, dob: sanitizeText(dob), classId: 'c1', gender: gender === 'Nam' ? 'male' : 'female', parentName: sanitizeText(parentName), parentPhone: sanitizeText(parentPhone), parentEmail: sanitizeText(parentEmail), enrollDate: sanitizeText(enrollDate) || todayStr(), status: 'active', initials }
                        }).filter(s => s.name)
                        const ndb = getDB(); ndb.students = [...ndb.students, ...imported]; commit(); setDB({ ...ndb })
                        setImportMsg(`✅ Đã import ${imported.length} học sinh!`); setTimeout(() => setImportMsg(''), 3000)
                    } catch { setImportMsg('❌ File không đúng định dạng'); setTimeout(() => setImportMsg(''), 3000) }
                }
                reader.readAsText(file, 'UTF-8'); e.target.value = ''
            }} />

            <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 20, gap: 12 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    {importMsg && <span style={{ fontSize: 13, fontWeight: 700, color: '#059669', background: '#ECFDF5', borderRadius: 8, padding: '6px 12px' }}>{importMsg}</span>}
                    <button onClick={() => fileRef.current?.click()} style={{ padding: '10px 18px', borderRadius: 12, border: '1.5px solid #DDD6FE', background: '#fff', color: '#7C3AED', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>📥 Import CSV</button>
                    <button onClick={() => exportCSV(filtered, db.classes)} style={{ padding: '10px 18px', borderRadius: 12, border: '1.5px solid #DDD6FE', background: '#fff', color: '#7C3AED', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>📤 Export CSV</button>
                    <button onClick={() => { setSelected(null); setModal('add') }} style={{ padding: '10px 22px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 14px rgba(109,40,217,0.35)' }}>+ Thêm học sinh</button>
                </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Tìm học sinh hoặc phụ huynh..." style={{ ...sel, flex: 1, minWidth: 200 }} />
                <select value={filterClass} onChange={e => setFilterClass(e.target.value)} style={sel}><option value="all">Tất cả lớp</option>{db.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={sel}><option value="all">Tất cả</option><option value="active">Đang học</option><option value="inactive">Nghỉ học</option></select>
            </div>
            <div className="mobile-scroll-table" style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(109,40,217,0.08)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: '#F8F7FF' }}>{['Học sinh', 'Lớp', 'Ngày sinh', 'Phụ huynh', 'Điện thoại', 'Trạng thái', ''].map(h => <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#7C6D9B', borderBottom: '1.5px solid #DDD6FE' }}>{h}</th>)}</tr></thead>
                    <tbody>
                        {filtered.map(s => {
                            const cls = db.classes.find(c => c.id === s.classId)
                            return (
                                <tr key={s.id} style={{ borderBottom: '1px solid #EDE9FE' }} onMouseEnter={e => e.currentTarget.style.background = '#F8F7FF'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                                    <td style={{ padding: '12px 16px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar initials={s.initials || '?'} size={32} /><span style={{ fontWeight: 700, fontSize: 13 }}>{s.name}</span></div></td>
                                    <td style={{ padding: '12px 16px' }}><span style={{ fontSize: 12, fontWeight: 700, color: cls?.color || '#6B6494', background: (cls?.color || '#6B6494') + '18', borderRadius: 6, padding: '2px 8px' }}>{cls?.name || '—'}</span></td>
                                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B6494' }}>{fmtDate(s.dob)}</td>
                                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600 }}>{s.parentName}</td>
                                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B6494' }}>{s.parentPhone}</td>
                                    <td style={{ padding: '12px 16px' }}><Badge status={s.status} /></td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button onClick={() => { setSelected(s); setModal('edit') }} style={{ padding: '5px 12px', borderRadius: 8, border: '1.5px solid #7C3AED', background: '#fff', color: '#7C3AED', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Sửa</button>
                                            <button onClick={() => { if (confirm('Xóa học sinh này?')) deleteStudent(s.id) }} style={{ padding: '5px 12px', borderRadius: 8, border: '1.5px solid #DC2626', background: '#fff', color: '#DC2626', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Xóa</button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
                {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: '#7C6D9B', fontSize: 14 }}>Không tìm thấy học sinh nào</div>}
            </div>
        </div>
    )
}
