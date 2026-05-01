import { useEffect, useState } from 'react'
import { getDB } from '../../data/store'
import { apiRequest, hasBackendAPI } from '../../data/api'
import { isSupabaseSession } from '../../data/backendMode'
import { listStudents } from '../../features/students/studentService'
import { getHealthRecord as getSupabaseHealthRecord, saveHealthRecord as saveSupabaseHealthRecord } from '../../features/sensitive/sensitiveService'

const BLOOD_TYPES = ['A', 'B', 'AB', 'O', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const RELATIONS = ['Bố', 'Mẹ', 'Ông', 'Bà', 'Anh/Chị', 'Khác']

function Field({ label, value, type = 'text', options, onChange, readOnly }) {
    const is = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #DDD6FE', fontSize: 13, color: '#1E1B4B', boxSizing: 'border-box', background: readOnly ? '#F8F7FF' : '#fff' }
    const ls = { fontSize: 11, fontWeight: 700, color: '#7C6D9B', display: 'block', marginBottom: 4 }
    if (readOnly) {
        return <div><label style={ls}>{label}</label><div style={{ ...is, padding: '9px 12px', color: value ? '#1E1B4B' : '#9B93C9' }}>{value || '—'}</div></div>
    }
    if (options) {
        return <div><label style={ls}>{label}</label><select style={is} value={value || ''} onChange={e => onChange(e.target.value)}><option value="">— Chọn —</option>{options.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
    }
    if (type === 'textarea') {
        return <div><label style={ls}>{label}</label><textarea style={{ ...is, resize: 'vertical', minHeight: 70 }} value={value || ''} onChange={e => onChange(e.target.value)} /></div>
    }
    return <div><label style={ls}>{label}</label><input type={type} style={is} value={value || ''} onChange={e => onChange(e.target.value)} /></div>
}

export default function HealthRecords({ readOnly = false, filterStudentId = null }) {
    const supabaseMode = isSupabaseSession()
    const db = getDB()
    const localStudents = filterStudentId
        ? db.students.filter(s => s.id === filterStudentId)
        : db.students.filter(s => s.status === 'active')
    const [supabaseStudents, setSupabaseStudents] = useState([])
    const students = supabaseMode ? supabaseStudents : localStudents

    const [selectedId, setSelectedId] = useState(filterStudentId || students[0]?.id || '')
    const [record, setRecord] = useState({})
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')

    const student = students.find(s => s.id === selectedId)

    useEffect(() => {
        if (!supabaseMode) return
        listStudents({ status: 'active' })
            .then(items => {
                const next = filterStudentId ? items.filter(s => s.id === filterStudentId) : items
                setSupabaseStudents(next)
                if (!selectedId && next[0]) setSelectedId(next[0].id)
            })
            .catch(err => setError(err.message))
    }, [supabaseMode, filterStudentId])

    async function loadRecord(sid) {
        if (!sid || (!hasBackendAPI() && !supabaseMode)) return
        setLoading(true)
        setError('')
        try {
            if (supabaseMode) {
                setRecord(await getSupabaseHealthRecord(sid))
            } else {
                const body = await apiRequest(`/api/health-records/${encodeURIComponent(sid)}`)
                setRecord(body.data || {})
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadRecord(selectedId) }, [selectedId])

    function update(key, value) {
        setRecord(r => ({ ...r, [key]: value }))
    }

    async function save() {
        if (!hasBackendAPI() && !supabaseMode) return
        setSaving(true)
        setMessage('')
        setError('')
        try {
            if (supabaseMode) {
                await saveSupabaseHealthRecord(selectedId, record)
            } else {
                await apiRequest(`/api/health-records/${encodeURIComponent(selectedId)}`, {
                    method: 'PUT',
                    body: JSON.stringify(record),
                })
            }
            setMessage('Đã lưu hồ sơ sức khỏe.')
            setTimeout(() => setMessage(''), 3000)
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    if (!hasBackendAPI() && !supabaseMode && !readOnly) {
        return (
            <div className="admin-page-pad" style={{ padding: '28px 36px' }}>
                <div style={{ background: '#fff', borderRadius: 16, padding: 28, boxShadow: '0 2px 16px rgba(109,40,217,0.08)' }}>
                    <div style={{ fontWeight: 800, fontSize: 18, color: '#1E1B4B', marginBottom: 8 }}>Hồ sơ sức khỏe học sinh</div>
                    <div style={{ color: '#7C6D9B', fontSize: 14 }}>Hồ sơ sức khỏe đang được chuẩn bị để lưu trữ và cập nhật trực tuyến.</div>
                </div>
            </div>
        )
    }

    return (
        <div className={readOnly ? '' : 'admin-page-pad'} style={{ padding: readOnly ? 0 : '28px 36px' }}>
            {!readOnly && (
                <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12 }}>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: 18, color: '#1E1B4B' }}>Hồ sơ sức khỏe học sinh</div>
                        <div style={{ fontSize: 13, color: '#7C6D9B', marginTop: 2 }}>Dị ứng · Thuốc · Liên hệ khẩn cấp · Bác sĩ</div>
                    </div>
                </div>
            )}

            {!filterStudentId && (
                <div style={{ marginBottom: 16 }}>
                    <select
                        value={selectedId}
                        onChange={e => { setSelectedId(e.target.value); setRecord({}) }}
                        style={{ padding: '9px 14px', borderRadius: 10, border: '1.5px solid #DDD6FE', fontSize: 13, color: '#1E1B4B', background: '#fff', minWidth: 240 }}
                    >
                        <option value="">— Chọn học sinh —</option>
                        {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            )}

            {message && <div style={{ color: '#059669', background: '#ECFDF5', borderRadius: 10, padding: '10px 14px', fontSize: 12, fontWeight: 700, marginBottom: 16 }}>{message}</div>}
            {error && <div style={{ color: '#DC2626', background: '#FEF2F2', borderRadius: 10, padding: '10px 14px', fontSize: 12, fontWeight: 700, marginBottom: 16 }}>{error}</div>}

            {selectedId && student && (
                <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(109,40,217,0.08)', padding: 24 }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 40, color: '#7C6D9B' }}>Đang tải...</div>
                    ) : (
                        <>
                            <div className="mobile-stack" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, paddingBottom: 16, borderBottom: '1.5px solid #EDE9FE' }}>
                                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#7C3AED,#A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 16 }}>
                                    {(student.initials || '?')}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: 15, color: '#1E1B4B' }}>{student.name}</div>
                                    <div style={{ fontSize: 12, color: '#7C6D9B' }}>{student.className || db.classes.find(c => c.id === student.classId)?.name || ''}</div>
                                </div>
                                <div style={{ marginLeft: 'auto', fontSize: 11, color: '#9B93C9', fontWeight: 600 }}>
                                    {record.updated_at ? `Cập nhật: ${new Date(record.updated_at).toLocaleString('vi-VN')}` : 'Chưa có hồ sơ'}
                                </div>
                            </div>

                            <div className="mobile-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                {/* Medical info */}
                                <div style={{ gridColumn: '1/-1', background: '#FEF2F2', borderRadius: 12, padding: '14px 16px' }}>
                                    <div style={{ fontWeight: 800, fontSize: 13, color: '#DC2626', marginBottom: 12 }}>🏥 Thông tin y tế</div>
                                    <div className="mobile-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                        <Field label="Nhóm máu" value={record.blood_type} options={BLOOD_TYPES} onChange={v => update('blood_type', v)} readOnly={readOnly} />
                                        <Field label="Dị ứng" value={record.allergies} onChange={v => update('allergies', v)} readOnly={readOnly} />
                                        <div style={{ gridColumn: '1/-1' }}>
                                            <Field label="Thuốc đang dùng / Lưu ý thuốc" type="textarea" value={record.medications} onChange={v => update('medications', v)} readOnly={readOnly} />
                                        </div>
                                        <div style={{ gridColumn: '1/-1' }}>
                                            <Field label="Ghi chú y tế khác" type="textarea" value={record.medical_notes} onChange={v => update('medical_notes', v)} readOnly={readOnly} />
                                        </div>
                                    </div>
                                </div>

                                {/* Emergency contact */}
                                <div style={{ gridColumn: '1/-1', background: '#FFF7ED', borderRadius: 12, padding: '14px 16px' }}>
                                    <div style={{ fontWeight: 800, fontSize: 13, color: '#D97706', marginBottom: 12 }}>🚨 Liên hệ khẩn cấp</div>
                                    <div className="mobile-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                        <Field label="Họ tên" value={record.emergency_contact_name} onChange={v => update('emergency_contact_name', v)} readOnly={readOnly} />
                                        <Field label="Quan hệ" value={record.emergency_contact_relation} options={RELATIONS} onChange={v => update('emergency_contact_relation', v)} readOnly={readOnly} />
                                        <div style={{ gridColumn: '1/-1' }}>
                                            <Field label="Số điện thoại" type="tel" value={record.emergency_contact_phone} onChange={v => update('emergency_contact_phone', v)} readOnly={readOnly} />
                                        </div>
                                    </div>
                                </div>

                                {/* Doctor */}
                                <div style={{ gridColumn: '1/-1', background: '#EDE9FE', borderRadius: 12, padding: '14px 16px' }}>
                                    <div style={{ fontWeight: 800, fontSize: 13, color: '#7C3AED', marginBottom: 12 }}>👨‍⚕️ Bác sĩ / Cơ sở y tế</div>
                                    <div className="mobile-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                        <Field label="Tên bác sĩ / Cơ sở" value={record.doctor_name} onChange={v => update('doctor_name', v)} readOnly={readOnly} />
                                        <Field label="Điện thoại" type="tel" value={record.doctor_phone} onChange={v => update('doctor_phone', v)} readOnly={readOnly} />
                                    </div>
                                </div>
                            </div>

                            {!readOnly && (
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                                    <button
                                        onClick={save}
                                        disabled={saving}
                                        style={{ padding: '10px 28px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
                                        aria-label="Lưu hồ sơ sức khỏe"
                                    >
                                        {saving ? 'Đang lưu...' : 'Lưu hồ sơ'}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {!selectedId && (
                <div style={{ background: '#fff', borderRadius: 16, padding: 48, textAlign: 'center', boxShadow: '0 2px 16px rgba(109,40,217,0.08)' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🏥</div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: '#1E1B4B' }}>Chọn học sinh để xem hồ sơ sức khỏe</div>
                </div>
            )}
        </div>
    )
}
