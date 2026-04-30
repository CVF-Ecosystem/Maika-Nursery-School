import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDB, hydrateFromAPI } from '../../data/store'
import { hasBackendAPI } from '../../data/api'
import { fmtDate } from '../../utils/format'
import { sanitizeFilename, sanitizeText, validateImageFile } from '../../utils/security'

const ANNS = [
    { id: 1, title: 'Nghỉ lễ 30/4 – 1/5', body: 'Kính gửi quý phụ huynh,\n\nNhà trường thông báo các bé được nghỉ lễ từ Thứ Tư 30/4 đến hết Thứ Sáu 2/5/2026.\n\nCác bé đi học trở lại vào Thứ Hai ngày 5/5/2026.\n\nKính chúc quý phụ huynh và các bé kỳ nghỉ vui vẻ, an toàn!\n\nBan Giám hiệu Maika', date: '24/04/2026', tag: 'Nghỉ lễ', tagColor: '#D97706', tagBg: '#FEF3C7', icon: '🎉', important: true },
    { id: 2, title: 'Họp phụ huynh tháng 5/2026', body: 'Kính mời quý phụ huynh tham dự buổi họp tổng kết học kỳ 2 vào lúc 17:30, Thứ Năm ngày 15/5/2026 tại hội trường.', date: '22/04/2026', tag: 'Họp phụ huynh', tagColor: '#6D28D9', tagBg: '#EDE9FE', icon: '📋', important: false },
    { id: 3, title: 'Khám sức khỏe định kỳ ngày 8/5', body: 'Nhà trường tổ chức khám sức khỏe định kỳ cho toàn bộ học sinh vào ngày 8/5/2026.\n\nKết quả sẽ gửi về phụ huynh trong 3 ngày.', date: '20/04/2026', tag: 'Y tế', tagColor: '#059669', tagBg: '#D1FAE5', icon: '🏥', important: false },
    { id: 4, title: 'Thông báo học phí tháng 5/2026', body: 'Học phí tháng 5 vui lòng nộp từ ngày 1–5/5/2026.\n\nChuyển khoản: 0123 4567 89 — MB Bank — TRUONG MAM NON MAIKA', date: '18/04/2026', tag: 'Học phí', tagColor: '#DC2626', tagBg: '#FEE2E2', icon: '💰', important: false },
    { id: 5, title: 'Menu tháng 5/2026 đã cập nhật', body: 'Thực đơn tháng 5/2026 đã cập nhật với nhiều món mới đa dạng, bổ dưỡng.', date: '15/04/2026', tag: 'Ăn uống', tagColor: '#F59E0B', tagBg: '#FEF3C7', icon: '🍽️', important: false },
]
const PHOTOS = [
    { id: 'p1', emoji: '🎨', title: 'Giờ vẽ sáng tạo', date: '29/04/2026', tag: 'Nghệ thuật', bg: 'linear-gradient(135deg,#6D28D9,#A78BFA)', desc: 'Vẽ tranh chủ đề gia đình' },
    { id: 'p2', emoji: '🍱', title: 'Bữa trưa hôm nay', date: '29/04/2026', tag: 'Bữa ăn', bg: 'linear-gradient(135deg,#F59E0B,#FBBF24)', desc: 'Cơm gà xào sả, canh bí đỏ' },
    { id: 'p3', emoji: '🏃', title: 'Thể dục ngoài sân', date: '28/04/2026', tag: 'Vận động', bg: 'linear-gradient(135deg,#059669,#34D399)', desc: 'Khởi động buổi sáng' },
    { id: 'p4', emoji: '🎵', title: 'Giờ âm nhạc', date: '28/04/2026', tag: 'Nghệ thuật', bg: 'linear-gradient(135deg,#EC4899,#F9A8D4)', desc: 'Tập bài hát "Cả nhà thương nhau"' },
    { id: 'p5', emoji: '😴', title: 'Giờ nghỉ trưa', date: '27/04/2026', tag: 'Nghỉ ngơi', bg: 'linear-gradient(135deg,#0891B2,#38BDF8)', desc: 'Giấc ngủ trưa an lành' },
    { id: 'p6', emoji: '📚', title: 'Đọc sách cùng bạn', date: '27/04/2026', tag: 'Học tập', bg: 'linear-gradient(135deg,#7C3AED,#C4B5FD)', desc: 'Giờ đọc sách tự do' },
    { id: 'p7', emoji: '🧩', title: 'Ghép hình', date: '25/04/2026', tag: 'Vui chơi', bg: 'linear-gradient(135deg,#D97706,#FBBF24)', desc: 'Phát triển tư duy' },
    { id: 'p8', emoji: '🌱', title: 'Chăm sóc vườn rau', date: '24/04/2026', tag: 'Vui chơi', bg: 'linear-gradient(135deg,#065F46,#34D399)', desc: 'Tưới cây và học về cây trồng' },
    { id: 'p9', emoji: '🎭', title: 'Kể chuyện sáng tạo', date: '22/04/2026', tag: 'Nghệ thuật', bg: 'linear-gradient(135deg,#9333EA,#DDD6FE)', desc: 'Tiểu phẩm "Ba chú lợn nhỏ"' },
]
const MOOD_EMOJI = { 'Vui vẻ': '😄', 'Hào hứng': '🤩', 'Bình thường': '😊', 'Mệt mỏi': '😴', 'Buồn ngủ': '🥱', 'Khó chịu': '😟' }
const MOOD_COLOR = { 'Vui vẻ': '#16A34A', 'Hào hứng': '#7C3AED', 'Bình thường': '#6B6494', 'Mệt mỏi': '#D97706', 'Buồn ngủ': '#0891B2', 'Khó chịu': '#DC2626' }

