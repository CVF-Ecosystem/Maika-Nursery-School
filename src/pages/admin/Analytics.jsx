import { useMemo, useState } from 'react'
import { getDB } from '../../data/store'
import { fmtMoney } from '../../utils/format'

const MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
const QUARTERS = [
    { value: '1', label: 'Quý 1', months: [0, 1, 2] },
    { value: '2', label: 'Quý 2', months: [3, 4, 5] },
    { value: '3', label: 'Quý 3', months: [6, 7, 8] },
    { value: '4', label: 'Quý 4', months: [9, 10, 11] },
]

function startOfMonth(year, monthIndex) {
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`
}

function endOfMonth(year, monthIndex) {
    const day = new Date(year, monthIndex + 1, 0).getDate()
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function inRange(date, start, end) {
    return date && date >= start && date <= end
}

function BarChart({ items, valueKey, color, format = v => v }) {
    const max = Math.max(1, ...items.map(item => Number(item[valueKey] || 0)))
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 180, paddingTop: 12 }}>
            {items.map(item => {
                const value = Number(item[valueKey] || 0)
                const height = Math.max(6, (value / max) * 150)
                return (
                    <div key={item.label} style={{ flex: 1, minWidth: 44, textAlign: 'center' }}>
                        <div title={`${item.label}: ${format(value)}`} style={{ height, background: color, borderRadius: '8px 8px 3px 3px', transition: 'height .2s' }} />
                        <div style={{ fontSize: 11, color: '#6B6494', fontWeight: 800, marginTop: 8 }}>{item.label}</div>
                    </div>
                )
            })}
        </div>
    )
}

function LineChart({ items }) {
    const max = Math.max(100, ...items.map(item => item.attendanceRate || 0))
    const width = 560
    const height = 180
    const points = items.map((item, index) => {
        const x = items.length === 1 ? width / 2 : (index / (items.length - 1)) * width
        const y = height - ((item.attendanceRate || 0) / max) * 145 - 16
        return { x, y, item }
    })
    const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')

    return (
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 200, display: 'block' }} role="img" aria-label="Biểu đồ tỷ lệ chuyên cần">
            <path d="M 0 164 L 560 164" stroke="#EDE9FE" strokeWidth="2" />
            <path d={path} fill="none" stroke="#16A34A" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            {points.map(point => (
                <g key={point.item.label}>
                    <circle cx={point.x} cy={point.y} r="5" fill="#16A34A" />
                    <text x={point.x} y={point.y - 10} textAnchor="middle" fontSize="11" fontWeight="800" fill="#15803D">{point.item.attendanceRate}%</text>
                    <text x={point.x} y="178" textAnchor="middle" fontSize="11" fontWeight="800" fill="#6B6494">{point.item.label}</text>
                </g>
            ))}
        </svg>
    )
}

function MetricCard({ label, value, sub, color }) {
    return (
        <div style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', boxShadow: '0 2px 16px rgba(109,40,217,0.08)', borderTop: `3px solid ${color}` }}>
            <div style={{ fontSize: 23, fontWeight: 900, color: '#1E1B4B', lineHeight: 1.15 }}>{value}</div>
            <div style={{ fontSize: 13, color: '#6B6494', marginTop: 5, fontWeight: 800 }}>{label}</div>
            {sub && <div style={{ fontSize: 11, color, marginTop: 5, fontWeight: 800 }}>{sub}</div>}
        </div>
    )
}

function ReportBlock({ title, children }) {
    return (
        <section style={{ background: '#fff', borderRadius: 12, padding: '20px 22px', boxShadow: '0 2px 16px rgba(109,40,217,0.08)', minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 15, color: '#1E1B4B', marginBottom: 14 }}>{title}</div>
            {children}
        </section>
    )
}

export default function Analytics() {
    const db = getDB()
    const now = new Date()
    const [mode, setMode] = useState('month')
    const [year, setYear] = useState(String(now.getFullYear()))
    const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'))
    const [quarter, setQuarter] = useState(String(Math.floor(now.getMonth() / 3) + 1))

    const activeStudents = db.students.filter(s => s.status === 'active').length
    const availableYears = useMemo(() => {
        const years = new Set([String(now.getFullYear())])
        db.attendance.forEach(row => row.date && years.add(row.date.slice(0, 4)))
        db.finance.forEach(row => row.date && years.add(row.date.slice(0, 4)))
        db.students.forEach(row => row.enrollDate && years.add(row.enrollDate.slice(0, 4)))
        return Array.from(years).sort((a, b) => b.localeCompare(a))
    }, [db, now])

    const report = useMemo(() => {
        const y = Number(year)
        const q = QUARTERS.find(item => item.value === quarter) || QUARTERS[0]
        const monthIndex = Number(month) - 1
        const start = mode === 'month' ? startOfMonth(y, monthIndex) : startOfMonth(y, q.months[0])
        const end = mode === 'month' ? endOfMonth(y, monthIndex) : endOfMonth(y, q.months[2])
        const selectedMonths = mode === 'month' ? [monthIndex] : q.months

        const attendance = db.attendance.filter(row => inRange(row.date, start, end))
        const present = attendance.filter(row => row.status === 'present').length
        const late = attendance.filter(row => row.status === 'late').length
        const absent = attendance.filter(row => row.status === 'absent').length
        const attendanceRate = attendance.length ? Math.round(((present + late) / attendance.length) * 100) : 0

        const finance = db.finance.filter(row => inRange(row.date, start, end))
        const paid = finance.filter(row => row.status === 'paid').reduce((sum, row) => sum + Number(row.amount || 0), 0)
        const debt = finance.filter(row => row.status !== 'paid').reduce((sum, row) => sum + Number(row.amount || 0), 0)
        const overdue = finance.filter(row => row.status === 'overdue').reduce((sum, row) => sum + Number(row.amount || 0), 0)
        const collectionRate = paid + debt > 0 ? Math.round((paid / (paid + debt)) * 100) : 0

        const newStudents = db.students.filter(row => inRange(row.enrollDate, start, end)).length
        const inactiveStudents = db.students.filter(row => row.status === 'inactive' && inRange(row.enrollDate, start, end)).length

        const series = selectedMonths.map(idx => {
            const s = startOfMonth(y, idx)
            const e = endOfMonth(y, idx)
            const att = db.attendance.filter(row => inRange(row.date, s, e))
            const presentCount = att.filter(row => row.status === 'present' || row.status === 'late').length
            const fin = db.finance.filter(row => inRange(row.date, s, e))
            const revenue = fin.filter(row => row.status === 'paid').reduce((sum, row) => sum + Number(row.amount || 0), 0)
            const monthDebt = fin.filter(row => row.status !== 'paid').reduce((sum, row) => sum + Number(row.amount || 0), 0)
            return {
                label: `T${idx + 1}`,
                attendanceRate: att.length ? Math.round((presentCount / att.length) * 100) : 0,
                revenue,
                debt: monthDebt,
                newStudents: db.students.filter(row => inRange(row.enrollDate, s, e)).length,
            }
        })

        return { start, end, present, late, absent, attendanceRate, paid, debt, overdue, collectionRate, newStudents, inactiveStudents, series }
    }, [db, mode, year, month, quarter])

    const control = { padding: '9px 12px', borderRadius: 10, border: '1.5px solid #DDD6FE', background: '#fff', color: '#1E1B4B', fontSize: 13, fontWeight: 800 }

    return (
        <div className="admin-page-pad" style={{ padding: '28px 36px' }}>
            <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ color: '#6B6494', fontSize: 13, fontWeight: 700 }}>
                    Báo cáo {mode === 'month' ? `tháng ${month}/${year}` : `${QUARTERS.find(q => q.value === quarter)?.label}/${year}`} · {report.start} đến {report.end}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <select value={mode} onChange={e => setMode(e.target.value)} style={control}>
                        <option value="month">Theo tháng</option>
                        <option value="quarter">Theo quý</option>
                    </select>
                    <select value={year} onChange={e => setYear(e.target.value)} style={control}>
                        {availableYears.map(item => <option key={item} value={item}>{item}</option>)}
                    </select>
                    {mode === 'month' ? (
                        <select value={month} onChange={e => setMonth(e.target.value)} style={control}>
                            {MONTHS.map(item => <option key={item} value={item}>Tháng {Number(item)}</option>)}
                        </select>
                    ) : (
                        <select value={quarter} onChange={e => setQuarter(e.target.value)} style={control}>
                            {QUARTERS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                    )}
                </div>
            </div>

            <div className="landing-section-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 16, marginBottom: 20 }}>
                <MetricCard label="Tỷ lệ chuyên cần" value={`${report.attendanceRate}%`} sub={`${report.present} có mặt · ${report.late} đi muộn · ${report.absent} vắng`} color="#16A34A" />
                <MetricCard label="Doanh thu đã thu" value={fmtMoney(report.paid)} sub={`Tỷ lệ thu ${report.collectionRate}%`} color="#059669" />
                <MetricCard label="Công nợ" value={fmtMoney(report.debt)} sub={`Quá hạn ${fmtMoney(report.overdue)}`} color="#DC2626" />
                <MetricCard label="Tăng trưởng học sinh" value={`+${report.newStudents}`} sub={`${activeStudents} học sinh đang học`} color="#7C3AED" />
            </div>

            <div className="mobile-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <ReportBlock title="Chuyên cần">
                    <LineChart items={report.series} />
                </ReportBlock>
                <ReportBlock title="Doanh thu theo kỳ">
                    <BarChart items={report.series} valueKey="revenue" color="#059669" format={fmtMoney} />
                </ReportBlock>
            </div>

            <div className="mobile-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <ReportBlock title="Công nợ">
                    <BarChart items={report.series} valueKey="debt" color="#DC2626" format={fmtMoney} />
                </ReportBlock>
                <ReportBlock title="Tăng trưởng học sinh">
                    <BarChart items={report.series} valueKey="newStudents" color="#7C3AED" format={value => `${value} học sinh`} />
                    <div style={{ marginTop: 10, fontSize: 12, color: '#6B6494', fontWeight: 700 }}>
                        Kỳ này ghi nhận {report.newStudents} học sinh mới{report.inactiveStudents ? `, ${report.inactiveStudents} hồ sơ đã ngưng học` : ''}.
                    </div>
                </ReportBlock>
            </div>
        </div>
    )
}
