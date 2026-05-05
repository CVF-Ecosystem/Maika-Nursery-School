import { useEffect, useState } from 'react'
import { isSupabaseSession } from '../../data/backendMode'
import { listFeeNoticeItems, listFeeNotices, updateFeeNoticeStatus } from '../../features/payments/feeNoticeService'
import { listStudents } from '../../features/students/studentService'
import { sendInvoiceZns } from '../../features/zalo/zaloService'
import { fmtMoney } from '../../utils/format'
import FeeNoticePrint from './invoices/FeeNoticePrint'

function currentYearMonth() {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const STATUS_CONFIG = {
    draft: { label: 'Nháp', bg: '#F5F3FF', color: '#6D28D9', border: '#DDD6FE' },
    sent: { label: 'Đã gửi', bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' },
    paid: { label: 'Đã thu', bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' },
    cancelled: { label: 'Đã hủy', bg: '#F5F5F4', color: '#6B7280', border: '#E5E7EB' },
    adjusted: { label: 'Điều chỉnh', bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' },
}

function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft
    return (
        <span
            style={{
                display: 'inline-block',
                padding: '3px 10px',
                borderRadius: 999,
                background: cfg.bg,
                color: cfg.color,
                border: `1px solid ${cfg.border}`,
                fontSize: 11,
                fontWeight: 700,
                whiteSpace: 'nowrap',
            }}
        >
            {cfg.label}
        </span>
    )
}

function ItemTypeBadge({ type }) {
    const map = {
        charge: ['#F8F7FF', '#6D28D9', 'Thu'],
        discount: ['#ECFDF5', '#059669', 'Hoàn'],
        credit: ['#EFF6FF', '#2563EB', 'Cấn trừ'],
        adjustment: ['#FFFBEB', '#B45309', 'Điều chỉnh'],
    }
    const [bg, color, label] = map[type] || ['#F5F5F4', '#6B7280', type]
    return (
        <span
            style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: 999,
                background: bg,
                color,
                fontSize: 10,
                fontWeight: 700,
            }}
        >
            {label}
        </span>
    )
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

const STATUS_FILTERS = [
    ['', 'Tất cả'],
    ['draft', 'Nháp'],
    ['sent', 'Đã gửi'],
    ['paid', 'Đã thu'],
    ['adjusted', 'Điều chỉnh'],
]

export default function FeeNotices({ selectedFacilityId = '' }) {
    const supabaseMode = isSupabaseSession()
    const [yearMonth, setYearMonth] = useState(currentYearMonth)
    const [statusFilter, setStatusFilter] = useState('')
    const [notices, setNotices] = useState([])
    const [students, setStudents] = useState([])
    const [selectedNotice, setSelectedNotice] = useState(null)
    const [selectedItems, setSelectedItems] = useState([])
    const [loading, setLoading] = useState(false)
    const [itemsLoading, setItemsLoading] = useState(false)
    const [actionMsg, setActionMsg] = useState('')

    useEffect(() => {
        if (!supabaseMode) return
        let mounted = true
        async function load() {
            setLoading(true)
            try {
                const [noticeList, studentList] = await Promise.all([
                    listFeeNotices({ facilityId: selectedFacilityId || undefined, yearMonth }),
                    listStudents({ facilityId: selectedFacilityId || undefined, status: 'active' }),
                ])
                if (!mounted) return
                setNotices(noticeList)
                setStudents(studentList)
                setSelectedNotice(null)
                setSelectedItems([])
            } catch {
                // silence — parent shows error
            } finally {
                if (mounted) setLoading(false)
            }
        }
        load()
        return () => {
            mounted = false
        }
    }, [supabaseMode, selectedFacilityId, yearMonth])

    async function selectNotice(notice) {
        setSelectedNotice(notice)
        setSelectedItems([])
        setItemsLoading(true)
        try {
            const items = await listFeeNoticeItems({ noticeId: notice.id })
            setSelectedItems(items)
        } finally {
            setItemsLoading(false)
        }
    }

    async function markStatus(notice, status) {
        try {
            await updateFeeNoticeStatus({ noticeId: notice.id, status })
            setNotices(prev => prev.map(n => (n.id === notice.id ? { ...n, status } : n)))
            if (selectedNotice?.id === notice.id) setSelectedNotice(prev => ({ ...prev, status }))
            setActionMsg(`Đã cập nhật trạng thái phiếu ${notice.notice_number}.`)
            setTimeout(() => setActionMsg(''), 3000)
        } catch {
            setActionMsg('Không cập nhật được trạng thái.')
        }
    }

    async function sendZaloNotice(notice) {
        const student = studentMap[notice.student_id]
        try {
            const dueDate = notice.year_month ? `${notice.year_month}-10` : ''
            await sendInvoiceZns({
                phone: student?.parentPhone,
                studentName: student?.name,
                amount: notice.total_amount,
                dueDate,
                invoiceNumber: notice.notice_number,
                facilityId: notice.facility_id,
                invoiceId: notice.linked_invoice_id || notice.id,
            })
            await markStatus(notice, notice.status === 'draft' ? 'sent' : notice.status)
            setActionMsg(`Đã gửi Zalo cho phiếu ${notice.notice_number}.`)
        } catch {
            setActionMsg('Không gửi được Zalo. Kiểm tra số điện thoại và cấu hình ZNS.')
        }
    }

    async function printVisibleNotices() {
        const rows = filtered.slice(0, 120)
        if (!rows.length) return
        setActionMsg('Đang chuẩn bị file in...')
        try {
            const pairs = await Promise.all(
                rows.map(async notice => [notice.id, await listFeeNoticeItems({ noticeId: notice.id })]),
            )
            const itemsMap = Object.fromEntries(pairs)
            const html = rows
                .map(notice => {
                    const student = studentMap[notice.student_id]
                    const items = itemsMap[notice.id] || []
                    return `<section class="page">
                        <div class="header">
                            <div class="school">Nhà Trẻ Tư Thục Maika</div>
                            <h1>PHIẾU THÔNG BÁO THU</h1>
                            <div>${escapeHtml(notice.year_month || '')}</div>
                        </div>
                        <div class="info"><span>Số phiếu</span><b>${escapeHtml(notice.notice_number || '')}</b></div>
                        <div class="info"><span>Học sinh</span><b>${escapeHtml(student?.name || '')}</b></div>
                        <div class="info"><span>Lớp</span><b>${escapeHtml(student?.className || '')}</b></div>
                        <hr/>
                        ${items
                            .map(
                                item => `<div class="item">
                                    <span>${escapeHtml(item.name)}${
                                        Number(item.quantity) !== 1
                                            ? ` <small>x ${escapeHtml(item.quantity)} ${escapeHtml(item.unit)}</small>`
                                            : ''
                                    }</span>
                                    <b>${item.amount < 0 ? '-' : ''}${fmtMoney(Math.abs(item.amount))}</b>
                                </div>`,
                            )
                            .join('')}
                        <hr/>
                        <div class="total"><span>Tổng phải thu</span><b>${fmtMoney(notice.total_amount)}</b></div>
                        <div class="footer">In ngày ${new Date().toLocaleDateString('vi-VN')}</div>
                    </section>`
                })
                .join('')
            const w = window.open('', '_blank', 'width=800,height=1000')
            if (!w) return
            w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>In phiếu báo thu</title>
                <style>
                    body{font-family:system-ui,sans-serif;color:#1E1B4B;margin:0;background:#f7f5ff}
                    .page{width:680px;min-height:940px;margin:20px auto;padding:38px 44px;background:#fff;page-break-after:always}
                    .header{text-align:center;margin-bottom:18px}.school{font-size:13px;color:#7C6D9B}
                    h1{font-size:20px;color:#6D28D9;margin:4px 0}.info,.item,.total{display:flex;justify-content:space-between;gap:18px;padding:8px 0;border-bottom:1px solid #F0EEFF}
                    .info span{color:#7C6D9B}.item small{color:#7C6D9B}.total{font-size:18px;color:#6D28D9;font-weight:900;border-bottom:none}
                    hr{border:none;border-top:1.5px dashed #DDD6FE;margin:14px 0}.footer{text-align:center;color:#9B93C9;font-size:12px;margin-top:28px}
                    @media print{body{background:#fff}.page{margin:0 auto;box-shadow:none}}
                </style></head><body>${html}<script>window.onload=function(){setTimeout(function(){window.print()},350)}</script></body></html>`)
            w.document.close()
            setActionMsg(`Đã mở file in ${rows.length} phiếu.`)
        } catch {
            setActionMsg('Không chuẩn bị được file in hàng loạt.')
        }
    }

    const studentMap = Object.fromEntries(students.map(s => [s.id, s]))
    const filtered = statusFilter ? notices.filter(n => n.status === statusFilter) : notices
    const selectedStudent = selectedNotice ? studentMap[selectedNotice.student_id] : null

    if (!supabaseMode) {
        return (
            <div style={{ padding: '36px', color: '#7C6D9B', textAlign: 'center', fontWeight: 600 }}>
                Phiếu báo thu chỉ khả dụng ở chế độ Supabase.
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', height: '100%', minHeight: 0, overflow: 'hidden' }}>
            {/* Danh sách phiếu */}
            <div
                style={{
                    flex: selectedNotice ? '0 0 55%' : '1 1 100%',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    transition: 'flex .2s',
                }}
            >
                {/* Toolbar */}
                <div
                    style={{
                        padding: '20px 24px 14px',
                        display: 'flex',
                        gap: 10,
                        flexWrap: 'wrap',
                        alignItems: 'flex-end',
                        borderBottom: '1px solid #EDE9FE',
                        background: '#fff',
                    }}
                >
                    <label style={{ display: 'grid', gap: 4, fontSize: 12, color: '#5B5490', fontWeight: 600 }}>
                        Tháng
                        <input
                            type="month"
                            value={yearMonth}
                            onChange={e => setYearMonth(e.target.value)}
                            style={{
                                padding: '8px 10px',
                                borderRadius: 9,
                                border: '1.5px solid #DDD6FE',
                                fontSize: 13,
                                fontWeight: 600,
                                color: '#1E1B4B',
                                width: 148,
                            }}
                        />
                    </label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {STATUS_FILTERS.map(([val, lbl]) => (
                            <button
                                key={val}
                                onClick={() => setStatusFilter(val)}
                                style={{
                                    padding: '8px 12px',
                                    borderRadius: 999,
                                    border: `1.5px solid ${statusFilter === val ? '#7C3AED' : '#DDD6FE'}`,
                                    background: statusFilter === val ? '#EDE9FE' : '#fff',
                                    color: statusFilter === val ? '#6D28D9' : '#6B6494',
                                    fontWeight: 700,
                                    fontSize: 12,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {lbl}
                            </button>
                        ))}
                    </div>
                    <div
                        style={{
                            marginLeft: 'auto',
                            fontSize: 12,
                            color: '#7C6D9B',
                            fontWeight: 600,
                            alignSelf: 'center',
                        }}
                    >
                        {filtered.length} phiếu
                    </div>
                    <button
                        onClick={printVisibleNotices}
                        disabled={!filtered.length}
                        style={{
                            padding: '8px 12px',
                            borderRadius: 9,
                            border: '1.5px solid #DDD6FE',
                            background: '#fff',
                            color: '#6D28D9',
                            fontWeight: 700,
                            fontSize: 12,
                            cursor: filtered.length ? 'pointer' : 'not-allowed',
                        }}
                    >
                        In tất cả
                    </button>
                </div>

                {actionMsg && (
                    <div
                        style={{
                            margin: '10px 24px 0',
                            padding: '8px 12px',
                            borderRadius: 8,
                            background: '#ECFDF5',
                            color: '#047857',
                            fontSize: 12,
                            fontWeight: 700,
                        }}
                    >
                        {actionMsg}
                    </div>
                )}

                {/* Bảng phiếu */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {loading ? (
                        <div style={{ padding: 36, color: '#7C6D9B', fontWeight: 700, textAlign: 'center' }}>
                            Đang tải...
                        </div>
                    ) : filtered.length === 0 ? (
                        <div style={{ padding: 36, color: '#7C6D9B', fontWeight: 600, textAlign: 'center' }}>
                            Không có phiếu nào trong tháng này.
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ background: '#F8F7FF' }}>
                                    {['Số phiếu', 'Học sinh', 'Lớp', 'Tổng thu', 'Trạng thái', ''].map(h => (
                                        <th
                                            key={h}
                                            style={{
                                                padding: '11px 14px',
                                                textAlign: 'left',
                                                color: '#7C6D9B',
                                                fontSize: 11,
                                                fontWeight: 700,
                                                borderBottom: '1.5px solid #DDD6FE',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(notice => {
                                    const student = studentMap[notice.student_id]
                                    const isSelected = selectedNotice?.id === notice.id
                                    return (
                                        <tr
                                            key={notice.id}
                                            onClick={() => selectNotice(notice)}
                                            style={{
                                                borderBottom: '1px solid #EDE9FE',
                                                background: isSelected ? '#F5F3FF' : 'transparent',
                                                cursor: 'pointer',
                                            }}
                                            onMouseEnter={e => {
                                                if (!isSelected) e.currentTarget.style.background = '#FAFAFF'
                                            }}
                                            onMouseLeave={e => {
                                                if (!isSelected) e.currentTarget.style.background = 'transparent'
                                            }}
                                        >
                                            <td style={{ padding: '11px 14px', color: '#7C3AED', fontWeight: 700 }}>
                                                {notice.notice_number || '—'}
                                            </td>
                                            <td style={{ padding: '11px 14px', color: '#1E1B4B', fontWeight: 600 }}>
                                                {student?.name || notice.student_id?.slice(0, 8)}
                                            </td>
                                            <td style={{ padding: '11px 14px', color: '#6B6494', fontWeight: 600 }}>
                                                {student?.className || '—'}
                                            </td>
                                            <td
                                                style={{
                                                    padding: '11px 14px',
                                                    fontWeight: 700,
                                                    color: '#059669',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {fmtMoney(notice.total_amount)}
                                            </td>
                                            <td style={{ padding: '11px 14px' }}>
                                                <StatusBadge status={notice.status} />
                                            </td>
                                            <td style={{ padding: '11px 14px' }}>
                                                <span style={{ color: '#7C3AED', fontSize: 16 }}>›</span>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Chi tiết phiếu */}
            {selectedNotice && (
                <div
                    style={{
                        flex: '0 0 45%',
                        borderLeft: '1.5px solid #EDE9FE',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        background: '#FAFAFF',
                    }}
                >
                    {/* Header chi tiết */}
                    <div
                        style={{
                            padding: '18px 20px',
                            background: '#fff',
                            borderBottom: '1px solid #EDE9FE',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            justifyContent: 'space-between',
                        }}
                    >
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#1E1B4B' }}>
                                {selectedStudent?.name || '—'}
                            </div>
                            <div style={{ fontSize: 11, color: '#7C6D9B', marginTop: 2 }}>
                                {selectedNotice.notice_number} · {selectedStudent?.className || '—'}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <StatusBadge status={selectedNotice.status} />
                            <button
                                onClick={() => {
                                    setSelectedNotice(null)
                                    setSelectedItems([])
                                }}
                                style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 8,
                                    border: '1.5px solid #DDD6FE',
                                    background: '#fff',
                                    color: '#6B6494',
                                    fontWeight: 700,
                                    fontSize: 14,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    lineHeight: 1,
                                }}
                                aria-label="Đóng"
                            >
                                ×
                            </button>
                        </div>
                    </div>

                    {/* Nội dung chi tiết */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                        {/* Tổng tiền */}
                        <div
                            style={{
                                background: '#fff',
                                borderRadius: 12,
                                padding: '14px 16px',
                                marginBottom: 14,
                                border: '1px solid #EDE9FE',
                            }}
                        >
                            <div style={{ fontSize: 12, color: '#7C6D9B', fontWeight: 600, marginBottom: 8 }}>
                                Tổng phải thu
                            </div>
                            <div style={{ fontSize: 22, fontWeight: 900, color: '#6D28D9' }}>
                                {fmtMoney(selectedNotice.total_amount)}
                            </div>
                            {selectedNotice.previous_credit > 0 && (
                                <div style={{ fontSize: 12, color: '#059669', marginTop: 4 }}>
                                    Đã cấn trừ: {fmtMoney(selectedNotice.previous_credit)}
                                </div>
                            )}
                        </div>

                        {/* Điểm danh tóm tắt */}
                        {selectedNotice.attendance_summary && (
                            <div
                                style={{
                                    background: '#fff',
                                    borderRadius: 12,
                                    padding: '12px 16px',
                                    marginBottom: 14,
                                    border: '1px solid #EDE9FE',
                                    display: 'flex',
                                    gap: 16,
                                    flexWrap: 'wrap',
                                }}
                            >
                                {[
                                    ['Ngày học', selectedNotice.attendance_summary.actualDays],
                                    ['Ngày ăn', selectedNotice.attendance_summary.mealDays],
                                    ['Vắng P', selectedNotice.attendance_summary.permittedAbsences],
                                    ['Vắng K', selectedNotice.attendance_summary.unpermittedAbsences],
                                ].map(([lbl, val]) => (
                                    <div key={lbl} style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 11, color: '#7C6D9B', fontWeight: 600 }}>{lbl}</div>
                                        <div style={{ fontSize: 15, fontWeight: 700, color: '#1E1B4B' }}>
                                            {val ?? '—'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Các khoản */}
                        <div
                            style={{
                                background: '#fff',
                                borderRadius: 12,
                                border: '1px solid #EDE9FE',
                                overflow: 'hidden',
                            }}
                        >
                            <div
                                style={{
                                    padding: '11px 16px',
                                    background: '#F8F7FF',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: '#7C6D9B',
                                    borderBottom: '1px solid #EDE9FE',
                                }}
                            >
                                CHI TIẾT CÁC KHOẢN
                            </div>
                            {itemsLoading ? (
                                <div style={{ padding: 20, color: '#7C6D9B', fontSize: 12, textAlign: 'center' }}>
                                    Đang tải...
                                </div>
                            ) : selectedItems.length === 0 ? (
                                <div style={{ padding: 20, color: '#9B93C9', fontSize: 12, textAlign: 'center' }}>
                                    Chưa có chi tiết khoản.
                                </div>
                            ) : (
                                selectedItems.map((item, i) => (
                                    <div
                                        key={item.id || i}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10,
                                            padding: '10px 16px',
                                            borderBottom: i < selectedItems.length - 1 ? '1px solid #F0EEFF' : 'none',
                                            fontSize: 13,
                                        }}
                                    >
                                        <ItemTypeBadge type={item.item_type} />
                                        <span style={{ flex: 1, color: '#1E1B4B', fontWeight: 600 }}>
                                            {item.name}
                                            {item.quantity !== 1 && (
                                                <span style={{ color: '#7C6D9B', fontWeight: 400, fontSize: 11 }}>
                                                    {' '}
                                                    × {item.quantity} {item.unit}
                                                </span>
                                            )}
                                        </span>
                                        <span
                                            style={{
                                                fontWeight: 700,
                                                color: item.amount < 0 ? '#059669' : '#1E1B4B',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {item.amount < 0 ? '-' : ''}
                                            {fmtMoney(Math.abs(item.amount))}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>

                        {selectedNotice.note && (
                            <div
                                style={{
                                    marginTop: 12,
                                    padding: '10px 14px',
                                    background: '#FFFBEB',
                                    borderRadius: 8,
                                    fontSize: 12,
                                    color: '#92400E',
                                }}
                            >
                                {selectedNotice.note}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div
                        style={{
                            padding: '14px 20px',
                            background: '#fff',
                            borderTop: '1px solid #EDE9FE',
                            display: 'flex',
                            gap: 8,
                            flexWrap: 'wrap',
                        }}
                    >
                        <FeeNoticePrint notice={selectedNotice} items={selectedItems} student={selectedStudent} />
                        {selectedNotice.status !== 'paid' && selectedNotice.status !== 'cancelled' && (
                            <button
                                onClick={() => markStatus(selectedNotice, 'paid')}
                                style={{
                                    padding: '5px 12px',
                                    borderRadius: 8,
                                    border: '1.5px solid #A7F3D0',
                                    background: '#ECFDF5',
                                    color: '#059669',
                                    fontWeight: 700,
                                    fontSize: 12,
                                    cursor: 'pointer',
                                }}
                            >
                                Đánh dấu đã thu
                            </button>
                        )}
                        {selectedNotice.status === 'draft' && (
                            <button
                                onClick={() => markStatus(selectedNotice, 'sent')}
                                style={{
                                    padding: '5px 12px',
                                    borderRadius: 8,
                                    border: '1.5px solid #BFDBFE',
                                    background: '#EFF6FF',
                                    color: '#2563EB',
                                    fontWeight: 700,
                                    fontSize: 12,
                                    cursor: 'pointer',
                                }}
                            >
                                Đánh dấu đã gửi PH
                            </button>
                        )}
                        {selectedStudent?.parentPhone &&
                            selectedNotice.status !== 'paid' &&
                            selectedNotice.status !== 'cancelled' && (
                                <button
                                    onClick={() => sendZaloNotice(selectedNotice)}
                                    style={{
                                        padding: '5px 12px',
                                        borderRadius: 8,
                                        border: '1.5px solid #BFDBFE',
                                        background: '#EFF6FF',
                                        color: '#2563EB',
                                        fontWeight: 700,
                                        fontSize: 12,
                                        cursor: 'pointer',
                                    }}
                                >
                                    Gửi Zalo
                                </button>
                            )}
                    </div>
                </div>
            )}
        </div>
    )
}
