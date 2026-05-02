import { useEffect, useState } from 'react'
import { getDB, todayStr } from '../../data/store'
import { fmtMoney, fmtDate } from '../../utils/format'
import { isSupabaseSession } from '../../data/backendMode'
import { getCurrentProfile } from '../../features/auth/authService'
import { listStudents } from '../../features/students/studentService'
import { listInvoices as listSupabaseInvoices, listIncidents as listSupabaseIncidents } from '../../features/sensitive/sensitiveService'
import { listDailyReportsByFacilityDate } from '../../features/reports/dailyReportService'
import { listAttendanceByFacilityDate } from '../../features/attendance/attendanceService'

function StatCard({ icon, label, value, sub, color, onClick }) {
    return (
        <div onClick={onClick} style={{ background: '#fff', borderRadius: 16, padding: '20px 22px', boxShadow: '0 2px 16px rgba(109,40,217,0.08)', cursor: onClick ? 'pointer' : 'default', borderTop: `3px solid ${color}`, transition: 'transform 0.15s, box-shadow 0.15s', display: 'flex', flexDirection: 'column', gap: 8 }}
            onMouseEnter={e => { if (onClick) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)'; } }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 2px 16px rgba(109,40,217,0.08)'; }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 26 }}>{icon}</div>
                <div style={{ background: color + '18', borderRadius: 8, padding: '4px 8px', fontSize: 11, fontWeight: 700, color }}>{sub}</div>
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, color: '#1E1B4B', lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 13, color: '#6B6494', fontWeight: 600 }}>{label}</div>
        </div>
    )
}

function QuickAttendance({ db }) {
    const today = todayStr()
    const todayAtt = db.attendance.filter(a => a.date === today)
    const present = todayAtt.filter(a => a.status === 'present').length
    const absent = todayAtt.filter(a => a.status === 'absent').length
    const late = todayAtt.filter(a => a.status === 'late').length
    const total = db.students.filter(s => s.status === 'active').length
    const pct = total > 0 ? Math.round((present / total) * 100) : 0
    return (
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px 22px', boxShadow: '0 2px 16px rgba(109,40,217,0.08)' }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#1E1B4B', marginBottom: 16 }}>Điểm danh hôm nay</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <div style={{ position: 'relative', width: 80, height: 80 }}>
                    <svg viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="40" cy="40" r="30" fill="none" stroke="#DDD6FE" strokeWidth="10" />
                        <circle cx="40" cy="40" r="30" fill="none" stroke="#7C3AED" strokeWidth="10" strokeDasharray={`${pct * 1.885} 188.5`} strokeLinecap="round" />
                    </svg>
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontWeight: 800, fontSize: 16, color: '#7C3AED' }}>{pct}%</div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[['✅ Có mặt', present, '#16A34A'], ['⏰ Đi trễ', late, '#7C3AED'], ['❌ Vắng mặt', absent, '#DC2626']].map(([lbl, val, col]) => (
                        <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 13, color: '#6B6494' }}>{lbl}</span>
                            <span style={{ fontWeight: 800, color: col, fontSize: 15 }}>{val}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

