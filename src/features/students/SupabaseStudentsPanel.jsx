import { useEffect, useMemo, useRef, useState } from 'react'
import { getCurrentProfile } from '../auth/authService'
import { listFacilities } from '../facilities/facilityService'
import { listStudents, markStudentInactive, saveStudent } from './studentService'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import { normalizeImportDate, normalizeImportKey, pickImportValue, readObjectsFromTable } from '../../utils/tabularImport'

const emptyForm = {
    id: '',
    facilityId: '',
    name: '',
    dob: '',
    gender: 'unknown',
    className: '',
    parentName: '',
    parentPhone: '',
    parentEmail: '',
    status: 'active',
    notes: '',
}

function StudentEditor({ form, facilities, classOptions, canEdit, onChange, onCancel, onSave }) {
    const is = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #DDD6FE', fontSize: 13, color: '#1E1B4B', boxSizing: 'border-box' }
    const ls = { fontSize: 12, fontWeight: 800, color: '#6B6494', display: 'block', marginBottom: 4 }
    const set = (key, value) => onChange({ ...form, [key]: value })
    return (
        <div style={{ background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 14px rgba(109,40,217,0.08)', marginBottom: 16 }}>
            <div style={{ fontWeight: 900, color: '#1E1B4B', marginBottom: 14 }}>{form.id ? 'Sửa học sinh' : 'Thêm học sinh'}</div>
            <div className="mobile-two-col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <div><label style={ls}>Cơ sở</label><select disabled={!canEdit} style={is} value={form.facilityId} onChange={e => set('facilityId', e.target.value)}>{facilities.map(f => <option key={f.id} value={f.id}>{f.code} - {f.name}</option>)}</select></div>
                <div><label style={ls}>Họ tên *</label><input disabled={!canEdit} style={is} value={form.name} onChange={e => set('name', e.target.value)} /></div>
                <div>
                    <label style={ls}>Lớp</label>
                    <input disabled={!canEdit} list="student-class-options" style={is} value={form.className} onChange={e => set('className', e.target.value)} />
                    <datalist id="student-class-options">{classOptions.map(name => <option key={name} value={name} />)}</datalist>
                </div>
                <div><label style={ls}>Ngày sinh</label><input disabled={!canEdit} type="date" style={is} value={form.dob} onChange={e => set('dob', e.target.value)} /></div>
                <div><label style={ls}>Giới tính</label><select disabled={!canEdit} style={is} value={form.gender} onChange={e => set('gender', e.target.value)}><option value="unknown">Chưa rõ</option><option value="male">Nam</option><option value="female">Nữ</option></select></div>
                <div><label style={ls}>Trạng thái</label><select disabled={!canEdit} style={is} value={form.status} onChange={e => set('status', e.target.value)}><option value="active">Đang học</option><option value="inactive">Nghỉ học</option></select></div>
                <div><label style={ls}>Phụ huynh</label><input disabled={!canEdit} style={is} value={form.parentName} onChange={e => set('parentName', e.target.value)} /></div>
                <div><label style={ls}>Số điện thoại</label><input disabled={!canEdit} style={is} value={form.parentPhone} onChange={e => set('parentPhone', e.target.value)} /></div>
                <div><label style={ls}>Email</label><input disabled={!canEdit} style={is} value={form.parentEmail} onChange={e => set('parentEmail', e.target.value)} /></div>
                <div style={{ gridColumn: '1/-1' }}><label style={ls}>Ghi chú</label><textarea disabled={!canEdit} style={{ ...is, minHeight: 62, resize: 'vertical' }} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                <button onClick={onCancel} style={{ padding: '9px 16px', borderRadius: 10, border: '1.5px solid #DDD6FE', background: '#fff', color: '#6B6494', fontWeight: 800 }}>Hủy</button>
                {canEdit && <button onClick={onSave} disabled={!form.name || !form.facilityId} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)', color: '#fff', fontWeight: 900 }}>Lưu</button>}
            </div>
        </div>
    )
}

function normalizeGender(value = '') {
    const text = normalizeImportKey(value)
    if (['nam', 'male', 'm', 'boy', 'trai'].includes(text)) return 'male'
    if (['nu', 'female', 'f', 'girl', 'gai'].includes(text)) return 'female'
    return 'unknown'
}

function normalizeStudentStatus(value = '') {
    const text = normalizeImportKey(value)
    if (['inactive', 'nghi', 'nghihoc', 'danghi', 'thoi', 'thoihoc'].includes(text)) return 'inactive'
    return 'active'
}

async function readStudentImportFile(file, facilityId) {
    const rows = await readObjectsFromTable(file)
    return rows.map(row => {
        const name = pickImportValue(row, ['hoten', 'hotentre', 'tenhocsinh', 'tenhocvien', 'tenbe', 'hocsinh', 'fullname', 'name'])
        return {
            facilityId,
            name,
            dob: normalizeImportDate(pickImportValue(row, ['ngaysinh', 'dob', 'birthday', 'dateofbirth'])),
            gender: normalizeGender(pickImportValue(row, ['gioitinh', 'gender', 'sex'])),
            className: pickImportValue(row, ['lop', 'tenlop', 'class', 'classname']),
            parentName: pickImportValue(row, ['phuhuynh', 'tenphuhuynh', 'hotenphuhuynh', 'cha', 'me', 'bo', 'parent', 'parentname']),
            parentPhone: pickImportValue(row, ['sdt', 'sodienthoai', 'dienthoai', 'sdtphuhuynh', 'phone', 'parentphone']),
            parentEmail: pickImportValue(row, ['email', 'emailphuhuynh', 'parentemail']),
            status: normalizeStudentStatus(pickImportValue(row, ['trangthai', 'status'])),
            notes: pickImportValue(row, ['ghichu', 'note', 'notes']),
        }
    }).filter(item => item.name)
}

export default function SupabaseStudentsPanel({ selectedFacilityId = '', facilities: scopedFacilities = [] }) {
    const [profile, setProfile] = useState(null)
    const [facilities, setFacilities] = useState([])
    const [students, setStudents] = useState([])
    const [facilityId, setFacilityId] = useState('')
    const [query, setQuery] = useState('')
    const [form, setForm] = useState(null)
    const [status, setStatus] = useState('active')
    const [loading, setLoading] = useState(true)
    const [err, setErr] = useState('')
    const [importMsg, setImportMsg] = useState('')
    const fileRef = useRef(null)

    const canEdit = profile?.role === 'admin'
    const visibleStudents = useMemo(() => students.filter(student => {
        const text = `${student.name} ${student.parentName} ${student.parentPhone} ${student.className}`.toLowerCase()
        return !query || text.includes(query.toLowerCase())
    }), [students, query])
    const classOptions = useMemo(() => {
        const names = new Set(['Nhà Trẻ', 'Lớp Mầm', 'Lớp Chồi', 'Lớp Lá'])
        students.forEach(student => { if (student.className) names.add(student.className) })
        return [...names].sort((a, b) => a.localeCompare(b, 'vi'))
    }, [students])

    async function loadBase() {
        setErr('')
        setLoading(true)
        try {
            const [p, fs] = await Promise.all([
                getCurrentProfile(),
                scopedFacilities.length ? Promise.resolve(scopedFacilities) : listFacilities(),
            ])
            setProfile(p)
            setFacilities(fs)
            const nextFacility = p?.role === 'teacher' ? p.facility_id : (selectedFacilityId || facilityId || fs[0]?.id || '')
            setFacilityId(nextFacility)
            const items = await listStudents({ facilityId: nextFacility, status })
            setStudents(items)
        } catch (ex) {
            setErr(ex.message)
        } finally {
            setLoading(false)
        }
    }

    async function reload(nextFacility = facilityId, nextStatus = status) {
        if (!nextFacility) return
        setErr('')
        try {
            setStudents(await listStudents({ facilityId: nextFacility, status: nextStatus === 'all' ? undefined : nextStatus }))
        } catch (ex) { setErr(ex.message) }
    }

    useEffect(() => { if (isSupabaseConfigured) loadBase(); else setLoading(false) }, [])

    useEffect(() => {
        if (!selectedFacilityId || profile?.role === 'teacher') return
        setFacilityId(selectedFacilityId)
        reload(selectedFacilityId, status)
    }, [selectedFacilityId])

    async function handleImport(file) {
        if (!file || !facilityId) return
        setErr('')
        setImportMsg('Đang import học sinh...')
        try {
            const rows = await readStudentImportFile(file, facilityId)
            for (const row of rows) {
                const existing = students.find(student =>
                    normalizeImportKey(student.name) === normalizeImportKey(row.name)
                    && (!row.dob || !student.dob || student.dob === row.dob)
                    && (!row.parentPhone || !student.parentPhone || student.parentPhone === row.parentPhone)
                )
                await saveStudent({ ...row, id: existing?.id || '' })
            }
            setImportMsg(`Đã import ${rows.length} học sinh.`)
            await reload(facilityId, status)
            setTimeout(() => setImportMsg(''), 3500)
        } catch (ex) {
            setImportMsg('')
            setErr(ex.message || 'Không import được file học sinh.')
        }
    }

    if (!isSupabaseConfigured) return <div style={{ padding: 28, color: '#7C6D9B', fontWeight: 800 }}>Hệ thống dữ liệu chưa sẵn sàng.</div>
    if (loading) return <div style={{ padding: 28, color: '#7C6D9B', fontWeight: 800 }}>Đang tải danh sách học sinh...</div>
    if (!profile) return <div style={{ padding: 28, color: '#DC2626', fontWeight: 800 }}>Vui lòng đăng nhập để xem danh sách học sinh.</div>

    return (
        <div className="admin-page-pad" style={{ padding: '28px 36px' }}>
            <input ref={fileRef} type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={e => { handleImport(e.target.files?.[0]); e.target.value = '' }} />
            <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, alignItems: 'center', marginBottom: 18 }}>
                {importMsg && <span style={{ fontSize: 13, fontWeight: 800, color: '#059669', background: '#ECFDF5', borderRadius: 8, padding: '7px 12px' }}>{importMsg}</span>}
                {canEdit && <button onClick={() => fileRef.current?.click()} style={{ padding: '10px 18px', borderRadius: 12, border: '1.5px solid #DDD6FE', background: '#fff', color: '#7C3AED', fontWeight: 900 }}>📥 Import Excel/CSV</button>}
                {canEdit && <button onClick={() => setForm({ ...emptyForm, facilityId: facilityId || facilities[0]?.id || '' })} style={{ padding: '10px 18px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)', color: '#fff', fontWeight: 900 }}>+ Thêm học sinh</button>}
            </div>
            {err && <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 10, background: '#FEF2F2', color: '#DC2626', fontWeight: 800, fontSize: 13 }}>{err}</div>}
            {form && <StudentEditor form={form} facilities={facilities} classOptions={classOptions} canEdit={canEdit} onChange={setForm} onCancel={() => setForm(null)} onSave={async () => { await saveStudent(form); setForm(null); reload() }} />}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm học sinh, phụ huynh, lớp..." style={{ flex: 1, minWidth: 220, padding: '9px 14px', borderRadius: 10, border: '1.5px solid #DDD6FE' }} />
                <select value={status} onChange={e => { setStatus(e.target.value); reload(facilityId, e.target.value) }} style={{ padding: '9px 14px', borderRadius: 10, border: '1.5px solid #DDD6FE' }}><option value="active">Đang học</option><option value="inactive">Nghỉ học</option><option value="all">Tất cả</option></select>
            </div>
            <div className="mobile-scroll-table" style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 16px rgba(109,40,217,0.08)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: '#F8F7FF' }}>{['Học sinh', 'Lớp', 'Ngày sinh', 'Phụ huynh', 'Liên hệ', 'Trạng thái', ''].map(h => <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, color: '#7C6D9B' }}>{h}</th>)}</tr></thead>
                    <tbody>{visibleStudents.map(student => (
                        <tr key={student.id} style={{ borderTop: '1px solid #EDE9FE' }}>
                            <td style={{ padding: '12px 14px', fontWeight: 800 }}>{student.name}</td>
                            <td style={{ padding: '12px 14px', color: '#6B6494' }}>{student.className || '—'}</td>
                            <td style={{ padding: '12px 14px', color: '#6B6494' }}>{student.dob || '—'}</td>
                            <td style={{ padding: '12px 14px' }}>{student.parentName || '—'}</td>
                            <td style={{ padding: '12px 14px', color: '#6B6494' }}>{student.parentPhone || student.parentEmail || '—'}</td>
                            <td style={{ padding: '12px 14px' }}>{student.status === 'active' ? 'Đang học' : 'Nghỉ học'}</td>
                            <td style={{ padding: '12px 14px' }}>{canEdit && <div style={{ display: 'flex', gap: 6 }}><button onClick={() => setForm(student)} style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #7C3AED', background: '#fff', color: '#7C3AED', fontWeight: 800 }}>Sửa</button><button onClick={async () => { await markStudentInactive(student.id); reload() }} style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #DC2626', background: '#fff', color: '#DC2626', fontWeight: 800 }}>Nghỉ</button></div>}</td>
                        </tr>
                    ))}</tbody>
                </table>
                {visibleStudents.length === 0 && <div style={{ padding: 36, textAlign: 'center', color: '#7C6D9B' }}>Chưa có học sinh trong bộ lọc này</div>}
            </div>
        </div>
    )
}
