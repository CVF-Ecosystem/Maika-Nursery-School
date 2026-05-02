import { useState } from 'react'
import { TYPE_MAP } from './invoiceTypes'
import ModalCloseButton from '../../../components/ModalCloseButton'

export default function InvoiceModal({ invoice, students, onClose, onSave }) {
    const isNew = !invoice?.id
    const [form, setForm] = useState(
        invoice
            ? {
                  studentId: invoice.student_id,
                  type: invoice.type,
                  description: invoice.description,
                  amount: String(invoice.amount),
                  dueDate: invoice.due_date,
                  status: invoice.status,
                  notes: invoice.notes || '',
                  paidDate: invoice.paid_date || '',
                  paymentMethod: invoice.payment_method || '',
              }
            : {
                  studentId: students[0]?.id || '',
                  type: 'tuition',
                  description: '',
                  amount: '',
                  dueDate: new Date().toISOString().slice(0, 10),
                  status: 'pending',
                  notes: '',
                  paidDate: '',
                  paymentMethod: '',
              },
    )

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
            role="dialog"
            aria-modal="true"
            aria-label={isNew ? 'Tạo hóa đơn mới' : 'Chỉnh sửa hóa đơn'}
        >
            <div
                style={{
                    position: 'relative',
                    background: '#fff',
                    borderRadius: 20,
                    width: 'min(520px, calc(100vw - 24px))',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    padding: 28,
                    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                }}
            >
                <ModalCloseButton onClick={onClose} />
                <div style={{ fontWeight: 800, fontSize: 17, color: '#1E1B4B', marginBottom: 20 }}>
                    {isNew ? 'Tạo hóa đơn mới' : 'Cập nhật hóa đơn'}
                </div>
                <div className="mobile-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div style={{ gridColumn: '1/-1' }}>
                        <label style={ls} htmlFor="inv-student">
                            Học sinh *
                        </label>
                        <select
                            id="inv-student"
                            style={is}
                            value={form.studentId}
                            onChange={e => setForm({ ...form, studentId: e.target.value })}
                        >
                            {students.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={ls}>Loại phí</label>
                        <select style={is} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                            {Object.entries(TYPE_MAP).map(([k, v]) => (
                                <option key={k} value={k}>
                                    {v}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={ls} htmlFor="inv-amount">
                            Số tiền (VND) *
                        </label>
                        <input
                            id="inv-amount"
                            type="number"
                            style={is}
                            value={form.amount}
                            onChange={e => setForm({ ...form, amount: e.target.value })}
                            placeholder="2500000"
                        />
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                        <label style={ls} htmlFor="inv-desc">
                            Nội dung *
                        </label>
                        <input
                            id="inv-desc"
                            style={is}
                            value={form.description}
                            onChange={e => setForm({ ...form, description: e.target.value })}
                        />
                    </div>
                    <div>
                        <label style={ls} htmlFor="inv-due">
                            Hạn nộp *
                        </label>
                        <input
                            id="inv-due"
                            type="date"
                            style={is}
                            value={form.dueDate}
                            onChange={e => setForm({ ...form, dueDate: e.target.value })}
                        />
                    </div>
                    <div>
                        <label style={ls}>Trạng thái</label>
                        <select
                            style={is}
                            value={form.status}
                            onChange={e => setForm({ ...form, status: e.target.value })}
                        >
                            <option value="pending">Chưa đóng</option>
                            <option value="paid">Đã đóng</option>
                            <option value="overdue">Quá hạn</option>
                            <option value="cancelled">Đã hủy</option>
                        </select>
                    </div>
                    {form.status === 'paid' && (
                        <>
                            <div>
                                <label style={ls} htmlFor="inv-pdate">
                                    Ngày nộp
                                </label>
                                <input
                                    id="inv-pdate"
                                    type="date"
                                    style={is}
                                    value={form.paidDate}
                                    onChange={e => setForm({ ...form, paidDate: e.target.value })}
                                />
                            </div>
                            <div>
                                <label style={ls}>Hình thức</label>
                                <select
                                    style={is}
                                    value={form.paymentMethod}
                                    onChange={e => setForm({ ...form, paymentMethod: e.target.value })}
                                >
                                    <option value="">— Chọn —</option>
                                    <option value="cash">Tiền mặt</option>
                                    <option value="transfer">Chuyển khoản</option>
                                    <option value="other">Khác</option>
                                </select>
                            </div>
                        </>
                    )}
                    <div style={{ gridColumn: '1/-1' }}>
                        <label style={ls} htmlFor="inv-notes">
                            Ghi chú
                        </label>
                        <input
                            id="inv-notes"
                            style={is}
                            value={form.notes}
                            onChange={e => setForm({ ...form, notes: e.target.value })}
                        />
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
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
                        onClick={() => onSave(form)}
                        disabled={!form.description || !form.amount || !form.dueDate || !form.studentId}
                        style={{
                            padding: '9px 24px',
                            borderRadius: 10,
                            border: 'none',
                            background: 'linear-gradient(90deg,#7C3AED,#A78BFA)',
                            color: '#fff',
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: 'pointer',
                        }}
                    >
                        Lưu
                    </button>
                </div>
            </div>
        </div>
    )
}
