import { describe, expect, it } from 'vitest'
import { portalPathForRole } from './authService'

describe('auth service', () => {
    it('maps roles to portal paths', () => {
        expect(portalPathForRole('admin')).toBe('/admin/app')
        expect(portalPathForRole('teacher')).toBe('/teacher/app')
        expect(portalPathForRole('parent')).toBe('/parent/app')
        expect(portalPathForRole('unknown')).toBe('/')
    })
})
