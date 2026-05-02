import { buildPaymentQrUrl, getPaymentSettings } from '../../../features/payments/paymentSettings'
import { TYPE_MAP } from './invoiceTypes'

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

export default function ReceiptPrint({ invoice, student }) {
    function exportPdf() {
        const settings = getPaymentSettings()
        const qrUrl = buildPaymentQrUrl({
            amount: invoice.amount,
            invoiceNumber: invoice.invoice_number,
            studentName: student?.name || '',
            settings,
        })
        const w = window.open('', '_blank', 'width=700,height=900')
        if (!w) return
        const paymentMethod =
            invoice.payment_method === 'cash'
                ? 'Tiền mặt'
                : invoice.payment_method === 'transfer'
                  ? 'Chuyển khoản'
                  : invoice.payment_method || '—'
        w.document.write(`
          <html><head><title>Biên lai ${invoice.invoice_number}</title>
          <style>
            body { font-family: 'Nunito', sans-serif; padding: 40px; color: #1E1B4B; }
            h1 { font-size: 22px; color: #6D28D9; }
            .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #EDE9FE; }
            .label { font-weight: 700; color: #7C6D9B; font-size: 13px; }
            .value { font-weight: 800; font-size: 13px; }
            .total { font-size: 20px; color: #6D28D9; }
            .qrbox { margin-top: 22px; display: flex; gap: 18px; align-items: center; padding: 16px; border: 1px solid #EDE9FE; border-radius: 12px; background: #F8F7FF; }
            .qrbox img { width: 170px; height: 170px; object-fit: contain; background: #fff; border-radius: 8px; }
            .footer { margin-top: 40px; font-size: 12px; color: #9B93C9; text-align: center; }
            @media print { button { display: none; } }
          </style></head><body>
          <div style="text-align:center;margin-bottom:24px">
            <div style="font-size:28px">🌸</div>
            <h1>BIÊN LAI THU TIỀN</h1>
            <div style="color:#7C6D9B;font-size:13px">Nhà Trẻ Tư Thục Maika</div>
          </div>
          <div class="row"><span class="label">Số biên lai</span><span class="value">${escapeHtml(invoice.invoice_number)}</span></div>
          <div class="row"><span class="label">Học sinh</span><span class="value">${escapeHtml(student?.name || '—')}</span></div>
          <div class="row"><span class="label">Loại phí</span><span class="value">${escapeHtml(TYPE_MAP[invoice.type] || invoice.type)}</span></div>
          <div class="row"><span class="label">Nội dung</span><span class="value">${escapeHtml(invoice.description)}</span></div>
          <div class="row"><span class="label">Hạn nộp</span><span class="value">${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('vi-VN') : '—'}</span></div>
          <div class="row"><span class="label">Ngày nộp</span><span class="value">${invoice.paid_date ? new Date(invoice.paid_date).toLocaleDateString('vi-VN') : '—'}</span></div>
          <div class="row"><span class="label">Hình thức</span><span class="value">${escapeHtml(paymentMethod)}</span></div>
          <div class="row"><span class="label total">Số tiền</span><span class="value total">${Number(invoice.amount).toLocaleString('vi-VN')} ₫</span></div>
          ${invoice.notes ? `<div style="margin-top:16px;padding:12px;background:#F5F3FF;border-radius:8px;font-size:13px">Ghi chú: ${escapeHtml(invoice.notes)}</div>` : ''}
          ${
              qrUrl
                  ? `
            <div class="qrbox">
              <img src="${escapeHtml(qrUrl)}" alt="QR thanh toán" />
              <div>
                <div style="font-weight:900;color:#1E1B4B;margin-bottom:8px">QR chuyển khoản</div>
                <div style="font-size:13px;color:#6B6494;line-height:1.7">
                  Ngân hàng: <b>${escapeHtml(settings.bankId)}</b><br/>
                  Số TK: <b>${escapeHtml(settings.accountNo)}</b><br/>
                  Chủ TK: <b>${escapeHtml(settings.accountName)}</b><br/>
                  Số tiền: <b>${Number(invoice.amount).toLocaleString('vi-VN')} ₫</b>
                </div>
              </div>
            </div>
          `
                  : `<div style="margin-top:18px;padding:12px;background:#FFFBEB;border-radius:8px;font-size:13px;color:#92400E">Chưa cấu hình tài khoản nhận tiền trong Cấu hình → Tài khoản nhận tiền.</div>`
          }
          <div class="footer">In ngày ${new Date().toLocaleDateString('vi-VN')} · Nhà Trẻ Maika</div>
          <button onclick="window.print()" style="display:block;margin:24px auto;padding:10px 24px;background:#6D28D9;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer">Xuất PDF / In biên lai</button>
          <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 350); }</script>
          </body></html>
        `)
        w.document.close()
    }
    return (
        <button
            onClick={exportPdf}
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
            aria-label={`Xuất PDF biên lai ${invoice.invoice_number}`}
        >
            PDF/QR
        </button>
    )
}
