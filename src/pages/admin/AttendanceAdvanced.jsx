import { useEffect, useMemo, useState } from 'react'
import { hasBackendAPI } from '../../data/api'
import { isSupabaseSession } from '../../data/backendMode'
import { getDB } from '../../data/store'
import { getCurrentProfile } from '../../features/auth/authService'
import {
    listAttendanceByFacilityDate,
    subscribeAttendanceByFacilityDate,
    upsertAttendance,
} from '../../features/attendance/attendanceService'
import { listStudents } from '../../features/students/studentService'
import {
    cacheTeacherData,
    enqueueOfflineAction,
    getFailedActions,
    isOnline,
    readCachedTeacherData,
    syncOfflineQueue,
} from '../../features/offline/offlineSyncService'
import PaginationBar from '../../components/PaginationBar'

const API = import.meta.env.VITE_API_URL || ''
const STUDENTS_PER_PAGE = 12

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

function today() {
    return new Date().toISOString().split('T')[0]
}

function SyncStatusIcon({ status }) {
    if (!status) return null
    const map = {
        syncing: ['🔄', 'Đang đồng bộ', '#D97706'],
        synced: ['✅', 'Đã đồng bộ', '#16A34A'],
        queued: ['💾', 'Chờ đồng bộ', '#D97706'],
        error: ['⚠️', 'Lỗi đồng bộ', '#DC2626'],
    }
    const [icon, label, color] = map[status] || map.synced
    return (
        <span title={label} aria-label={label} style={{ fontSize: 13, color, fontWeight: 900 }}>
            {icon}
        </span>
    )
}

