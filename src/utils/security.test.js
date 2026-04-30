import { describe, expect, it } from 'vitest'
import { MAX_IMAGE_UPLOAD_BYTES, sanitizeFilename, sanitizeText, validateImageFile } from './security'

describe('security utilities', () => {
    it('strips HTML from user text', () => {
        expect(sanitizeText('<img src=x onerror=alert(1)>Xin chào <b>Maika</b>')).toBe('Xin chào Maika')
    })

    it('cleans unsafe file names', () => {
        expect(sanitizeFilename('../<script>alert(1)</script> anh dep.jpg')).toBe('anh dep')
        expect(sanitizeFilename('')).toBe('Anh tai len')
    })

    it('validates image uploads', () => {
        const image = new File(['x'], 'photo.png', { type: 'image/png' })
        const text = new File(['x'], 'notes.txt', { type: 'text/plain' })
        const huge = new File([new Uint8Array(MAX_IMAGE_UPLOAD_BYTES + 1)], 'huge.png', { type: 'image/png' })

        expect(validateImageFile(image)).toBe('')
        expect(validateImageFile(text)).toBe('Chỉ hỗ trợ file ảnh.')
        expect(validateImageFile(huge)).toBe('Ảnh tải lên tối đa 5MB.')
    })
})
