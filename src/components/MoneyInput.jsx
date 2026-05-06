import { useEffect, useRef, useState } from 'react'
import { normalizeTuitionNumber } from '../features/payments/tuitionFromAttendance'

function formatVnd(amount) {
    return amount ? amount.toLocaleString('vi-VN') : ''
}

export default function MoneyInput({ value, onChange, style, inputMode = 'numeric', placeholder = '0', ...props }) {
    const [display, setDisplay] = useState(() => formatVnd(normalizeTuitionNumber(value)))
    const focused = useRef(false)

    // Sync external value changes (e.g. reset after save) only when not focused
    useEffect(() => {
        if (!focused.current) {
            setDisplay(formatVnd(normalizeTuitionNumber(value)))
        }
    }, [value])

    function handleChange(e) {
        const raw = e.target.value
        setDisplay(raw)
        onChange?.(normalizeTuitionNumber(raw))
    }

    function handleFocus() {
        focused.current = true
    }

    function handleBlur() {
        focused.current = false
        const amount = normalizeTuitionNumber(display)
        setDisplay(formatVnd(amount))
        onChange?.(amount)
    }

    return (
        <input
            {...props}
            type="text"
            inputMode={inputMode}
            value={display}
            placeholder={placeholder}
            style={style}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
        />
    )
}