export default function ParentPortal() {
    const navigate = useNavigate()
    const [tab, setTab] = useState('announcements')
    const [openAnn, setOpenAnn] = useState(new Set([1]))
    const [galFilter, setGalFilter] = useState('all')
    const [userPhotos, setUserPhotos] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('bb_parent_photos') || '[]')
        } catch {
            return []
        }
    })
    const [uploadMsg, setUploadMsg] = useState('')
    const [messages, setMessages] = useState([{ from: 'school', name: '🌸 Maika School', text: 'Xin chào phụ huynh! Đây là kênh liên lạc giữa nhà trường và gia đình.', time: '08:00' }])
    const [msgText, setMsgText] = useState('')
    const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
    const [loadingData, setLoadingData] = useState(hasBackendAPI())

    const phone = sessionStorage.getItem('maika_parent_phone')

    useEffect(() => {
        if (!hasBackendAPI() || !phone) return
        let mounted = true
        hydrateFromAPI()
            .catch(() => { })
            .finally(() => { if (mounted) setLoadingData(false) })
        return () => { mounted = false }
    }, [])

    if (!phone) { navigate('/parent'); return null }

    if (loadingData) return <div style={{ minHeight: '100vh', background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C6D9B', fontWeight: 800 }}>Đang tải dữ liệu...</div>

    const db = getDB()
    const student = db.students.find(s => s.parentPhone === phone) || db.students[0]
    const cls = db.classes.find(c => c.id === student.classId)

    // Gallery
    const allPhotos = [...PHOTOS, ...userPhotos]
    const filtered = galFilter === 'all' ? allPhotos : allPhotos.filter(p => p.tag === galFilter)
    const tags = ['all', ...new Set(PHOTOS.map(p => p.tag))]

    function handleUpload(e) {
        const files = Array.from(e.target.files || [])
        const existing = [...userPhotos]
        const errors = []
        files.forEach(file => {
            const validationError = validateImageFile(file)
            if (validationError) {
                errors.push(`${file.name}: ${validationError}`)
                return
            }
            const reader = new FileReader()
            reader.onload = ev => {
                existing.push({ id: 'u' + Date.now() + Math.random(), title: sanitizeFilename(file.name), date: new Date().toLocaleDateString('vi-VN'), tag: 'Hình ảnh', img: ev.target.result, emoji: '📸', bg: 'linear-gradient(135deg,#6D28D9,#A78BFA)', desc: 'Ảnh do phụ huynh tải lên' })
                localStorage.setItem('bb_parent_photos', JSON.stringify(existing))
                setUserPhotos([...existing])
            }
            reader.readAsDataURL(file)
        })
        setUploadMsg(errors.length ? errors.join(' ') : '')
        e.target.value = ''
    }

    // Report
    const report = db.dailyReports.find(r => r.studentId === student.id && r.date === reportDate)
    const att = db.attendance.find(a => a.studentId === student.id && a.date === reportDate)
    const attLabel = att ? ({ present: '✅ Có mặt', late: '⏰ Đi trễ', absent: '❌ Vắng mặt' }[att.status] || '—') : '—'

    function sendMsg(e) {
        e.preventDefault()
        if (!msgText.trim()) return
        const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        setMessages(m => [...m, { from: 'parent', name: 'Phụ huynh', text: sanitizeText(msgText), time: now }])
        setMsgText('')
        setTimeout(() => setMessages(m => [...m, { from: 'school', name: '🌸 Maika School', text: 'Cảm ơn phụ huynh đã nhắn tin! Nhà trường sẽ phản hồi sớm nhất trong giờ hành chính (7:00–17:00). Trân trọng!', time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) }]), 1500)
    }

    const TABS = [['announcements', '📢 Thông báo'], ['gallery', '📸 Hình ảnh'], ['reports', '📝 Nhật ký'], ['messages', '💬 Nhắn tin']]

    return (
        <div style={{ background: '#F5F3FF', minHeight: '100vh' }}>
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg,#1E1B4B,#2D2870,#4C1D95)', padding: '0 28px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => navigate('/')}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#7C3AED,#A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🌸</div>
                    <span style={{ fontWeight: 900, fontSize: 16, color: '#fff' }}>Maika</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 50, padding: '6px 14px', color: '#C4B5FD', fontSize: 13, fontWeight: 700 }}>🧒 {student.name} · {cls?.name || ''}</div>
                    <button onClick={() => navigate('/')} style={{ fontSize: 13, color: '#8B83C3', fontWeight: 700, background: 'none', border: 'none' }}>← Trang chủ</button>
                </div>
            </div>
            {/* Tabs */}
            <div style={{ background: '#fff', borderBottom: '1px solid #EDE9FE', padding: '0 28px', display: 'flex', position: 'sticky', top: 64, zIndex: 90 }}>
                {TABS.map(([id, label]) => (
                    <button key={id} onClick={() => setTab(id)} style={{ padding: '16px 24px', border: 'none', background: 'none', fontWeight: 700, fontSize: 14, color: tab === id ? '#6D28D9' : '#7C6D9B', borderBottom: `2.5px solid ${tab === id ? '#6D28D9' : 'transparent'}`, cursor: 'pointer' }}>{label}</button>
                ))}
            </div>
            {/* Main */}
            <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 24px' }}>
                {/* ANNOUNCEMENTS */}
                {tab === 'announcements' && (
                    <div>
                        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E1B4B', marginBottom: 18 }}>Thông báo nhà trường</h2>
                        {ANNS.map(a => (
                            <div key={a.id} onClick={() => setOpenAnn(s => { const n = new Set(s); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n })}
                                style={{ background: `${a.important ? 'linear-gradient(135deg,#FFFBEB,#fff)' : '#fff'}`, borderRadius: 18, padding: '22px 24px', marginBottom: 14, boxShadow: '0 2px 14px rgba(109,40,217,0.07)', borderLeft: `4px solid ${a.important ? '#F59E0B' : '#7C3AED'}`, cursor: 'pointer' }}>
                                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                                    <div style={{ width: 44, height: 44, borderRadius: 12, background: a.tagBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{a.icon}</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                                            <div>
                                                <span style={{ background: a.tagBg, color: a.tagColor, fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 50, display: 'inline-block', marginBottom: 6 }}>{a.tag}{a.important ? ' 📌' : ''}</span>
                                                <div style={{ fontWeight: 800, fontSize: 15, color: '#1E1B4B' }}>{a.title}</div>
                                            </div>
                                            <span style={{ fontSize: 11, color: '#7C6D9B', fontWeight: 600, flexShrink: 0 }}>{a.date}</span>
                                        </div>
                                    </div>
                                </div>
                                {openAnn.has(a.id) && <div style={{ fontSize: 14, color: '#4B4899', lineHeight: 1.75, marginTop: 14, paddingTop: 14, borderTop: '1.5px dashed #EDE9FE', whiteSpace: 'pre-wrap' }}>{a.body}</div>}
                            </div>
                        ))}
                    </div>
                )}
                {/* GALLERY */}
                {tab === 'gallery' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E1B4B' }}>Hình ảnh hoạt động</h2>
                            <button onClick={() => document.getElementById('ph-upload').click()} style={{ padding: '9px 18px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)', color: '#fff', fontWeight: 700, fontSize: 13 }}>📤 Thêm ảnh</button>
                        </div>
                        <input type="file" id="ph-upload" accept="image/*" multiple style={{ display: 'none' }} onChange={handleUpload} />
                        {uploadMsg && <div style={{ color: '#DC2626', background: '#FEF2F2', borderRadius: 10, padding: '10px 14px', fontSize: 12, fontWeight: 700, marginBottom: 16 }}>{uploadMsg}</div>}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                            {tags.map(t => <button key={t} onClick={() => setGalFilter(t)} style={{ padding: '6px 16px', borderRadius: 50, border: `1.5px solid ${galFilter === t ? '#6D28D9' : '#DDD6FE'}`, background: galFilter === t ? '#6D28D9' : '#fff', color: galFilter === t ? '#fff' : '#7C6D9B', fontWeight: 700, fontSize: 13 }}>{t === 'all' ? 'Tất cả' : t}</button>)}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14 }}>
                            {filtered.map(p => (
                                <div key={p.id} style={{ borderRadius: 16, overflow: 'hidden', aspectRatio: '4/3', position: 'relative', cursor: 'pointer', transition: 'transform .2s' }}
                                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.querySelector('.pov').style.opacity = 1 }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.querySelector('.pov').style.opacity = 0 }}>
                                    <div style={{ width: '100%', height: '100%', background: p.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, fontWeight: 700, fontSize: 13, color: 'rgba(255,255,255,0.9)' }}>
                                        {p.img ? <img src={p.img} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <span style={{ fontSize: 52 }}>{p.emoji}</span>}
                                        <span style={{ position: 'relative' }}>{p.title}</span>
                                    </div>
                                    <div className="pov" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg,rgba(30,27,75,0.85),transparent 55%)', opacity: 0, transition: 'opacity .2s', display: 'flex', alignItems: 'flex-end', padding: 12 }}>
                                        <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>{p.desc || p.title}</span>
                                    </div>
                                    <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(30,27,75,0.7)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>{p.date}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {/* REPORT */}
                {tab === 'reports' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
                            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E1B4B' }}>Nhật ký hàng ngày</h2>
                            <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} style={{ padding: '8px 14px', borderRadius: 10, border: '1.5px solid #DDD6FE', fontSize: 13 }} />
                        </div>
                        {!report ? (
                            <div style={{ background: '#fff', borderRadius: 20, padding: 48, textAlign: 'center', boxShadow: '0 2px 14px rgba(109,40,217,0.07)' }}>
                                <div style={{ fontSize: 52, marginBottom: 12 }}>📝</div>
                                <div style={{ fontWeight: 700, fontSize: 16, color: '#1E1B4B' }}>Chưa có nhật ký cho ngày này</div>
                            </div>
                        ) : (
                            <div>
                                <div style={{ background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)', borderRadius: 20, padding: '24px 28px', color: '#fff', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                        <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🧒</div>
                                        <div><div style={{ fontWeight: 900, fontSize: 18 }}>{student.name}</div><div style={{ fontSize: 13, opacity: .8 }}>{cls?.name || ''} · {fmtDate(reportDate)}</div></div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}><div style={{ fontSize: 12, opacity: .7 }}>Đi học</div><div style={{ fontWeight: 800, fontSize: 15 }}>{attLabel}</div></div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                                    {[['🍳 Bữa sáng', report.breakfast], ['🍱 Bữa trưa', report.lunch], ['🍎 Bữa xế', report.snack], ['😴 Ngủ trưa', report.napDuration > 0 ? report.napDuration + ' phút' : 'Không ngủ']].map(([lbl, val]) => (
                                        <div key={lbl} style={{ background: '#F5F3FF', borderRadius: 14, padding: '14px 16px' }}>
                                            <div style={{ fontSize: 10, fontWeight: 800, color: '#7C6D9B', textTransform: 'uppercase', marginBottom: 4 }}>{lbl}</div>
                                            <div style={{ fontSize: 15, fontWeight: 700, color: '#1E1B4B' }}>{val || '—'}</div>
                                        </div>
                                    ))}
                                </div>
                                {report.mood && <div style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', marginBottom: 12 }}>
                                    <div style={{ fontSize: 10, fontWeight: 800, color: '#7C6D9B', marginBottom: 8, textTransform: 'uppercase' }}>Tâm trạng</div>
                                    <span style={{ background: `${MOOD_COLOR[report.mood] || '#6B6494'}18`, color: MOOD_COLOR[report.mood] || '#6B6494', padding: '6px 14px', borderRadius: 50, fontWeight: 800, fontSize: 14 }}>{MOOD_EMOJI[report.mood] || '😊'} {report.mood}</span>
                                </div>}
                                {report.note && <div style={{ background: '#FFFBEB', borderRadius: 14, padding: '16px 18px', borderLeft: '3px solid #F59E0B' }}>
                                    <div style={{ fontSize: 10, fontWeight: 800, color: '#D97706', marginBottom: 6, textTransform: 'uppercase' }}>Ghi chú từ cô giáo</div>
                                    <div style={{ fontSize: 14, color: '#1E1B4B', lineHeight: 1.7 }}>{report.note}</div>
                                </div>}
                            </div>
                        )}
                    </div>
                )}
                {/* MESSAGES */}
                {tab === 'messages' && (
                    <div>
                        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E1B4B', marginBottom: 18 }}>Nhắn tin với nhà trường</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 420, overflowY: 'auto', padding: 4, marginBottom: 16 }}>
                            {messages.map((m, i) => (
                                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.from === 'parent' ? 'flex-end' : 'flex-start' }}>
                                    <div style={{ padding: '14px 16px', maxWidth: '78%', background: m.from === 'parent' ? 'linear-gradient(135deg,#6D28D9,#8B5CF6)' : '#EDE9FE', color: m.from === 'parent' ? '#fff' : '#1E1B4B', borderRadius: m.from === 'parent' ? '16px 4px 16px 16px' : '4px 16px 16px 16px' }}>
                                        <div style={{ fontSize: 11, fontWeight: 800, opacity: .7, marginBottom: 4 }}>{m.name}</div>
                                        <div style={{ fontSize: 14, lineHeight: 1.6 }}>{m.text}</div>
                                        <div style={{ fontSize: 11, opacity: .6, marginTop: 6, textAlign: 'right' }}>{m.time}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div style={{ background: '#fff', borderRadius: 16, padding: '14px 16px' }}>
                            <textarea value={msgText} onChange={e => setMsgText(e.target.value)} rows={3} placeholder="Nhập tin nhắn cho nhà trường..." style={{ width: '100%', border: '1.5px solid #DDD6FE', borderRadius: 12, padding: '10px 14px', fontSize: 14, resize: 'none', color: '#1E1B4B' }} />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                                <button onClick={sendMsg} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)', color: '#fff', fontWeight: 800, fontSize: 14 }}>Gửi →</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
