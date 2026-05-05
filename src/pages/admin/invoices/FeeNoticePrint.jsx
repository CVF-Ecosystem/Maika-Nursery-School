import { buildPaymentQrUrl, getPaymentSettings } from '../../../features/payments/paymentSettings'

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

function fmtVnd(value) {
    return Number(value || 0).toLocaleString('vi-VN') + ' ₫'
}

function yearMonthLabel(yearMonth) {
    if (!yearMonth) return ''
    const [year, month] = yearMonth.split('-')
    return `Tháng ${month}/${year}`
}

function dueDateLabel(yearMonth) {
    if (!yearMonth) return '—'
    const [year, month] = yearMonth.split('-')
    return `10/${month}/${year}`
}

export default function FeeNoticePrint({ notice, items = [], student, label = 'In phiếu' }) {
    function exportPdf() {
        const settings = getPaymentSettings()
        const isPaid = notice.status === 'paid'
        const totalAmount = Number(notice.total_amount || 0)
        const qrUrl = !isPaid
            ? buildPaymentQrUrl({
                  amount: totalAmount,
                  invoiceNumber: notice.notice_number,
                  studentName: student?.name || '',
                  settings,
              })
            : null

        const chargeItems = items.filter(item => item.item_type === 'charge')
        const deductItems = items.filter(item => ['discount', 'credit'].includes(item.item_type))
        const paidAmount = isPaid ? totalAmount : 0
        const dueAmount = isPaid ? 0 : totalAmount

        const itemsHtml = chargeItems
            .map(
                (item, i) => `
            <div class="item-row">
                <span class="${isPaid ? 'check-paid' : 'check-box'}">${isPaid ? '✓' : ''}</span>
                <span class="item-num">${i + 1}.</span>
                <span class="item-name">${escapeHtml(item.name)}
                    <span class="item-unit">(${item.quantity > 1 ? `${item.quantity} ` : '1 '}${escapeHtml(item.unit || 'tháng')})</span>
                </span>
                <span class="item-amount">${fmtVnd(Math.abs(item.amount))}</span>
            </div>`,
            )
            .join('')

        const deductHtml = deductItems.length
            ? `<div class="section-label">Khấu trừ</div>
               ${deductItems
                   .map(
                       item => `
               <div class="item-row deduct-row">
                   <span class="deduct-dash">—</span>
                   <span class="item-name">${escapeHtml(item.name)}</span>
                   <span class="item-amount credit-amount">${fmtVnd(Math.abs(item.amount))}</span>
               </div>`,
                   )
                   .join('')}`
            : ''

        const qrSection =
            !isPaid && qrUrl
                ? `<div class="qrbox">
                    <img src="${escapeHtml(qrUrl)}" alt="QR thanh toán"/>
                    <div>
                        <div style="font-weight:900;color:#1E1B4B;margin-bottom:8px">QR chuyển khoản</div>
                        <div style="font-size:13px;color:#6B6494;line-height:1.8">
                            Ngân hàng: <b>${escapeHtml(settings.bankId || '—')}</b><br/>
                            Số TK: <b>${escapeHtml(settings.accountNo || '—')}</b><br/>
                            Chủ TK: <b>${escapeHtml(settings.accountName || '—')}</b><br/>
                            Số tiền: <b>${fmtVnd(totalAmount)}</b>
                        </div>
                    </div>
                </div>`
                : !isPaid
                  ? `<div class="warn-box">Chưa cấu hình tài khoản nhận tiền trong Cấu hình → Tài khoản nhận tiền.</div>`
                  : ''

        const w = window.open('', '_blank', 'width=700,height=1050')
        if (!w) return
        w.document.write(`
<!DOCTYPE html><html><head>
<meta charset="utf-8">
<title>Phiếu báo thu ${escapeHtml(notice.notice_number || '')}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Nunito',system-ui,sans-serif;padding:36px 40px;color:#1E1B4B;font-size:14px;max-width:640px;margin:auto}
.header{text-align:center;margin-bottom:22px}
.school-name{font-size:13px;color:#7C6D9B;margin-bottom:2px}
h1{font-size:20px;color:#6D28D9;font-weight:900;letter-spacing:.5px}
.month{font-size:14px;color:#1E1B4B;font-weight:700;margin-top:4px}
.divider{border:none;border-top:1.5px dashed #DDD6FE;margin:14px 0}
.info-row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #F0EEFF;font-size:13px}
.info-label{color:#7C6D9B;font-weight:600}
.info-value{font-weight:700;color:#1E1B4B;text-align:right}
.section-label{font-size:11px;font-weight:700;color:#7C6D9B;text-transform:uppercase;letter-spacing:.5px;margin:14px 0 6px}
.item-row{display:flex;align-items:flex-start;gap:8px;padding:9px 0;border-bottom:1px solid #F5F3FF;font-size:13px}
.check-box{width:20px;height:20px;border:2px solid #DDD6FE;border-radius:4px;flex-shrink:0;display:inline-block;margin-top:1px}
.check-paid{width:20px;height:20px;background:#059669;border-radius:4px;color:#fff;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;margin-top:1px}
.item-num{color:#9B93C9;font-weight:600;min-width:18px;flex-shrink:0}
.item-name{flex:1;color:#1E1B4B;font-weight:600}
.item-unit{font-weight:400;color:#7C6D9B;font-size:12px}
.item-amount{font-weight:700;white-space:nowrap;min-width:110px;text-align:right}
.deduct-row{padding:7px 0}
.deduct-dash{min-width:28px;color:#9B93C9;padding-left:8px;flex-shrink:0}
.credit-amount{color:#059669}
.total-box{margin-top:14px}
.total-row{display:flex;justify-content:space-between;padding:7px 0;font-size:14px}
.total-main{font-size:18px;font-weight:900;color:#6D28D9;border-bottom:1.5px solid #EDE9FE;padding-bottom:12px;margin-bottom:4px}
.total-paid-v{color:#059669;font-weight:700}
.total-due-v{color:#DC2626;font-weight:900;font-size:16px}
.due-note{font-size:12px;color:#DC2626;font-weight:600;margin-top:6px;text-align:right}
.paid-badge{margin:14px 0;text-align:center;background:#ECFDF5;color:#059669;border-radius:8px;font-size:14px;font-weight:900;letter-spacing:1px;padding:10px;border:1.5px solid #A7F3D0}
.qrbox{margin-top:18px;display:flex;gap:16px;align-items:center;padding:14px;border:1px solid #EDE9FE;border-radius:12px;background:#F8F7FF}
.qrbox img{width:140px;height:140px;object-fit:contain;background:#fff;border-radius:8px}
.warn-box{margin-top:14px;padding:12px;background:#FFFBEB;border-radius:8px;font-size:13px;color:#92400E}
.note-box{margin-top:10px;padding:10px 12px;background:#F5F3FF;border-radius:8px;font-size:12px;color:#5B5490}
.footer{margin-top:28px;font-size:12px;color:#9B93C9;text-align:center}
@media print{button{display:none}}
</style></head><body>
<div class="header">
    <div style="font-size:26px">🌸</div>
    <div class="school-name">Nhà Trẻ Tư Thục Maika</div>
    <h1>PHIẾU THÔNG BÁO THU</h1>
    <div class="month">${escapeHtml(yearMonthLabel(notice.year_month))}</div>
</div>
<hr class="divider"/>
<div class="info-row"><span class="info-label">Số phiếu</span><span class="info-value">${escapeHtml(notice.notice_number || '—')}</span></div>
<div class="info-row"><span class="info-label">Học sinh</span><span class="info-value">${escapeHtml(student?.name || '—')}</span></div>
<div class="info-row"><span class="info-label">Lớp</span><span class="info-value">${escapeHtml(student?.className || student?.class_name || '—')}</span></div>
<div class="info-row"><span class="info-label">Mã học sinh</span><span class="info-value">${escapeHtml(student?.studentCode || student?.code || '—')}</span></div>
<hr class="divider"/>
<div class="section-label">Các khoản thu</div>
${itemsHtml}
${deductHtml}
<hr class="divider"/>
<div class="total-box">
    <div class="total-row total-main"><span>Tổng số tiền</span><span>${fmtVnd(totalAmount)}</span></div>
    <div class="total-row"><span style="color:#7C6D9B;font-weight:600">Đã thanh toán</span><span class="total-paid-v">${fmtVnd(paidAmount)}</span></div>
    <div class="total-row"><span style="color:#DC2626;font-weight:700">Chưa thanh toán</span><span class="total-due-v">${fmtVnd(dueAmount)}</span></div>
    ${!isPaid ? `<div class="due-note">Hạn nộp: ${escapeHtml(dueDateLabel(notice.year_month))}</div>` : ''}
</div>
${isPaid ? '<div class="paid-badge">✓ ĐÃ THANH TOÁN</div>' : ''}
${qrSection}
${notice.note ? `<div class="note-box">${escapeHtml(notice.note)}</div>` : ''}
<div class="footer">In ngày ${new Date().toLocaleDateString('vi-VN')} · Nhà Trẻ Maika</div>
<button onclick="window.print()" style="display:block;margin:24px auto;padding:10px 24px;background:#6D28D9;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">Xuất PDF / In phiếu</button>
<script>window.onload=function(){setTimeout(function(){window.print()},350)}</script>
</body></html>`)
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
                whiteSpace: 'nowrap',
            }}
            aria-label={`In phiếu báo thu ${notice.notice_number}`}
        >
            {label}
        </button>
    )
}
