import { useEffect, useRef, useState } from 'react'
import { commit, getDB } from '../../data/store'
import { apiRequest, hasBackendAPI } from '../../data/api'
import { isSupabaseSession } from '../../data/backendMode'
import { listStudents, saveStudent as saveSupabaseStudent } from '../../features/students/studentService'
import { deleteInvoices as deleteSupabaseInvoices, listInvoices as listSupabaseInvoices, saveInvoice as saveSupabaseInvoice } from '../../features/sensitive/sensitiveService'
import { buildPaymentQrUrl, getPaymentSettings, hasPaymentQrSettings } from '../../features/payments/paymentSettings'
import { buildReceiptNumber, studentCodeFromReceiptNumber } from '../../features/payments/receiptNumbers'
import { fmtMoney, fmtDate } from '../../utils/format'
import { sanitizeText } from '../../utils/security'
import { normalizeImportDate, normalizeImportKey, pickImportValue, readObjectsFromTable, readWorkbookTables } from '../../utils/tabularImport'

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

function localFinanceToInvoice(row) {
    return {
        id: row.id,
        student_id: row.studentId,
        invoice_number: row.invoiceNumber || row.receiptNo || row.id.toUpperCase(),
        type: row.type || 'tuition',
        description: row.desc || row.description || '',
        amount: Number(row.amount || 0),
        due_date: row.date || row.dueDate || '',
        paid_date: row.paidDate || (row.status === 'paid' ? row.date : ''),
        payment_method: row.paymentMethod || row.method || '',
        status: row.status || 'pending',
        notes: row.notes || row.note || '',
    }
}

function normalizeInvoiceStatus(value = '') {
    const text = normalizeImportKey(value)
    if (['paid', 'dadong', 'dathu', 'danop', 'hoanthanh', 'complete', 'completed'].includes(text)) return 'paid'
    if (['overdue', 'quahan', 'trehan', 'noqua', 'congnoquahan'].includes(text)) return 'overdue'
    if (['cancelled', 'canceled', 'dahuy', 'huy'].includes(text)) return 'cancelled'
    return 'pending'
}

function normalizeInvoiceType(value = '') {
    const text = normalizeImportKey(value)
    if (['meal', 'tienan', 'an', 'phiantin'].includes(text)) return 'meal'
    if (['material', 'hoclieu', 'tailieu', 'sachvo'].includes(text)) return 'material'
    if (['activity', 'hoatdong', 'ngoaikhoa'].includes(text)) return 'activity'
    if (['other', 'khac'].includes(text)) return 'other'
    return 'tuition'
}

function normalizePaymentMethod(value = '') {
    const text = normalizeImportKey(value)
    if (['cash', 'tienmat', 'tm'].includes(text)) return 'cash'
    if (['transfer', 'chuyenkhoan', 'ck', 'bank', 'banking'].includes(text)) return 'transfer'
    if (['other', 'khac'].includes(text)) return 'other'
    return ''
}

function normalizeImportedStudentGender(value = '') {
    const text = normalizeImportKey(value)
    if (['nam', 'male', 'm'].includes(text)) return 'male'
    if (['nu', 'female', 'f'].includes(text)) return 'female'
    return 'unknown'
}

function normalizeImportedStudentStatus(value = '') {
    const text = normalizeImportKey(value)
    if (['nghihoc', 'nghi', 'off', 'inactive'].includes(text)) return 'inactive'
    return 'active'
}

function parseImportAmount(value) {
    if (typeof value === 'number') return Math.round(value)
    const digits = String(value || '').replace(/[^\d]/g, '')
    return Number(digits || 0)
}

function moneyNumber(value) {
    return Math.max(0, Math.round(Number(value || 0)))
}

function cellText(value) {
    return sanitizeText(String(value ?? ''))
}

function vnDate(value) {
    if (!value) return ''
    const normalized = normalizeImportDate(value)
    const match = String(normalized).match(/^(\d{4})-(\d{2})-(\d{2})$/)
    return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value)
}

function studentClassName(student, db) {
    if (student?.className) return student.className
    const cls = db?.classes?.find(item => item.id === student?.classId)
    return cls?.name || ''
}

function studentStatusLabel(student) {
    return student?.status === 'inactive' ? 'Nghỉ học' : 'Đang học'
}

function studentGenderLabel(student) {
    if (student?.gender === 'male') return 'Nam'
    if (student?.gender === 'female') return 'Nữ'
    return ''
}

