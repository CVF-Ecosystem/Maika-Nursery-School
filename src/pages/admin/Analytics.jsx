import { getDB } from '../../data/store'
import { fmtMoney } from '../../utils/format'

export default function Analytics() {
    const db = getDB()
    const today = new Date().toISOString().split('T')[0]
    const todayAtt = db.attendance.filter(a => a.date === today)
    const present = todayAtt.filter(a => a.status === 'present').length
    const absent = todayAtt.filter(a => a.status === 'absent').length
    const late = todayAtt.filter(a => a.status === 'late').length
    const activeStudents = db.students.filter(s => s.status === 'active').length
    const pct = activeStudents > 0 ? Math.round((present / activeStudents) * 100) : 0

    const totalRevenue = db.finance.filter(f => f.status === 'paid').reduce((s, f) => s + f.amount, 0)
    const totalPending = db.finance.filter(f => f.status !== 'paid').reduce((s, f) => s + f.amount, 0)
    const collectionRate = totalRevenue + totalPending > 0 ? Math.round(totalRevenue / (totalRevenue + totalPending) * 100) : 0

    const classDist = db.classes.map(c => ({
        name: c.name, color: c.color,
        count: db.students.filter(s => s.classId === c.id && s.status === 'active').length
    }))
    const moodDist = ['Vui vẻ', 'Bình thường', 'Mệt mỏi', 'Hào hứng', 'Buồn ngủ'].map(m => ({
        label: m, count: db.dailyReports.filter(r => r.mood === m).length
    })).filter(m => m.count > 0).sort((a, b) => b.count - a.count)

    return (
        <div className="admin-page-pad" style={{ padding: '28px 36px' }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#1E1B4B', marginBottom: 8 }}>Báo cáo & Phân tích</div>
            <div style={{ fontSize: 13, color: '#7C6D9B', marginBottom: 24 }}>Thống kê tổng hợp hoạt động nhà trường</div>
            <div className="landing-section-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 16, marginBottom: 24 }}>
                {[
                    ['👦', 'Học sinh đang học', activeStudents, '#7C3AED'],
                    ['📈', 'Tỷ lệ chuyên cần hôm nay', `${pct}%`, '#16A34A'],
                    ['💰', 'Tỷ lệ thu học phí', `${collectionRate}%`, '#F59E0B'],
                    ['✅', 'Có mặt hôm nay', present, '#16A34A'],
                    ['❌', 'Vắng mặt hôm nay', absent, '#DC2626'],
                    ['💵', 'Đã thu tháng này', fmtMoney(totalRevenue), '#059669'],
                ].map(([icon, lbl, val, col], i) => (
                    <div key={i} style={{ background: '#fff', borderRadius: 16, padding: '20px 22px', boxShadow: '0 2px 16px rgba(109,40,217,0.08)', borderTop: `3px solid ${col}` }}>
                        <div style={{ fontSize: 26, marginBottom: 8 }}>{icon}</div>
                        <div style={{ fontSize: 24, fontWeight: 900, color: '#1E1B4B', lineHeight: 1 }}>{val}</div>
                        <div style={{ fontSize: 13, color: '#6B6494', marginTop: 4, fontWeight: 600 }}>{lbl}</div>
                    </div>
                ))}
            </div>
            <div className="mobile-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ background: '#fff', borderRadius: 16, padding: '22px 24px', boxShadow: '0 2px 16px rgba(109,40,217,0.08)' }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#1E1B4B', marginBottom: 16 }}>Phân bổ học sinh theo lớp</div>
                    {classDist.map(c => (
                        <div key={c.name} style={{ marginBottom: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#1E1B4B' }}>{c.name}</span>
                                <span style={{ fontSize: 13, fontWeight: 800, color: c.color }}>{c.count} học sinh</span>
                            </div>
                            <div style={{ height: 8, background: '#EDE9FE', borderRadius: 999, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${activeStudents > 0 ? c.count / activeStudents * 100 : 0}%`, background: c.color, borderRadius: 999 }} />
                            </div>
                        </div>
                    ))}
                </div>
                <div style={{ background: '#fff', borderRadius: 16, padding: '22px 24px', boxShadow: '0 2px 16px rgba(109,40,217,0.08)' }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#1E1B4B', marginBottom: 16 }}>Tâm trạng học sinh</div>
                    {moodDist.length === 0 ? <div style={{ textAlign: 'center', color: '#7C6D9B', padding: '20px 0' }}>Chưa có dữ liệu</div> :
                        moodDist.map((m, i) => (
                            <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #EDE9FE' }}>
                                <span style={{ fontSize: 14 }}>{{ 'Vui vẻ': '😄', 'Bình thường': '😊', 'Mệt mỏi': '😴', 'Hào hứng': '🤩', 'Buồn ngủ': '🥱' }[m.label] || '😊'} {m.label}</span>
                                <span style={{ fontWeight: 800, color: '#7C3AED', fontSize: 15 }}>{m.count}</span>
                            </div>
                        ))
                    }
                </div>
            </div>
        </div>
    )
}
