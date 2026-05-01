import { getCurrentProfile } from '../auth/authService'
import { requireSupabase } from '../../lib/supabaseClient'

const NOTIFICATION_COLUMNS = 'id, title, body, type, priority, target_role, target_class_id, target_student_id, channel, status, scheduled_at, sent_at, created_by, created_at, updated_at'
const SETTINGS_COLUMNS = 'id, school_name, logo_url, address, phone, email, hours_open, hours_close, pickup_start, pickup_end, timezone, current_academic_year_id, updated_at'
const ACADEMIC_YEAR_COLUMNS = 'id, name, start_date, end_date, is_current, created_at'
const HOLIDAY_COLUMNS = 'id, name, date, is_recurring, note, created_at'
const TUITION_COLUMNS = 'id, name, class_id, amount, currency, billing_cycle, description, is_active, created_at, updated_at'
const MEAL_COLUMNS = 'id, week_start, day_of_week, meal_type, dishes, ingredients, allergen_notes, is_published, created_by, created_at, updated_at'

const DEFAULT_SETTINGS = {
    id: 1,
    school_name: 'Nhà Trẻ Maika',
    logo_url: '',
    address: '',
    phone: '',
    email: '',
    hours_open: '07:00',
    hours_close: '18:00',
    pickup_start: '16:30',
    pickup_end: '18:00',
    timezone: 'Asia/Ho_Chi_Minh',
    current_academic_year_id: null,
}

export async function listNotifications({ status, type } = {}) {
    const client = requireSupabase()
    const profile = await getCurrentProfile()
    let query = client
        .from('notifications')
        .select(NOTIFICATION_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(100)

    if (status) query = query.eq('status', status)
    if (type) query = query.eq('type', type)
    if (profile?.role === 'parent') query = query.eq('status', 'sent')

    const { data, error } = await query
    if (error) throw error

    const rows = data || []
    if (profile?.role !== 'parent' || rows.length === 0) {
        return { data: rows, unreadCount: 0 }
    }

    const ids = rows.map(row => row.id)
    const { data: reads, error: readsError } = await client
        .from('notification_reads')
        .select('notification_id')
        .eq('user_id', profile.id)
        .in('notification_id', ids)
    if (readsError) throw readsError

    const readIds = new Set((reads || []).map(row => row.notification_id))
    const withReadState = rows.map(row => ({ ...row, is_read: readIds.has(row.id) ? 1 : 0 }))
    return {
        data: withReadState,
        unreadCount: withReadState.filter(row => !row.is_read).length,
    }
}

export async function createNotification(input) {
    const client = requireSupabase()
    const profile = await getCurrentProfile()
    const payload = notificationPayload(input, profile?.id, { partial: false })
    const { data, error } = await client
        .from('notifications')
        .insert(payload)
        .select(NOTIFICATION_COLUMNS)
        .single()
    if (error) throw error
    return data
}

export async function updateNotification(id, input) {
    const client = requireSupabase()
    const payload = {
        ...notificationPayload(input, null, { partial: true }),
        ...(input.status === 'sent' ? { sent_at: new Date().toISOString() } : {}),
        updated_at: new Date().toISOString(),
    }
    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key])
    const { data, error } = await client
        .from('notifications')
        .update(payload)
        .eq('id', id)
        .select(NOTIFICATION_COLUMNS)
        .single()
    if (error) throw error
    return data
}

export async function markNotificationRead(id) {
    const client = requireSupabase()
    const profile = await getCurrentProfile()
    const { error } = await client
        .from('notification_reads')
        .upsert({ notification_id: id, user_id: profile.id }, { onConflict: 'notification_id,user_id' })
    if (error) throw error
}

function notificationPayload(input, createdBy, { partial } = { partial: true }) {
    const payload = {
        ...(field(input, 'title', partial) ? { title: input.title } : {}),
        ...(field(input, 'body', partial) ? { body: input.body } : {}),
        ...(field(input, 'type', partial) ? { type: input.type || 'general' } : {}),
        ...(field(input, 'priority', partial) ? { priority: input.priority || 'normal' } : {}),
        ...(field(input, 'targetRole', partial) ? { target_role: input.targetRole === '' ? null : input.targetRole } : {}),
        ...(field(input, 'targetClassId', partial) ? { target_class_id: input.targetClassId || null } : {}),
        ...(field(input, 'targetStudentId', partial) ? { target_student_id: input.targetStudentId || null } : {}),
        ...(field(input, 'channel', partial) ? { channel: input.channel || 'app' } : {}),
        ...(field(input, 'status', partial) ? { status: input.status || 'draft' } : {}),
        ...(field(input, 'scheduledAt', partial) ? { scheduled_at: input.scheduledAt || null } : {}),
        ...(createdBy ? { created_by: createdBy } : {}),
    }
    return payload
}

function field(input, key, partial) {
    return !partial || Object.prototype.hasOwnProperty.call(input, key)
}

export async function getSchoolSettings() {
    const client = requireSupabase()
    const { data, error } = await client
        .from('school_settings')
        .select(SETTINGS_COLUMNS)
        .eq('id', 1)
        .maybeSingle()
    if (error) throw error
    return data || DEFAULT_SETTINGS
}