function prefixForClass(className = '') {
    const key = normalizeImportKey(className)
    if (key.includes('nhatre')) return 'NT'
    if (key.includes('mam') || key.includes('choi')) return 'MC'
    return 'HS'
}

function studentCode(student, index, className, invoices = []) {
    if (student?.code) return student.code
    if (student?.studentCode) return student.studentCode
    if (/^[A-Z]{1,4}_?\d+$/i.test(String(student?.id || ''))) return student.id
    const matchedReceiptCode = invoices.map(inv => inv.student_id === student?.id ? studentCodeFromReceiptNumber(inv.invoice_number) : '').find(Boolean)
    if (matchedReceiptCode) return matchedReceiptCode
    const matchedInvoice = invoices.find(inv => inv.student_id === student?.id && /^[A-Z]{1,4}_?\d+-\d{4}-\d{2}$/i.test(String(inv.invoice_number || '')))
    if (matchedInvoice) return String(matchedInvoice.invoice_number).replace(/-\d{4}-\d{2}$/i, '')
    return `${prefixForClass(className)}_${String(index + 1).padStart(2, '0')}`
}

function receiptCodeForStudent(students, db, invoices, studentId, type, dueDate) {
    const index = students.findIndex(student => student.id === studentId)
    const student = index >= 0 ? students[index] : null
    const code = student ? studentCode(student, index, studentClassName(student, db), invoices) : ''
    return buildReceiptNumber({
        type,
        dueDate,
        studentCode: code,
        fallbackCode: `HS${String(Math.max(index, 0) + 1).padStart(3, '0')}`,
        existingNumbers: invoices.map(invoice => invoice.invoice_number),
    })
}

function isImportedReceipt(invoice) {
    const number = String(invoice?.invoice_number || '').trim()
    return /^[A-Z]{1,4}_?\d+-\d{4}-\d{2}$/i.test(number)
        || /^(?:HP|TA|HL|HD|KT)-\d{6}-[A-Z]{1,4}_?\d+(?:-\d{2})?$/i.test(number)
}

function exportFileName(month, year, className) {
    const suffix = normalizeImportKey(className || 'hoc phi') || 'hoc-phi'
    return `bang-thu-hoc-phi-${suffix}-${year}-${String(month).padStart(2, '0')}.xlsx`
}

