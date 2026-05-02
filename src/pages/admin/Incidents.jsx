import { useEffect, useRef, useState } from 'react'
import { getDB } from '../../data/store'
import { apiRequest, hasBackendAPI } from '../../data/api'
import { isSupabaseSession } from '../../data/backendMode'
import { listStudents } from '../../features/students/studentService'
import {
    acknowledgeIncident,
    listIncidents as listSupabaseIncidents,
    saveIncident as saveSupabaseIncident,
    subscribeIncidents,
} from '../../features/sensitive/sensitiveService'
import { getSignedUrl, uploadReportPhoto } from '../../features/media/mediaService'
import { sendPushForEvent } from '../../features/push/pushService'
import ModalCloseButton from '../../components/ModalCloseButton'

const SEVERITY_MAP = {
    minor: ['#D97706', '#FFFBEB', 'Nhẹ'],
    moderate: ['#DC2626', '#FEF2F2', 'Vừa'],
    severe: ['#7F1D1D', '#FEE2E2', 'Nghiêm trọng'],
}

const STATUS_MAP = {
    draft: ['#6B6494', '#F5F5F4', 'Nháp'],
    open: ['#D97706', '#FFFBEB', 'Đang xử lý'],
    resolved: ['#16A34A', '#F0FDF4', 'Đã giải quyết'],
    parent_acknowledged: ['#7C3AED', '#EDE9FE', 'PH đã đọc'],
}

function StatusBadge({ status }) {
    const [col, bg, label] = STATUS_MAP[status] || ['#6B6494', '#F5F5F4', status]
    return (
        <span
            style={{ background: bg, color: col, borderRadius: 6, fontSize: 11, fontWeight: 800, padding: '2px 8px' }}
        >
            {label}
        </span>
    )
}

function SeverityBadge({ severity }) {
    const [col, bg, label] = SEVERITY_MAP[severity] || ['#6B6494', '#F5F5F4', severity]
    return (
        <span
            style={{ background: bg, color: col, borderRadius: 6, fontSize: 11, fontWeight: 700, padding: '2px 8px' }}
        >
            {label}
        </span>
    )
}

