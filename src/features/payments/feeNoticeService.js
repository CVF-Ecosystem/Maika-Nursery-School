import { getCurrentProfile } from '../auth/authService'
import { requireSupabase } from '../../lib/supabaseClient'
import { listInvoices, saveInvoice } from '../sensitive/sensitiveService'
import { buildReceiptNumber } from './receiptNumbers'
import { tuitionInvoiceNumber } from './tuitionFromAttendance'

const NOTICE_COLUMNS =
    'id, student_id, facility_id, year_month, notice_number, status, total_amount, previous_credit, attendance_summary, linked_invoice_id, note, created_by, created_at, updated_at'
const NOTICE_ITEM_COLUMNS =
    'id, notice_id, fee_item_id, name, quantity, unit, unit_price, amount, item_type, display_order, created_at'
const CREDIT_COLUMNS = 'id, student_id, facility_id, year_month, amount, note, updated_by, created_at, updated_at'

function nextMonth(yearMonth) {
    const [year, month] = String(yearMonth).split('-').map(Number)
    const date = new Date(year || new Date().getFullYear(), month || 1, 1)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function noticeNumber(row, existingNumbers = []) {
    return buildReceiptNumber({
        type: 'fee_notice',
        dueDate: row.dueDate,
        studentCode: row.studentCode,
        fallbackCode: row.studentId,
        existingNumbers,
    })
}

function adjustmentInvoiceNumber(row, existingNumbers = []) {
    return buildReceiptNumber({
        type: 'tuition_adjustment',
        dueDate: row.dueDate,
        studentCode: row.studentCode,
        fallbackCode: row.studentId,
        existingNumbers,
    })
}

export async function listFeeNotices({ facilityId, yearMonth } = {}) {
    const client = requireSupabase()
    let query = client.from('fee_notices').select(NOTICE_COLUMNS).order('created_at', { ascending: false })
    if (facilityId) query = query.eq('facility_id', facilityId)
    if (yearMonth) query = query.eq('year_month', yearMonth)
    const { data, error } = await query
    if (error) throw error
    return data || []
}

export async function listStudentTuitionCredits({ facilityId, yearMonth } = {}) {
    const client = requireSupabase()
    let query = client.from('student_tuition_credits').select(CREDIT_COLUMNS).order('updated_at', { ascending: false })
    if (facilityId) query = query.eq('facility_id', facilityId)
    if (yearMonth) query = query.eq('year_month', yearMonth)
    const { data, error } = await query
    if (error) throw error
    return data || []
}

export async function upsertStudentTuitionCredit({ studentId, facilityId, yearMonth, amount, note }) {
    const client = requireSupabase()
    const profile = await getCurrentProfile().catch(() => null)
    const payload = {
        student_id: studentId,
        facility_id: facilityId,
        year_month: yearMonth,
        amount: Number(amount || 0),
        note: note || null,
        updated_by: profile?.id || null,
        updated_at: new Date().toISOString(),
    }
    const { data, error } = await client
        .from('student_tuition_credits')
        .upsert(payload, { onConflict: 'student_id,year_month' })
        .select(CREDIT_COLUMNS)
        .single()
    if (error) throw error
    return data
}

function feeNoticeItems(row) {
    const items = [
        {
            name: row.tuitionRuleName || 'Học phí cơ bản',
            quantity: 1,
            unit: 'tháng',
            unit_price: row.monthlyTuition,
            amount: row.monthlyTuition,
            item_type: 'charge',
            display_order: 10,
        },
    ]
    if (row.refundAmount > 0) {
        items.push({
            name: 'Hoàn tiền ăn vắng có phép',
            quantity: row.permittedAbsences,
            unit: 'ngày',
            unit_price: row.refundPerPermittedAbsence,
            amount: -row.refundAmount,
            item_type: 'discount',
            display_order: 80,
        })
    }
    if (row.previousCredit > 0) {
        items.push({
            name: 'Cấn trừ tháng trước',
            quantity: 1,
            unit: 'lần',
            unit_price: row.previousCredit,
            amount: -row.previousCredit,
            item_type: 'credit',
            display_order: 90,
        })
    }
    return items
}

function attendanceSummary(row) {
    return {
        schoolDayCount: row.schoolDayCount,
        actualDays: row.actualDays,
        mealDays: row.mealDays,
        permittedAbsences: row.permittedAbsences,
        unpermittedAbsences: row.unpermittedAbsences,
        holidayAbsences: row.holidayAbsences,
        missingSchoolDays: row.missingSchoolDays,
        monthlyTuition: row.monthlyTuition,
        refundPerPermittedAbsence: row.refundPerPermittedAbsence,
        refundAmount: row.refundAmount,
        previousCredit: row.previousCredit,
    }
}

export async function listFeeNoticeItems({ noticeId } = {}) {
    const client = requireSupabase()
    const { data, error } = await client
        .from('fee_notice_items')
        .select(NOTICE_ITEM_COLUMNS)
        .eq('notice_id', noticeId)
        .order('display_order', { ascending: true })
    if (error) throw error
    return data || []
}

export async function updateFeeNoticeStatus({ noticeId, status }) {
    const client = requireSupabase()
    const { error } = await client
        .from('fee_notices')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', noticeId)
    if (error) throw error
}

export async function saveMonthlyFeeNotices({ rows = [], yearMonth, facilityId } = {}) {
    const client = requireSupabase()
    const profile = await getCurrentProfile().catch(() => null)
    const payableRows = rows.filter(row => row.studentId && row.amountDue > 0)
    if (!payableRows.length) return { created: 0, updated: 0, adjusted: 0, credited: 0, skipped: 0 }

    const [existingNotices, existingInvoices] = await Promise.all([
        listFeeNotices({ facilityId, yearMonth }),
        listInvoices({ facilityId }),
    ])
    const noticeByStudent = new Map(existingNotices.map(item => [item.student_id, item]))
    const invoiceById = new Map(existingInvoices.map(item => [item.id, item]))
    const invoiceByStudentMonth = new Map(
        existingInvoices
            .filter(item => item.type === 'tuition' && item.student_id && item.due_date?.slice(0, 7) === yearMonth)
            .map(item => [item.student_id, item]),
    )
    const existingNoticeNumbers = new Set(existingNotices.map(item => item.notice_number).filter(Boolean))
    const existingInvoiceNumbers = new Set(existingInvoices.map(item => item.invoice_number).filter(Boolean))
    const result = { created: 0, updated: 0, adjusted: 0, credited: 0, skipped: 0 }

    for (const row of payableRows) {
        const existingNotice = noticeByStudent.get(row.studentId)
        const linkedInvoice =
            (existingNotice?.linked_invoice_id ? invoiceById.get(existingNotice.linked_invoice_id) : null) ||
            invoiceByStudentMonth.get(row.studentId)
        const existingAmount = Number(existingNotice?.total_amount || linkedInvoice?.amount || 0)
        const isPaid = existingNotice?.status === 'paid' || linkedInvoice?.status === 'paid'

        if (isPaid) {
            let baseNotice = existingNotice
            if (!baseNotice) {
                const { data: createdBaseNotice, error: baseNoticeError } = await client
                    .from('fee_notices')
                    .insert({
                        student_id: row.studentId,
                        facility_id: row.student?.facilityId || row.facilityId || facilityId,
                        year_month: yearMonth,
                        notice_number: noticeNumber(row, [...existingNoticeNumbers]),
                        status: 'paid',
                        total_amount: existingAmount,
                        previous_credit: 0,
                        attendance_summary: {},
                        linked_invoice_id: linkedInvoice?.id || null,
                        note: `Tạo lại phiếu nền từ khoản thu đã thanh toán tháng ${yearMonth}.`,
                        created_by: profile?.id || null,
                    })
                    .select(NOTICE_COLUMNS)
                    .single()
                if (baseNoticeError) throw baseNoticeError
                existingNoticeNumbers.add(createdBaseNotice.notice_number)
                baseNotice = createdBaseNotice
            }

            const delta = Math.round(row.amountDue - existingAmount)
            if (delta === 0) {
                result.skipped += 1
                continue
            }

            const { error: adjustmentError } = await client.from('fee_notice_adjustments').insert({
                original_notice_id: baseNotice.id,
                student_id: row.studentId,
                facility_id: row.student?.facilityId || row.facilityId || facilityId,
                year_month: yearMonth,
                amount_delta: delta,
                reason: `Điều chỉnh bảng thu tháng ${yearMonth}`,
                created_by: profile?.id || null,
            })
            if (adjustmentError) throw adjustmentError

            if (delta > 0) {
                const invoiceNumber = adjustmentInvoiceNumber(row, [...existingInvoiceNumbers])
                await saveInvoice({
                    studentId: row.studentId,
                    invoiceNumber,
                    type: 'tuition_adjustment',
                    description: `Điều chỉnh học phí tháng ${yearMonth} - ${row.studentName}`,
                    amount: delta,
                    dueDate: row.dueDate,
                    status: 'pending',
                    notes: `Điều chỉnh tăng từ bảng điểm danh tháng ${yearMonth}.`,
                })
                existingInvoiceNumbers.add(invoiceNumber)
            } else {
                await upsertStudentTuitionCredit({
                    studentId: row.studentId,
                    facilityId: row.student?.facilityId || row.facilityId || facilityId,
                    yearMonth: nextMonth(yearMonth),
                    amount: Math.abs(delta),
                    note: `Cấn trừ điều chỉnh giảm học phí tháng ${yearMonth}.`,
                })
                result.credited += 1
            }

            result.adjusted += 1
            continue
        }

        const payload = {
            ...(existingNotice ? { id: existingNotice.id } : {}),
            student_id: row.studentId,
            facility_id: row.student?.facilityId || row.facilityId || facilityId,
            year_month: yearMonth,
            notice_number: existingNotice?.notice_number || noticeNumber(row, [...existingNoticeNumbers]),
            status: existingNotice?.status === 'sent' ? 'sent' : 'draft',
            total_amount: row.amountDue,
            previous_credit: row.previousCredit,
            attendance_summary: attendanceSummary(row),
            linked_invoice_id: linkedInvoice?.id || null,
            note: row.missingSchoolDays
                ? `Còn ${row.missingSchoolDays} ngày chưa điểm danh, đã xác nhận tạo phiếu.`
                : null,
            created_by: existingNotice?.created_by || profile?.id || null,
            updated_at: new Date().toISOString(),
        }

        const { data: notice, error: noticeError } = await client
            .from('fee_notices')
            .upsert(payload, { onConflict: 'student_id,year_month' })
            .select(NOTICE_COLUMNS)
            .single()
        if (noticeError) throw noticeError
        existingNoticeNumbers.add(notice.notice_number)

        const { error: deleteItemsError } = await client.from('fee_notice_items').delete().eq('notice_id', notice.id)
        if (deleteItemsError) throw deleteItemsError

        const items = feeNoticeItems(row).map(item => ({ ...item, notice_id: notice.id }))
        const { error: itemsError } = await client.from('fee_notice_items').insert(items).select(NOTICE_ITEM_COLUMNS)
        if (itemsError) throw itemsError

        const invoiceNumber = linkedInvoice?.invoice_number || tuitionInvoiceNumber(row, [...existingInvoiceNumbers])
        const invoice = await saveInvoice({
            id: linkedInvoice?.id,
            studentId: row.studentId,
            invoiceNumber,
            type: 'tuition',
            description: row.description,
            amount: row.amountDue,
            dueDate: row.dueDate,
            status: linkedInvoice?.status || 'pending',
            notes: `Liên kết phiếu thông báo ${notice.notice_number}. Đi học ${row.actualDays}/${row.schoolDayCount} ngày, vắng P ${row.permittedAbsences}, vắng K ${row.unpermittedAbsences}.`,
        })
        existingInvoiceNumbers.add(invoice.invoice_number)

        if (!notice.linked_invoice_id || notice.linked_invoice_id !== invoice.id) {
            const { error: linkError } = await client
                .from('fee_notices')
                .update({ linked_invoice_id: invoice.id, updated_at: new Date().toISOString() })
                .eq('id', notice.id)
            if (linkError) throw linkError
        }

        if (existingNotice) result.updated += 1
        else result.created += 1
    }

    return result
}