export default function AttendanceAdvanced({ readOnly = false, filterStudentId, selectedFacilityId = '' }) {
    const [date, setDate] = useState(today)
    const [students, setStudents] = useState([])
    const [records, setRecords] = useState({})
    const [classes, setClasses] = useState([])
    const [classFilter, setClassFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [editModal, setEditModal] = useState(null)
    const [saving, setSaving] = useState(false)
    const [savingIds, setSavingIds] = useState([])
    const [syncStatus, setSyncStatus] = useState({})
    const [page, setPage] = useState(1)
    const [err, setErr] = useState('')
    const supabaseMode = isSupabaseSession()

    useEffect(() => {
        if (supabaseMode) return
        const db = getDB()
        setStudents(db.students || [])
        setClasses(db.classes || [])
    }, [supabaseMode])

    useEffect(() => {
        if (supabaseMode) {
            loadSupabaseAttendance()
            return
        }
        if (!hasBackendAPI()) return
        const qs = new URLSearchParams({ date })
        if (filterStudentId) qs.set('studentId', filterStudentId)
        apiFetch(`/api/attendance-records?${qs}`)
            .then(res => {
                const map = {}
                for (const r of res.data || []) map[r.student_id] = r
                setRecords(map)
            })
            .catch(() => setErr('Lỗi tải dữ liệu'))
    }, [date, filterStudentId, supabaseMode, selectedFacilityId])

    useEffect(() => {
        if (!supabaseMode) return
        const sync = () =>
            syncOfflineQueue()
                .then(() => loadSupabaseAttendance())
                .catch(() => {})
        window.addEventListener('online', sync)
        sync()
        return () => window.removeEventListener('online', sync)
    }, [supabaseMode, date, selectedFacilityId])

    async function loadSupabaseAttendance() {
        setErr('')
        try {
            const profile = await getCurrentProfile()
            const facilityId = profile?.role === 'teacher' ? profile.facility_id : selectedFacilityId || undefined
            const items = await listStudents({ facilityId, status: 'active' })
            const scoped = filterStudentId ? items.filter(s => s.id === filterStudentId) : items
            setStudents(scoped)
            setClasses([...new Set(scoped.map(s => s.className).filter(Boolean))].map(name => ({ id: name, name })))
            cacheTeacherData('last-facility-id', facilityId || 'all')
            cacheTeacherData(`students:${facilityId || 'all'}`, scoped)
            const attendance = await listAttendanceByFacilityDate({
                facilityId: profile?.role === 'parent' ? undefined : facilityId,
                date,
            })
            const map = {}
            for (const record of attendance) map[record.studentId] = record
            setRecords(map)
            setSyncStatus(prev => {
                const next = { ...prev }
                attendance.forEach(record => {
                    next[record.studentId] = next[record.studentId] || 'synced'
                })
                return next
            })
            cacheTeacherData(`attendance:${facilityId || 'all'}:${date}`, map)
        } catch (ex) {
            const facilityId = readCachedTeacherData('last-facility-id', selectedFacilityId || 'all')
            const cachedStudents = readCachedTeacherData(`students:${facilityId}`, [])
            const cachedRecords = readCachedTeacherData(`attendance:${facilityId}:${date}`, {})
            if (cachedStudents.length) {
                setStudents(filterStudentId ? cachedStudents.filter(s => s.id === filterStudentId) : cachedStudents)
                setClasses(
                    [...new Set(cachedStudents.map(s => s.className).filter(Boolean))].map(name => ({
                        id: name,
                        name,
                    })),
                )
                setRecords(cachedRecords)
                setErr('Đang dùng dữ liệu offline. Thao tác sẽ tự đồng bộ khi có mạng.')
            } else {
                setErr(ex.message || 'Không tải được dữ liệu điểm danh')
            }
        }
    }

    useEffect(() => {
        if (!supabaseMode || !date || !students.length) return undefined
        const facilityId = selectedFacilityId || students.find(student => student.facilityId)?.facilityId || ''
        return subscribeAttendanceByFacilityDate({
            facilityId,
            date,
            onChange: ({ eventType, record, oldRecord }) => {
                const changed = record || oldRecord
                if (!changed?.studentId) return
                setRecords(prev => {
                    const next = { ...prev }
                    if (eventType === 'DELETE') delete next[changed.studentId]
                    else next[changed.studentId] = record
                    cacheTeacherData(`attendance:${facilityId || 'all'}:${date}`, next)
                    return next
                })
                if (record?.studentId) setSyncStatus(prev => ({ ...prev, [record.studentId]: 'synced' }))
            },
        })
    }, [supabaseMode, date, selectedFacilityId, students])

    const classFilteredStudents = filterStudentId
        ? students.filter(s => s.id === filterStudentId)
        : classFilter
          ? students.filter(s => (supabaseMode ? s.className : s.classId) === classFilter)
          : students
    const filteredStudents = statusFilter
        ? classFilteredStudents.filter(student => {
              const rec = records[student.id]
              if (statusFilter === 'missing') return !rec
              return rec?.status === statusFilter
          })
        : classFilteredStudents
    const pagedStudents = useMemo(
        () => filteredStudents.slice((page - 1) * STUDENTS_PER_PAGE, page * STUDENTS_PER_PAGE),
        [filteredStudents, page],
    )

    useEffect(() => {
        setPage(1)
    }, [date, classFilter, statusFilter, filteredStudents.length])

    async function quickMark(studentId, status) {
        if (readOnly) return
        if (status === 'absent') {
            const student = students.find(s => s.id === studentId)
            setEditModal({
                student,
                rec: {
                    ...(records[studentId] || {}),
                    studentId,
                    date,
                    status: 'absent',
                    absenceType: records[studentId]?.absenceType || records[studentId]?.absence_type || '',
                },
            })
            return
        }
        setSavingIds(prev => [...new Set([...prev, studentId])])
        try {
            const now = new Date().toTimeString().slice(0, 5)
            if (supabaseMode) {
                const student = students.find(s => s.id === studentId)
                const profile = await getCurrentProfile().catch(() => null)
                const optimistic = {
                    studentId,
                    facilityId: student?.facilityId || profile?.facility_id || selectedFacilityId,
                    date,
                    status,
                    absenceType: status === 'absent' ? 'unpermitted' : '',
                    checkInTime: status !== 'absent' ? now : '',
                    recordedBy: profile?.id || '',
                }
                setRecords(prev => {
                    const next = { ...prev, [studentId]: { ...(prev[studentId] || {}), ...optimistic } }
                    cacheTeacherData(`attendance:${student?.facilityId || selectedFacilityId || 'all'}:${date}`, next)
                    return next
                })
                setSyncStatus(prev => ({ ...prev, [studentId]: isOnline() ? 'syncing' : 'queued' }))
                if (isOnline()) {
                    try {
                        const saved = await upsertAttendance(optimistic)
                        setRecords(prev => ({ ...prev, [studentId]: saved }))
                        setSyncStatus(prev => ({ ...prev, [studentId]: 'synced' }))
                    } catch (error) {
                        enqueueOfflineAction('attendance', optimistic)
                        setSyncStatus(prev => ({ ...prev, [studentId]: 'queued' }))
                        setErr(error.message || 'Chưa lưu được lên máy chủ. Điểm danh đã lưu offline và sẽ tự đồng bộ.')
                    }
                } else {
                    enqueueOfflineAction('attendance', optimistic)
                    setSyncStatus(prev => ({ ...prev, [studentId]: 'queued' }))
                    setErr('Đang offline. Điểm danh đã lưu tạm trên máy.')
                }
                setSavingIds(prev => prev.filter(id => id !== studentId))
                return
            }
            const res = await apiFetch(`/api/attendance-records/${studentId}/${date}`, {
                method: 'PUT',
                body: JSON.stringify({ status, checkInTime: status !== 'absent' ? now : null }),
            })
            setRecords(prev => ({ ...prev, [studentId]: res.data }))
        } catch (ex) {
            setErr(ex.message)
        }
        setSavingIds(prev => prev.filter(id => id !== studentId))
    }

    async function saveDetail(input) {
        setSaving(true)
        try {
            const attendanceInput = input
            if (supabaseMode) {
                const student = students.find(s => s.id === attendanceInput.studentId)
                const profile = await getCurrentProfile().catch(() => null)
                const optimistic = {
                    studentId: attendanceInput.studentId,
                    facilityId: student?.facilityId || profile?.facility_id || selectedFacilityId,
                    date,
                    status: attendanceInput.status,
                    absenceType: attendanceInput.status === 'absent' ? attendanceInput.absenceType : '',
                    checkInTime: attendanceInput.checkInTime,
                    checkOutTime: attendanceInput.checkOutTime,
                    pickupPerson: attendanceInput.pickupPerson,
                    pickupPhone: attendanceInput.pickupPhone,
                    lateReason: attendanceInput.lateReason,
                    earlyPickupReason: attendanceInput.earlyPickupReason,
                    note: attendanceInput.note,
                    recordedBy: profile?.id || '',
                }
                setRecords(prev => {
                    const next = {
                        ...prev,
                        [attendanceInput.studentId]: { ...(prev[attendanceInput.studentId] || {}), ...optimistic },
                    }
                    cacheTeacherData(`attendance:${student?.facilityId || selectedFacilityId || 'all'}:${date}`, next)
                    return next
                })
                if (isOnline()) {
                    try {
                        const saved = await upsertAttendance(optimistic)
                        setRecords(prev => ({ ...prev, [attendanceInput.studentId]: saved }))
                    } catch (error) {
                        enqueueOfflineAction('attendance', optimistic)
                        setErr(
                            error.message ||
                                'Chưa lưu được chi tiết lên máy chủ. Điểm danh đã lưu offline và sẽ tự đồng bộ.',
                        )
                    }
                } else {
                    enqueueOfflineAction('attendance', optimistic)
                    setErr('Đang offline. Chi tiết điểm danh đã lưu tạm trên máy.')
                }
                setEditModal(null)
                setSaving(false)
                return
            }
            const res = await apiFetch(`/api/attendance-records/${attendanceInput.studentId}/${date}`, {
                method: 'PUT',
                body: JSON.stringify(attendanceInput),
            })
            setRecords(prev => ({ ...prev, [attendanceInput.studentId]: res.data }))
            setEditModal(null)
        } catch (ex) {
            setErr(ex.message)
        }
        setSaving(false)
    }

    const classRecords = useMemo(
        () => classFilteredStudents.map(student => records[student.id]).filter(Boolean),
        [classFilteredStudents, records],
    )
    const totalMarked = classRecords.length
    const missingCount = Math.max(0, classFilteredStudents.length - totalMarked)
    const progressPct = classFilteredStudents.length
        ? Math.round((totalMarked / classFilteredStudents.length) * 100)
        : 0
    const failedCount = getFailedActions().filter(action => action.type === 'attendance').length
    const totalPresent = classRecords.filter(record => record.status === 'present').length
    const totalAbsent = classRecords.filter(record => record.status === 'absent').length
    const totalLate = classRecords.filter(record => record.status === 'late').length

    return (
        <div>
            {!readOnly && (
                <div
                    style={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 80,
                        background: 'rgba(245,243,255,0.97)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid #DDD6FE',
                        borderRadius: 14,
                        padding: '8px 12px',
                        marginBottom: 14,
                        boxShadow: '0 8px 24px rgba(109,40,217,0.12)',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                            flexWrap: 'wrap',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ color: '#1E1B4B', fontWeight: 900, fontSize: 13 }}>
                                Điểm danh {totalMarked}/{classFilteredStudents.length}
                            </span>
                            <SummaryPill label="Có" value={totalPresent} color="#059669" bg="#ECFDF5" />
                            <SummaryPill label="Vắng" value={totalAbsent} color="#DC2626" bg="#FEF2F2" />
                            <SummaryPill label="Trễ" value={totalLate} color="#D97706" bg="#FFFBEB" />
                            <SummaryPill label="Còn" value={missingCount} color="#6D28D9" bg="#EDE9FE" />
                        </div>
                        <PaginationBar
                            page={page}
                            pageSize={STUDENTS_PER_PAGE}
                            total={filteredStudents.length}
                            onPageChange={setPage}
                            itemLabel="bé"
                            compact
                        />
                    </div>
                </div>
            )}

            {/* Date + filter bar */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
                <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    style={{
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: '1.5px solid #DDD6FE',
                        fontSize: 14,
                        fontWeight: 700,
                        color: '#1E1B4B',
                    }}
                />
                {!filterStudentId && (
                    <select
                        value={classFilter}
                        onChange={e => setClassFilter(e.target.value)}
                        style={{
                            padding: '10px 14px',
                            borderRadius: 10,
                            border: '1.5px solid #DDD6FE',
                            fontSize: 13,
                            color: '#1E1B4B',
                        }}
                    >
                        <option value="">Tất cả lớp</option>
                        {classes.map(c => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                )}
                {err && <span style={{ fontSize: 13, color: '#DC2626' }}>{err}</span>}
            </div>

            {!readOnly && (
                <div
                    style={{
                        background: '#fff',
                        borderRadius: 16,
                        padding: 16,
                        marginBottom: 16,
                        boxShadow: '0 2px 14px rgba(109,40,217,0.07)',
                    }}
                >
                    <div
                        className="mobile-stack"
                        style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}
                    >
                        <div style={{ flex: 1, minWidth: 220 }}>
                            <div style={{ fontSize: 14, fontWeight: 900, color: '#1E1B4B' }}>Tiến độ điểm danh</div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: '#6B6494', marginTop: 3 }}>
                                {totalMarked}/{classFilteredStudents.length} bé đã điểm danh · còn {missingCount} bé
                            </div>
                            <div
                                style={{
                                    height: 8,
                                    background: '#EDE9FE',
                                    borderRadius: 999,
                                    overflow: 'hidden',
                                    marginTop: 10,
                                }}
                            >
                                <div
                                    style={{
                                        width: `${progressPct}%`,
                                        height: '100%',
                                        background: 'linear-gradient(135deg,#16A34A,#34D399)',
                                        borderRadius: 999,
                                    }}
                                />
                            </div>
                            {failedCount > 0 && (
                                <div style={{ color: '#DC2626', fontSize: 12, fontWeight: 800, marginTop: 8 }}>
                                    Có {failedCount} điểm danh lỗi sync cần thử lại.
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {[
                                ['', 'Tất cả'],
                                ['missing', 'Chưa điểm danh'],
                                ['present', 'Có mặt'],
                                ['absent', 'Vắng'],
                                ['late', 'Đi trễ'],
                            ].map(([value, label]) => (
                                <button
                                    key={value || 'all'}
                                    onClick={() => setStatusFilter(value)}
                                    style={{
                                        padding: '9px 11px',
                                        borderRadius: 10,
                                        border: '1.5px solid #DDD6FE',
                                        background: statusFilter === value ? '#EDE9FE' : '#fff',
                                        color: statusFilter === value ? '#7C3AED' : '#5B5490',
                                        fontWeight: 900,
                                        fontSize: 12,
                                        cursor: 'pointer',
                                    }}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Summary */}
            {!readOnly && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                    {[
                        { label: 'Có mặt', count: totalPresent, color: '#059669', bg: '#ECFDF5' },
                        { label: 'Vắng mặt', count: totalAbsent, color: '#DC2626', bg: '#FEF2F2' },
                        { label: 'Đi trễ', count: totalLate, color: '#D97706', bg: '#FFFBEB' },
                        { label: 'Tổng', count: filteredStudents.length, color: '#6D28D9', bg: '#EDE9FE' },
                    ].map(s => (
                        <div
                            key={s.label}
                            style={{
                                background: s.bg,
                                borderRadius: 12,
                                padding: '12px 20px',
                                textAlign: 'center',
                                minWidth: 90,
                            }}
                        >
                            <div style={{ fontWeight: 900, fontSize: 24, color: s.color }}>{s.count}</div>
                            <div style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>{s.label}</div>
                        </div>
                    ))}
                </div>
            )}

            <PaginationBar
                page={page}
                pageSize={STUDENTS_PER_PAGE}
                total={filteredStudents.length}
                onPageChange={setPage}
                itemLabel="bé"
            />

            {/* Student list — mobile-optimized large buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pagedStudents.map(student => {
                    const rec = records[student.id]
                    const status = rec?.status || null
                    const cfg = status ? STATUS_CONFIG[status] : null
                    const cls = supabaseMode ? { name: student.className } : classes.find(c => c.id === student.classId)
                    const rowSaving = savingIds.includes(student.id)

                    return (
                        <div
                            className="mobile-stack"
                            key={student.id}
                            style={{
                                background: cfg ? cfg.bg : '#fff',
                                borderRadius: 14,
                                padding: '14px 18px',
                                boxShadow: '0 2px 8px rgba(109,40,217,0.07)',
                                border: `1.5px solid ${cfg ? cfg.border : '#EDE9FE'}`,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 14,
                            }}
                        >
                            {/* Avatar */}
                            <div
                                style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 12,
                                    background: 'linear-gradient(135deg,#6D28D9,#A78BFA)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#fff',
                                    fontWeight: 900,
                                    fontSize: 16,
                                    flexShrink: 0,
                                }}
                            >
                                {student.name?.charAt(0)}
                            </div>
                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 800, fontSize: 15, color: '#1E1B4B' }}>{student.name}</div>
                                <div style={{ fontSize: 12, color: '#7C6D9B' }}>
                                    {cls?.name || student.classId || ''}
                                    {rec?.checkInTime && (
                                        <span style={{ marginLeft: 8, color: '#059669' }}>⏱ Vào {rec.checkInTime}</span>
                                    )}
                                    {rec?.checkOutTime && (
                                        <span style={{ marginLeft: 8, color: '#2563EB' }}>⏱ Ra {rec.checkOutTime}</span>
                                    )}
                                    <span style={{ marginLeft: 8 }}>
                                        <SyncStatusIcon status={syncStatus[student.id] || (rec ? 'synced' : '')} />
                                    </span>
                                </div>
                                {rec?.pickupPerson && (
                                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                                        🚗 {rec.pickupPerson} ({rec.pickupPhone || '—'})
                                    </div>
                                )}
                            </div>
                            {/* Quick actions */}
                            {!readOnly && (
                                <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                                    {Object.entries(STATUS_CONFIG).map(([key, conf]) => (
                                        <button
                                            key={key}
                                            onClick={() => quickMark(student.id, key)}
                                            disabled={rowSaving}
                                            aria-label={`Đánh dấu ${conf.label}`}
                                            title={conf.label}
                                            style={{
                                                width: 38,
                                                height: 38,
                                                borderRadius: 10,
                                                border: `2px solid ${status === key ? conf.color : '#E5E7EB'}`,
                                                background: status === key ? conf.bg : '#fff',
                                                cursor: rowSaving ? 'wait' : 'pointer',
                                                fontSize: 16,
                                                fontWeight: 700,
                                                transition: 'all 0.15s',
                                            }}
                                        >
                                            {conf.icon}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => setEditModal({ student, rec })}
                                        aria-label="Ghi chi tiết"
                                        title="Ghi chi tiết"
                                        style={{
                                            width: 38,
                                            height: 38,
                                            borderRadius: 10,
                                            border: '2px solid #DDD6FE',
                                            background: '#F5F3FF',
                                            cursor: 'pointer',
                                            fontSize: 14,
                                        }}
                                    >
                                        ✏️
                                    </button>
                                </div>
                            )}
                            {readOnly && cfg && <span style={{ fontSize: 22 }}>{cfg.icon}</span>}
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
            <PaginationBar
                page={page}
                pageSize={STUDENTS_PER_PAGE}
                total={filteredStudents.length}
                onPageChange={setPage}
                itemLabel="bé"
            />

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

function SummaryPill({ label, value, color, bg }) {
    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                borderRadius: 999,
                background: bg,
                color,
                padding: '5px 8px',
                fontSize: 11,
                fontWeight: 900,
            }}
        >
            {label}: {value}
        </span>
    )
}

function isPermittedAbsenceNote(value = '') {
    const text = String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
    if (text.startsWith('[k]')) return false
    if (text.startsWith('[p]')) return true
    return text === 'p' || text.includes('co phep') || text.includes('xin phep') || text.includes('xin nghi')
}

function absenceTypeFromNote(value = '') {
    return isPermittedAbsenceNote(value) ? 'permitted' : 'unpermitted'
}

function noteWithAbsenceType(note = '', absenceType = '') {
    const text = String(note || '').trim()
    const cleaned = text.replace(/^\[(?:P|K)\]\s*/i, '').trim()
    if (absenceType === 'permitted') return `[P] ${cleaned || 'Vắng có phép'}`
    if (absenceType === 'unpermitted') return `[K] ${cleaned || 'Vắng không phép'}`
    return cleaned
}

function DetailModal({ student, rec, date, saving, onSave, onClose }) {
    const initialNote = rec?.note || ''
    const initialAbsenceType =
        rec?.absenceType || rec?.absence_type || (initialNote ? absenceTypeFromNote(initialNote) : '')
    const [form, setForm] = useState({
        status: rec?.status || 'present',
        checkInTime: rec?.checkInTime || rec?.check_in_time || '',
        checkOutTime: rec?.checkOutTime || rec?.check_out_time || '',
        pickupPerson: rec?.pickupPerson || rec?.pickup_person || '',
        pickupPhone: rec?.pickupPhone || rec?.pickup_phone || '',
        lateReason: rec?.lateReason || rec?.late_reason || '',
        earlyPickupReason: rec?.earlyPickupReason || rec?.early_pickup_reason || '',
        absenceType: initialAbsenceType,
        note: initialNote,
    })
    const absenceTypeMissing = form.status === 'absent' && !form.absenceType

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Chi tiết điểm danh"
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(30,27,75,0.5)',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                zIndex: 1000,
            }}
        >
            <div
                style={{
                    background: '#fff',
                    borderRadius: '20px 20px 0 0',
                    width: '100%',
                    maxWidth: 560,
                    padding: '24px 24px 32px',
                    boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                }}
            >
                <div
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}
                >
                    <div style={{ fontWeight: 900, fontSize: 16, color: '#1E1B4B' }}>📋 Điểm danh: {student.name}</div>
                    <button
                        onClick={onClose}
                        style={{
                            background: '#F5F3FF',
                            border: 'none',
                            borderRadius: 8,
                            padding: '6px 12px',
                            cursor: 'pointer',
                            fontWeight: 700,
                        }}
                    >
                        ✕
                    </button>
                </div>
                <div style={{ fontSize: 13, color: '#7C6D9B', marginBottom: 16 }}>Ngày: {date}</div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
                    {Object.entries(STATUS_CONFIG).map(([key, conf]) => (
                        <button
                            key={key}
                            onClick={() =>
                                setForm(f => ({
                                    ...f,
                                    status: key,
                                    note:
                                        key === 'absent' && f.absenceType
                                            ? noteWithAbsenceType(f.note, f.absenceType)
                                            : f.note,
                                }))
                            }
                            style={{
                                padding: '8px 16px',
                                borderRadius: 20,
                                border: `2px solid ${form.status === key ? conf.color : '#E5E7EB'}`,
                                background: form.status === key ? conf.bg : '#fff',
                                color: form.status === key ? conf.color : '#6B7280',
                                fontWeight: 700,
                                fontSize: 13,
                                cursor: 'pointer',
                            }}
                        >
                            {conf.icon} {conf.label}
                        </button>
                    ))}
                </div>

                <div
                    className="mobile-two-col"
                    style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}
                >
                    <LabelInput
                        label="Giờ vào"
                        type="time"
                        value={form.checkInTime}
                        onChange={v => setForm(f => ({ ...f, checkInTime: v }))}
                    />
                    <LabelInput
                        label="Giờ ra"
                        type="time"
                        value={form.checkOutTime}
                        onChange={v => setForm(f => ({ ...f, checkOutTime: v }))}
                    />
                </div>
                <div
                    className="mobile-two-col"
                    style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}
                >
                    <LabelInput
                        label="Người đón"
                        value={form.pickupPerson}
                        onChange={v => setForm(f => ({ ...f, pickupPerson: v }))}
                        placeholder="Tên người đón"
                    />
                    <LabelInput
                        label="Điện thoại người đón"
                        value={form.pickupPhone}
                        onChange={v => setForm(f => ({ ...f, pickupPhone: v }))}
                        placeholder="0901..."
                    />
                </div>
                {form.status === 'late' && (
                    <LabelInput
                        label="Lý do đến trễ"
                        value={form.lateReason}
                        onChange={v => setForm(f => ({ ...f, lateReason: v }))}
                        placeholder="Tắc đường, ốm..."
                        style={{ marginBottom: 12 }}
                    />
                )}
                {form.status === 'absent' && (
                    <div style={{ marginBottom: 12 }}>
                        <label
                            style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: '#5B5490',
                                display: 'block',
                                marginBottom: 6,
                            }}
                        >
                            Loại vắng
                        </label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {[
                                ['unpermitted', 'K - Không phép', '#DC2626', '#FEF2F2'],
                                ['permitted', 'P - Có phép', '#B45309', '#FFFBEB'],
                            ].map(([value, label, color, bg]) => (
                                <button
                                    key={value}
                                    onClick={() =>
                                        setForm(f => ({
                                            ...f,
                                            absenceType: value,
                                            note: noteWithAbsenceType(f.note, value),
                                        }))
                                    }
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: 10,
                                        border: `1.5px solid ${form.absenceType === value ? color : '#DDD6FE'}`,
                                        background: form.absenceType === value ? bg : '#fff',
                                        color: form.absenceType === value ? color : '#6B6494',
                                        fontSize: 12,
                                        fontWeight: 800,
                                    }}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        {absenceTypeMissing && (
                            <div style={{ marginTop: 6, color: '#DC2626', fontSize: 12, fontWeight: 700 }}>
                                Chọn rõ K hoặc P trước khi lưu vắng mặt.
                            </div>
                        )}
                    </div>
                )}
                {form.status === 'early_pickup' && (
                    <LabelInput
                        label="Lý do đón sớm"
                        value={form.earlyPickupReason}
                        onChange={v => setForm(f => ({ ...f, earlyPickupReason: v }))}
                        placeholder="Lý do..."
                        style={{ marginBottom: 12 }}
                    />
                )}
                <LabelInput
                    label="Ghi chú"
                    value={form.note}
                    onChange={v => setForm(f => ({ ...f, note: v }))}
                    placeholder="Ghi chú thêm..."
                    style={{ marginBottom: 18 }}
                />

                <button
                    onClick={() =>
                        !absenceTypeMissing &&
                        onSave({
                            studentId: student.id,
                            ...form,
                            note:
                                form.status === 'absent' ? noteWithAbsenceType(form.note, form.absenceType) : form.note,
                        })
                    }
                    disabled={saving || absenceTypeMissing}
                    style={{
                        width: '100%',
                        padding: '14px',
                        borderRadius: 14,
                        border: 'none',
                        background:
                            saving || absenceTypeMissing ? '#DDD6FE' : 'linear-gradient(135deg,#6D28D9,#8B5CF6)',
                        color: saving || absenceTypeMissing ? '#7C6D9B' : '#fff',
                        fontWeight: 800,
                        fontSize: 15,
                        cursor: saving ? 'wait' : absenceTypeMissing ? 'not-allowed' : 'pointer',
                    }}
                >
                    {saving ? 'Đang lưu...' : '💾 Lưu điểm danh'}
                </button>
            </div>
        </div>
    )
}

function LabelInput({ label, value, onChange, type = 'text', placeholder = '', style = {} }) {
    return (
        <div style={style}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#5B5490', display: 'block', marginBottom: 4 }}>
                {label}
            </label>
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1.5px solid #DDD6FE',
                    fontSize: 13,
                    color: '#1E1B4B',
                    boxSizing: 'border-box',
                }}
            />
        </div>
    )
}
