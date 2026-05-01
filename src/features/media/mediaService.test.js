import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mapAsset, getSignedUrl } from './mediaService'

const mockCreateSignedUrl = vi.fn()
const mockStorageFrom = vi.fn()

vi.mock('../../lib/supabaseClient', () => ({
    requireSupabase: () => ({
        storage: { from: mockStorageFrom },
    }),
}))

vi.mock('../auth/authService', () => ({
    getCurrentProfile: vi.fn().mockResolvedValue({ id: 'u1', facility_id: 'cs1-id', role: 'teacher' }),
}))

describe('mediaService — signed URL', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockStorageFrom.mockReturnValue({ createSignedUrl: mockCreateSignedUrl })
    })

    it('returns empty string for falsy storagePath', async () => {
        expect(await getSignedUrl('')).toBe('')
        expect(await getSignedUrl(null)).toBe('')
        expect(mockStorageFrom).not.toHaveBeenCalled()
    })

    it('calls createSignedUrl on maika-media bucket with TTL 600s', async () => {
        mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.example/photo.jpg' }, error: null })
        const result = await getSignedUrl('cs1-id/123-photo.jpg')
        expect(mockStorageFrom).toHaveBeenCalledWith('maika-media')
        expect(mockCreateSignedUrl).toHaveBeenCalledWith('cs1-id/123-photo.jpg', 600)
        expect(result).toBe('https://signed.example/photo.jpg')
    })

    it('accepts custom TTL', async () => {
        mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.example/x' }, error: null })
        await getSignedUrl('some/path', 3600)
        expect(mockCreateSignedUrl).toHaveBeenCalledWith('some/path', 3600)
    })

    it('throws on storage error', async () => {
        mockCreateSignedUrl.mockResolvedValue({ data: null, error: new Error('bucket not found') })
        await expect(getSignedUrl('bad/path')).rejects.toThrow('bucket not found')
    })

    it('returns empty string when signedUrl missing from response', async () => {
        mockCreateSignedUrl.mockResolvedValue({ data: {}, error: null })
        expect(await getSignedUrl('some/path')).toBe('')
    })
})

describe('mediaService — mapAsset (parent isolation)', () => {
    it('uses signed_url field — not public_url', () => {
        const mapped = mapAsset({
            id: 'a1', album_id: 'al1', facility_id: 'cs1-id', student_id: 's1',
            storage_path: 'cs1-id/photo.jpg',
            public_url: 'https://SHOULD-NOT-BE-USED.example/photo.jpg',
            signed_url: 'https://signed.example/photo.jpg',
            original_name: 'photo.jpg', mime_type: 'image/jpeg',
            caption: 'Giờ ăn', status: 'published',
            created_by: 'u1', created_at: '2026-05-01T08:00:00Z',
        })
        expect(mapped.url).toBe('https://signed.example/photo.jpg')
        expect(mapped.url).not.toContain('SHOULD-NOT-BE-USED')
    })

    it('url is empty string when signed_url absent', () => {
        const mapped = mapAsset({
            id: 'a2', storage_path: 'cs1-id/photo.jpg',
            public_url: 'https://public.example/photo.jpg',
            signed_url: null,
        })
        expect(mapped.url).toBe('')
    })

    it('maps facility scoping fields correctly', () => {
        const mapped = mapAsset({
            id: 'a3', album_id: 'al1', facility_id: 'cs2-id', student_id: 's9',
            storage_path: 'cs2-id/x.jpg', signed_url: 'https://s.example/x',
            status: 'published',
        })
        expect(mapped.facilityId).toBe('cs2-id')
        expect(mapped.studentId).toBe('s9')
    })
})