function IncidentModal({ incident, students, onClose, onSave }) {
    const isNew = !incident?.id
    const [form, setForm] = useState(
        incident || {
            studentId: students[0]?.id || '',
            occurredAt: new Date().toISOString().slice(0, 16),
            severity: 'minor',
            description: '',
            initialAction: '',
            status: 'open',
        },
    )
    const [existingPaths, setExistingPaths] = useState(incident?.photo_paths || [])
    const [existingUrls, setExistingUrls] = useState([])
    const [photoFiles, setPhotoFiles] = useState([])
    const [photoPreviews, setPhotoPreviews] = useState([])
    const fileRef = useRef()

    const is = {
        width: '100%',
        padding: '8px 12px',
        borderRadius: 8,
        border: '1.5px solid #DDD6FE',
        fontSize: 13,
        color: '#1E1B4B',
        boxSizing: 'border-box',
    }
    const ls = { fontSize: 12, fontWeight: 700, color: '#6B6494', display: 'block', marginBottom: 4 }

    useEffect(() => {
        if (!existingPaths.length) return
        Promise.all(existingPaths.map(p => getSignedUrl(p).catch(() => ''))).then(setExistingUrls)
    }, [existingPaths.join(',')])

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
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
            role="dialog"
            aria-modal="true"
            aria-label={isNew ? 'Tạo sự cố mới' : 'Chỉnh sửa sự cố'}
        >
            <div
                style={{
                    position: 'relative',
                    background: '#fff',
                    borderRadius: 20,
                    width: 'min(560px, calc(100vw - 24px))',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    padding: 28,
                    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                }}
            >
                <ModalCloseButton onClick={onClose} />
                <div style={{ fontWeight: 800, fontSize: 17, color: '#1E1B4B', marginBottom: 20 }}>
                    {isNew ? 'Ghi nhận sự cố mới' : 'Cập nhật sự cố'}
                </div>
                <div style={{ display: 'grid', gap: 14 }}>
                    <div>
                        <label style={ls} htmlFor="inc-student">
                            Học sinh *
                        </label>
                        <select
                            id="inc-student"
                            style={is}
                            value={form.studentId}
                            onChange={e => setForm({ ...form, studentId: e.target.value })}
                        >
                            {students.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div
                        className="mobile-two-col"
                        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
                    >
                        <div>
                            <label style={ls} htmlFor="inc-time">
                                Thời gian xảy ra *
                            </label>
                            <input
                                id="inc-time"
                                type="datetime-local"
                                style={is}
                                value={(form.occurredAt || '').slice(0, 16)}
                                onChange={e => setForm({ ...form, occurredAt: e.target.value })}
                            />
                        </div>
                        <div>
                            <label style={ls}>Mức độ</label>
                            <select
                                style={is}
                                value={form.severity}
                                onChange={e => setForm({ ...form, severity: e.target.value })}
                            >
                                <option value="minor">Nhẹ</option>
                                <option value="moderate">Vừa</option>
                                <option value="severe">Nghiêm trọng</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label style={ls} htmlFor="inc-desc">
                            Mô tả sự cố *
                        </label>
                        <textarea
                            id="inc-desc"
                            style={{ ...is, resize: 'vertical', minHeight: 80 }}
                            value={form.description}
                            onChange={e => setForm({ ...form, description: e.target.value })}
                            placeholder="Mô tả chi tiết sự cố xảy ra..."
                        />
                    </div>
                    <div>
                        <label style={ls} htmlFor="inc-action">
                            Xử lý ban đầu
                        </label>
                        <textarea
                            id="inc-action"
                            style={{ ...is, resize: 'vertical', minHeight: 60 }}
                            value={form.initialAction || ''}
                            onChange={e => setForm({ ...form, initialAction: e.target.value })}
                            placeholder="Các bước xử lý đã thực hiện..."
                        />
                    </div>
                    {!isNew && (
                        <div>
                            <label style={ls}>Trạng thái</label>
                            <select
                                style={is}
                                value={form.status}
                                onChange={e => setForm({ ...form, status: e.target.value })}
                            >
                                <option value="draft">Nháp</option>
                                <option value="open">Đang xử lý</option>
                                <option value="resolved">Đã giải quyết</option>
                            </select>
                        </div>
                    )}
                    <div>
                        <label style={ls}>📷 Ảnh hiện trường (tối đa 3)</label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                            {existingUrls.map((url, i) =>
                                url ? (
                                    <div
                                        key={`e${i}`}
                                        style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}
                                    >
                                        <img
                                            src={url}
                                            alt=""
                                            style={{
                                                width: 72,
                                                height: 72,
                                                objectFit: 'cover',
                                                borderRadius: 8,
                                                border: '1.5px solid #DDD6FE',
                                            }}
                                        />
                                        <button
                                            onClick={() => removeExisting(i)}
                                            aria-label="Xóa ảnh"
                                            style={{
                                                position: 'absolute',
                                                top: -6,
                                                right: -6,
                                                width: 20,
                                                height: 20,
                                                borderRadius: 999,
                                                border: 'none',
                                                background: '#DC2626',
                                                color: '#fff',
                                                fontSize: 11,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ) : null,
                            )}
                            {photoPreviews.map((url, i) => (
                                <div
                                    key={`n${i}`}
                                    style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}
                                >
                                    <img
                                        src={url}
                                        alt=""
                                        style={{
                                            width: 72,
                                            height: 72,
                                            objectFit: 'cover',
                                            borderRadius: 8,
                                            border: '1.5px solid #7C3AED',
                                        }}
                                    />
                                    <button
                                        onClick={() => removeNew(i)}
                                        aria-label="Xóa ảnh mới"
                                        style={{
                                            position: 'absolute',
                                            top: -6,
                                            right: -6,
                                            width: 20,
                                            height: 20,
                                            borderRadius: 999,
                                            border: 'none',
                                            background: '#DC2626',
                                            color: '#fff',
                                            fontSize: 11,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                            {totalPhotos < 3 && (
                                <>
                                    <input
                                        ref={fileRef}
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        multiple
                                        style={{ display: 'none' }}
                                        onChange={handlePhotoSelect}
                                    />
                                    <button
                                        onClick={() => fileRef.current?.click()}
                                        aria-label="Chụp ảnh hiện trường"
                                        style={{
                                            width: 72,
                                            height: 72,
                                            borderRadius: 8,
                                            border: '1.5px dashed #FCA5A5',
                                            background: '#FFF1F2',
                                            color: '#DC2626',
                                            fontSize: 24,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                        }}
                                    >
                                        +
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '9px 20px',
                            borderRadius: 10,
                            border: '1.5px solid #DDD6FE',
                            background: '#fff',
                            fontSize: 13,
                            fontWeight: 700,
                            color: '#6B6494',
                            cursor: 'pointer',
                        }}
                    >
                        Hủy
                    </button>
                    <button
                        onClick={() => onSave({ ...form, photoFiles, existingPaths })}
                        disabled={!form.description || !form.studentId}
                        style={{
                            padding: '9px 24px',
                            borderRadius: 10,
                            border: 'none',
                            background: 'linear-gradient(90deg,#7C3AED,#A78BFA)',
                            color: '#fff',
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: 'pointer',
                        }}
                    >
                        {isNew ? 'Ghi nhận' : 'Lưu'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function Incidents({ readOnly = false, filterStudentId = null, selectedFacilityId = '' }) {
    const supabaseMode = isSupabaseSession()
    const db = getDB()
    const [supabaseStudents, setSupabaseStudents] = useState([])
    const students = supabaseMode ? supabaseStudents : db.students.filter(s => s.status === 'active')
    const [incidents, setIncidents] = useState([])
    const [loading, setLoading] = useState(false)
    const [modal, setModal] = useState(null)
    const [selected, setSelected] = useState(null)
    const [filterStatus, setFilterStatus] = useState('all')
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')

    useEffect(() => {
        if (!supabaseMode) return
        listStudents({ facilityId: selectedFacilityId || undefined, status: 'active' })
            .then(items => setSupabaseStudents(filterStudentId ? items.filter(s => s.id === filterStudentId) : items))
            .catch(err => setError(err.message))
    }, [supabaseMode, filterStudentId, selectedFacilityId])

    async function load() {
        if (!hasBackendAPI() && !supabaseMode) return
        setLoading(true)
        setError('')
        try {
            if (supabaseMode) {
                setIncidents(
                    await listSupabaseIncidents({
                        studentId: filterStudentId,
                        facilityId: filterStudentId ? undefined : selectedFacilityId || undefined,
                        status: filterStatus,
                    }),
                )
            } else {
                const params = new URLSearchParams()
                if (filterStudentId) params.set('studentId', filterStudentId)
                if (filterStatus !== 'all') params.set('status', filterStatus)
                const body = await apiRequest(`/api/incidents?${params}`)
                setIncidents(body.data || [])
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [filterStatus, filterStudentId, selectedFacilityId])

    useEffect(() => {
        if (!supabaseMode) return
        return subscribeIncidents({
            facilityId: filterStudentId ? undefined : selectedFacilityId || undefined,
            onChange: ({ eventType, record, oldRecord }) => {
                if (
                    filterStudentId &&
                    record?.student_id !== filterStudentId &&
                    oldRecord?.student_id !== filterStudentId
                )
                    return
                if (eventType === 'DELETE') {
                    const id = oldRecord?.id
                    if (id) setIncidents(prev => prev.filter(i => i.id !== id))
                } else if (record) {
                    setIncidents(prev =>
                        prev.some(i => i.id === record.id)
                            ? prev.map(i => (i.id === record.id ? record : i))
                            : [record, ...prev],
                    )
                }
            },
        })
    }, [supabaseMode, filterStudentId, selectedFacilityId])

    async function handleSave(form) {
        setError('')
        const { photoFiles, existingPaths, ...incidentData } = form
        const editingIncident = selected
        const prevIncidents = incidents

        const optimistic = {
            ...(editingIncident || {}),
            id: editingIncident?.id || `temp_${Date.now()}`,
            student_id: incidentData.studentId,
            occurred_at: incidentData.occurredAt ? new Date(incidentData.occurredAt).toISOString() : null,
            severity: incidentData.severity,
            description: incidentData.description,
            initial_action: incidentData.initialAction || '',
            status: incidentData.status || 'open',
            photo_paths: existingPaths || [],
        }
        if (editingIncident) {
            setIncidents(prev => prev.map(inc => (inc.id === editingIncident.id ? { ...inc, ...optimistic } : inc)))
        } else {
            setIncidents(prev => [optimistic, ...prev])
        }
        setModal(null)
        setSelected(null)

        try {
            if (supabaseMode) {
                let newPaths = []
                if (photoFiles?.length) {
                    const facilityId = editingIncident?.facility_id || selectedFacilityId || undefined
                    newPaths = await Promise.all(
                        photoFiles.map(f =>
                            uploadReportPhoto({ file: f, facilityId, studentId: incidentData.studentId }),
                        ),
                    )
                }
                const photoPaths = [...(existingPaths || []), ...newPaths]
                const saved = await saveSupabaseIncident({
                    ...incidentData,
                    id: editingIncident?.id,
                    occurredAt: incidentData.occurredAt ? new Date(incidentData.occurredAt).toISOString() : undefined,
                    photoPaths,
                })
                if (!editingIncident) {
                    const studentName = students.find(s => s.id === incidentData.studentId)?.name || 'Học sinh'
                    sendPushForEvent({
                        studentId: incidentData.studentId,
                        title: `Sự cố: ${studentName}`,
                        body: incidentData.description?.slice(0, 80),
                        url: '/parent',
                    }).catch(() => {})
                }
                setMessage(editingIncident ? 'Đã cập nhật sự cố.' : 'Đã ghi nhận sự cố.')
            } else if (editingIncident) {
                await apiRequest(`/api/incidents/${editingIncident.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        ...incidentData,
                        occurredAt: incidentData.occurredAt
                            ? new Date(incidentData.occurredAt).toISOString()
                            : undefined,
                    }),
                })
                setMessage('Đã cập nhật sự cố.')
            } else {
                await apiRequest('/api/incidents', {
                    method: 'POST',
                    body: JSON.stringify({
                        ...incidentData,
                        occurredAt: new Date(incidentData.occurredAt).toISOString(),
                    }),
                })
                setMessage('Đã ghi nhận sự cố.')
            }
            if (!editingIncident) await load()
            setTimeout(() => setMessage(''), 3000)
        } catch (err) {
            setIncidents(prevIncidents)
            setError(err.message)
        }
    }

    async function acknowledge(id) {
        const prevIncidents = incidents
        setIncidents(prev =>
            prev.map(inc =>
                inc.id === id
                    ? { ...inc, status: 'parent_acknowledged', parent_acknowledged_at: new Date().toISOString() }
                    : inc,
            ),
        )
        try {
            if (supabaseMode) {
                await acknowledgeIncident(id)
            } else {
                await apiRequest(`/api/incidents/${id}`, { method: 'PUT', body: JSON.stringify({}) })
            }
            setMessage('Đã xác nhận đã đọc.')
            setTimeout(() => setMessage(''), 3000)
        } catch (err) {
            setIncidents(prevIncidents)
            setError(err.message)
        }
    }

    function getStudentName(sid) {
        return students.find(s => s.id === sid)?.name || sid
    }

    if (!hasBackendAPI() && !supabaseMode) {
        return (
            <div className={readOnly ? '' : 'admin-page-pad'} style={{ padding: readOnly ? 0 : '28px 36px' }}>
                <div
                    style={{
                        background: '#fff',
                        borderRadius: 16,
                        padding: 28,
                        boxShadow: '0 2px 16px rgba(109,40,217,0.08)',
                    }}
                >
                    <div style={{ fontWeight: 800, fontSize: 18, color: '#1E1B4B', marginBottom: 8 }}>
                        Báo cáo sự cố
                    </div>
                    <div style={{ color: '#7C6D9B', fontSize: 14 }}>
                        Báo cáo sự cố đang được chuẩn bị để ghi nhận và theo dõi trực tuyến.
                    </div>
                </div>
            </div>
        )
    }

    const filtered = filterStatus === 'all' ? incidents : incidents.filter(i => i.status === filterStatus)
    const sel = {
        padding: '9px 14px',
        borderRadius: 10,
        border: '1.5px solid #DDD6FE',
        fontSize: 13,
        color: '#1E1B4B',
        background: '#fff',
    }

    return (
        <div className={readOnly ? '' : 'admin-page-pad'} style={{ padding: readOnly ? 0 : '28px 36px' }}>
            {modal === 'form' && (
                <IncidentModal
                    incident={selected}
                    students={students}
                    onClose={() => {
                        setModal(null)
                        setSelected(null)
                    }}
                    onSave={handleSave}
                />
            )}

            {!readOnly && (
                <div
                    className="mobile-stack"
                    style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        marginBottom: 20,
                        gap: 12,
                    }}
                >
                    <button
                        onClick={() => {
                            setSelected(null)
                            setModal('form')
                        }}
                        style={{
                            padding: '10px 22px',
                            borderRadius: 12,
                            border: 'none',
                            background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)',
                            color: '#fff',
                            fontWeight: 800,
                            fontSize: 14,
                            cursor: 'pointer',
                            boxShadow: '0 4px 14px rgba(109,40,217,0.35)',
                        }}
                        aria-label="Ghi nhận sự cố mới"
                    >
                        + Ghi nhận sự cố
                    </button>
                </div>
            )}

            {readOnly && (
                <div style={{ fontWeight: 800, fontSize: 16, color: '#1E1B4B', marginBottom: 16 }}>
                    Sự cố ({incidents.length})
                </div>
            )}

            {message && (
                <div
                    style={{
                        color: '#059669',
                        background: '#ECFDF5',
                        borderRadius: 10,
                        padding: '10px 14px',
                        fontSize: 12,
                        fontWeight: 700,
                        marginBottom: 16,
                    }}
                >
                    {message}
                </div>
            )}
            {error && (
                <div
                    style={{
                        color: '#DC2626',
                        background: '#FEF2F2',
                        borderRadius: 10,
                        padding: '10px 14px',
                        fontSize: 12,
                        fontWeight: 700,
                        marginBottom: 16,
                    }}
                >
                    {error}
                </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                {['all', 'draft', 'open', 'resolved', 'parent_acknowledged'].map(s => (
                    <button
                        key={s}
                        onClick={() => setFilterStatus(s)}
                        style={{
                            ...sel,
                            fontWeight: filterStatus === s ? 800 : 600,
                            borderColor: filterStatus === s ? '#7C3AED' : '#DDD6FE',
                            color: filterStatus === s ? '#7C3AED' : '#6B6494',
                            background: filterStatus === s ? '#F5F3FF' : '#fff',
                        }}
                    >
                        {s === 'all' ? 'Tất cả' : STATUS_MAP[s]?.[2] || s}
                    </button>
                ))}
            </div>

            <div
                className="mobile-scroll-table"
                style={{
                    background: '#fff',
                    borderRadius: 16,
                    boxShadow: '0 2px 16px rgba(109,40,217,0.08)',
                    overflow: 'hidden',
                }}
            >
                {loading ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                            {Array.from({ length: 4 }).map((_, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #EDE9FE' }}>
                                    {[70, 55, 40, 80, 50, 30].map((w, j) => (
                                        <td key={j} style={{ padding: '14px 16px' }}>
                                            <div className="skeleton" style={{ height: 13, width: `${w}%` }} />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#7C6D9B' }}>
                        <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
                        <div style={{ fontWeight: 700 }}>Không có sự cố nào</div>
                    </div>
                ) : (
                    <table
                        style={{ width: '100%', borderCollapse: 'collapse' }}
                        role="table"
                        aria-label="Danh sách sự cố"
                    >
                        <thead>
                            <tr style={{ background: '#F8F7FF' }}>
                                {['Học sinh', 'Thời gian', 'Mức độ', 'Mô tả', 'Trạng thái', ''].map(h => (
                                    <th
                                        key={h}
                                        scope="col"
                                        style={{
                                            padding: '12px 16px',
                                            textAlign: 'left',
                                            fontSize: 11,
                                            fontWeight: 800,
                                            color: '#7C6D9B',
                                            borderBottom: '1.5px solid #DDD6FE',
                                        }}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(inc => (
                                <tr key={inc.id} style={{ borderBottom: '1px solid #EDE9FE' }}>
                                    <td
                                        style={{
                                            padding: '12px 16px',
                                            fontWeight: 700,
                                            fontSize: 13,
                                            color: '#1E1B4B',
                                        }}
                                    >
                                        {getStudentName(inc.student_id)}
                                    </td>
                                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#6B6494' }}>
                                        {new Date(inc.occurred_at).toLocaleString('vi-VN', {
                                            dateStyle: 'short',
                                            timeStyle: 'short',
                                        })}
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <SeverityBadge severity={inc.severity} />
                                    </td>
                                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#4B4899', maxWidth: 260 }}>
                                        <div
                                            style={{
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {inc.description}
                                        </div>
                                        {inc.initial_action && (
                                            <div style={{ fontSize: 11, color: '#9B93C9', marginTop: 2 }}>
                                                Xử lý: {inc.initial_action}
                                            </div>
                                        )}
                                        {inc.photo_paths?.length > 0 && (
                                            <div style={{ fontSize: 11, color: '#7C3AED', marginTop: 2 }}>
                                                📷 {inc.photo_paths.length} ảnh
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <StatusBadge status={inc.status} />
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            {!readOnly && (
                                                <button
                                                    onClick={() => {
                                                        setSelected({
                                                            ...inc,
                                                            studentId: inc.student_id,
                                                            occurredAt: inc.occurred_at,
                                                            initialAction: inc.initial_action,
                                                        })
                                                        setModal('form')
                                                    }}
                                                    style={{
                                                        padding: '5px 12px',
                                                        borderRadius: 8,
                                                        border: '1.5px solid #7C3AED',
                                                        background: '#fff',
                                                        color: '#7C3AED',
                                                        fontWeight: 700,
                                                        fontSize: 12,
                                                        cursor: 'pointer',
                                                    }}
                                                    aria-label={`Sửa sự cố ${inc.id}`}
                                                >
                                                    Sửa
                                                </button>
                                            )}
                                            {readOnly && inc.status === 'resolved' && !inc.parent_acknowledged_at && (
                                                <button
                                                    onClick={() => acknowledge(inc.id)}
                                                    style={{
                                                        padding: '5px 12px',
                                                        borderRadius: 8,
                                                        border: '1.5px solid #16A34A',
                                                        background: '#fff',
                                                        color: '#16A34A',
                                                        fontWeight: 700,
                                                        fontSize: 12,
                                                        cursor: 'pointer',
                                                    }}
                                                    aria-label="Xác nhận đã đọc"
                                                >
                                                    ✓ Đã đọc
                                                </button>
                                            )}
                                            {inc.parent_acknowledged_at && (
                                                <span style={{ fontSize: 11, color: '#7C3AED', fontWeight: 600 }}>
                                                    ✓ PH đã đọc
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
