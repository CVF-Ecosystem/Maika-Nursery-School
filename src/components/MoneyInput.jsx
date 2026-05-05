import { normalizeTuitionNumber } from '../features/payments/tuitionFromAttendance'

function formatVndInput(value) {
    const amount = normalizeTuitionNumber(value)
    if (!amount) return ''
    return amount.toLocaleString('vi-VN')
}

export default function MoneyInput({ value, onChange, style, inputMode = 'numeric', placeholder = '0', ...props }) {
    return (
        <input
            {...props}
            type="text"
            inputMode={inputMode}
            value={formatVndInput(value)}
            onChange={event => onChange?.(normalizeTuitionNumber(event.target.value))}
            placeholder={placeholder}
            style={style}
        />
    )
}
