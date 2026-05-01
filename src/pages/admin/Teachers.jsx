import { useEffect, useRef, useState } from 'react'
import { getDB, commit, todayStr } from '../../data/store'
import { fmtDate } from '../../utils/format'
import { initialsFromName, normalizeImportDate, normalizeImportKey, pickImportValue, readObjectsFromTable } from '../../utils/tabularImport'
import { isSupabaseSession } from '../../data/backendMode'
import { listTeachers, saveTeacher as saveSupabaseTeacher } from '../../features/teachers/teacherService'

function Avatar({ initials, size = 38 }) {
    const colors = ['#7C3AED', '#A78BFA', '#34D399', '#06B6D4', '#EC4899']
    const c = colors[(initials.charCodeAt(0) || 0) % colors.length]
    return <div style={{ width: size, height: size, borderRadius: 999, background: `linear-gradient(135deg,${c},${c}99)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: size * 0.35, flexShrink: 0 }}>{initials}</div>
}

function TeacherModal({ teacher, db, facilityId = '', onClose, onSave }) {
    const [form, setForm] = useState(teacher || { facilityId, name: '', classId: '', className: '', subject: 'Giáo viên chủ nhiệm', phone: '', email: '', joinDate: todayStr(), status: 'active', initials: '', degree: '', notes: '' })
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
                    <div><label style={ls}>Phụ trách lớp</label>{db?.classes?.length ? <select style={is} value={form.classId || ''} onChange={e => hc('classId', e.target.value)}><option value="">— Không có —</option>{db.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select> : <input style={is} value={form.className || ''} onChange={e => hc('className', e.target.value)} placeholder="VD: Lớp Mầm" />}</div>
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

function normalizeStatus(value = '') {
    const text = normalizeImportKey(value)
    if (['inactive', 'nghi', 'nghilam', 'danghi', 'khoa', 'locked'].includes(text)) return 'inactive'
    return 'active'
}

async function readTeacherImportFile(file) {
    const rows = await readObjectsFromTable(file, {
        preferredSheetNames: ['giao vien', 'nhan su', 'teacher'],
        headerKeywords: ['hoten', 'tengiaovien', 'sodienthoai', 'email', 'chucvu'],
    })
    return rows.map(row => {
        const name = pickImportValue(row, ['hovaten', 'hoten', 'tengiaovien', 'giaovien', 'fullname', 'name'])
        return {
            name,
            className: pickImportValue(row, ['lop', 'phutrachlop', 'classname', 'class']),
            subject: pickImportValue(row, ['chuyenmon', 'mon', 'vaitro', 'chucvu', 'vitri', 'nhiemvu', 'subject']) || 'Giáo viên chủ nhiệm',
            phone: pickImportValue(row, ['dienthoai', 'sodienthoai', 'sdt', 'phone']),
            email: pickImportValue(row, ['email', 'mail']),
            joinDate: normalizeImportDate(pickImportValue(row, ['ngayvaolam', 'ngaybatdau', 'joindate', 'join'])),
            status: normalizeStatus(pickImportValue(row, ['trangthai', 'status'])),
            initials: pickImportValue(row, ['viettat', 'initials']) || initialsFromName(name),
            degree: pickImportValue(row, ['trinhdo', 'bangcap', 'hocvan', 'degree']),
            notes: pickImportValue(row, ['diachi', 'ghichu', 'note', 'notes']),
        }
    }).filter(item => item.name)
}

function SupabaseTeachers({ selectedFacilityId = '', facilities = [] }) {
    const [teachers, setTeachers] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [importMsg, setImportMsg] = useState('')
    const [modal, setModal] = useState(null)
    const [selected, setSelected] = useState(null)
    const fileRef = useRef(null)
    const facility = facilities.find(f => f.id === selectedFacilityId)

    async function reload() {
        if (!selectedFacilityId) {
            setTeachers([])
            setLoading(false)
            return
        }
        setLoading(true)
        setError('')
        try {
            setTeachers(await listTeachers({ facilityId: selectedFacilityId }))
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        let mounted = true
        if (mounted) reload()
        return () => { mounted = false }
    }, [selectedFacilityId])

    async function handleSave(form) {
        try {
            await saveSupabaseTeacher({ ...form, id: selected?.id, facilityId: selectedFacilityId })
            setModal(null)
            setSelected(null)
            await reload()
        } catch (err) {
            setError(err.message)
        }
    }

    async function handleImport(file) {
        if (!file || !selectedFacilityId) return
        setError('')
        setImportMsg('Đang import hồ sơ giáo viên...')
        try {
            const rows = await readTeacherImportFile(file)
            for (const row of rows) {
                const existing = teachers.find(teacher =>
                    (row.email && normalizeImportKey(teacher.email) === normalizeImportKey(row.email))
                    || (row.phone && normalizeImportKey(teacher.phone) === normalizeImportKey(row.phone))
                    || normalizeImportKey(teacher.name) === normalizeImportKey(row.name)
                )
                await saveSupabaseTeacher({ ...row, id: existing?.id || '', facilityId: selectedFacilityId })
            }
            setImportMsg(`Đã import ${rows.length} hồ sơ giáo viên.`)
            await reload()
            setTimeout(() => setImportMsg(''), 3500)
        } catch (err) {
            setImportMsg('')
            setError(err.message || 'Không import được file giáo viên.')
        }
    }

    return (
        <div className="admin-page-pad" style={{ padding: '28px 36px' }}>
            <input ref={fileRef} type="file" accept=".xls,.xlsx,.csv" style={{ display: 'none' }} onChange={e => { handleImport(e.target.files?.[0]); e.target.value = '' }} />
            {modal === 'add' && <TeacherModal db={{ classes: [] }} facilityId={selectedFacilityId} onClose={() => setModal(null)} onSave={handleSave} />}
            {modal === 'edit' && <TeacherModal teacher={selected} db={{ classes: [] }} facilityId={selectedFacilityId} onClose={() => { setModal(null); setSelected(null) }} onSave={handleSave} />}
            <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12 }}>
                <div style={{ fontSize: 13, color: '#7C6D9B', fontWeight: 800 }}>{facility ? `${facility.code} - ${facility.name}` : 'Chưa chọn cơ sở'}</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {importMsg && <span style={{ fontSize: 13, fontWeight: 800, color: '#059669', background: '#ECFDF5', borderRadius: 8, padding: '7px 12px' }}>{importMsg}</span>}
                    <button onClick={() => fileRef.current?.click()} style={{ padding: '10px 18px', borderRadius: 12, border: '1.5px solid #DDD6FE', background: '#fff', color: '#7C3AED', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>📥 Import Excel/CSV</button>
                    <button onClick={() => { setSelected(null); setModal('add') }} style={{ padding: '10px 22px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 14px rgba(109,40,217,0.35)' }}>+ Thêm giáo viên</button>
                </div>
            </div>
            {error && <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 10, background: '#FEF2F2', color: '#DC2626', fontSize: 13, fontWeight: 800 }}>{error}</div>}
            {loading ? (
                <div style={{ background: '#fff', borderRadius: 16, padding: 36, textAlign: 'center', color: '#7C6D9B', fontWeight: 800 }}>Đang tải giáo viên...</div>
            ) : teachers.length === 0 ? (
                <div style={{ background: '#fff', borderRadius: 16, padding: 42, textAlign: 'center', color: '#7C6D9B', boxShadow: '0 2px 16px rgba(109,40,217,0.08)' }}>
                    <div style={{ fontWeight: 800, color: '#1E1B4B', marginBottom: 6 }}>Chưa có giáo viên trong cơ sở này</div>
                    <div style={{ fontSize: 13 }}>Bạn có thể thêm thủ công tại đây hoặc import hồ sơ giáo viên sau.</div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,300px),1fr))', gap: 18 }}>
                    {teachers.map(teacher => (
                        <div key={teacher.id} style={{ background: '#fff', borderRadius: 20, padding: '22px 24px', boxShadow: '0 2px 16px rgba(109,40,217,0.08)', border: '1.5px solid #EDE9FE' }}>
                            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
                                <Avatar initials={teacher.initials || initialsFromName(teacher.name || teacher.email)} size={50} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 800, fontSize: 15, color: '#1E1B4B' }}>{teacher.name || 'Chưa đặt tên'}</div>
                                    <div style={{ fontSize: 13, color: '#7C6D9B', marginTop: 2 }}>{teacher.subject}</div>
                                    {teacher.className && <span style={{ fontSize: 11, fontWeight: 800, color: '#7C3AED', background: '#EDE9FE', borderRadius: 6, padding: '2px 8px', display: 'inline-block', marginTop: 6 }}>{teacher.className}</span>}
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 800, color: teacher.status === 'active' ? '#16A34A' : '#DC2626', background: teacher.status === 'active' ? '#F0FDF4' : '#FEF2F2', borderRadius: 6, padding: '3px 8px' }}>{teacher.status === 'active' ? 'Đang làm' : 'Đã nghỉ'}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                <div style={{ fontSize: 13, color: '#6B6494' }}>📞 {teacher.phone || '—'}</div>
                                <div style={{ fontSize: 13, color: '#6B6494' }}>✉️ {teacher.email || '—'}</div>
                                <div style={{ fontSize: 13, color: '#6B6494' }}>🎓 {teacher.degree || '—'}</div>
                                <div style={{ fontSize: 13, color: '#6B6494' }}>📅 Vào làm: {teacher.joinDate ? fmtDate(teacher.joinDate) : '—'}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                                <button onClick={() => { setSelected(teacher); setModal('edit') }} style={{ flex: 1, padding: '8px', borderRadius: 10, border: '1.5px solid #7C3AED', background: '#fff', color: '#7C3AED', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>✏️ Chỉnh sửa</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default function Teachers(props) {
    if (isSupabaseSession()) return <SupabaseTeachers {...props} />

    const [db, setDB] = useState(getDB())
    const [modal, setModal] = useState(null)
    const [selected, setSelected] = useState(null)
    const [importMsg, setImportMsg] = useState('')
    const fileRef = useRef(null)

    function saveTeacher(form) {
        const ndb = getDB()
        if (selected) { const idx = ndb.teachers.findIndex(t => t.id === selected.id); ndb.teachers[idx] = { ...selected, ...form } }
        else ndb.teachers.push({ ...form, id: 't' + Date.now() })
        commit(); setDB({ ...ndb }); setModal(null); setSelected(null)
    }

    async function handleImport(file) {
        if (!file) return
        try {
            const rows = await readTeacherImportFile(file)
            const ndb = getDB()
            rows.forEach(row => {
                const classMatch = ndb.classes.find(c => normalizeImportKey(c.name) === normalizeImportKey(row.className))
                const existingIndex = ndb.teachers.findIndex(t =>
                    (row.email && normalizeImportKey(t.email) === normalizeImportKey(row.email))
                    || (row.phone && normalizeImportKey(t.phone) === normalizeImportKey(row.phone))
                    || normalizeImportKey(t.name) === normalizeImportKey(row.name)
                )
                const record = { ...row, classId: classMatch?.id || '', id: existingIndex >= 0 ? ndb.teachers[existingIndex].id : 't' + Date.now() + Math.random() }
                if (existingIndex >= 0) ndb.teachers[existingIndex] = { ...ndb.teachers[existingIndex], ...record }
                else ndb.teachers.push(record)
            })
            commit()
            setDB({ ...ndb })
            setImportMsg(`Đã import ${rows.length} hồ sơ giáo viên.`)
            setTimeout(() => setImportMsg(''), 3500)
        } catch {
            setImportMsg('Không import được file giáo viên.')
            setTimeout(() => setImportMsg(''), 3500)
        }
    }

    return (
        <div className="admin-page-pad" style={{ padding: '28px 36px' }}>
            <input ref={fileRef} type="file" accept=".xls,.xlsx,.csv" style={{ display: 'none' }} onChange={e => { handleImport(e.target.files?.[0]); e.target.value = '' }} />
            {modal === 'add' && <TeacherModal db={db} onClose={() => setModal(null)} onSave={saveTeacher} />}
            {modal === 'edit' && <TeacherModal teacher={selected} db={db} onClose={() => { setModal(null); setSelected(null) }} onSave={saveTeacher} />}
            <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 24, gap: 12 }}>
                {importMsg && <span style={{ fontSize: 13, fontWeight: 800, color: importMsg.startsWith('Không') ? '#DC2626' : '#059669', background: importMsg.startsWith('Không') ? '#FEF2F2' : '#ECFDF5', borderRadius: 8, padding: '7px 12px' }}>{importMsg}</span>}
                <button onClick={() => fileRef.current?.click()} style={{ padding: '10px 18px', borderRadius: 12, border: '1.5px solid #DDD6FE', background: '#fff', color: '#7C3AED', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>📥 Import Excel/CSV</button>
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