function RecentMessages({ db, onNav }) {
    const unread = db.messages.filter(m => !m.read && m.fromRole === 'parent').slice(0, 4)
    return (
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px 22px', boxShadow: '0 2px 16px rgba(109,40,217,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#1E1B4B' }}>Tin nhắn chưa đọc</div>
                <button onClick={() => onNav('messages')} style={{ background: 'none', border: 'none', color: '#7C3AED', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Xem tất cả →</button>
            </div>
            {unread.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#7C6D9B', fontSize: 13, padding: '20px 0' }}>Không có tin nhắn mới</div>
            ) : unread.map(m => (
                <div key={m.id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid #EDE9FE' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 999, background: 'linear-gradient(135deg,#7C3AED,#A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>{m.fromName.charAt(0)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#1E1B4B' }}>{m.fromName}</div>
                        <div style={{ fontSize: 12, color: '#6B6494', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.subject}</div>
                    </div>
                    <div style={{ fontSize: 11, color: '#7C6D9B', flexShrink: 0 }}>{new Date(m.date).toLocaleDateString('vi-VN')}</div>
                </div>
            ))}
        </div>
    )
}

function UpcomingEvents({ db, onNav }) {
    const today = todayStr()
    const upcoming = db.events.filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5)
    const typeColor = { school: '#7C3AED', celebration: '#A78BFA', meeting: '#7C3AED', health: '#16A34A', finance: '#DC2626', holiday: '#06B6D4', training: '#8B5CF6' }
    const typeLabel = { school: 'Học đường', celebration: 'Lễ hội', meeting: 'Họp', health: 'Y tế', finance: 'Tài chính', holiday: 'Nghỉ lễ', training: 'Tập huấn' }
    return (
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px 22px', boxShadow: '0 2px 16px rgba(109,40,217,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#1E1B4B' }}>Sự kiện sắp tới</div>
                <button onClick={() => onNav('calendar')} style={{ background: 'none', border: 'none', color: '#7C3AED', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Xem lịch →</button>
            </div>
            {upcoming.map(ev => (
                <div key={ev.id} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid #EDE9FE', alignItems: 'flex-start' }}>
                    <div style={{ width: 40, textAlign: 'center', flexShrink: 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#7C6D9B', textTransform: 'uppercase' }}>{new Date(ev.date + 'T00:00:00').toLocaleDateString('vi-VN', { month: 'short' })}</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: '#7C3AED', lineHeight: 1 }}>{new Date(ev.date + 'T00:00:00').getDate()}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#1E1B4B' }}>{ev.title}</div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: typeColor[ev.type] || '#6B6494', background: (typeColor[ev.type] || '#6B6494') + '18', borderRadius: 4, padding: '1px 6px' }}>{typeLabel[ev.type] || ev.type}</span>
                    </div>
                </div>
            ))}
        </div>
    )
}

function FinanceSummary({ db }) {
    const paid = db.finance.filter(f => f.status === 'paid').reduce((s, f) => s + f.amount, 0)
    const pending = db.finance.filter(f => f.status === 'pending').reduce((s, f) => s + f.amount, 0)
    const overdue = db.finance.filter(f => f.status === 'overdue').reduce((s, f) => s + f.amount, 0)
    const total = paid + pending + overdue
    const paidPct = total > 0 ? (paid / total) * 100 : 0
    return (
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px 22px', boxShadow: '0 2px 16px rgba(109,40,217,0.08)' }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#1E1B4B', marginBottom: 14 }}>Học phí tháng này</div>
            <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B6494', marginBottom: 4 }}>
                    <span>Thu được</span><span style={{ fontWeight: 800, color: '#16A34A' }}>{fmtMoney(paid)}</span>
                </div>
                <div style={{ height: 8, background: '#DDD6FE', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${paidPct}%`, background: 'linear-gradient(90deg,#16A34A,#4ADE80)', borderRadius: 999 }} />
                </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1, background: '#F5F3FF', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: '#7C6D9B', fontWeight: 700 }}>CHƯA ĐÓNG</div>
                    <div style={{ fontWeight: 800, color: '#7C3AED', fontSize: 14 }}>{fmtMoney(pending)}</div>
                </div>
                <div style={{ flex: 1, background: '#FEF2F2', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: '#DC2626', fontWeight: 700 }}>QUÁ HẠN</div>
                    <div style={{ fontWeight: 800, color: '#DC2626', fontSize: 14 }}>{fmtMoney(overdue)}</div>
                </div>
            </div>
        </div>
    )
}

function AlertItem({ color, bg, icon, label, count, onNav, navTarget }) {
    if (!count) return null
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: bg, marginBottom: 8 }}>
            <div style={{ fontSize: 20, flexShrink: 0 }}>{icon}</div>
            <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 800, color, fontSize: 14 }}>{count}</span>
                <span style={{ fontSize: 13, color: '#4B4899', fontWeight: 600, marginLeft: 6 }}>{label}</span>
            </div>
            <button onClick={() => onNav(navTarget)} style={{ padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${color}`, background: '#fff', color, fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Xem →</button>
        </div>
    )
}

function SupabaseAlerts({ onNav, selectedFacilityId }) {
    const [alerts, setAlerts] = useState(null)

    useEffect(() => {
        async function load() {
            try {
                const profile = await getCurrentProfile()
                const facilityId = profile?.role === 'teacher' ? profile.facility_id : selectedFacilityId || undefined
                const today = todayStr()
                const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
                const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
                const cutoff3d = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

                const [invoices, incidents, students, reports, attToday, attYesterday] = await Promise.all([
                    listSupabaseInvoices({ facilityId }).catch(() => []),
                    listSupabaseIncidents({ facilityId }).catch(() => []),
                    listStudents({ facilityId, status: 'active' }).catch(() => []),
                    listDailyReportsByFacilityDate({ facilityId, date: today }).catch(() => []),
                    listAttendanceByFacilityDate({ facilityId, date: today }).catch(() => ({})),
                    listAttendanceByFacilityDate({ facilityId, date: yesterday }).catch(() => ({})),
                ])

                const overdueInvoices = invoices.filter(inv =>
                    inv.status !== 'paid' && inv.status !== 'cancelled' && inv.due_date && inv.due_date < cutoff3d
                ).length

                const openIncidents = incidents.filter(inc =>
                    inc.status === 'open' && inc.created_at && inc.created_at < cutoff24h
                ).length

                const reportedIds = new Set(reports.map(r => r.studentId))
                const missingReports = students.filter(s => !reportedIds.has(s.id)).length

                const absentToday = new Set(Object.values(attToday).filter(a => a?.status === 'absent').map(a => a.studentId))
                const absentYesterday = new Set(Object.values(attYesterday).filter(a => a?.status === 'absent').map(a => a.studentId))
                const consecutiveAbsent = [...absentToday].filter(id => absentYesterday.has(id)).length

                setAlerts({ overdueInvoices, openIncidents, missingReports, consecutiveAbsent })
            } catch { setAlerts({}) }
        }
        load()
    }, [selectedFacilityId])

    if (!alerts) return (
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px 22px', boxShadow: '0 2px 16px rgba(109,40,217,0.08)', marginBottom: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#1E1B4B', marginBottom: 14 }}>⚡ Việc cần làm hôm nay</div>
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 46, borderRadius: 12, marginBottom: 8 }} />)}
        </div>
    )

    const total = (alerts.overdueInvoices || 0) + (alerts.openIncidents || 0) + (alerts.missingReports || 0) + (alerts.consecutiveAbsent || 0)

    return (
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px 22px', boxShadow: '0 2px 16px rgba(109,40,217,0.08)', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#1E1B4B' }}>⚡ Việc cần làm hôm nay</div>
                {total === 0 && <span style={{ fontSize: 12, fontWeight: 700, color: '#16A34A', background: '#ECFDF5', borderRadius: 8, padding: '3px 10px' }}>✅ Tất cả ổn</span>}
            </div>
            {total === 0 ? (
                <div style={{ textAlign: 'center', color: '#16A34A', fontSize: 14, fontWeight: 700, padding: '12px 0' }}>Không có việc tồn đọng — tốt lắm! 🎉</div>
            ) : (
                <>
                    <AlertItem color="#DC2626" bg="#FEF2F2" icon="💸" label="hóa đơn quá hạn trên 3 ngày" count={alerts.overdueInvoices} onNav={onNav} navTarget="invoices" />
                    <AlertItem color="#DC2626" bg="#FEF2F2" icon="🚨" label="sự cố mở chưa xử lý trên 24h" count={alerts.openIncidents} onNav={onNav} navTarget="incidents" />
                    <AlertItem color="#D97706" bg="#FFFBEB" icon="📅" label="học sinh vắng liên tiếp ≥ 2 ngày" count={alerts.consecutiveAbsent} onNav={onNav} navTarget="attendance" />
                    <AlertItem color="#7C3AED" bg="#F5F3FF" icon="📝" label="học sinh chưa có nhật ký hôm nay" count={alerts.missingReports} onNav={onNav} navTarget="reports" />
                </>
            )}
        </div>
    )
}

