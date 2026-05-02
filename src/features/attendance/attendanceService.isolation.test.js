import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listAttendanceByFacilityDate, upsertAttendance } from './attendanceService'

function makeChain(resolvedData = { data: [], error: null }) {
    const chain = {}
    chain.select = vi.fn(() => chain)
    chain.eq = vi.fn(() => chain)
    chain.order = vi.fn(() => Promise.resolve(resolvedData))
    chain.upsert = vi.fn(() => chain)
    chain.single = vi.fn(() => Promise.resolve(resolvedData))
    return chain
}

let chain
const mockFrom = vi.fn()
const mockRpc = vi.fn()

vi.mock('../../lib/supabaseClient', () => ({
    requireSupabase: () => ({ from: mockFrom, rpc: mockRpc }),
}))

const SAMPLE_ROW = {
    id: 'r1',
    student_id: 's1',
    facility_id: 'cs1-id',
    attendance_date: '2026-05-01',
    status: 'present',
    note: null,
    meal_photo_url: null,
    meal_photo_path: null,
    recorded_by: 'u1',
    check_in_time: '08:00',
    check_out_time: '16:00',
    pickup_person: 'Bà Lan',
    pickup_phone: '0901234567',
    late_reason: null,
    early_pickup_reason: null,
}

describe('attendanceService — facility isolation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        chain = makeChain()
        mockFrom.mockReturnValue(chain)
        mockRpc.mockResolvedValue({ data: SAMPLE_ROW, error: null })
    })

    it('queries attendance filtered by facilityId and date', async () => {
        await listAttendanceByFacilityDate({ facilityId: 'cs1-id', date: '2026-05-01' })
        expect(mockFrom).toHaveBeenCalledWith('attendance')
        expect(chain.eq).toHaveBeenCalledWith('attendance_date', '2026-05-01')
        expect(chain.eq).toHaveBeenCalledWith('facility_id', 'cs1-id')
    })

    it('omits facility_id filter when facilityId not provided', async () => {
        await listAttendanceByFacilityDate({ date: '2026-05-01' })
        expect(chain.eq).toHaveBeenCalledWith('attendance_date', '2026-05-01')
        const facilityEqCall = chain.eq.mock.calls.find(([col]) => col === 'facility_id')
        expect(facilityEqCall).toBeUndefined()
    })

    it('maps returned rows to camelCase — no snake_case keys', async () => {
        chain.order = vi.fn(() => Promise.resolve({ data: [SAMPLE_ROW], error: null }))
        const results = await listAttendanceByFacilityDate({ facilityId: 'cs1-id', date: '2026-05-01' })
        expect(results).toHaveLength(1)
        expect(results[0]).toMatchObject({
            studentId: 's1',
            facilityId: 'cs1-id',
            checkInTime: '08:00',
            checkOutTime: '16:00',
            pickupPerson: 'Bà Lan',
            pickupPhone: '0901234567',
        })
        expect(results[0]).not.toHaveProperty('check_in_time')
        expect(results[0]).not.toHaveProperty('check_out_time')
        expect(results[0]).not.toHaveProperty('pickup_person')
        expect(results[0]).not.toHaveProperty('facility_id')
    })

    it('upsert delegates durable attendance writes to the Supabase RPC', async () => {
        await upsertAttendance({
            studentId: 's1',
            facilityId: 'cs1-id',
            date: '2026-05-01',
            status: 'present',
        })
        expect(mockRpc).toHaveBeenCalledWith(
            'mark_attendance',
            expect.objectContaining({
                p_student_id: 's1',
                p_attendance_date: '2026-05-01',
                p_status: 'present',
            }),
        )
    })

    it('teacher cs2 cannot see cs1 data — query scoped to facilityId param', async () => {
        chain.order = vi.fn(() => Promise.resolve({ data: [], error: null }))
        const results = await listAttendanceByFacilityDate({ facilityId: 'cs2-id', date: '2026-05-01' })
        expect(chain.eq).toHaveBeenCalledWith('facility_id', 'cs2-id')
        expect(chain.eq).not.toHaveBeenCalledWith('facility_id', 'cs1-id')
        expect(results).toHaveLength(0)
    })
})