export async function saveSchoolSettings(input) {
    const client = requireSupabase()
    const payload = {
        id: 1,
        school_name: input.schoolName || 'Nhà Trẻ Maika',
        logo_url: input.logoUrl || null,
        address: input.address || null,
        phone: input.phone || null,
        email: input.email || null,
        hours_open: input.hoursOpen || '07:00',
        hours_close: input.hoursClose || '18:00',
        pickup_start: input.pickupStart || '16:30',
        pickup_end: input.pickupEnd || '18:00',
        timezone: input.timezone || 'Asia/Ho_Chi_Minh',
        current_academic_year_id: input.currentAcademicYearId || null,
        updated_at: new Date().toISOString(),
    }
    const { data, error } = await client
        .from('school_settings')
        .upsert(payload, { onConflict: 'id' })
        .select(SETTINGS_COLUMNS)
        .single()
    if (error) throw error
    return data
}

export async function listAcademicYears() {
    const client = requireSupabase()
    const { data, error } = await client
        .from('academic_years')
        .select(ACADEMIC_YEAR_COLUMNS)
        .order('start_date', { ascending: false })
    if (error) throw error
    return data || []
}

export async function createAcademicYear(input) {
    const client = requireSupabase()
    if (input.isCurrent) await clearCurrentAcademicYear()
    const { data, error } = await client
        .from('academic_years')
        .insert({
            name: input.name,
            start_date: input.startDate,
            end_date: input.endDate,
            is_current: !!input.isCurrent,
        })
        .select(ACADEMIC_YEAR_COLUMNS)
        .single()
    if (error) throw error
    return data
}

export async function updateAcademicYear(id, input) {
    const client = requireSupabase()
    if (input.isCurrent) await clearCurrentAcademicYear()
    const payload = {
        name: input.name,
        start_date: input.startDate,
        end_date: input.endDate,
        is_current: input.isCurrent,
    }
    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key])
    const { data, error } = await client
        .from('academic_years')
        .update(payload)
        .eq('id', id)
        .select(ACADEMIC_YEAR_COLUMNS)
        .single()
    if (error) throw error
    return data
}

async function clearCurrentAcademicYear() {
    const client = requireSupabase()
    const { error } = await client
        .from('academic_years')
        .update({ is_current: false })
        .eq('is_current', true)
    if (error) throw error
}

export async function listSchoolHolidays() {
    const client = requireSupabase()
    const { data, error } = await client
        .from('school_holidays')
        .select(HOLIDAY_COLUMNS)
        .order('date', { ascending: true })
    if (error) throw error
    return data || []
}

export async function createSchoolHoliday(input) {
    const client = requireSupabase()
    const { data, error } = await client
        .from('school_holidays')
        .insert({
            name: input.name,
            date: input.date,
            is_recurring: !!input.isRecurring,
            note: input.note || null,
        })
        .select(HOLIDAY_COLUMNS)
        .single()
    if (error) throw error
    return data
}

export async function deleteSchoolHoliday(id) {
    const client = requireSupabase()
    const { error } = await client.from('school_holidays').delete().eq('id', id)
    if (error) throw error
}

export async function listTuitionPlans({ activeOnly = false } = {}) {
    const client = requireSupabase()
    let query = client.from('tuition_plans').select(TUITION_COLUMNS).order('name', { ascending: true })
    if (activeOnly) query = query.eq('is_active', true)
    const { data, error } = await query
    if (error) throw error
    return data || []
}

export async function createTuitionPlan(input) {
    const client = requireSupabase()
    const { data, error } = await client
        .from('tuition_plans')
        .insert(tuitionPayload(input))
        .select(TUITION_COLUMNS)
        .single()
    if (error) throw error
    return data
}

export async function updateTuitionPlan(id, input) {
    const client = requireSupabase()
    const payload = { ...tuitionPayload(input), updated_at: new Date().toISOString() }
    const { data, error } = await client
        .from('tuition_plans')
        .update(payload)
        .eq('id', id)
        .select(TUITION_COLUMNS)
        .single()
    if (error) throw error
    return data
}

function tuitionPayload(input) {
    return {
        name: input.name,
        class_id: input.classId || null,
        amount: Number(input.amount || 0),
        currency: input.currency || 'VND',
        billing_cycle: input.billingCycle || 'monthly',
        description: input.description || null,
        is_active: input.isActive !== false,
    }
}

export async function listMealMenus({ weekStart, published = false } = {}) {
    const client = requireSupabase()
    let query = client
        .from('meal_menus')
        .select(MEAL_COLUMNS)
        .order('week_start', { ascending: false })
        .order('day_of_week', { ascending: true })
        .order('meal_type', { ascending: true })

    if (weekStart) query = query.eq('week_start', weekStart)
    if (published) query = query.eq('is_published', true)

    const { data, error } = await query
    if (error) throw error
    return data || []
}

export async function upsertMealMenu(input) {
    const client = requireSupabase()
    const profile = await getCurrentProfile()
    const payload = {
        week_start: input.weekStart,
        day_of_week: Number(input.dayOfWeek),
        meal_type: input.mealType || 'lunch',
        dishes: Array.isArray(input.dishes) ? input.dishes : [],
        ingredients: input.ingredients || null,
        allergen_notes: input.allergenNotes || null,
        is_published: !!input.isPublished,
        created_by: profile?.id || null,
        updated_at: new Date().toISOString(),
    }
    const { data, error } = await client
        .from('meal_menus')
        .upsert(payload, { onConflict: 'week_start,day_of_week,meal_type' })
        .select(MEAL_COLUMNS)
        .single()
    if (error) throw error
    return data
}
