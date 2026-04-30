import { describe, expect, it } from 'vitest'
import { fmtDate, fmtDateTime, fmtMoney, getAge } from './format'

describe('format utilities', () => {
    it('formats Vietnamese dates', () => {
        expect(fmtDate('2026-04-30')).toBe('30/4/2026')
        expect(fmtDate('')).toBe('')
    })

    it('formats VND amounts', () => {
        expect(fmtMoney(2500000)).toMatch(/2\.500\.000/)
        expect(fmtMoney(2500000)).toMatch(/₫/)
    })

    it('formats date time values', () => {
        expect(fmtDateTime('2026-04-30T08:15:00')).toContain('30/4/2026')
        expect(fmtDateTime(null)).toBe('')
    })

    it('calculates age from birth year', () => {
        const expected = new Date().getFullYear() - 2020
        expect(getAge('2020-03-15')).toBe(expected)
    })
})
