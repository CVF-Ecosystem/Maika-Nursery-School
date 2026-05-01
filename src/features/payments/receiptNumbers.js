const TYPE_PREFIX = {
    tuition: 'HP',
    meal: 'TA',
    material: 'HL',
    activity: 'HD',
    other: 'KT',
}

export function receiptPeriod(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return `${value.getFullYear()}${String(value.getMonth() + 1).padStart(2, '0')}`
    }
    const text = String(value || '').trim()
    const match = text.match(/^(\d{4})[-/](\d{1,2})/)
    if (match) return `${match[1]}${match[2].padStart(2, '0')}`
    const now = new Date()
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function cleanReceiptStudentCode(value = '') {
    return String(value || '')
        .trim()
        .toUpperCase()
        .replace(/\s*[-_]\s*/g, '_')
        .replace(/\s+/g, '_')
        .replace(/[^A-Z0-9_]/g, '')
}

export function receiptPrefix(type = 'tuition') {
    return TYPE_PREFIX[type] || TYPE_PREFIX.other
}

export function buildReceiptNumber({ type = 'tuition', dueDate, studentCode = '', fallbackCode = 'AUTO', existingNumbers = [] } = {}) {
    const code = cleanReceiptStudentCode(studentCode) || cleanReceiptStudentCode(fallbackCode) || 'AUTO'
    const base = `${receiptPrefix(type)}-${receiptPeriod(dueDate)}-${code}`
    const existing = new Set(existingNumbers.map(number => String(number || '').trim().toUpperCase()).filter(Boolean))
    let candidate = base
    let suffix = 2
    while (existing.has(candidate.toUpperCase())) {
        candidate = `${base}-${String(suffix).padStart(2, '0')}`
        suffix += 1
    }
    return candidate
}

export function studentCodeFromReceiptNumber(invoiceNumber = '') {
    const match = String(invoiceNumber || '').trim().match(/^(?:HP|TA|HL|HD|KT)-\d{6}-([A-Z0-9_]+)(?:-\d{2})?$/i)
    return match ? match[1].toUpperCase() : ''
}
