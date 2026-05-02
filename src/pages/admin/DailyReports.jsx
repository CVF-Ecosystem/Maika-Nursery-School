import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { getDB, commit, todayStr } from '../../data/store'
import { fmtDate } from '../../utils/format'
import { isSupabaseSession } from '../../data/backendMode'
import { getCurrentProfile } from '../../features/auth/authService'
import { listStudents } from '../../features/students/studentService'
import {
    listDailyReportsByFacilityDate,
    saveDailyReport,
    subscribeDailyReports,
} from '../../features/reports/dailyReportService'
import { listAttendanceByFacilityDate } from '../../features/attendance/attendanceService'
import { listIncidents } from '../../features/sensitive/sensitiveService'
import { compressImage, getSignedUrl, uploadReportPhoto } from '../../features/media/mediaService'
import { createNotification } from '../../features/operations/operationalService'
import ModalCloseButton from '../../components/ModalCloseButton'
import PaginationBar from '../../components/PaginationBar'
import {
    cacheTeacherData,
    enqueueOfflineAction,
    getFailedActions,
    isOnline,
    readCachedTeacherData,
    syncOfflineQueue,
} from '../../features/offline/offlineSyncService'

const STUDENTS_PER_PAGE = 12

function Avatar({ initials, size = 36 }) {
    const colors = ['#7C3AED', '#A78BFA', '#34D399', '#06B6D4', '#EC4899']
    const c = colors[(initials.charCodeAt(0) || 0) % colors.length]
    return (
        <div
            style={{
                width: size,
                height: size,
                borderRadius: 999,
                background: `linear-gradient(135deg,${c},${c}99)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 800,
                fontSize: size * 0.35,
                flexShrink: 0,
            }}
        >
            {initials}
        </div>
    )
}

function ReportChip({ icon, label, value }) {
    return (
        <div style={{ background: '#F8F7FF', borderRadius: 8, padding: '6px 10px' }}>
            <div style={{ fontSize: 10, color: '#7C6D9B', fontWeight: 700 }}>
                {icon} {label}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1E1B4B', marginTop: 1 }}>{value || '—'}</div>
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

const MOOD_OPTIONS = ['Vui vẻ', 'Hào hứng', 'Bình thường', 'Mệt mỏi', 'Buồn ngủ', 'Khó chịu']
const MEAL_OPTIONS = ['Ăn hết suất', 'Ăn được 3/4', 'Ăn được 1/2', 'Ăn ít', 'Không ăn']
const ACTIVITY_OPTIONS = ['Vẽ tranh', 'Đọc sách', 'Hát nhạc', 'Vận động', 'Kể chuyện', 'Chơi cát', 'Làm thủ công']
const DRAFT_PREFIX = 'maika_daily_report_draft_v1:'

function defaultReport(overrides = {}) {
    return {
        breakfast: 'Ăn hết suất',
        lunch: 'Ăn hết suất',
        snack: 'Ăn hết suất',
        napDuration: 90,
        mood: 'Vui vẻ',
        activities: [],
        note: '',
        health: 'Bình thường',
        ...overrides,
    }
}

function getInitials(name = '') {
    return (
        name
            .split(' ')
            .filter(Boolean)
            .slice(-2)
            .map(word => word[0])
            .join('')
            .toUpperCase() || '?'
    )
}

function readDraft(draftKey) {
    if (!draftKey) return null
    try {
        const raw = localStorage.getItem(DRAFT_PREFIX + draftKey)
        return raw ? JSON.parse(raw) : null
    } catch {
        return null
    }
}

function writeDraft(draftKey, data) {
    if (!draftKey) return
    try {
        localStorage.setItem(DRAFT_PREFIX + draftKey, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }))
    } catch {
        /* local draft is best effort */
    }
}

function clearDraft(draftKey) {
    if (!draftKey) return
    try {
        localStorage.removeItem(DRAFT_PREFIX + draftKey)
    } catch {
        /* local draft is best effort */
    }
}

function SyncStatusIcon({ status }) {
    if (!status) return null
    const map = {
        draft: ['💾', 'Đã lưu trên máy', '#7C6D9B'],
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

function TeacherTodayPanel({
    total,
    completed,
    missing,
    failedCount,
    showMissingOnly,
    onToggleMissing,
    onOpenBatch,
    onOpenSummary,
}) {
    const percent = total ? Math.round((completed / total) * 100) : 0
    return (
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
                    <div style={{ fontSize: 14, fontWeight: 900, color: '#1E1B4B' }}>Tiến độ nhật ký hôm nay</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#6B6494', marginTop: 3 }}>
                        {completed}/{total} bé đã có nhật ký · còn {missing} bé
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
                                width: `${percent}%`,
                                height: '100%',
                                background: 'linear-gradient(135deg,#16A34A,#34D399)',
                                borderRadius: 999,
                            }}
                        />
                    </div>
                    {failedCount > 0 && (
                        <div style={{ color: '#DC2626', fontSize: 12, fontWeight: 800, marginTop: 8 }}>
                            Có {failedCount} mục đồng bộ lỗi cần thử lại.
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button
                        onClick={onToggleMissing}
                        style={{
                            padding: '9px 12px',
                            borderRadius: 10,
                            border: '1.5px solid #DDD6FE',
                            background: showMissingOnly ? '#EDE9FE' : '#fff',
                            color: '#7C3AED',
                            fontWeight: 900,
                            fontSize: 12,
                            cursor: 'pointer',
                        }}
                    >
                        {showMissingOnly ? 'Hiện tất cả' : 'Chưa có nhật ký'}
                    </button>
                    <button
                        onClick={onOpenBatch}
                        style={{
                            padding: '9px 12px',
                            borderRadius: 10,
                            border: '1.5px solid #7C3AED',
                            background: '#fff',
                            color: '#7C3AED',
                            fontWeight: 900,
                            fontSize: 12,
                            cursor: 'pointer',
                        }}
                    >
                        Làm hàng loạt
                    </button>
                    <button
                        onClick={onOpenSummary}
                        style={{
                            padding: '9px 12px',
                            borderRadius: 10,
                            border: 'none',
                            background: '#1E1B4B',
                            color: '#fff',
                            fontWeight: 900,
                            fontSize: 12,
                            cursor: 'pointer',
                        }}
                    >
                        Tổng kết ngày
                    </button>
                </div>
            </div>
        </div>
    )
}

function BatchModal({ selectedCount, onClose, onApply }) {
    const [form, setForm] = useState(defaultReport())
    const is = {
        width: '100%',
        padding: '9px 12px',
        borderRadius: 8,
        border: '1.5px solid #DDD6FE',
        fontSize: 13,
        color: '#1E1B4B',
        boxSizing: 'border-box',
    }
    const ls = { fontSize: 12, fontWeight: 800, color: '#6B6494', display: 'block', marginBottom: 4 }
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
        >
            <div
                style={{
                    position: 'relative',
                    background: '#fff',
                    borderRadius: 18,
                    width: 'min(460px, calc(100vw - 24px))',
                    padding: 24,
                    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                }}
            >
                <ModalCloseButton onClick={onClose} />
                <div style={{ fontWeight: 900, fontSize: 16, color: '#1E1B4B' }}>
                    Áp dụng cho {selectedCount} học sinh
                </div>
                <div style={{ fontSize: 12, color: '#7C6D9B', fontWeight: 700, margin: '4px 0 16px' }}>
                    Dùng cho các thông tin giống nhau, sau đó sửa ngoại lệ từng bé.
                </div>
                <div className="mobile-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[
                        ['breakfast', 'Bữa sáng'],
                        ['lunch', 'Bữa trưa'],
                        ['snack', 'Bữa xế'],
                    ].map(([key, label]) => (
                        <div key={key}>
                            <label style={ls}>{label}</label>
                            <select
                                style={is}
                                value={form[key]}
                                onChange={e => setForm({ ...form, [key]: e.target.value })}
                            >
                                {MEAL_OPTIONS.map(o => (
                                    <option key={o}>{o}</option>
                                ))}
                            </select>
                        </div>
                    ))}
                    <div>
                        <label style={ls}>Ngủ trưa</label>
                        <input
                            type="number"
                            min={0}
                            max={180}
                            step={15}
                            style={is}
                            value={form.napDuration}
                            onChange={e => setForm({ ...form, napDuration: +e.target.value })}
                        />
                    </div>
                    <div>
                        <label style={ls}>Tâm trạng</label>
                        <select style={is} value={form.mood} onChange={e => setForm({ ...form, mood: e.target.value })}>
                            {MOOD_OPTIONS.map(o => (
                                <option key={o}>{o}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={ls}>Sức khỏe</label>
                        <select
                            style={is}
                            value={form.health}
                            onChange={e => setForm({ ...form, health: e.target.value })}
                        >
                            {['Bình thường', 'Sốt nhẹ', 'Ho', 'Đau bụng', 'Dị ứng'].map(o => (
                                <option key={o}>{o}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '9px 18px',
                            borderRadius: 10,
                            border: '1.5px solid #DDD6FE',
                            background: '#fff',
                            color: '#6B6494',
                            fontWeight: 800,
                            cursor: 'pointer',
                        }}
                    >
                        Hủy
                    </button>
                    <button
                        onClick={() => onApply(form)}
                        style={{
                            padding: '9px 20px',
                            borderRadius: 10,
                            border: 'none',
                            background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)',
                            color: '#fff',
                            fontWeight: 900,
                            cursor: 'pointer',
                        }}
                    >
                        Áp dụng
                    </button>
                </div>
            </div>
        </div>
    )
}

function EndOfDayModal({ summary, sending, sent, onClose, onSend }) {
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
        >
            <div
                style={{
                    position: 'relative',
                    background: '#fff',
                    borderRadius: 18,
                    width: 'min(440px, calc(100vw - 24px))',
                    padding: 24,
                    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                }}
            >
                <ModalCloseButton onClick={onClose} />
                <div style={{ fontWeight: 900, fontSize: 16, color: '#1E1B4B' }}>Tổng kết cuối ngày</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '16px 0' }}>
                    <ReportChip icon="✅" label="Đã ghi" value={`${summary.completed}/${summary.total}`} />
                    <ReportChip icon="⏳" label="Còn thiếu" value={`${summary.missing}`} />
                </div>
                {summary.missingNames.length > 0 && (
                    <div style={{ fontSize: 12, color: '#6B6494', fontWeight: 700, lineHeight: 1.5 }}>
                        Chưa có nhật ký: {summary.missingNames.join(', ')}
                    </div>
                )}
                {sent && (
                    <div style={{ marginTop: 12, color: '#16A34A', fontWeight: 900, fontSize: 12 }}>
                        Đã gửi thông báo cho hiệu trưởng.
                    </div>
                )}
                <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '9px 18px',
                            borderRadius: 10,
                            border: '1.5px solid #DDD6FE',
                            background: '#fff',
                            color: '#6B6494',
                            fontWeight: 800,
                            cursor: 'pointer',
                        }}
                    >
                        Đóng
                    </button>
                    <button
                        disabled={sending || sent}
                        onClick={onSend}
                        style={{
                            padding: '9px 20px',
                            borderRadius: 10,
                            border: 'none',
                            background: sent ? '#A7F3D0' : '#1E1B4B',
                            color: sent ? '#065F46' : '#fff',
                            fontWeight: 900,
                            cursor: sending || sent ? 'default' : 'pointer',
                        }}
                    >
                        {sending ? 'Đang gửi...' : sent ? 'Đã gửi' : 'Gửi hiệu trưởng'}
                    </button>
                </div>
            </div>
        </div>
    )
}

function EditModal({ student, report, onClose, onSave, showPhotos = false, draftKey = '', reportDate = todayStr() }) {
    const draft = useMemo(() => readDraft(draftKey), [draftKey])
    const [form, setForm] = useState(draft?.form || report || defaultReport())
    const [existingPaths, setExistingPaths] = useState(draft?.existingPaths || report?.photoPaths || [])
    const [existingUrls, setExistingUrls] = useState([])
    const [photoFiles, setPhotoFiles] = useState([])
    const [photoPreviews, setPhotoPreviews] = useState([])
    const [compressing, setCompressing] = useState(false)
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
        if (!showPhotos || !existingPaths.length) return
        Promise.all(existingPaths.map(p => getSignedUrl(p).catch(() => ''))).then(setExistingUrls)
    }, [showPhotos, existingPaths])

    useEffect(() => {
        writeDraft(draftKey, { form, existingPaths })
    }, [draftKey, form, existingPaths])

    async function handlePhotoSelect(e) {
        const files = Array.from(e.target.files || [])
        const remaining = 3 - existingPaths.length - photoFiles.length
        const newFiles = files.slice(0, Math.max(0, remaining))
        if (!newFiles.length) return
        setCompressing(true)
        try {
            const optimizedFiles = await Promise.all(newFiles.map(file => compressImage(file)))
            setPhotoFiles(prev => [...prev, ...optimizedFiles])
            setPhotoPreviews(prev => [...prev, ...optimizedFiles.map(f => URL.createObjectURL(f))])
        } finally {
            setCompressing(false)
        }
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
        >
            <div
                style={{
                    position: 'relative',
                    background: '#fff',
                    borderRadius: 20,
                    width: 'min(480px, calc(100vw - 24px))',
                    padding: 28,
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                }}
            >
                <ModalCloseButton onClick={onClose} />
                <div style={{ fontWeight: 800, fontSize: 16, color: '#1E1B4B', marginBottom: 4 }}>
                    Nhật ký: {student?.name}
                </div>
                <div style={{ fontSize: 12, color: '#7C6D9B', marginBottom: 18 }}>
                    Ngày {fmtDate(reportDate)}
                    {draft && <span style={{ color: '#D97706', fontWeight: 800 }}> · đã khôi phục nháp</span>}
                </div>
                <div className="mobile-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[
                        ['breakfast', '🍳 Bữa sáng'],
                        ['lunch', '🍱 Bữa trưa'],
                        ['snack', '🍎 Bữa xế'],
                    ].map(([key, lbl]) => (
                        <div key={key}>
                            <label style={ls}>{lbl}</label>
                            <select
                                style={is}
                                value={form[key]}
                                onChange={e => setForm({ ...form, [key]: e.target.value })}
                            >
                                {MEAL_OPTIONS.map(o => (
                                    <option key={o}>{o}</option>
                                ))}
                            </select>
                        </div>
                    ))}
                    <div>
                        <label style={ls}>😴 Ngủ trưa (phút)</label>
                        <input
                            type="number"
                            min={0}
                            max={180}
                            step={15}
                            style={is}
                            value={form.napDuration}
                            onChange={e => setForm({ ...form, napDuration: +e.target.value })}
                        />
                    </div>
                    <div>
                        <label style={ls}>😊 Tâm trạng</label>
                        <select style={is} value={form.mood} onChange={e => setForm({ ...form, mood: e.target.value })}>
                            {MOOD_OPTIONS.map(o => (
                                <option key={o}>{o}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={ls}>🏥 Sức khỏe</label>
                        <select
                            style={is}
                            value={form.health}
                            onChange={e => setForm({ ...form, health: e.target.value })}
                        >
                            {['Bình thường', 'Sốt nhẹ', 'Ho', 'Đau bụng', 'Dị ứng'].map(o => (
                                <option key={o}>{o}</option>
                            ))}
                        </select>
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                        <label style={ls}>🎨 Hoạt động</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {ACTIVITY_OPTIONS.map(a => {
                                const active = (form.activities || []).includes(a)
                                return (
                                    <button
                                        key={a}
                                        onClick={() => {
                                            const acts = form.activities || []
                                            setForm({
                                                ...form,
                                                activities: active ? acts.filter(x => x !== a) : [...acts, a],
                                            })
                                        }}
                                        style={{
                                            padding: '4px 12px',
                                            borderRadius: 20,
                                            border: `1.5px solid ${active ? '#7C3AED' : '#DDD6FE'}`,
                                            background: active ? '#EDE9FE' : '#fff',
                                            color: active ? '#7C3AED' : '#6B6494',
                                            fontWeight: 700,
                                            fontSize: 12,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {a}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 4,
                            }}
                        >
                            <label style={{ ...ls, marginBottom: 0 }}>💬 Ghi chú thêm</label>
                            <button
                                type="button"
                                onClick={() => {
                                    const mealSummary = [
                                        form.breakfast && `sáng: ${form.breakfast.toLowerCase()}`,
                                        form.lunch && `trưa: ${form.lunch.toLowerCase()}`,
                                        form.snack && `xế: ${form.snack.toLowerCase()}`,
                                    ]
                                        .filter(Boolean)
                                        .join(', ')
                                    const sleepSummary =
                                        form.napDuration >= 60
                                            ? 'ngủ trưa ngon giấc'
                                            : form.napDuration >= 20
                                              ? 'ngủ trưa ít'
                                              : 'không ngủ trưa'
                                    const acts = (form.activities || []).join(', ')
                                    const health =
                                        form.health && form.health !== 'Bình thường'
                                            ? ` Sức khỏe: ${form.health.toLowerCase()}.`
                                            : ''
                                    const lines = [
                                        `Hôm nay bé ${form.mood ? form.mood.toLowerCase() : 'bình thường'}.`,
                                        mealSummary ? `Bữa ăn (${mealSummary}).` : '',
                                        `Giấc ngủ: ${sleepSummary} (${form.napDuration || 0} phút).`,
                                        acts ? `Hoạt động: ${acts}.` : '',
                                        health,
                                    ]
                                        .filter(Boolean)
                                        .join(' ')
                                    setForm(f => ({ ...f, note: lines }))
                                }}
                                style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: '#7C3AED',
                                    background: '#EDE9FE',
                                    border: 'none',
                                    borderRadius: 6,
                                    padding: '3px 8px',
                                    cursor: 'pointer',
                                }}
                            >
                                ✨ Tạo tóm tắt
                            </button>
                        </div>
                        <textarea
                            style={{ ...is, resize: 'vertical', minHeight: 60 }}
                            value={form.note}
                            onChange={e => setForm({ ...form, note: e.target.value })}
                            placeholder="Ghi chú cho phụ huynh..."
                        />
                    </div>
                    {showPhotos && (
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={ls}>📷 Ảnh minh họa (tối đa 3)</label>
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
                                            disabled={compressing}
                                            onClick={() => fileRef.current?.click()}
                                            aria-label="Chụp ảnh hoặc chọn từ thư viện"
                                            style={{
                                                width: 72,
                                                height: 72,
                                                borderRadius: 8,
                                                border: '1.5px dashed #DDD6FE',
                                                background: '#F8F7FF',
                                                color: '#7C3AED',
                                                fontSize: compressing ? 11 : 24,
                                                fontWeight: 900,
                                                cursor: compressing ? 'default' : 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                            }}
                                        >
                                            {compressing ? 'Nén...' : '+'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
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
                        onClick={() => {
                            clearDraft(draftKey)
                            onSave({ ...form, photoFiles, existingPaths })
                        }}
                        style={{
                            padding: '9px 24px',
                            borderRadius: 10,
                            border: 'none',
                            background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)',
                            color: '#fff',
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: 'pointer',
                        }}
                    >
                        Lưu nhật ký
                    </button>
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
    const [syncStatus, setSyncStatus] = useState({})
    const [selectedIds, setSelectedIds] = useState([])
    const [batchOpen, setBatchOpen] = useState(false)
    const [showMissingOnly, setShowMissingOnly] = useState(false)
    const [summaryOpen, setSummaryOpen] = useState(false)
    const [summarySending, setSummarySending] = useState(false)
    const [summarySent, setSummarySent] = useState(false)
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(true)
    const [err, setErr] = useState('')
    const moodColors = {
        'Vui vẻ': '#16A34A',
        'Hào hứng': '#7C3AED',
        'Bình thường': '#6B6494',
        'Mệt mỏi': '#D97706',
        'Buồn ngủ': '#0891B2',
    }
    const sel = {
        padding: '8px 12px',
        borderRadius: 10,
        border: '1.5px solid #DDD6FE',
        fontSize: 13,
        color: '#1E1B4B',
        background: '#fff',
    }

    const load = useCallback(async () => {
        setErr('')
        setLoading(true)
        try {
            const profile = await getCurrentProfile()
            const facilityId = profile?.role === 'teacher' ? profile.facility_id : selectedFacilityId || undefined
            const items = await listStudents({ facilityId, status: 'active' })
            const dailyReports = await listDailyReportsByFacilityDate({ facilityId, date })
            const reportMap = {}
            dailyReports.forEach(report => {
                reportMap[report.studentId] = report
            })
            setStudents(items)
            setReports(reportMap)
            setSyncStatus(prev => {
                const next = { ...prev }
                dailyReports.forEach(report => {
                    next[report.studentId] = next[report.studentId] || 'synced'
                })
                return next
            })
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
                setClasses(
                    [...new Set(cachedStudents.map(s => s.className).filter(Boolean))].map(name => ({
                        id: name,
                        name,
                    })),
                )
                setErr('Đang dùng dữ liệu offline. Nhật ký sẽ tự đồng bộ khi có mạng.')
            } else {
                setErr(ex.message || 'Không tải được nhật ký ngày.')
            }
        } finally {
            setLoading(false)
        }
    }, [date, selectedFacilityId])

    useEffect(() => {
        load()
    }, [load])

    useEffect(() => {
        if (!date) return
        return subscribeDailyReports({
            facilityId: selectedFacilityId || undefined,
            date,
            onChange: ({ eventType, record, oldRecord }) => {
                setReports(prev => {
                    const next = { ...prev }
                    if (eventType === 'DELETE' && oldRecord?.studentId) {
                        delete next[oldRecord.studentId]
                    } else if (record?.studentId) {
                        next[record.studentId] = record
                    }
                    return next
                })
                if (record?.studentId) setSyncStatus(prev => ({ ...prev, [record.studentId]: 'synced' }))
            },
        })
    }, [date, selectedFacilityId])

    useEffect(() => {
        const sync = () =>
            syncOfflineQueue()
                .then(load)
                .catch(() => {})
        window.addEventListener('online', sync)
        sync()
        return () => window.removeEventListener('online', sync)
    }, [load])

    const baseStudents = useMemo(
        () => (classFilter ? students.filter(student => student.className === classFilter) : students),
        [classFilter, students],
    )
    const filteredStudents = showMissingOnly ? baseStudents.filter(student => !reports[student.id]) : baseStudents
    const pagedStudents = useMemo(
        () => filteredStudents.slice((page - 1) * STUDENTS_PER_PAGE, page * STUDENTS_PER_PAGE),
        [filteredStudents, page],
    )
    const todaySelected = date === todayStr()
    const failedCount = getFailedActions().filter(action => action.type === 'daily-report').length
    const summary = useMemo(() => {
        const missingStudents = baseStudents.filter(student => !reports[student.id])
        return {
            total: baseStudents.length,
            completed: baseStudents.length - missingStudents.length,
            missing: missingStudents.length,
            missingNames: missingStudents.map(student => student.name),
        }
    }, [baseStudents, reports])

    useEffect(() => {
        setPage(1)
    }, [date, classFilter, showMissingOnly, filteredStudents.length])

    function toggleSelected(studentId) {
        setSelectedIds(prev => (prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]))
    }

    async function saveSupabaseReport(studentId, data, { closeEditor = true } = {}) {
        const { photoFiles, existingPaths, ...reportData } = data
        const student = students.find(s => s.id === studentId)
        const facilityId = student?.facilityId || selectedFacilityId || undefined
        setSyncStatus(prev => ({ ...prev, [studentId]: isOnline() ? 'syncing' : 'queued' }))

        let newPaths = []
        if (photoFiles?.length && isOnline()) {
            try {
                newPaths = await Promise.all(photoFiles.map(f => uploadReportPhoto({ file: f, facilityId, studentId })))
            } catch {
                /* continue without photos if upload fails */
            }
        }

        const photoPaths = [...(existingPaths || []), ...newPaths]
        const record = { studentId, facilityId, date, ...reportData, photoPaths }

        setReports(prev => {
            const next = { ...prev, [studentId]: record }
            cacheTeacherData(`daily-reports:${facilityId || 'all'}:${date}`, next)
            return next
        })
        if (closeEditor) setEditing(null)
        if (isOnline()) {
            try {
                const saved = await saveDailyReport(record)
                setReports(prev => ({ ...prev, [studentId]: saved }))
                setSyncStatus(prev => ({ ...prev, [studentId]: 'synced' }))
                return saved
            } catch {
                enqueueOfflineAction('daily-report', record)
                setSyncStatus(prev => ({ ...prev, [studentId]: 'queued' }))
                setErr('Mất kết nối. Nhật ký đã lưu offline và sẽ tự đồng bộ.')
                return record
            }
        } else {
            enqueueOfflineAction('daily-report', record)
            setSyncStatus(prev => ({ ...prev, [studentId]: 'queued' }))
            setErr('Đang offline. Nhật ký đã lưu tạm trên máy.')
            return record
        }
    }

    async function quickSaveMood(studentId, mood) {
        const current = reports[studentId] || defaultReport()
        await saveSupabaseReport(
            studentId,
            { ...current, mood, photoFiles: [], existingPaths: current.photoPaths || [] },
            { closeEditor: false },
        )
    }

    async function applyBatch(data) {
        const ids = selectedIds.length
            ? selectedIds
            : filteredStudents.filter(student => !reports[student.id]).map(student => student.id)
        if (!ids.length) return
        setBatchOpen(false)
        await Promise.allSettled(
            ids.map(studentId =>
                saveSupabaseReport(
                    studentId,
                    { ...data, photoFiles: [], existingPaths: reports[studentId]?.photoPaths || [] },
                    { closeEditor: false },
                ),
            ),
        )
        setSelectedIds([])
    }

    async function sendEndOfDaySummary() {
        setSummarySending(true)
        setErr('')
        try {
            const facilityId =
                students.find(student => student.facilityId)?.facilityId || selectedFacilityId || undefined
            const [attendance, incidents] = await Promise.all([
                listAttendanceByFacilityDate({ facilityId, date }).catch(() => []),
                listIncidents({ facilityId, status: 'open' }).catch(() => []),
            ])
            const present = attendance.filter(item => item.status === 'present').length
            const absent = attendance.filter(item => item.status === 'absent').length
            const late = attendance.filter(item => item.status === 'late').length
            await createNotification({
                title: `Tổng kết nhật ký ngày ${fmtDate(date)}`,
                body: [
                    `Nhật ký: đã ghi ${summary.completed}/${summary.total}, còn thiếu ${summary.missing}.`,
                    `Điểm danh: có mặt ${present}, vắng ${absent}, đi trễ ${late}.`,
                    `Sự cố đang mở: ${incidents.length}.`,
                    summary.missingNames.length ? `Chưa có nhật ký: ${summary.missingNames.join(', ')}.` : '',
                ]
                    .filter(Boolean)
                    .join(' '),
                type: 'system',
                priority: summary.missing || incidents.length ? 'high' : 'normal',
                targetRole: 'admin',
                channel: 'app',
                status: 'sent',
            })
            setSummarySent(true)
        } catch (ex) {
            setErr(ex.message || 'Không gửi được tổng kết cuối ngày.')
        } finally {
            setSummarySending(false)
        }
    }

    if (loading)
        return (
            <div
                className="admin-page-pad"
                style={{
                    padding: '28px 36px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,320px),1fr))',
                    gap: 14,
                }}
            >
                {Array.from({ length: 6 }).map((_, i) => (
                    <div
                        key={i}
                        style={{
                            background: '#fff',
                            borderRadius: 16,
                            padding: '16px 18px',
                            boxShadow: '0 2px 14px rgba(109,40,217,0.07)',
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 12,
                            }}
                        >
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 999 }} />
                                <div>
                                    <div className="skeleton" style={{ height: 13, width: 90, marginBottom: 5 }} />
                                    <div className="skeleton" style={{ height: 10, width: 60 }} />
                                </div>
                            </div>
                            <div className="skeleton" style={{ height: 30, width: 72, borderRadius: 8 }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            {Array.from({ length: 4 }).map((__, j) => (
                                <div key={j} className="skeleton" style={{ height: 44, borderRadius: 8 }} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        )

    return (
        <div className="admin-page-pad" style={{ padding: '28px 36px' }}>
            {editing && (
                <EditModal
                    student={students.find(s => s.id === editing)}
                    report={reports[editing]}
                    onClose={() => setEditing(null)}
                    onSave={data => saveSupabaseReport(editing, data)}
                    showPhotos
                    draftKey={`${editing}:${date}`}
                    reportDate={date}
                />
            )}
            {batchOpen && (
                <BatchModal
                    selectedCount={
                        selectedIds.length || filteredStudents.filter(student => !reports[student.id]).length
                    }
                    onClose={() => setBatchOpen(false)}
                    onApply={applyBatch}
                />
            )}
            {summaryOpen && (
                <EndOfDayModal
                    summary={summary}
                    sending={summarySending}
                    sent={summarySent}
                    onClose={() => setSummaryOpen(false)}
                    onSend={sendEndOfDaySummary}
                />
            )}
            {todaySelected && (
                <TeacherTodayPanel
                    total={summary.total}
                    completed={summary.completed}
                    missing={summary.missing}
                    failedCount={failedCount}
                    showMissingOnly={showMissingOnly}
                    onToggleMissing={() => setShowMissingOnly(value => !value)}
                    onOpenBatch={() => setBatchOpen(true)}
                    onOpenSummary={() => {
                        setSummarySent(false)
                        setSummaryOpen(true)
                    }}
                />
            )}
            <div
                style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 70,
                    background: 'rgba(245,243,255,0.97)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid #DDD6FE',
                    borderRadius: 14,
                    padding: '8px 12px',
                    marginBottom: 14,
                    boxShadow: '0 8px 24px rgba(109,40,217,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ color: '#1E1B4B', fontWeight: 900, fontSize: 13 }}>Nhật ký ngày</span>
                    <SummaryPill label="Đã ghi" value={summary.completed} color="#059669" bg="#ECFDF5" />
                    <SummaryPill label="Còn thiếu" value={summary.missing} color="#D97706" bg="#FFFBEB" />
                    <SummaryPill label="Đang xem" value={filteredStudents.length} color="#6D28D9" bg="#EDE9FE" />
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
            <div
                className="mobile-stack"
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 20,
                    gap: 12,
                }}
            >
                {err && (
                    <div
                        style={{
                            color: err.includes('offline') || err.includes('mạng') ? '#D97706' : '#DC2626',
                            background: err.includes('offline') || err.includes('mạng') ? '#FFFBEB' : '#FEF2F2',
                            borderRadius: 10,
                            padding: '8px 12px',
                            fontSize: 12,
                            fontWeight: 800,
                        }}
                    >
                        {err}
                    </div>
                )}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginLeft: 'auto' }}>
                    <select value={classFilter} onChange={e => setClassFilter(e.target.value)} style={sel}>
                        <option value="">Tất cả lớp</option>
                        {classes.map(c => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} style={sel} />
                </div>
            </div>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,320px),1fr))',
                    gap: 14,
                }}
            >
                <div style={{ gridColumn: '1/-1' }}>
                    <PaginationBar
                        page={page}
                        pageSize={STUDENTS_PER_PAGE}
                        total={filteredStudents.length}
                        onPageChange={setPage}
                        itemLabel="bé"
                    />
                </div>
                {pagedStudents.map(s => {
                    const r = reports[s.id]
                    const isSelected = selectedIds.includes(s.id)
                    return (
                        <div
                            key={s.id}
                            style={{
                                background: isSelected ? '#F5F3FF' : '#fff',
                                border: isSelected ? '1.5px solid #7C3AED' : '1.5px solid transparent',
                                borderRadius: 16,
                                padding: '16px 18px',
                                boxShadow: '0 2px 14px rgba(109,40,217,0.07)',
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: 12,
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    {todaySelected && (
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleSelected(s.id)}
                                            aria-label={`Chọn ${s.name}`}
                                            style={{ width: 18, height: 18, accentColor: '#7C3AED' }}
                                        />
                                    )}
                                    <Avatar initials={getInitials(s.name)} />
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 13, color: '#1E1B4B' }}>{s.name}</div>
                                        <span style={{ fontSize: 10, fontWeight: 700, color: '#6B6494' }}>
                                            {s.className}
                                        </span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <SyncStatusIcon status={syncStatus[s.id] || (r ? 'synced' : '')} />
                                    <button
                                        onClick={() => setEditing(s.id)}
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
                                    >
                                        {r ? 'Sửa' : 'Ghi nhật ký'}
                                    </button>
                                </div>
                            </div>
                            {r ? (
                                <div
                                    className="mobile-two-col"
                                    style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}
                                >
                                    <ReportChip icon="🍳" label="Sáng" value={r.breakfast} />
                                    <ReportChip icon="🍱" label="Trưa" value={r.lunch} />
                                    <ReportChip icon="🍎" label="Xế" value={r.snack} />
                                    <ReportChip
                                        icon="😴"
                                        label="Ngủ"
                                        value={r.napDuration > 0 ? `${r.napDuration} phút` : 'Không ngủ'}
                                    />
                                    <div
                                        style={{
                                            gridColumn: '1/-1',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            flexWrap: 'wrap',
                                        }}
                                    >
                                        <span style={{ fontSize: 11, color: '#6B6494', fontWeight: 700 }}>
                                            Tâm trạng:
                                        </span>
                                        <span
                                            style={{
                                                fontSize: 12,
                                                fontWeight: 800,
                                                color: moodColors[r.mood] || '#6B6494',
                                            }}
                                        >
                                            {r.mood}
                                        </span>
                                        {r.note && (
                                            <span style={{ fontSize: 11, color: '#6B6494', fontStyle: 'italic' }}>
                                                · {r.note}
                                            </span>
                                        )}
                                        {r.photoPaths?.length > 0 && (
                                            <span
                                                style={{
                                                    fontSize: 11,
                                                    color: '#7C3AED',
                                                    fontWeight: 700,
                                                    marginLeft: 'auto',
                                                }}
                                            >
                                                📷 {r.photoPaths.length}
                                            </span>
                                        )}
                                    </div>
                                    {todaySelected && (
                                        <div
                                            style={{
                                                gridColumn: '1/-1',
                                                display: 'flex',
                                                gap: 6,
                                                flexWrap: 'wrap',
                                                marginTop: 4,
                                            }}
                                        >
                                            {MOOD_OPTIONS.slice(0, 4).map(mood => (
                                                <button
                                                    key={mood}
                                                    onClick={() => quickSaveMood(s.id, mood)}
                                                    style={{
                                                        padding: '6px 10px',
                                                        borderRadius: 999,
                                                        border: `1.5px solid ${r.mood === mood ? '#7C3AED' : '#DDD6FE'}`,
                                                        background: r.mood === mood ? '#EDE9FE' : '#fff',
                                                        color: r.mood === mood ? '#7C3AED' : '#6B6494',
                                                        fontWeight: 800,
                                                        fontSize: 11,
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    {mood}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div>
                                    <div
                                        style={{
                                            textAlign: 'center',
                                            padding: '10px 0',
                                            color: '#7C6D9B',
                                            fontSize: 13,
                                            fontWeight: 700,
                                        }}
                                    >
                                        Chưa có nhật ký hôm nay
                                    </div>
                                    {todaySelected && (
                                        <div
                                            style={{
                                                display: 'flex',
                                                gap: 6,
                                                flexWrap: 'wrap',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            {MOOD_OPTIONS.slice(0, 4).map(mood => (
                                                <button
                                                    key={mood}
                                                    onClick={() => quickSaveMood(s.id, mood)}
                                                    style={{
                                                        padding: '8px 10px',
                                                        borderRadius: 999,
                                                        border: '1.5px solid #DDD6FE',
                                                        background: '#fff',
                                                        color: '#7C3AED',
                                                        fontWeight: 900,
                                                        fontSize: 11,
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    {mood}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}
                <div style={{ gridColumn: '1/-1' }}>
                    <PaginationBar
                        page={page}
                        pageSize={STUDENTS_PER_PAGE}
                        total={filteredStudents.length}
                        onPageChange={setPage}
                        itemLabel="bé"
                    />
                </div>
            </div>
        </div>
    )
}

function LegacyDailyReports() {
    const [db, setDB] = useState(getDB())
    const [selDate, setSelDate] = useState(todayStr())
    const [filterClass, setFilterClass] = useState('all')
    const [editing, setEditing] = useState(null)
    const [page, setPage] = useState(1)
    const moodColors = {
        'Vui vẻ': '#16A34A',
        'Hào hứng': '#7C3AED',
        'Bình thường': '#6B6494',
        'Mệt mỏi': '#D97706',
        'Buồn ngủ': '#0891B2',
    }
    const students = useMemo(() => {
        let s = db.students.filter(st => st.status === 'active')
        if (filterClass !== 'all') s = s.filter(st => st.classId === filterClass)
        return s
    }, [db, filterClass])
    const pagedStudents = useMemo(
        () => students.slice((page - 1) * STUDENTS_PER_PAGE, page * STUDENTS_PER_PAGE),
        [students, page],
    )
    const reportMap = useMemo(() => {
        const map = {}
        db.dailyReports
            .filter(r => r.date === selDate)
            .forEach(r => {
                map[r.studentId] = r
            })
        return map
    }, [db, selDate])
    const sel = {
        padding: '8px 12px',
        borderRadius: 10,
        border: '1.5px solid #DDD6FE',
        fontSize: 13,
        color: '#1E1B4B',
        background: '#fff',
    }
    function saveReport(studentId, data) {
        const { photoFiles: _photoFiles, existingPaths: _existingPaths, ...reportData } = data
        const ndb = getDB()
        const idx = ndb.dailyReports.findIndex(r => r.date === selDate && r.studentId === studentId)
        const rec = { id: `dr-${selDate}-${studentId}`, studentId, date: selDate, ...reportData }
        if (idx >= 0) ndb.dailyReports[idx] = rec
        else ndb.dailyReports.push(rec)
        commit()
        setDB({ ...ndb })
        setEditing(null)
    }
    useEffect(() => {
        setPage(1)
    }, [selDate, filterClass, students.length])

    return (
        <div className="admin-page-pad" style={{ padding: '28px 36px' }}>
            {editing && (
                <EditModal
                    student={db.students.find(s => s.id === editing)}
                    report={reportMap[editing]}
                    onClose={() => setEditing(null)}
                    onSave={data => saveReport(editing, data)}
                    draftKey={`legacy:${editing}:${selDate}`}
                    reportDate={selDate}
                />
            )}
            <div
                className="mobile-stack"
                style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 20, gap: 12 }}
            >
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <select value={filterClass} onChange={e => setFilterClass(e.target.value)} style={sel}>
                        <option value="all">Tất cả lớp</option>
                        {db.classes.map(c => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                    <input type="date" value={selDate} onChange={e => setSelDate(e.target.value)} style={sel} />
                </div>
            </div>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,320px),1fr))',
                    gap: 14,
                }}
            >
                <div style={{ gridColumn: '1/-1' }}>
                    <PaginationBar
                        page={page}
                        pageSize={STUDENTS_PER_PAGE}
                        total={students.length}
                        onPageChange={setPage}
                        itemLabel="bé"
                    />
                </div>
                {pagedStudents.map(s => {
                    const r = reportMap[s.id]
                    const cls = db.classes.find(c => c.id === s.classId)
                    return (
                        <div
                            key={s.id}
                            style={{
                                background: '#fff',
                                borderRadius: 16,
                                padding: '16px 18px',
                                boxShadow: '0 2px 14px rgba(109,40,217,0.07)',
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: 12,
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div
                                        style={{
                                            width: 36,
                                            height: 36,
                                            borderRadius: 999,
                                            background: 'linear-gradient(135deg,#7C3AED,#A78BFA)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#fff',
                                            fontWeight: 800,
                                            fontSize: 14,
                                        }}
                                    >
                                        {s.initials || '?'}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 13, color: '#1E1B4B' }}>{s.name}</div>
                                        <span style={{ fontSize: 10, fontWeight: 700, color: cls?.color || '#6B6494' }}>
                                            {cls?.name}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setEditing(s.id)}
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
                                >
                                    {r ? 'Sửa' : 'Ghi nhật ký'}
                                </button>
                            </div>
                            {r ? (
                                <div
                                    className="mobile-two-col"
                                    style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}
                                >
                                    <ReportChip icon="🍳" label="Sáng" value={r.breakfast} />
                                    <ReportChip icon="🍱" label="Trưa" value={r.lunch} />
                                    <ReportChip icon="🍎" label="Xế" value={r.snack} />
                                    <ReportChip
                                        icon="😴"
                                        label="Ngủ"
                                        value={r.napDuration > 0 ? `${r.napDuration} phút` : 'Không ngủ'}
                                    />
                                    <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ fontSize: 11, color: '#6B6494', fontWeight: 700 }}>
                                            Tâm trạng:
                                        </span>
                                        <span
                                            style={{
                                                fontSize: 12,
                                                fontWeight: 800,
                                                color: moodColors[r.mood] || '#6B6494',
                                            }}
                                        >
                                            {r.mood}
                                        </span>
                                        {r.note && (
                                            <span style={{ fontSize: 11, color: '#6B6494', fontStyle: 'italic' }}>
                                                · {r.note}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '16px 0', color: '#7C6D9B', fontSize: 13 }}>
                                    Chưa có nhật ký hôm nay
                                </div>
                            )}
                        </div>
                    )
                })}
                <div style={{ gridColumn: '1/-1' }}>
                    <PaginationBar
                        page={page}
                        pageSize={STUDENTS_PER_PAGE}
                        total={students.length}
                        onPageChange={setPage}
                        itemLabel="bé"
                    />
                </div>
            </div>
        </div>
    )
}

export default function DailyReports(props) {
    if (isSupabaseSession()) return <SupabaseDailyReports {...props} />
    return <LegacyDailyReports />
}
