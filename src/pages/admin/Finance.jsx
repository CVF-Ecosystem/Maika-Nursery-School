import { useState, useMemo } from 'react'
import { getDB, commit } from '../../data/store'
import { fmtMoney, fmtDate } from '../../utils/format'

export default function Finance() {
    const [db, setDB] = useState(getDB())
    const [filter, setFilter] = useState('all')
    const [search, setSearch] = useState('')
    const [modal, setModal] = useState(null)
    const [form, setForm] = useState({ studentId: '', type: 'tuition', desc: '', amount: '', date: new Date().toISOString().split('T')[0], status: 'pending', method: '' })

    const records = useMemo(() => db.finance.filter(f => {
        if (filter !== 'all' && f.status !== filter) return false
        if (search) { const s = db.students.find(st => st.id === f.studentId); return (s?.name || '').toLowerCase().includes(search.toLowerCase()) || f.desc.toLowerCase().includes(search.toLowerCase()) }
        return true
    }).sort((a, b) => b.date.localeCompare(a.date)), [db, filter, search])

    const paid = db.finance.filter(f => f.status === 'paid').reduce((s, f) => s + f.amount, 0)
    const pending = db.finance.filter(f => f.status === 'pending').reduce((s, f) => s + f.amount, 0)
    const overdue = db.finance.filter(f => f.status === 'overdue').reduce((s, f) => s + f.amount, 0)

    function saveRecord() {
        const ndb = getDB()
        ndb.finance.push({ ...form, id: 'f' + Date.now(), amount: +form.amount })
        commit(); setDB({ ...ndb }); setModal(null)
    }

    function updateStatus(id, status) {
        const ndb = getDB(); const idx = ndb.finance.findIndex(f => f.id === id); if (idx >= 0) ndb.finance[idx].status = status
        commit(); setDB({ ...ndb })
    }

    const statusMap = { paid: ['#16A34A', '#F0FDF4', 'Đã đóng'], pending: ['#D97706', '#FFFBEB', 'Chưa đóng'], overdue: ['#DC2626', '#FEF2F2', 'Quá hạn'] }
    const sel = { padding: '9px 14px', borderRadius: 10, border: '1.5px solid #DDD6FE', fontSize: 13, color: '#1E1B4B', background: '#fff' }
    const is = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #DDD6FE', fontSize: 13, color: '#1E1B4B', boxSizing: 'border-box' }
    const ls = { fontSize: 12, fontWeight: 700, color: '#6B6494', display: 'block', marginBottom: 4 }

    return (
        <div className="admin-page-pad" style={{ padding: '28px 36px' }}>
            {modal === 'add' && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && setModal(null)}>
                    <div style={{ background: '#fff', borderRadius: 20, width: 'min(480px, calc(100vw - 24px))', padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                        <div style={{ fontWeight: 800, fontSize: 17, color: '#1E1B4B', marginBottom: 20 }}>Thêm giao dịch</div>
                        <div className="mobile-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                            <div style={{ gridColumn: '1/-1' }}>
                                <label style={ls}>Học sinh</label>
                                <select style={is} value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })}>
                                    <option value="">— Chọn học sinh —</option>
                                    {db.students.filter(s => s.status === 'active').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div><label style={ls}>Loại</label><select style={is} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="tuition">Học phí</option><option value="meal">Tiền ăn</option><option value="material">Học liệu</option><option value="other">Khác</option></select></div>
                            <div><label style={ls}>Số tiền (VND)</label><input type="number" style={is} value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="2500000" /></div>
                            <div style={{ gridColumn: '1/-1' }}><label style={ls}>Mô tả</label><input style={is} value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} /></div>
                            <div><label style={ls}>Ngày</label><input type="date" style={is} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
                            <div><label style={ls}>Trạng thái</label><select style={is} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option value="pending">Chưa đóng</option><option value="paid">Đã đóng</option><option value="overdue">Quá hạn</option></select></div>
                        </div>
                        <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
                            <button onClick={() => setModal(null)} style={{ padding: '9px 20px', borderRadius: 10, border: '1.5px solid #DDD6FE', background: '#fff', fontSize: 13, fontWeight: 700, color: '#6B6494', cursor: 'pointer' }}>Hủy</button>
                            <button onClick={saveRecord} style={{ padding: '9px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Lưu</button>
                        </div>
                    </div>
                </div>
            )}
            <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 20, gap: 12 }}>
                <button onClick={() => setModal('add')} style={{ padding: '10px 22px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>+ Thêm giao dịch</button>
            </div>
            <div className="landing-section-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 24 }}>
                {[['💚', 'Đã thu', paid, '#16A34A', '#F0FDF4'], ['🟡', 'Chưa đóng', pending, '#D97706', '#FFFBEB'], ['🔴', 'Quá hạn', overdue, '#DC2626', '#FEF2F2']].map(([icon, lbl, amt, col, bg]) => (
                    <div key={lbl} style={{ background: bg, borderRadius: 14, padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'center' }}>
                        <span style={{ fontSize: 28 }}>{icon}</span>
                        <div><div style={{ fontSize: 10, fontWeight: 800, color: col, letterSpacing: .5, textTransform: 'uppercase' }}>{lbl}</div><div style={{ fontWeight: 900, fontSize: 18, color: col, lineHeight: 1.2 }}>{fmtMoney(amt)}</div></div>
                    </div>
                ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Tìm theo học sinh..." style={{ ...sel, flex: 1 }} />
                <select value={filter} onChange={e => setFilter(e.target.value)} style={sel}><option value="all">Tất cả</option><option value="paid">Đã đóng</option><option value="pending">Chưa đóng</option><option value="overdue">Quá hạn</option></select>
            </div>
            <div className="mobile-scroll-table" style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(109,40,217,0.08)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: '#F8F7FF' }}>{['Học sinh', 'Mô tả', 'Số tiền', 'Ngày', 'Trạng thái', ''].map(h => <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#7C6D9B', borderBottom: '1.5px solid #DDD6FE' }}>{h}</th>)}</tr></thead>
                    <tbody>
                        {records.map(f => {
                            const st = db.students.find(s => s.id === f.studentId)
                            const [col, bg, lbl] = statusMap[f.status] || ['#6B6494', '#F5F5F4', '—']
                            return (
                                <tr key={f.id} style={{ borderBottom: '1px solid #EDE9FE' }} onMouseEnter={e => e.currentTarget.style.background = '#F8F7FF'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                                    <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: 13 }}>{st?.name || '—'}</td>
                                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B6494' }}>{f.desc}</td>
                                    <td style={{ padding: '12px 16px', fontWeight: 800, fontSize: 13, color: '#1E1B4B' }}>{fmtMoney(f.amount)}</td>
                                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B6494' }}>{fmtDate(f.date)}</td>
                                    <td style={{ padding: '12px 16px' }}><span style={{ background: bg, color: col, borderRadius: 6, fontSize: 11, fontWeight: 700, padding: '2px 8px' }}>{lbl}</span></td>
                                    <td style={{ padding: '12px 16px' }}>
                                        {f.status !== 'paid' && <button onClick={() => updateStatus(f.id, 'paid')} style={{ padding: '4px 12px', borderRadius: 8, border: '1.5px solid #16A34A', background: '#fff', color: '#16A34A', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>✓ Đã đóng</button>}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
                {records.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: '#7C6D9B', fontSize: 14 }}>Không có giao dịch nào</div>}
            </div>
        </div>
    )
}
