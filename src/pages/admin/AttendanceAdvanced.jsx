import { useEffect, useState } from 'react'
import { hasBackendAPI } from '../../data/api'
import { getDB } from '../../data/store'

const API = import.meta.env.VITE_API_URL || ''

async function apiFetch(path, opts = {}) {
    const token = sessionStorage.getItem('maika_api_token')
    const res = await fetch(API + path, {
        ...opts,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Lỗi server')
    return json
}

const STATUS_CONFIG = {
    present: { label: 'Có mặt', icon: '✅', bg: '#ECFDF5', color: '#059669', border: '#6EE7B7' },
    absent: { label: 'Vắng mặt', icon: '❌', bg: '#FEF2F2', color: '#DC2626', border: '#FCA5A5' },
    late: { label: 'Đi trễ', icon: '⏰', bg: '#FFFBEB', color: '#D97706', border: '#FCD34D' },
    early_pickup: { label: 'Đón sớm', icon: '🚗', bg: '#EFF6FF', color: '#2563EB', border: '#93C5FD' },
}

function today() { return new Date().toISOString().split('T')[0] }

export default function AttendanceAdvanced({ readOnly = false, filterStudentId }) {
    const [date, setDate] = useState(today)
    const [students, setStudents] = useState([])
    const [records, setRecords] = useState({})
    const [summary, setSummary] = useState([])
    const [classes, setClasses] = useState([])
    const [classFilter, setClassFilter] = useState('')
    const [editModal, setEditModal] = useState(null)
    const [saving, setSaving] = useState(false)
    const [err, setErr] = useState('')

    useEffect(() => {
        const db = getDB()
        setStudents(db.students || [])
        setClasses(db.classes || [])
    }, [])

    useEffect(() => {
        if (!hasBackendAPI()) return
        const qs = new URLSearchParams({ date })
        if (filterStudentId) qs.set('studentId', filterStudentId)
        apiFetch(`/api/attendance-records?${qs}`)
            .then(res => {
                const map = {}
                for (const r of (res.data || [])) map[r.student_id] = r
                setRecords(map)
                setSummary(res.summary || [])
            })
            .catch(() => setErr('Lỗi tải dữ liệu'))
    }, [date, filterStudentId])

    const filteredStudents = filterStudentId
        ? students.filter(s => s.id === filterStudentId)
        : (classFilter ? students.filter(s => s.classId === classFilter) : students)

    async function quickMark(studentId, status) {
        if (readOnly) return
        setSaving(true)
        try {
            const now = new Date().toTimeString().slice(0, 5)
            const res = await apiFetch(`/api/attendance-records/${studentId}/${date}`, {
                method: 'PUT',
                body: JSON.stringify({ status, checkInTime: status !== 'absent' ? now : null }),
            })
            setRecords(prev => ({ ...prev, [studentId]: res.data }))
        } catch (ex) { setErr(ex.message) }
        setSaving(false)
    }

    async function saveDetail(input) {
        setSaving(true)
        try {
            const res = await apiFetch(`/api/attendance-records/${input.studentId}/${date}`, {
                method: 'PUT',
                body: JSON.stringify(input),
            })
            setRecords(prev => ({ ...prev, [input.studentId]: res.data }))
            setEditModal(null)
        } catch (ex) { setErr(ex.message) }
        setSaving(false)
    }

    const totalPresent = summary.find(s => s.status === 'present')?.count || 0
    const totalAbsent = summary.find(s => s.status === 'absent')?.count || 0
    const totalLate = summary.find(s => s.status === 'late')?.count || 0

    return (
        <div>
            {/* Date + filter bar */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #DDD6FE', fontSize: 14, fontWeight: 700, color: '#1E1B4B' }} />
                {!filterStudentId && (
                    <select value={classFilter} onChange={e => setClassFilter(e.target.value)} style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #DDD6FE', fontSize: 13, color: '#1E1B4B' }}>
                        <option value="">Tất cả lớp</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                )}
                {err && <span style={{ fontSize: 13, color: '#DC2626' }}>{err}</span>}
            </div>

            {/* Summary */}
            {!readOnly && summary.length > 0 && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                    {[
                        { label: 'Có mặt', count: totalPresent, color: '#059669', bg: '#ECFDF5' },
                        { label: 'Vắng mặt', count: totalAbsent, color: '#DC2626', bg: '#FEF2F2' },
                        { label: 'Đi trễ', count: totalLate, color: '#D97706', bg: '#FFFBEB' },
                        { label: 'Tổng', count: filteredStudents.length, color: '#6D28D9', bg: '#EDE9FE' },
                    ].map(s => (
                        <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: '12px 20px', textAlign: 'center', minWidth: 90 }}>
                            <div style={{ fontWeight: 900, fontSize: 24, color: s.color }}>{s.count}</div>
                            <div style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>{s.label}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Student list — mobile-optimized large buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredStudents.map(student => {
                    const rec = records[student.id]
                    const status = rec?.status || null
                    const cfg = status ? STATUS_CONFIG[status] : null
                    const cls = classes.find(c => c.id === student.classId)

                    return (
                        <div key={student.id} style={{ background: cfg ? cfg.bg : '#fff', borderRadius: 14, padding: '14px 18px', boxShadow: '0 2px 8px rgba(109,40,217,0.07)', border: `1.5px solid ${cfg ? cfg.border : '#EDE9FE'}`, display: 'flex', alignItems: 'center', gap: 14 }}>
                            {/* Avatar */}
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#6D28D9,#A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 16, flexShrink: 0 }}>
                                {student.name?.charAt(0)}
                            </div>
                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 800, fontSize: 15, color: '#1E1B4B' }}>{student.name}</div>
                                <div style={{ fontSize: 12, color: '#7C6D9B' }}>
                                    {cls?.name || student.classId || ''}
                                    {rec?.check_in_time && <span style={{ marginLeft: 8, color: '#059669' }}>⏱ Vào {rec.check_in_time}</span>}
                                    {rec?.check_out_time && <span style={{ marginLeft: 8, color: '#2563EB' }}>⏱ Ra {rec.check_out_time}</span>}
                                </div>
                                {rec?.pickup_person && <div style={{ fontSize: 11, color: '#9CA3AF' }}>🚗 {rec.pickup_person} ({rec.pickup_phone || '—'})</div>}
                            </div>
                            {/* Quick actions */}
                            {!readOnly && (
                                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                    {Object.entries(STATUS_CONFIG).map(([key, conf]) => (
                                        <button
                                            key={key}
                                            onClick={() => quickMark(student.id, key)}
                                            disabled={saving}
                                            aria-label={`Đánh dấu ${conf.label}`}
                                            title={conf.label}
                                            style={{
                                                width: 38, height: 38, borderRadius: 10, border: `2px solid ${status === key ? conf.color : '#E5E7EB'}`,
                                                background: status === key ? conf.bg : '#fff', cursor: saving ? 'wait' : 'pointer',
                                                fontSize: 16, fontWeight: 700, transition: 'all 0.15s',
                                            }}
                                        >
                                            {conf.icon}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => setEditModal({ student, rec })}
                                        aria-label="Ghi chi tiết"
                                        title="Ghi chi tiết"
                                        style={{ width: 38, height: 38, borderRadius: 10, border: '2px solid #DDD6FE', background: '#F5F3FF', cursor: 'pointer', fontSize: 14 }}
                                    >
                                        ✏️
                                    </button>
                                </div>
                            )}
                            {readOnly && cfg && (
                                <span style={{ fontSize: 22 }}>{cfg.icon}</span>
                            )}
                        </div>
                    )
                })}
                {filteredStudents.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 48, color: '#7C6D9B' }}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                        <div style={{ fontWeight: 700 }}>Không tìm thấy học sinh</div>
                    </div>
                )}
            </div>

            {/* Detail modal */}
            {editModal && (
                <DetailModal
                    student={editModal.student}
                    rec={editModal.rec}
                    date={date}
                    saving={saving}
                    onSave={saveDetail}
                    onClose={() => setEditModal(null)}
                />
            )}
        </div>
    )
}

function DetailModal({ student, rec, date, saving, onSave, onClose }) {
    const [form, setForm] = useState({
        status: rec?.status || 'present',
        checkInTime: rec?.check_in_time || '',
        checkOutTime: rec?.check_out_time || '',
        pickupPerson: rec?.pickup_person || '',
        pickupPhone: rec?.pickup_phone || '',
        lateReason: rec?.late_reason || '',
        earlyPickupReason: rec?.early_pickup_reason || '',
        note: rec?.note || '',
    })

    return (
        <div role="dialog" aria-modal="true" aria-label="Chi tiết điểm danh" style={{ position: 'fixed', inset: 0, background: 'rgba(30,27,75,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 560, padding: '24px 24px 32px', boxShadow: '0 -8px 40px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <div style={{ fontWeight: 900, fontSize: 16, color: '#1E1B4B' }}>📋 Điểm danh: {student.name}</div>
                    <button onClick={onClose} style={{ background: '#F5F3FF', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontWeight: 700 }}>✕</button>
                </div>
                <div style={{ fontSize: 13, color: '#7C6D9B', marginBottom: 16 }}>Ngày: {date}</div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
                    {Object.entries(STATUS_CONFIG).map(([key, conf]) => (
                        <button key={key} onClick={() => setForm(f => ({ ...f, status: key }))}
                            style={{ padding: '8px 16px', borderRadius: 20, border: `2px solid ${form.status === key ? conf.color : '#E5E7EB'}`, background: form.status === key ? conf.bg : '#fff', color: form.status === key ? conf.color : '#6B7280', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                            {conf.icon} {conf.label}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <LabelInput label="Giờ vào" type="time" value={form.checkInTime} onChange={v => setForm(f => ({ ...f, checkInTime: v }))} />
                    <LabelInput label="Giờ ra" type="time" value={form.checkOutTime} onChange={v => setForm(f => ({ ...f, checkOutTime: v }))} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <LabelInput label="Người đón" value={form.pickupPerson} onChange={v => setForm(f => ({ ...f, pickupPerson: v }))} placeholder="Tên người đón" />
                    <LabelInput label="Điện thoại người đón" value={form.pickupPhone} onChange={v => setForm(f => ({ ...f, pickupPhone: v }))} placeholder="0901..." />
                </div>
                {form.status === 'late' && <LabelInput label="Lý do đến trễ" value={form.lateReason} onChange={v => setForm(f => ({ ...f, lateReason: v }))} placeholder="Tắc đường, ốm..." style={{ marginBottom: 12 }} />}
                {form.status === 'early_pickup' && <LabelInput label="Lý do đón sớm" value={form.earlyPickupReason} onChange={v => setForm(f => ({ ...f, earlyPickupReason: v }))} placeholder="Lý do..." style={{ marginBottom: 12 }} />}
                <LabelInput label="Ghi chú" value={form.note} onChange={v => setForm(f => ({ ...f, note: v }))} placeholder="Ghi chú thêm..." style={{ marginBottom: 18 }} />

                <button onClick={() => onSave({ studentId: student.id, ...form })} disabled={saving}
                    style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: saving ? '#DDD6FE' : 'linear-gradient(135deg,#6D28D9,#8B5CF6)', color: saving ? '#7C6D9B' : '#fff', fontWeight: 800, fontSize: 15, cursor: saving ? 'wait' : 'pointer' }}>
                    {saving ? 'Đang lưu...' : '💾 Lưu điểm danh'}
                </button>
            </div>
        </div>
    )
}

function LabelInput({ label, value, onChange, type = 'text', placeholder = '', style = {} }) {
    return (
        <div style={style}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#5B5490', display: 'block', marginBottom: 4 }}>{label}</label>
            <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #DDD6FE', fontSize: 13, color: '#1E1B4B', boxSizing: 'border-box' }} />
        </div>
    )
}