async function exportMaikaTuitionWorkbook({ invoices, students, db }) {
    const XLSX = await import('@e965/xlsx')
    const firstInvoice = invoices.find(inv => inv.due_date) || {}
    const baseDate = firstInvoice.due_date || new Date().toISOString().slice(0, 10)
    const [year, month] = baseDate.split('-').map(Number)
    const invoiceStudentIds = new Set(invoices.map(inv => inv.student_id).filter(Boolean))
    const exportStudents = students
        .filter(student => invoiceStudentIds.size ? invoiceStudentIds.has(student.id) : student.status !== 'inactive')
        .sort((a, b) => String(studentClassName(a, db)).localeCompare(String(studentClassName(b, db)), 'vi') || String(a.name || '').localeCompare(String(b.name || ''), 'vi'))
    const className = exportStudents.length ? studentClassName(exportStudents[0], db) : ''
    const studentRows = exportStudents.map((student, index) => {
        const cls = studentClassName(student, db)
        return [
            index + 1,
            studentCode(student, index, cls, invoices),
            student.name || '',
            studentGenderLabel(student),
            vnDate(student.dob),
            vnDate(student.enrollDate),
            cls,
            studentStatusLabel(student),
            student.address || '',
            student.parentName || '',
            student.parentPhone || '',
            student.notes || '',
        ]
    })

    const invoiceByStudent = new Map()
    invoices.forEach(inv => {
        if (!inv.student_id || inv.status === 'cancelled') return
        const current = invoiceByStudent.get(inv.student_id)
        if (!current || moneyNumber(inv.amount) > moneyNumber(current.amount)) invoiceByStudent.set(inv.student_id, inv)
    })

    const tuitionRows = exportStudents.map((student, index) => {
        const cls = studentClassName(student, db)
        const inv = invoiceByStudent.get(student.id) || {}
        const amount = moneyNumber(inv.amount)
        const paid = inv.status === 'paid' ? amount : 0
        return [
            index + 1,
            studentCode(student, index, cls, invoices),
            student.name || '',
            cls,
            amount,
            '',
            '',
            '',
            '',
            0,
            amount,
            vnDate(inv.paid_date),
            student.parentName || '',
            paid || '',
            inv.notes || '',
        ]
    })

    const totals = tuitionRows.reduce((sum, row) => ({
        tuition: sum.tuition + moneyNumber(row[4]),
        due: sum.due + moneyNumber(row[10]),
        paid: sum.paid + moneyNumber(row[13]),
    }), { tuition: 0, due: 0, paid: 0 })

    const studentSheet = [
        [`THÔNG TIN HỌC SINH ${className ? className.toUpperCase() : ''}`],
        ['STT', 'MSHS', 'Họ và tên', 'Giới tính', 'Ngày sinh', 'Ngày nhập học', 'Lớp', 'Trạng thái', 'Địa chỉ', 'Họ tên Cha/Mẹ', 'Số điện thoại', 'Ghi chú'],
        ...studentRows,
    ]
    const tuitionSheet = [
        ['MẦM NON THIÊN THẦN MAIKA', '', '', '', 'BẢNG THEO DÕI HỌC PHÍ'],
        [],
        ['', 'Tháng', month],
        ['', 'Năm', year],
        ['', 'Ngày học chuẩn trong tháng', '', ''],
        ['STT', 'MSHS', 'Họ và tên', 'Lớp', 'Học phí', 'Số ngày đi học thực tế', '', 'Tiền thừa tháng trước', '', '', 'Tiền phải thu trong tháng', 'Ngày nộp tiền', 'Họ & Tên người nộp tiền', 'Số tiền nộp', 'Ghi chú'],
        ['', '', '', '', '', '', 'Số ngày vắng không phép', 'Số ngày vắng có phép', 'Tiền hoàn lại', 'Tổng cộng', '', '', '', '', ''],
        ['', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
        ['', '', '', '', totals.tuition, '', '', '', '', 0, totals.due, '', '', totals.paid, ''],
        ...tuitionRows,
    ]

    const workbook = XLSX.utils.book_new()
    const wsStudents = XLSX.utils.aoa_to_sheet(studentSheet)
    const wsTuition = XLSX.utils.aoa_to_sheet(tuitionSheet)
    wsStudents['!cols'] = [{ wch: 6 }, { wch: 12 }, { wch: 28 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 36 }, { wch: 24 }, { wch: 16 }, { wch: 28 }]
    wsTuition['!cols'] = [{ wch: 6 }, { wch: 12 }, { wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 24 }, { wch: 14 }, { wch: 28 }]
    XLSX.utils.book_append_sheet(workbook, wsStudents, 'Thông tin học sinh')
    XLSX.utils.book_append_sheet(workbook, wsTuition, 'Bảng học phí_nội  bộ')
    XLSX.writeFile(workbook, exportFileName(month, year, className))
}

function numberFromCell(value) {
    if (typeof value === 'number') return value
    const digits = String(value || '').replace(/[^\d.-]/g, '')
    return Number(digits || 0)
}

function findRightValue(rows, labels) {
    const wanted = labels.map(normalizeImportKey)
    for (const row of rows.slice(0, 12)) {
        for (let c = 0; c < row.length; c += 1) {
            if (!wanted.includes(normalizeImportKey(row[c]))) continue
            for (let next = c + 1; next < row.length; next += 1) {
                if (String(row[next] ?? '').trim()) return row[next]
            }
        }
    }
    return ''
}

function periodDueDate(rows) {
    const month = numberFromCell(findRightValue(rows, ['Tháng', 'Thang']))
    const year = numberFromCell(findRightValue(rows, ['Năm', 'Nam']))
    if (!month || !year) return new Date().toISOString().slice(0, 10)
    return `${Math.round(year)}-${String(Math.round(month)).padStart(2, '0')}-01`
}

function findMaikaTuitionSheet(sheets) {
    return sheets.find(sheet => normalizeImportKey(sheet.name).includes('hocphi'))
        || sheets.find(sheet => sheet.rows.some(row => row.some(cell => normalizeImportKey(cell).includes('bangtheodoihocphi'))))
}

function studentMatchesImport(student, row) {
    const id = sanitizeText(pickImportValue(row, ['mahocsinh', 'studentid', 'id']))
    const name = sanitizeText(pickImportValue(row, ['hocsinh', 'hoten', 'hotenhocsinh', 'tenhocsinh', 'tenbe', 'student', 'studentname', 'name']))
    const phone = sanitizeText(pickImportValue(row, ['sdt', 'sodienthoai', 'dienthoai', 'sdtphuhuynh', 'parentphone', 'phone']))
    if (id && normalizeImportKey(student.id) === normalizeImportKey(id)) return true
    if (phone && normalizeImportKey(student.parentPhone || '') === normalizeImportKey(phone)) return true
    return Boolean(name && normalizeImportKey(student.name || '') === normalizeImportKey(name))
}

function findStudentByCodeName(students, code, name) {
    const codeKey = normalizeImportKey(code)
    const nameKey = normalizeImportKey(name)
    return students.find(student => codeKey && normalizeImportKey(student.id) === codeKey)
        || students.find(student => codeKey && normalizeImportKey(student.code || student.studentCode || '') === codeKey)
        || students.find(student => nameKey && normalizeImportKey(student.name || '') === nameKey)
}

function findMaikaStudentSheet(sheets) {
    return sheets.find(sheet => normalizeImportKey(sheet.name).includes('thongtinhocsinh'))
        || sheets.find(sheet => sheet.rows.some(row => row.some(cell => normalizeImportKey(cell).includes('thongtinhocsinh'))))
}

function parseMaikaStudentSheet(sheet) {
    if (!sheet) return new Map()
    const headerIndex = sheet.rows.findIndex(row => {
        const keys = row.map(normalizeImportKey)
        return keys.includes('mshs') && keys.includes('hovaten')
    })
    if (headerIndex < 0) return new Map()
    const map = new Map()
    sheet.rows.slice(headerIndex + 1).forEach(row => {
        const code = cellText(row[1])
        const name = cellText(row[2])
        if (!code || !name) return
        map.set(normalizeImportKey(code), {
            code,
            name,
            gender: normalizeImportedStudentGender(row[3]),
            dob: normalizeImportDate(row[4]),
            enrollDate: normalizeImportDate(row[5]),
            className: cellText(row[6]),
            status: normalizeImportedStudentStatus(row[7]),
            address: cellText(row[8]),
            parentName: cellText(row[9]),
            parentPhone: cellText(row[10]),
            notes: cellText(row[11]),
        })
    })
    return map
}

function parseMaikaTuitionSheet(sheet, students, studentProfiles = new Map()) {
    const headerIndex = sheet.rows.findIndex(row => {
        const keys = row.map(normalizeImportKey)
        return keys.includes('mshs') && keys.includes('hovaten') && keys.includes('hocphi')
    })
    if (headerIndex < 0) return []
    const dueDate = periodDueDate(sheet.rows)
    const period = dueDate.slice(0, 7)
    return sheet.rows.slice(headerIndex + 1).map(row => {
        const code = cellText(row[1])
        const name = cellText(row[2])
        const klass = cellText(row[3])
        const amountDue = parseImportAmount(row[10])
        const paidDate = normalizeImportDate(row[11])
        const paidAmount = parseImportAmount(row[13])
        const note = cellText(row[14])
        const student = findStudentByCodeName(students, code, name)
        const studentProfile = studentProfiles.get(normalizeImportKey(code)) || null
        const status = paidAmount > 0 || paidDate ? 'paid' : 'pending'
        return {
            invoiceNumber: buildReceiptNumber({ type: 'tuition', dueDate, studentCode: code }),
            studentId: student?.id || '',
            studentProfile,
            type: 'tuition',
            description: `Học phí tháng ${Number(period.slice(5, 7))}/${period.slice(0, 4)}${klass ? ` - ${klass}` : ''}`,
            amount: amountDue,
            dueDate,
            status,
            notes: note,
            paidDate: paidDate || (status === 'paid' ? dueDate : ''),
            paymentMethod: status === 'paid' ? 'cash' : '',
        }
    }).filter(row => row.invoiceNumber && row.amount > 0)
}

async function readInvoiceImportFile(file, students) {
    const sheets = await readWorkbookTables(file)
    const maikaSheet = findMaikaTuitionSheet(sheets)
    if (maikaSheet) return parseMaikaTuitionSheet(maikaSheet, students, parseMaikaStudentSheet(findMaikaStudentSheet(sheets)))

    const rows = await readObjectsFromTable(file, {
        preferredSheetNames: ['hoc phi', 'khoan thu', 'hoa don', 'bien lai'],
        headerKeywords: ['mabienlai', 'mahoadon', 'mshs', 'hocsinh', 'sotien', 'hannop'],
    })
    return rows.map(row => {
        const student = students.find(item => studentMatchesImport(item, row))
        const type = normalizeInvoiceType(pickImportValue(row, ['loaiphi', 'loai', 'type', 'khoanthu']))
        const description = sanitizeText(pickImportValue(row, ['noidung', 'mota', 'diengiai', 'description', 'desc'])) || TYPE_MAP[type] || 'Khoản thu'
        const status = normalizeInvoiceStatus(pickImportValue(row, ['trangthai', 'status']))
        const paidDate = normalizeImportDate(pickImportValue(row, ['ngaynop', 'ngaythu', 'paiddate', 'paidat']))
        const dueDate = normalizeImportDate(pickImportValue(row, ['hannop', 'ngaydenhan', 'ngay', 'duedate', 'date']))
        const studentImportCode = sanitizeText(pickImportValue(row, ['mshs', 'mahocsinh', 'studentcode', 'studentid']))
        const explicitInvoiceNumber = sanitizeText(pickImportValue(row, ['mabienlai', 'mahoadon', 'invoice', 'invoicenumber', 'sobienlai']))
        return {
            invoiceNumber: explicitInvoiceNumber || buildReceiptNumber({
                type,
                dueDate,
                studentCode: studentImportCode || student?.code || student?.studentCode || '',
            }),
            studentId: student?.id || '',
            studentProfile: null,
            type,
            description,
            amount: parseImportAmount(pickImportValue(row, ['sotien', 'amount', 'hocphi', 'thanhtien', 'tongtien'])),
            dueDate,
            status,
            notes: sanitizeText(pickImportValue(row, ['ghichu', 'note', 'notes'])),
            paidDate: paidDate || (status === 'paid' ? new Date().toISOString().slice(0, 10) : ''),
            paymentMethod: normalizePaymentMethod(pickImportValue(row, ['hinhthuc', 'phuongthuc', 'paymentmethod', 'method'])),
        }
    })
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

function ReceiptPrint({ invoice, student }) {
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
        const paymentMethod = invoice.payment_method === 'cash' ? 'Tiền mặt' : invoice.payment_method === 'transfer' ? 'Chuyển khoản' : (invoice.payment_method || '—')
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
          ${qrUrl ? `
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
          ` : `<div style="margin-top:18px;padding:12px;background:#FFFBEB;border-radius:8px;font-size:13px;color:#92400E">Chưa cấu hình tài khoản nhận tiền trong Cấu hình → Tài khoản nhận tiền.</div>`}
          <div class="footer">In ngày ${new Date().toLocaleDateString('vi-VN')} · Nhà Trẻ Maika</div>
          <button onclick="window.print()" style="display:block;margin:24px auto;padding:10px 24px;background:#6D28D9;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer">Xuất PDF / In biên lai</button>
          <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 350); }</script>
          </body></html>
        `)
        w.document.close()
    }
    return (
        <button onClick={exportPdf} style={{ padding: '5px 12px', borderRadius: 8, border: '1.5px solid #7C3AED', background: '#fff', color: '#7C3AED', fontWeight: 700, fontSize: 12, cursor: 'pointer' }} aria-label={`Xuất PDF biên lai ${invoice.invoice_number}`}>
            PDF/QR
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

export default function Invoices({ readOnly = false, filterStudentId = null, selectedFacilityId = '' }) {
    const supabaseMode = isSupabaseSession()
    const db = getDB()
    const localMode = !hasBackendAPI() && !supabaseMode
    const [supabaseStudents, setSupabaseStudents] = useState([])
    const students = supabaseMode ? supabaseStudents : db.students.filter(s => s.status === 'active')
    const [invoices, setInvoices] = useState([])
    const [loading, setLoading] = useState(false)
    const [modal, setModal] = useState(null)
    const [selected, setSelected] = useState(null)
    const [filterStatus, setFilterStatus] = useState('all')
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const fileRef = useRef(null)

    useEffect(() => {
        if (!supabaseMode) return
        listStudents({ facilityId: selectedFacilityId || undefined, status: 'active' })
            .then(items => setSupabaseStudents(filterStudentId ? items.filter(s => s.id === filterStudentId) : items))
            .catch(err => setError(err.message))
    }, [supabaseMode, filterStudentId, selectedFacilityId])

    async function load() {
        if (localMode) {
            const localRows = (getDB().finance || [])
                .filter(row => !filterStudentId || row.studentId === filterStudentId)
                .map(localFinanceToInvoice)
                .sort((a, b) => String(b.due_date || '').localeCompare(String(a.due_date || '')))
            setInvoices(localRows)
            return
        }
        setLoading(true)
        setError('')
        try {
            if (supabaseMode) {
                setInvoices(await listSupabaseInvoices({ studentId: filterStudentId, facilityId: filterStudentId ? undefined : selectedFacilityId || undefined }))
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

    useEffect(() => { load() }, [filterStudentId, selectedFacilityId])

    async function handleSave(form) {
        setError('')
        const editingInvoice = selected
        const prevInvoices = invoices

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
        const invoiceNumber = editingInvoice?.invoice_number || receiptCodeForStudent(students, db, invoices, payload.studentId, payload.type, payload.dueDate)

        const optimistic = {
            id: editingInvoice?.id || `temp_${Date.now()}`,
            invoice_number: invoiceNumber,
            student_id: payload.studentId,
            type: payload.type,
            description: payload.description,
            amount: Number(payload.amount || 0),
            due_date: payload.dueDate,
            status: payload.status,
            notes: payload.notes,
            paid_date: payload.paidDate || null,
            payment_method: payload.paymentMethod || null,
        }
        if (editingInvoice) {
            setInvoices(prev => prev.map(inv => inv.id === editingInvoice.id ? { ...inv, ...optimistic } : inv))
        } else {
            setInvoices(prev => [optimistic, ...prev])
        }
        setModal(null)
        setSelected(null)

        try {
            if (supabaseMode) {
                await saveSupabaseInvoice({ ...payload, id: editingInvoice?.id, invoiceNumber })
                setMessage(editingInvoice ? 'Đã cập nhật hóa đơn.' : 'Đã tạo hóa đơn mới.')
            } else if (localMode) {
                const ndb = getDB()
                if (!Array.isArray(ndb.finance)) ndb.finance = []
                const localPayload = {
                    id: editingInvoice?.id || `f${Date.now()}`,
                    studentId: payload.studentId,
                    invoiceNumber,
                    type: payload.type,
                    desc: payload.description,
                    amount: Number(payload.amount || 0),
                    date: payload.dueDate,
                    status: payload.status,
                    method: payload.paymentMethod || '',
                    paidDate: payload.paidDate || '',
                    notes: payload.notes || '',
                }
                const idx = ndb.finance.findIndex(row => row.id === localPayload.id)
                if (idx >= 0) ndb.finance[idx] = { ...ndb.finance[idx], ...localPayload }
                else ndb.finance.unshift(localPayload)
                commit()
                setMessage(editingInvoice ? 'Đã cập nhật hóa đơn.' : 'Đã tạo hóa đơn mới.')
            } else if (editingInvoice) {
                await apiRequest(`/api/invoices/${editingInvoice.id}`, { method: 'PUT', body: JSON.stringify(payload) })
                setMessage('Đã cập nhật hóa đơn.')
            } else {
                await apiRequest('/api/invoices', { method: 'POST', body: JSON.stringify({ ...payload, invoiceNumber }) })
                setMessage('Đã tạo hóa đơn mới.')
            }
            if (!editingInvoice) await load()
            setTimeout(() => setMessage(''), 3000)
        } catch (err) {
            setInvoices(prevInvoices)
            setError(err.message)
        }
    }

    async function saveImportedInvoice(row) {
        const existing = row.invoiceNumber ? invoices.find(item => normalizeImportKey(item.invoice_number) === normalizeImportKey(row.invoiceNumber)) : null
        const payload = {
            studentId: row.studentId,
            type: row.type,
            description: row.description,
            amount: row.amount,
            dueDate: row.dueDate,
            status: row.status,
            notes: row.notes,
            paidDate: row.paidDate || null,
            paymentMethod: row.paymentMethod || null,
        }

        if (supabaseMode) {
            await saveSupabaseInvoice({ ...payload, id: existing?.id, invoiceNumber: row.invoiceNumber || existing?.invoice_number })
            return
        }

        if (localMode) {
            const ndb = getDB()
            if (!Array.isArray(ndb.finance)) ndb.finance = []
            const id = existing?.id || `f${Date.now()}${Math.random().toString(36).slice(2, 6)}`
            const invoiceNumber = row.invoiceNumber || existing?.invoice_number || receiptCodeForStudent(students, db, invoices, payload.studentId, payload.type, payload.dueDate)
            const localPayload = {
                id,
                studentId: payload.studentId,
                invoiceNumber,
                type: payload.type,
                desc: payload.description,
                amount: Number(payload.amount || 0),
                date: payload.dueDate,
                status: payload.status,
                method: payload.paymentMethod || '',
                paidDate: payload.paidDate || '',
                notes: payload.notes || '',
            }
            const idx = ndb.finance.findIndex(item => item.id === id || (localPayload.invoiceNumber && normalizeImportKey(item.invoiceNumber || item.receiptNo || '') === normalizeImportKey(localPayload.invoiceNumber)))
            if (idx >= 0) ndb.finance[idx] = { ...ndb.finance[idx], ...localPayload }
            else ndb.finance.unshift(localPayload)
            commit()
            return
        }

        if (existing?.id) {
            await apiRequest(`/api/invoices/${existing.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        } else {
            await apiRequest('/api/invoices', { method: 'POST', body: JSON.stringify({ ...payload, invoiceNumber: row.invoiceNumber || undefined }) })
        }
    }

    async function ensureStudentForImport(row) {
        if (row.studentId || !row.studentProfile) return row.studentId
        const profile = row.studentProfile
        const matched = students.find(student => findStudentByCodeName([student], profile.code, profile.name))
        if (matched) return matched.id

        if (supabaseMode) {
            if (!selectedFacilityId) return ''
            const created = await saveSupabaseStudent({
                facilityId: selectedFacilityId,
                name: profile.name,
                dob: profile.dob,
                gender: profile.gender,
                className: profile.className,
                parentName: profile.parentName,
                parentPhone: profile.parentPhone,
                status: profile.status,
                notes: [profile.notes, profile.address].filter(Boolean).join(' · '),
            })
            setSupabaseStudents(current => current.some(student => student.id === created.id) ? current : [...current, created])
            return created.id
        }

        if (localMode) {
            const ndb = getDB()
            const existing = ndb.students.find(student => findStudentByCodeName([student], profile.code, profile.name))
            if (existing) return existing.id
            const id = profile.code || `s${Date.now()}${Math.random().toString(36).slice(2, 6)}`
            const record = {
                id,
                code: profile.code,
                name: profile.name,
                dob: profile.dob,
                classId: ndb.classes.find(c => normalizeImportKey(c.name) === normalizeImportKey(profile.className))?.id || 'c1',
                className: profile.className,
                parentName: profile.parentName,
                parentPhone: profile.parentPhone,
                parentEmail: '',
                enrollDate: profile.enrollDate || new Date().toISOString().slice(0, 10),
                status: profile.status,
                initials: profile.name.split(' ').filter(Boolean).slice(-2).map(word => word[0]?.toUpperCase()).join('') || '?',
                gender: profile.gender,
                notes: [profile.notes, profile.address].filter(Boolean).join(' · '),
            }
            ndb.students.push(record)
            commit()
            return id
        }

        return ''
    }

    async function handleImport(file) {
        if (!file) return
        setError('')
        setMessage('Đang import khoản thu...')
        try {
            const rows = await readInvoiceImportFile(file, students)
            for (const row of rows) {
                if (!row.studentId) row.studentId = await ensureStudentForImport(row)
            }
            const validRows = rows.filter(row => row.studentId && row.amount > 0 && row.dueDate)
            for (const row of validRows) await saveImportedInvoice(row)
            await load()
            const skipped = rows.length - validRows.length
            setMessage(`Đã import ${validRows.length} khoản thu${skipped ? `, bỏ qua ${skipped} dòng thiếu thông tin.` : '.'}`)
            setTimeout(() => setMessage(''), 4000)
        } catch (err) {
            setMessage('')
            setError(err.message || 'Không import được file học phí.')
        }
    }

    async function handleExport() {
        setError('')
        setMessage('Đang tạo file Excel...')
        try {
            await exportMaikaTuitionWorkbook({ invoices, students, db })
            setMessage('Đã xuất file Excel học phí theo mẫu Maika.')
            setTimeout(() => setMessage(''), 3500)
        } catch (err) {
            setMessage('')
            setError(err.message || 'Không xuất được file Excel học phí.')
        }
    }

    async function markPaid(invoice) {
        const prevInvoices = invoices
        const today = new Date().toISOString().slice(0, 10)
        setInvoices(prev => prev.map(inv => inv.id === invoice.id
            ? { ...inv, status: 'paid', paid_date: today }
            : inv))
        try {
            if (supabaseMode) {
                await saveSupabaseInvoice({
                    ...invoice,
                    studentId: invoice.student_id,
                    invoiceNumber: invoice.invoice_number,
                    dueDate: invoice.due_date,
                    paidDate: today,
                    paymentMethod: invoice.payment_method,
                    notes: invoice.notes,
                    status: 'paid',
                })
            } else if (localMode) {
                const ndb = getDB()
                const idx = ndb.finance.findIndex(row => row.id === invoice.id)
                if (idx >= 0) {
                    ndb.finance[idx] = {
                        ...ndb.finance[idx],
                        status: 'paid',
                        paidDate: today,
                        method: ndb.finance[idx].method || 'Chuyển khoản',
                    }
                    commit()
                }
            } else {
                await apiRequest(`/api/invoices/${invoice.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ status: 'paid', paidDate: today }),
                })
            }
        } catch (err) {
            setInvoices(prevInvoices)
            setError(err.message)
        }
    }

    const filtered = filterStatus === 'all' ? invoices : invoices.filter(i => i.status === filterStatus)
    const importedVisible = filtered.filter(isImportedReceipt)

    async function clearImportedInvoices() {
        if (!importedVisible.length) {
            setMessage('Không có dữ liệu import trong danh sách hiện tại.')
            setTimeout(() => setMessage(''), 3000)
            return
        }
        const ok = window.confirm(`Xóa ${importedVisible.length} khoản thu import trong danh sách hiện tại? Thao tác này không hoàn tác.`)
        if (!ok) return
        setError('')
        setMessage('Đang xóa dữ liệu import...')
        try {
            const ids = importedVisible.map(invoice => invoice.id)
            if (supabaseMode) {
                await deleteSupabaseInvoices(ids)
            } else if (localMode) {
                const ndb = getDB()
                const idSet = new Set(ids)
                ndb.finance = (ndb.finance || []).filter(row => !idSet.has(row.id))
                commit()
            } else {
                for (const id of ids) await apiRequest(`/api/invoices/${id}`, { method: 'DELETE' })
            }
            await load()
            setMessage(`Đã xóa ${ids.length} khoản thu import.`)
            setTimeout(() => setMessage(''), 3500)
        } catch (err) {
            setMessage('')
            setError(err.message || 'Không xóa được dữ liệu import.')
        }
    }

    const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0)
    const totalPending = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + i.amount, 0)
    const totalOverdue = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.amount, 0)

    const sel = { padding: '9px 14px', borderRadius: 10, border: '1.5px solid #DDD6FE', fontSize: 13, color: '#1E1B4B', background: '#fff' }
    const paymentReady = hasPaymentQrSettings()

    return (
        <div className={readOnly ? '' : 'admin-page-pad'} style={{ padding: readOnly ? 0 : '28px 36px' }}>
            {!readOnly && (
                <input ref={fileRef} type="file" accept=".xls,.xlsx,.csv" style={{ display: 'none' }} onChange={e => { handleImport(e.target.files?.[0]); e.target.value = '' }} />
            )}
            {modal === 'form' && (
                <InvoiceModal
                    invoice={selected}
                    students={students}
                    onClose={() => { setModal(null); setSelected(null) }}
                    onSave={handleSave}
                />
            )}

            {!readOnly && (
                <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 20, gap: 12 }}>
                    <div style={{ flex: 1, color: '#6B6494', fontSize: 13, lineHeight: 1.5 }}>
                        {!paymentReady && <div style={{ color: '#B45309', fontWeight: 700 }}>QR chuyển khoản chưa sẵn sàng. Vui lòng cập nhật thông tin nhận tiền trong Cấu hình.</div>}
                    </div>
                    <button
                        onClick={() => fileRef.current?.click()}
                        style={{ padding: '10px 18px', borderRadius: 12, border: '1.5px solid #DDD6FE', background: '#fff', color: '#7C3AED', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
                    >
                        📥 Import Excel/CSV
                    </button>
                    <button
                        onClick={handleExport}
                        style={{ padding: '10px 18px', borderRadius: 12, border: '1.5px solid #DDD6FE', background: '#fff', color: '#7C3AED', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
                    >
                        📤 Export Excel
                    </button>
                    <button
                        onClick={clearImportedInvoices}
                        disabled={!importedVisible.length}
                        style={{ padding: '10px 18px', borderRadius: 12, border: '1.5px solid #FCA5A5', background: importedVisible.length ? '#fff' : '#F8F7FF', color: importedVisible.length ? '#DC2626' : '#A8A0C8', fontWeight: 800, fontSize: 13, cursor: importedVisible.length ? 'pointer' : 'not-allowed' }}
                    >
                        Xóa import
                    </button>
                    <button
                        onClick={() => { setSelected(null); setModal('form') }}
                        style={{ padding: '10px 22px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
                        aria-label="Tạo hóa đơn mới"
                    >
                        + Tạo khoản thu
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
