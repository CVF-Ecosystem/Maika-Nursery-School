import { useEffect, useRef, useState } from 'react'
import { getDB } from '../../data/store'
import { apiRequest, hasBackendAPI } from '../../data/api'
import { isSupabaseSession } from '../../data/backendMode'
import { listStudents } from '../../features/students/studentService'
import { listInvoices as listSupabaseInvoices, saveInvoice as saveSupabaseInvoice } from '../../features/sensitive/sensitiveService'
import { fmtMoney, fmtDate } from '../../utils/format'

const STATUS_MAP = {
    pending: ['#D97706', '#FFFBEB', 'Chưa đóng'],
    paid: ['#16A34A', '#F0FDF4', 'Đã đóng'],
    overdue: ['#DC2626', '#FEF2F2', 'Quá hạn'],
    cancelled: ['#6B6494', '#F5F5F4', 'Đã hủy'],
}

const TYPE_MAP = {
    tuition: 'Học phí',
    meal: 'Tiền ăn',
    material: 'Học liệu',
    activity: 'Hoạt động',
    other: 'Khác',
}

function ReceiptPrint({ invoice, student }) {
    const ref = useRef()
    function print() {
        const w = window.open('', '_blank', 'width=700,height=900')
        w.document.write(`
          <html><head><title>Biên lai ${invoice.invoice_number}</title>
          <style>
            body { font-family: 'Nunito', sans-serif; padding: 40px; color: #1E1B4B; }
            h1 { font-size: 22px; color: #6D28D9; }
            .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #EDE9FE; }
            .label { font-weight: 700; color: #7C6D9B; font-size: 13px; }
            .value { font-weight: 800; font-size: 13px; }
            .total { font-size: 20px; color: #6D28D9; }
            .footer { margin-top: 40px; font-size: 12px; color: #9B93C9; text-align: center; }
            @media print { button { display: none; } }
          </style></head><body>
          <div style="text-align:center;margin-bottom:24px">
            <div style="font-size:28px">🌸</div>
            <h1>BIÊN LAI THU TIỀN</h1>
            <div style="color:#7C6D9B;font-size:13px">Nhà Trẻ Tư Thục Maika</div>
          </div>
          <div class="row"><span class="label">Số biên lai</span><span class="value">${invoice.invoice_number}</span></div>
          <div class="row"><span class="label">Học sinh</span><span class="value">${student?.name || '—'}</span></div>
          <div class="row"><span class="label">Loại phí</span><span class="value">${TYPE_MAP[invoice.type] || invoice.type}</span></div>
          <div class="row"><span class="label">Nội dung</span><span class="value">${invoice.description}</span></div>
          <div class="row"><span class="label">Hạn nộp</span><span class="value">${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('vi-VN') : '—'}</span></div>
          <div class="row"><span class="label">Ngày nộp</span><span class="value">${invoice.paid_date ? new Date(invoice.paid_date).toLocaleDateString('vi-VN') : '—'}</span></div>
          <div class="row"><span class="label">Hình thức</span><span class="value">${invoice.payment_method === 'cash' ? 'Tiền mặt' : invoice.payment_method === 'transfer' ? 'Chuyển khoản' : (invoice.payment_method || '—')}</span></div>
          <div class="row"><span class="label total">Số tiền</span><span class="value total">${Number(invoice.amount).toLocaleString('vi-VN')} ₫</span></div>
          ${invoice.notes ? `<div style="margin-top:16px;padding:12px;background:#F5F3FF;border-radius:8px;font-size:13px">Ghi chú: ${invoice.notes}</div>` : ''}
          <div class="footer">In ngày ${new Date().toLocaleDateString('vi-VN')} · Nhà Trẻ Maika</div>
          <button onclick="window.print()" style="display:block;margin:24px auto;padding:10px 24px;background:#6D28D9;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer">🖨️ In biên lai</button>
          </body></html>
        `)
        w.document.close()
    }
    return (
        <button ref={ref} onClick={print} style={{ padding: '5px 12px', borderRadius: 8, border: '1.5px solid #7C3AED', background: '#fff', color: '#7C3AED', fontWeight: 700, fontSize: 12, cursor: 'pointer' }} aria-label={`In biên lai ${invoice.invoice_number}`}>
            🖨️ In
        </button>
    )
}

