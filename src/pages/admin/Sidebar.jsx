import { useNavigate } from 'react-router-dom'

const NAV_ITEMS = [
    { id: 'dashboard', icon: '⊞', label: 'Tổng quan' },
    { id: 'students', icon: '👦', label: 'Học sinh' },
    { id: 'teachers', icon: '👩‍🏫', label: 'Giáo viên' },
    { id: 'attendance', icon: '✓', label: 'Điểm danh' },
    { id: 'reports', icon: '📝', label: 'Nhật ký ngày' },
    { id: 'finance', icon: '💰', label: 'Học phí' },
    { id: 'messages', icon: '💬', label: 'Tin nhắn' },
    { id: 'calendar', icon: '📅', label: 'Lịch sự kiện' },
    { id: 'analytics', icon: '📊', label: 'Báo cáo' },
    { id: 'resources', icon: '📚', label: 'Tài nguyên' },
    { id: 'gamification', icon: '🏆', label: 'Thành tích' },
    { id: 'users', icon: '⚙', label: 'Tài khoản' },
    { id: 'audit', icon: '◷', label: 'Nhật ký' },
    { id: 'backups', icon: '⇩', label: 'Sao lưu' },
]

const GROUPS = [
    { label: 'QUẢN LÝ', ids: ['dashboard', 'students', 'teachers'] },
    { label: 'HOẠT ĐỘNG', ids: ['attendance', 'reports', 'finance'] },
    { label: 'GIAO TIẾP', ids: ['messages', 'calendar'] },
    { label: 'PHÂN TÍCH', ids: ['analytics', 'resources', 'gamification'] },
    { label: 'HỆ THỐNG', ids: ['users', 'audit', 'backups'] },
]

export default function Sidebar({ active, onNav, unreadCount }) {
    const navigate = useNavigate()
    return (
        <aside style={{ width: 248, minHeight: '100vh', background: 'linear-gradient(180deg,#1E1B4B 0%,#2D2870 100%)', display: 'flex', flexDirection: 'column', position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 100, boxShadow: '4px 0 24px rgba(30,27,75,0.25)' }}>
            {/* Logo */}
            <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid rgba(167,139,250,0.15)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#7C3AED,#A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, boxShadow: '0 4px 14px rgba(124,58,237,0.5)' }}>🌸</div>
                    <div>
                        <div style={{ fontWeight: 900, fontSize: 17, color: '#fff', letterSpacing: -0.5 }}>Maika</div>
                        <div style={{ fontSize: 10, color: '#8B83C3', fontWeight: 700, letterSpacing: 1 }}>NHÀ TRẺ TƯ THỤC</div>
                    </div>
                </div>
            </div>
            {/* Nav */}
            <nav style={{ flex: 1, padding: '14px 10px', overflowY: 'auto' }}>
                {GROUPS.map(group => (
                    <div key={group.label} style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 9, fontWeight: 800, color: '#4D4899', letterSpacing: 1.5, padding: '0 10px 6px' }}>{group.label}</div>
                        {NAV_ITEMS.filter(item => group.ids.includes(item.id)).map(item => {
                            const isActive = active === item.id
                            return (
                                <button key={item.id} onClick={() => onNav(item.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: 'none', background: isActive ? 'rgba(124,58,237,0.22)' : 'transparent', color: isActive ? '#C4B5FD' : '#8B83C3', fontSize: 13.5, fontWeight: isActive ? 700 : 600, cursor: 'pointer', marginBottom: 2, textAlign: 'left', borderLeft: `3px solid ${isActive ? '#A78BFA' : 'transparent'}`, transition: 'all 0.15s', position: 'relative' }}
                                    onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#C4B5FD'; } }}
                                    onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8B83C3'; } }}>
                                    <span style={{ fontSize: 15, width: 22, textAlign: 'center', opacity: isActive ? 1 : 0.75 }}>{item.icon}</span>
                                    <span style={{ flex: 1 }}>{item.label}</span>
                                    {item.id === 'messages' && unreadCount > 0 && (
                                        <span style={{ background: '#7C3AED', color: '#fff', borderRadius: 999, fontSize: 10, fontWeight: 900, padding: '2px 7px', minWidth: 20, textAlign: 'center' }}>{unreadCount}</span>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                ))}
            </nav>
            {/* Footer */}
            <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(167,139,250,0.15)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#7C3AED,#A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 13 }}>HT</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#E2DFFF' }}>Hiệu trưởng</div>
                    <div style={{ fontSize: 10, color: '#6B5FAA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>admin@maika.edu.vn</div>
                </div>
                <div style={{ width: 8, height: 8, borderRadius: 999, background: '#10B981' }} />
            </div>
        </aside>
    )
}

export function TopBar({ title, subtitle }) {
    const dateStr = new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    return (
        <div style={{ height: 64, background: '#fff', borderBottom: '1px solid #EDE9FE', display: 'flex', alignItems: 'center', padding: '0 32px', gap: 16, position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 1px 12px rgba(109,40,217,0.06)' }}>
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 18, color: '#1E1B4B', letterSpacing: -0.3 }}>{title}</div>
                {subtitle && <div style={{ fontSize: 12, color: '#7C6D9B', marginTop: 1, fontWeight: 600 }}>{subtitle}</div>}
            </div>
            <div style={{ fontSize: 12, color: '#7C6D9B', fontWeight: 700, background: '#F5F3FF', padding: '6px 14px', borderRadius: 20 }}>{dateStr}</div>
        </div>
    )
}
