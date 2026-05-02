import { useEffect, useRef, useState, useMemo } from 'react'
import { getDB, commit, todayStr } from '../../data/store'
import { fmtDate } from '../../utils/format'
import { isSupabaseSession } from '../../data/backendMode'
import { getCurrentProfile } from '../../features/auth/authService'
import { listStudents } from '../../features/students/studentService'
import { listDailyReportsByFacilityDate, saveDailyReport, subscribeDailyReports } from '../../features/reports/dailyReportService'
import { getSignedUrl, uploadReportPhoto } from '../../features/media/mediaService'
import { cacheTeacherData, enqueueOfflineAction, isOnline, readCachedTeacherData, syncOfflineQueue } from '../../features/offline/offlineSyncService'

function Avatar({ initials, size = 36 }) {
    const colors = ['#7C3AED', '#A78BFA', '#34D399', '#06B6D4', '#EC4899']
    const c = colors[(initials.charCodeAt(0) || 0) % colors.length]
    return <div style={{ width: size, height: size, borderRadius: 999, background: `linear-gradient(135deg,${c},${c}99)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: size * 0.35, flexShrink: 0 }}>{initials}</div>
}

function ReportChip({ icon, label, value }) {
    return <div style={{ background: '#F8F7FF', borderRadius: 8, padding: '6px 10px' }}><div style={{ fontSize: 10, color: '#7C6D9B', fontWeight: 700 }}>{icon} {label}</div><div style={{ fontSize: 12, fontWeight: 700, color: '#1E1B4B', marginTop: 1 }}>{value || '—'}</div></div>
}

function EditModal({ student, report, onClose, onSave, showPhotos = false }) {
    const mealOpts = ['Ăn hết suất', 'Ăn được 3/4', 'Ăn được 1/2', 'Ăn ít', 'Không ăn']
    const moodOpts = ['Vui vẻ', 'Hào hứng', 'Bình thường', 'Mệt mỏi', 'Buồn ngủ', 'Khó chịu']
    const actOpts = ['Vẽ tranh', 'Đọc sách', 'Hát nhạc', 'Vận động', 'Kể chuyện', 'Chơi cát', 'Làm thủ công']
    const [form, setForm] = useState(report || { breakfast: 'Ăn hết suất', lunch: 'Ăn hết suất', snack: 'Ăn hết suất', napDuration: 90, mood: 'Vui vẻ', activities: [], note: '', health: 'Bình thường' })
    const [existingPaths, setExistingPaths] = useState(report?.photoPaths || [])
    const [existingUrls, setExistingUrls] = useState([])
    const [photoFiles, setPhotoFiles] = useState([])
    const [photoPreviews, setPhotoPreviews] = useState([])
    const fileRef = useRef()
    const is = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #DDD6FE', fontSize: 13, color: '#1E1B4B', boxSizing: 'border-box' }
    const ls = { fontSize: 12, fontWeight: 700, color: '#6B6494', display: 'block', marginBottom: 4 }

    useEffect(() => {
        if (!showPhotos || !existingPaths.length) return
        Promise.all(existingPaths.map(p => getSignedUrl(p).catch(() => ''))).then(setExistingUrls)
    }, [showPhotos, existingPaths.join(',')])

    function handlePhotoSelect(e) {
        const files = Array.from(e.target.files || [])
        const remaining = 3 - existingPaths.length - photoFiles.length
        const newFiles = files.slice(0, Math.max(0, remaining))
        if (!newFiles.length) return
        setPhotoFiles(prev => [...prev, ...newFiles])
        setPhotoPreviews(prev => [...prev, ...newFiles.map(f => URL.createObjectURL(f))])
        e.target.value = ''
    }

    function removeExisting(i) {
        setExistingPaths(prev => prev.filter((_, idx) => idx !== i))
        setExistingUrls(prev => prev.filter((_, idx) => idx !== i))
    }

    function removeNew(i) {
        URL.revokeObjectURL(photoPreviews[i])
        setPhotoFiles(prev => prev.filter((_, idx) => idx !== i))
        setPhotoPreviews(prev => prev.filter((_, idx) => idx !== i))
    }

    const totalPhotos = existingPaths.length + photoFiles.length

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
                    {showPhotos && (
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={ls}>📷 Ảnh minh họa (tối đa 3)</label>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                                {existingUrls.map((url, i) => url ? (
                                    <div key={`e${i}`} style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
                                        <img src={url} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1.5px solid #DDD6FE' }} />
                                        <button onClick={() => removeExisting(i)} aria-label="Xóa ảnh" style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 999, border: 'none', background: '#DC2626', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                                    </div>
                                ) : null)}
                                {photoPreviews.map((url, i) => (
                                    <div key={`n${i}`} style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
                                        <img src={url} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1.5px solid #7C3AED' }} />
                                        <button onClick={() => removeNew(i)} aria-label="Xóa ảnh mới" style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 999, border: 'none', background: '#DC2626', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                                    </div>
                                ))}
                                {totalPhotos < 3 && (
                                    <>
                                        <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple style={{ display: 'none' }} onChange={handlePhotoSelect} />
                                        <button onClick={() => fileRef.current?.click()} aria-label="Chụp ảnh hoặc chọn từ thư viện" style={{ width: 72, height: 72, borderRadius: 8, border: '1.5px dashed #DDD6FE', background: '#F8F7FF', color: '#7C3AED', fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 10, border: '1.5px solid #DDD6FE', background: '#fff', fontSize: 13, fontWeight: 700, color: '#6B6494', cursor: 'pointer' }}>Hủy</button>
                    <button onClick={() => onSave({ ...form, photoFiles, existingPaths })} style={{ padding: '9px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Lưu nhật ký</button>
                </div>
            </div>
        </div>
    )
}

function SupabaseDailyReports({ selectedFacilityId = '' }) {
    const [date, setDate] = useState(todayStr())
    const [students, setStudents] = useState([])
    const [reports, setReports] = useState({})
    const [classes, setClasses] = useState([])
    const [classFilter, setClassFilter] = useState('')
    const [editing, setEditing] = useState(null)
    const [loading, setLoading] = useState(true)
    const [err, setErr] = useState('')
    const moodColors = { 'Vui vẻ': '#16A34A', 'Hào hứng': '#7C3AED', 'Bình thường': '#6B6494', 'Mệt mỏi': '#D97706', 'Buồn ngủ': '#0891B2' }
    const sel = { padding: '8px 12px', borderRadius: 10, border: '1.5px solid #DDD6FE', fontSize: 13, color: '#1E1B4B', background: '#fff' }

    async function load() {
        setErr('')
        setLoading(true)
        try {
            const profile = await getCurrentProfile()
            const facilityId = profile?.role === 'teacher' ? profile.facility_id : selectedFacilityId || undefined
            const items = await listStudents({ facilityId, status: 'active' })
            const dailyReports = await listDailyReportsByFacilityDate({ facilityId, date })
            const reportMap = {}
            dailyReports.forEach(report => { reportMap[report.studentId] = report })
            setStudents(items)
            setReports(reportMap)
            setClasses([...new Set(items.map(s => s.className).filter(Boolean))].map(name => ({ id: name, name })))
            cacheTeacherData('last-facility-id', facilityId || 'all')
            cacheTeacherData(`students:${facilityId || 'all'}`, items)
            cacheTeacherData(`daily-reports:${facilityId || 'all'}:${date}`, reportMap)
        } catch (ex) {
            const facilityId = readCachedTeacherData('last-facility-id', selectedFacilityId || 'all')
            const cachedStudents = readCachedTeacherData(`students:${facilityId}`, [])
            const cachedReports = readCachedTeacherData(`daily-reports:${facilityId}:${date}`, {})
            if (cachedStudents.length) {
                setStudents(cachedStudents)
                setReports(cachedReports)
                setClasses([...new Set(cachedStudents.map(s => s.className).filter(Boolean))].map(name => ({ id: name, name })))
                setErr('Đang dùng dữ liệu offline. Nhật ký sẽ tự đồng bộ khi có mạng.')
            } else {
                setErr(ex.message || 'Không tải được nhật ký ngày.')
            }
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [date, selectedFacilityId])

    useEffect(() => {
        if (!date) return
        return subscribeDailyReports({
            facilityId: selectedFacilityId || undefined,
            date,
            onChange: ({ eventType, record, oldRecord }) => {
                setReports(prev => {
                    const next = { ...prev }
                    if (eventType === 'DELETE' && oldRecord?.studentId) { delete next[oldRecord.studentId] }
                    else if (record?.studentId) { next[record.studentId] = record }
                    return next
                })
            },
        })
    }, [date, selectedFacilityId])

    useEffect(() => {
        const sync = () => syncOfflineQueue().then(load).catch(() => { })
        window.addEventListener('online', sync)
        sync()
        return () => window.removeEventListener('online', sync)
    }, [date, selectedFacilityId])

    const filteredStudents = classFilter ? students.filter(student => student.className === classFilter) : students

    async function saveSupabaseReport(studentId, data) {
        const { photoFiles, existingPaths, ...reportData } = data
        const student = students.find(s => s.id === studentId)
        const facilityId = student?.facilityId || selectedFacilityId || undefined

        let newPaths = []
        if (photoFiles?.length && isOnline()) {
            try {
                newPaths = await Promise.all(
                    photoFiles.map(f => uploadReportPhoto({ file: f, facilityId, studentId }))
                )
            } catch { /* continue without photos if upload fails */ }
        }

        const photoPaths = [...(existingPaths || []), ...newPaths]
        const record = { studentId, facilityId, date, ...reportData, photoPaths }

        setReports(prev => {
            const next = { ...prev, [studentId]: record }
            cacheTeacherData(`daily-reports:${facilityId || 'all'}:${date}`, next)
            return next
        })
        setEditing(null)
        if (isOnline()) {
            try {
                const saved = await saveDailyReport(record)
                setReports(prev => ({ ...prev, [studentId]: saved }))
            } catch {
                enqueueOfflineAction('daily-report', record)
                setErr('Mất kết nối. Nhật ký đã lưu offline và sẽ tự đồng bộ.')
            }
        } else {
            enqueueOfflineAction('daily-report', record)
            setErr('Đang offline. Nhật ký đã lưu tạm trên máy.')
        }
    }

    if (loading) return (
        <div className="admin-page-pad" style={{ padding: '28px 36px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,320px),1fr))', gap: 14 }}>
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 16, padding: '16px 18px', boxShadow: '0 2px 14px rgba(109,40,217,0.07)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 999 }} />
                            <div><div className="skeleton" style={{ height: 13, width: 90, marginBottom: 5 }} /><div className="skeleton" style={{ height: 10, width: 60 }} /></div>
                        </div>
                        <div className="skeleton" style={{ height: 30, width: 72, borderRadius: 8 }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {Array.from({ length: 4 }).map((__, j) => <div key={j} className="skeleton" style={{ height: 44, borderRadius: 8 }} />)}
                    </div>
                </div>
            ))}
        </div>
    )

    return (
        <div className="admin-page-pad" style={{ padding: '28px 36px' }}>
            {editing && <EditModal student={students.find(s => s.id === editing)} report={reports[editing]} onClose={() => setEditing(null)} onSave={data => saveSupabaseReport(editing, data)} showPhotos />}
            <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12 }}>
                {err && <div style={{ color: err.includes('offline') || err.includes('mạng') ? '#D97706' : '#DC2626', background: err.includes('offline') || err.includes('mạng') ? '#FFFBEB' : '#FEF2F2', borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 800 }}>{err}</div>}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginLeft: 'auto' }}>
                    <select value={classFilter} onChange={e => setClassFilter(e.target.value)} style={sel}><option value="">Tất cả lớp</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} style={sel} />
                </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,320px),1fr))', gap: 14 }}>
                {filteredStudents.map(s => {
                    const r = reports[s.id]
                    return (
                        <div key={s.id} style={{ background: '#fff', borderRadius: 16, padding: '16px 18px', boxShadow: '0 2px 14px rgba(109,40,217,0.07)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 999, background: 'linear-gradient(135deg,#7C3AED,#A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14 }}>{s.name?.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase() || '?'}</div>
                                    <div><div style={{ fontWeight: 700, fontSize: 13, color: '#1E1B4B' }}>{s.name}</div><span style={{ fontSize: 10, fontWeight: 700, color: '#6B6494' }}>{s.className}</span></div>
                                </div>
                                <button onClick={() => setEditing(s.id)} style={{ padding: '5px 12px', borderRadius: 8, border: '1.5px solid #7C3AED', background: '#fff', color: '#7C3AED', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{r ? 'Sửa' : 'Ghi nhật ký'}</button>
                            </div>
                            {r ? <div className="mobile-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <ReportChip icon="🍳" label="Sáng" value={r.breakfast} />
                                <ReportChip icon="🍱" label="Trưa" value={r.lunch} />
                                <ReportChip icon="🍎" label="Xế" value={r.snack} />
                                <ReportChip icon="😴" label="Ngủ" value={r.napDuration > 0 ? `${r.napDuration} phút` : 'Không ngủ'} />
                                <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 11, color: '#6B6494', fontWeight: 700 }}>Tâm trạng:</span>
                                    <span style={{ fontSize: 12, fontWeight: 800, color: moodColors[r.mood] || '#6B6494' }}>{r.mood}</span>
                                    {r.note && <span style={{ fontSize: 11, color: '#6B6494', fontStyle: 'italic' }}>· {r.note}</span>}
                                    {r.photoPaths?.length > 0 && <span style={{ fontSize: 11, color: '#7C3AED', fontWeight: 700, marginLeft: 'auto' }}>📷 {r.photoPaths.length}</span>}
                                </div>
                            </div> : <div style={{ textAlign: 'center', padding: '16px 0', color: '#7C6D9B', fontSize: 13 }}>Chưa có nhật ký hôm nay</div>}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default function DailyReports(props) {
    if (isSupabaseSession()) return <SupabaseDailyReports {...props} />

    const [db, setDB] = useState(getDB())
    const [selDate, setSelDate] = useState(todayStr())
    const [filterClass, setFilterClass] = useState('all')
    const [editing, setEditing] = useState(null)
    const moodColors = { 'Vui vẻ': '#16A34A', 'Hào hứng': '#7C3AED', 'Bình thường': '#6B6494', 'Mệt mỏi': '#D97706', 'Buồn ngủ': '#0891B2' }
    const students = useMemo(() => { let s = db.students.filter(st => st.status === 'active'); if (filterClass !== 'all') s = s.filter(st => st.classId === filterClass); return s }, [db, filterClass])
    const reportMap = useMemo(() => { const map = {}; db.dailyReports.filter(r => r.date === selDate).forEach(r => { map[r.studentId] = r }); return map }, [db, selDate])
    const sel = { padding: '8px 12px', borderRadius: 10, border: '1.5px solid #DDD6FE', fontSize: 13, color: '#1E1B4B', background: '#fff' }
    function saveReport(studentId, data) {
        const { photoFiles, existingPaths, ...reportData } = data
        const ndb = getDB(); const idx = ndb.dailyReports.findIndex(r => r.date === selDate && r.studentId === studentId)
        const rec = { id: `dr-${selDate}-${studentId}`, studentId, date: selDate, ...reportData }
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
