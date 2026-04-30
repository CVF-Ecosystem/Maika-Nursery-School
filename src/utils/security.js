import DOMPurify from 'dompurify'

export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024

export function sanitizeText(value) {
    return DOMPurify.sanitize(String(value ?? ''), {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
    }).trim()
}

export function sanitizeFilename(value) {
    const withoutExtension = String(value ?? '').replace(/\.[^/.\\]+$/, '')
    const cleaned = sanitizeText(withoutExtension)
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
        .replace(/^\.+/, '')
        .replace(/\s+/g, ' ')
        .slice(0, 80)
        .trim()

    return cleaned || 'Anh tai len'
}

export function validateImageFile(file) {
    if (!file) return 'Không tìm thấy file ảnh.'
    if (!file.type || !file.type.startsWith('image/')) return 'Chỉ hỗ trợ file ảnh.'
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) return 'Ảnh tải lên tối đa 5MB.'
    return ''
}