export default function Dashboard({ onNav, scopeStats = {}, selectedFacilityId = '' }) {
    const supabaseMode = isSupabaseSession()
    const db = getDB()
    const activeStudents = supabaseMode ? scopeStats.students || 0 : db.students.filter(s => s.status === 'active').length
    const activeTeachers = supabaseMode ? scopeStats.teachers || 0 : db.teachers.filter(t => t.status === 'active').length
    const unreadMsg = db.messages.filter(m => !m.read && m.fromRole === 'parent').length
    const today = todayStr()
    const todayReports = db.dailyReports.filter(r => r.date === today).length
    return (
        <div className="admin-page-pad" style={{ padding: '28px 36px' }}>
            <div style={{ marginBottom: 24 }}>
                <div style={{ fontWeight: 800, fontSize: 22, color: '#1E1B4B' }}>Xin chào, Hiệu trưởng! 👋</div>
                <div style={{ fontSize: 14, color: '#7C6D9B', marginTop: 4 }}>Đây là tổng quan hoạt động của trường hôm nay.</div>
            </div>
            {supabaseMode && <SupabaseAlerts onNav={onNav} selectedFacilityId={selectedFacilityId} />}
            <div className="landing-section-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 16, marginBottom: 24 }}>
                <StatCard icon="👦" label="Học sinh đang học" value={activeStudents} sub="Đang học" color="#7C3AED" onClick={() => onNav('students')} />
                <StatCard icon="👩‍🏫" label="Giáo viên" value={activeTeachers} sub="Hoạt động" color="#A78BFA" onClick={() => onNav('teachers')} />
                <StatCard icon="💬" label="Tin nhắn mới" value={unreadMsg} sub="Chưa đọc" color="#7C3AED" onClick={() => onNav('messages')} />
                <StatCard icon="📝" label="Nhật ký hôm nay" value={todayReports} sub="Đã ghi" color="#16A34A" onClick={() => onNav('reports')} />
            </div>
            <div className="mobile-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <QuickAttendance db={db} />
                <FinanceSummary db={db} />
            </div>
            <div className="mobile-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <RecentMessages db={db} onNav={onNav} />
                <UpcomingEvents db={db} onNav={onNav} />
            </div>
        </div>
    )
}
