import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_KEY

if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
}

const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
})

const { data: facilities, error: facilityError } = await supabase
    .from('facilities')
    .select('id, code')
    .eq('code', 'CS2')

if (facilityError) throw facilityError
const facilityId = facilities?.[0]?.id
if (!facilityId) throw new Error('CS2 facility not found')

const names = [
    ['Lê Minh Khang', 'Lê Thị Hạnh', 'Mầm 1'],
    ['Nguyễn An Nhiên', 'Nguyễn Quốc Bảo', 'Mầm 1'],
    ['Trần Gia Hân', 'Trần Thị Thu', 'Mầm 1'],
    ['Phạm Tuấn Kiệt', 'Phạm Minh Tâm', 'Chồi 1'],
    ['Võ Bảo Ngọc', 'Võ Thị Lan', 'Chồi 1'],
    ['Đỗ Nhật Minh', 'Đỗ Văn Nam', 'Chồi 1'],
    ['Hoàng Khánh Linh', 'Hoàng Thùy Dung', 'Lá 1'],
    ['Bùi Gia Bảo', 'Bùi Thanh Sơn', 'Lá 1'],
    ['Đặng Phương Anh', 'Đặng Ngọc Mai', 'Lá 1'],
    ['Mai Đức Anh', 'Mai Hoàng Long', 'Nhà Trẻ'],
    ['Cao Minh Châu', 'Cao Thị Hồng', 'Nhà Trẻ'],
    ['Ngô Hải Đăng', 'Ngô Văn Phúc', 'Nhà Trẻ'],
]

const rows = names.map(([student, parent, className], index) => ({
    facility_id: facilityId,
    full_name: student,
    dob: null,
    gender: 'unknown',
    class_name: className,
    parent_name: parent,
    parent_phone: `09${String(20000000 + index).padStart(8, '0')}`,
    parent_email: null,
    status: 'active',
    notes: 'Dữ liệu giả lập CS2 để test giao diện/RLS',
}))

await supabase
    .from('students')
    .delete()
    .eq('facility_id', facilityId)
    .eq('notes', 'Dữ liệu giả lập CS2 để test giao diện/RLS')

const { data, error } = await supabase
    .from('students')
    .insert(rows)
    .select('id')

if (error) throw error

console.log(JSON.stringify({ ok: true, facility: 'CS2', studentsSeeded: data?.length || rows.length }, null, 2))