function InvoiceModal({ invoice, students, onClose, onSave }) {
    const isNew = !invoice?.id
    const [form, setForm] = useState(invoice ? {
        studentId: invoice.student_id,
        type: invoice.type,
        description: invoice.description,
        amount: String(invoice.amount),
        dueDate: invoice.due_date,
        status: invoice.status,
        notes: invoice.notes || '',
        paidDate: invoice.paid_date || '',
        paymentMethod: invoice.payment_method || '',
    } : {
        studentId: students[0]?.id || '',
        type: 'tuition',
        description: '',
        amount: '',
        dueDate: new Date().toISOString().slice(0, 10),
        status: 'pending',
        notes: '',
        paidDate: '',
        paymentMethod: '',
    })

    const is = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #DDD6FE', fontSize: 13, color: '#1E1B4B', boxSizing: 'border-box' }
    const ls = { fontSize: 12, fontWeight: 700, color: '#6B6494', display: 'block', marginBottom: 4 }

    return (
        <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={e => e.target === e.currentTarget && onClose()}
            role="dialog"
            aria-modal="true"
            aria-label={isNew ? 'Tạo hóa đơn mới' : 'Chỉnh sửa hóa đơn'}
        >
            <div style={{ background: '#fff', borderRadius: 20, width: 'min(520px, calc(100vw - 24px))', maxHeight: '90vh', overflowY: 'auto', padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                <div style={{ fontWeight: 800, fontSize: 17, color: '#1E1B4B', marginBottom: 20 }}>
                    {isNew ? 'Tạo hóa đơn mới' : `Cập nhật hóa đơn`}
                </div>
                <div className="mobile-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div style={{ gridColumn: '1/-1' }}>
                        <label style={ls} htmlFor="inv-student">Học sinh *</label>
                        <select id="inv-student" style={is} value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })}>
                            {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={ls}>Loại phí</label>
                        <select style={is} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                            {Object.entries(TYPE_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={ls} htmlFor="inv-amount">Số tiền (VND) *</label>
                        <input id="inv-amount" type="number" style={is} value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="2500000" />
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                        <label style={ls} htmlFor="inv-desc">Nội dung *</label>
                        <input id="inv-desc" style={is} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                    </div>
                    <div>
                        <label style={ls} htmlFor="inv-due">Hạn nộp *</label>
                        <input id="inv-due" type="date" style={is} value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
                    </div>
                    <div>
                        <label style={ls}>Trạng thái</label>
                        <select style={is} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                            <option value="pending">Chưa đóng</option>
                            <option value="paid">Đã đóng</option>
                            <option value="overdue">Quá hạn</option>
                            <option value="cancelled">Đã hủy</option>
                        </select>
                    </div>
                    {form.status === 'paid' && (
                        <>
                            <div>
                                <label style={ls} htmlFor="inv-pdate">Ngày nộp</label>
                                <input id="inv-pdate" type="date" style={is} value={form.paidDate} onChange={e => setForm({ ...form, paidDate: e.target.value })} />
                            </div>
                            <div>
                                <label style={ls}>Hình thức</label>
                                <select style={is} value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })}>
                                    <option value="">— Chọn —</option>
                                    <option value="cash">Tiền mặt</option>
                                    <option value="transfer">Chuyển khoản</option>
                                    <option value="other">Khác</option>
                                </select>
                            </div>
                        </>
                    )}
                    <div style={{ gridColumn: '1/-1' }}>
                        <label style={ls} htmlFor="inv-notes">Ghi chú</label>
                        <input id="inv-notes" style={is} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 10, border: '1.5px solid #DDD6FE', background: '#fff', fontSize: 13, fontWeight: 700, color: '#6B6494', cursor: 'pointer' }}>Hủy</button>
                    <button
                        onClick={() => onSave(form)}
                        disabled={!form.description || !form.amount || !form.dueDate || !form.studentId}
                        style={{ padding: '9px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(90deg,#7C3AED,#A78BFA)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                    >
                        Lưu
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function Invoices({ readOnly = false, filterStudentId = null }) {
    const supabaseMode = isSupabaseSession()
    const db = getDB()
    const [supabaseStudents, setSupabaseStudents] = useState([])
    const students = supabaseMode ? supabaseStudents : db.students.filter(s => s.status === 'active')
    const [invoices, setInvoices] = useState([])
    const [loading, setLoading] = useState(false)
    const [modal, setModal] = useState(null)
    const [selected, setSelected] = useState(null)
    const [filterStatus, setFilterStatus] = useState('all')
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')

    useEffect(() => {
        if (!supabaseMode) return
        listStudents({ status: 'active' })
            .then(items => setSupabaseStudents(filterStudentId ? items.filter(s => s.id === filterStudentId) : items))
            .catch(err => setError(err.message))
    }, [supabaseMode, filterStudentId])

    async function load() {
        if (!hasBackendAPI() && !supabaseMode) return
        setLoading(true)
        setError('')
        try {
            if (supabaseMode) {
                setInvoices(await listSupabaseInvoices({ studentId: filterStudentId }))
            } else {
                const params = new URLSearchParams()
                if (filterStudentId) params.set('studentId', filterStudentId)
                const body = await apiRequest(`/api/invoices?${params}`)
                setInvoices(body.data || [])
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [filterStudentId])

    async function handleSave(form) {
        setError('')
        try {
            const payload = {
                studentId: form.studentId,
                type: form.type,
                description: form.description,
                amount: form.amount,
                dueDate: form.dueDate,
                status: form.status,
                notes: form.notes,
                paidDate: form.paidDate || null,
                paymentMethod: form.paymentMethod || null,
            }
            if (supabaseMode) {
                await saveSupabaseInvoice({ ...payload, id: selected?.id, invoiceNumber: selected?.invoice_number })
                setMessage(selected ? 'Đã cập nhật hóa đơn.' : 'Đã tạo hóa đơn mới.')
            } else if (selected) {
                await apiRequest(`/api/invoices/${selected.id}`, { method: 'PUT', body: JSON.stringify(payload) })
                setMessage('Đã cập nhật hóa đơn.')
            } else {
                await apiRequest('/api/invoices', { method: 'POST', body: JSON.stringify(payload) })
                setMessage('Đã tạo hóa đơn mới.')
            }
            setModal(null); setSelected(null)
            await load()
            setTimeout(() => setMessage(''), 3000)
        } catch (err) {
            setError(err.message)
        }
    }

    async function markPaid(invoice) {
        try {
            if (supabaseMode) {
                await saveSupabaseInvoice({
                    ...invoice,
                    studentId: invoice.student_id,
                    invoiceNumber: invoice.invoice_number,
                    dueDate: invoice.due_date,
                    paidDate: new Date().toISOString().slice(0, 10),
                    paymentMethod: invoice.payment_method,
                    notes: invoice.notes,
                    status: 'paid',
                })
            } else {
                await apiRequest(`/api/invoices/${invoice.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ status: 'paid', paidDate: new Date().toISOString().slice(0, 10) }),
                })
            }
            await load()
        } catch (err) {
            setError(err.message)
        }
    }

    const filtered = filterStatus === 'all' ? invoices : invoices.filter(i => i.status === filterStatus)
    const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0)
    const totalPending = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + i.amount, 0)
    const totalOverdue = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.amount, 0)

    if (!hasBackendAPI() && !supabaseMode) {
        return (
            <div className={readOnly ? '' : 'admin-page-pad'} style={{ padding: readOnly ? 0 : '28px 36px' }}>
                <div style={{ background: '#fff', borderRadius: 16, padding: 28, boxShadow: '0 2px 16px rgba(109,40,217,0.08)' }}>
                    <div style={{ fontWeight: 800, fontSize: 18, color: '#1E1B4B', marginBottom: 8 }}>Hóa đơn & Biên lai</div>
                    <div style={{ color: '#7C6D9B', fontSize: 14 }}>Quản lý hóa đơn đang được chuẩn bị để lưu trữ và tra cứu trực tuyến.</div>
                </div>
            </div>
        )
    }

    const sel = { padding: '9px 14px', borderRadius: 10, border: '1.5px solid #DDD6FE', fontSize: 13, color: '#1E1B4B', background: '#fff' }

    return (
        <div className={readOnly ? '' : 'admin-page-pad'} style={{ padding: readOnly ? 0 : '28px 36px' }}>
            {modal === 'form' && (
                <InvoiceModal
                    invoice={selected}
                    students={students}
                    onClose={() => { setModal(null); setSelected(null) }}
                    onSave={handleSave}
                />
            )}

            {!readOnly && (
                <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12 }}>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: 18, color: '#1E1B4B' }}>Hóa đơn & Biên lai</div>
                        <div style={{ fontSize: 13, color: '#7C6D9B', marginTop: 2 }}>{invoices.length} hóa đơn · Quản lý nâng cao</div>
                    </div>
                    <button
                        onClick={() => { setSelected(null); setModal('form') }}
                        style={{ padding: '10px 22px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
                        aria-label="Tạo hóa đơn mới"
                    >
                        + Tạo hóa đơn
                    </button>
                </div>
            )}

            {readOnly && (
                <div style={{ fontWeight: 800, fontSize: 16, color: '#1E1B4B', marginBottom: 16 }}>Công nợ & Biên lai</div>
            )}

            {message && <div style={{ color: '#059669', background: '#ECFDF5', borderRadius: 10, padding: '10px 14px', fontSize: 12, fontWeight: 700, marginBottom: 16 }}>{message}</div>}
            {error && <div style={{ color: '#DC2626', background: '#FEF2F2', borderRadius: 10, padding: '10px 14px', fontSize: 12, fontWeight: 700, marginBottom: 16 }}>{error}</div>}

            {!readOnly && (
                <div className="landing-section-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 20 }}>
                    {[['💚', 'Đã thu', totalPaid, '#16A34A', '#F0FDF4'], ['🟡', 'Chưa đóng', totalPending, '#D97706', '#FFFBEB'], ['🔴', 'Quá hạn', totalOverdue, '#DC2626', '#FEF2F2']].map(([icon, lbl, amt, col, bg]) => (
                        <div key={lbl} style={{ background: bg, borderRadius: 14, padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'center' }}>
                            <span style={{ fontSize: 28 }}>{icon}</span>
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 800, color: col, textTransform: 'uppercase' }}>{lbl}</div>
                                <div style={{ fontWeight: 900, fontSize: 18, color: col }}>{fmtMoney(amt)}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                {['all', 'pending', 'paid', 'overdue', 'cancelled'].map(s => (
                    <button key={s} onClick={() => setFilterStatus(s)} style={{ ...sel, fontWeight: filterStatus === s ? 800 : 600, borderColor: filterStatus === s ? '#7C3AED' : '#DDD6FE', color: filterStatus === s ? '#7C3AED' : '#6B6494', background: filterStatus === s ? '#F5F3FF' : '#fff' }}>
                        {s === 'all' ? 'Tất cả' : (STATUS_MAP[s]?.[2] || s)}
                    </button>
                ))}
            </div>

            <div className="mobile-scroll-table" style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(109,40,217,0.08)', overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#7C6D9B' }}>Đang tải...</div>
                ) : filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#7C6D9B' }}>
                        <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
                        <div style={{ fontWeight: 700 }}>Không có hóa đơn nào</div>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }} role="table" aria-label="Danh sách hóa đơn">
                        <thead>
                            <tr style={{ background: '#F8F7FF' }}>
                                {['Mã biên lai', !filterStudentId && 'Học sinh', 'Nội dung', 'Số tiền', 'Hạn nộp', 'Trạng thái', ''].filter(Boolean).map(h => (
                                    <th key={h} scope="col" style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#7C6D9B', borderBottom: '1.5px solid #DDD6FE' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(inv => {
                                const st = students.find(s => s.id === inv.student_id)
                                const [col, bg, lbl] = STATUS_MAP[inv.status] || ['#6B6494', '#F5F5F4', '—']
                                return (
                                    <tr key={inv.id} style={{ borderBottom: '1px solid #EDE9FE' }}>
                                        <td style={{ padding: '12px 16px' }}>
                                            <div style={{ fontWeight: 800, fontSize: 12, color: '#7C3AED' }}>{inv.invoice_number}</div>
                                            <div style={{ fontSize: 11, color: '#9B93C9' }}>{TYPE_MAP[inv.type] || inv.type}</div>
                                        </td>
                                        {!filterStudentId && <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: 13 }}>{st?.name || '—'}</td>}
                                        <td style={{ padding: '12px 16px', fontSize: 13, color: '#4B4899' }}>
                                            {inv.description}
                                            {inv.notes && <div style={{ fontSize: 11, color: '#9B93C9' }}>{inv.notes}</div>}
                                        </td>
                                        <td style={{ padding: '12px 16px', fontWeight: 900, fontSize: 14, color: '#1E1B4B' }}>{fmtMoney(inv.amount)}</td>
                                        <td style={{ padding: '12px 16px', fontSize: 12, color: inv.status === 'overdue' ? '#DC2626' : '#6B6494', fontWeight: inv.status === 'overdue' ? 700 : 400 }}>
                                            {fmtDate(inv.due_date)}
                                            {inv.paid_date && <div style={{ fontSize: 11, color: '#16A34A', fontWeight: 700 }}>Nộp: {fmtDate(inv.paid_date)}</div>}
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <span style={{ background: bg, color: col, borderRadius: 6, fontSize: 11, fontWeight: 800, padding: '2px 8px' }}>{lbl}</span>
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                {inv.status === 'paid' && <ReceiptPrint invoice={inv} student={st} />}
                                                {!readOnly && inv.status !== 'paid' && inv.status !== 'cancelled' && (
                                                    <button onClick={() => markPaid(inv)} style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid #16A34A', background: '#fff', color: '#16A34A', fontWeight: 700, fontSize: 11, cursor: 'pointer' }} aria-label="Đánh dấu đã đóng">✓ Đã đóng</button>
                                                )}
                                                {!readOnly && (
                                                    <button onClick={() => { setSelected({ ...inv, studentId: inv.student_id, dueDate: inv.due_date, paidDate: inv.paid_date, paymentMethod: inv.payment_method, notes: inv.notes }); setModal('form') }} style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid #7C3AED', background: '#fff', color: '#7C3AED', fontWeight: 700, fontSize: 11, cursor: 'pointer' }} aria-label={`Sửa hóa đơn ${inv.invoice_number}`}>Sửa</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
