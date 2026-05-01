const PAYMENT_SETTINGS_KEY = 'maika_payment_settings'

export const DEFAULT_PAYMENT_SETTINGS = {
    bankId: '',
    accountNo: '',
    accountName: '',
    transferPrefix: 'Hoc phi Maika',
}

export function getPaymentSettings() {
    try {
        const raw = localStorage.getItem(PAYMENT_SETTINGS_KEY)
        if (!raw) return { ...DEFAULT_PAYMENT_SETTINGS }
        return { ...DEFAULT_PAYMENT_SETTINGS, ...JSON.parse(raw) }
    } catch {
        return { ...DEFAULT_PAYMENT_SETTINGS }
    }
}

export function savePaymentSettings(input) {
    const settings = {
        bankId: String(input.bankId || '').trim(),
        accountNo: String(input.accountNo || '').trim(),
        accountName: String(input.accountName || '').trim(),
        transferPrefix: String(input.transferPrefix || DEFAULT_PAYMENT_SETTINGS.transferPrefix).trim(),
    }
    localStorage.setItem(PAYMENT_SETTINGS_KEY, JSON.stringify(settings))
    return settings
}

export function hasPaymentQrSettings(settings = getPaymentSettings()) {
    return Boolean(settings.bankId && settings.accountNo && settings.accountName)
}

export function buildPaymentQrUrl({ amount, invoiceNumber, studentName, settings = getPaymentSettings() }) {
    if (!hasPaymentQrSettings(settings)) return ''
    const money = Math.max(0, Math.round(Number(amount || 0)))
    const addInfo = [settings.transferPrefix, invoiceNumber, studentName].filter(Boolean).join(' ')
    const params = new URLSearchParams({
        amount: String(money),
        addInfo,
        accountName: settings.accountName,
    })
    return `https://img.vietqr.io/image/${encodeURIComponent(settings.bankId)}-${encodeURIComponent(settings.accountNo)}-compact2.png?${params.toString()}`
}
