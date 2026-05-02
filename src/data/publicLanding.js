import { createTourRequest, getDB } from './store'
import { hasBackendAPI, publicApiRequest } from './api'
import { isSupabaseBackend } from './backendMode'
import { supabase } from '../lib/supabaseClient'

const PLACEHOLDER_LANDING_DATA = {
    stats: {
        activeStudentCount: 0,
        activeTeacherCount: 0,
        classCount: 0,
    },
    heroCards: [
        ['👦', '—', 'Học sinh đang học'],
        ['👩‍🏫', '—', 'Giáo viên phụ trách'],
        ['⭐', '—', 'Nhóm lớp mầm non'],
        ['🔒', 'Riêng tư', 'Phân quyền bảo mật'],
    ],
    statStrip: [
        ['—', 'Nhóm lớp mầm non'],
        ['Hằng ngày', 'Điểm danh và nhật ký'],
        ['—', 'Giáo viên và nhân sự'],
        ['Riêng tư', 'Quyền truy cập theo vai trò'],
    ],
    programs: [
        {
            id: 'program-mam',
            cls: 'Lớp Mầm',
            age: '3–4 tuổi',
            icon: '🌱',
            bg: '#EDE9FE',
            col: '#6D28D9',
            delay: 'd1',
            desc: 'Làm quen môi trường học, phát triển ngôn ngữ và kỹ năng xã hội qua vui chơi.',
            feats: ['🎨 Vẽ và tô màu sáng tạo', '🎵 Học qua bài hát & vần điệu', '🤝 Kỹ năng sống căn bản'],
        },
        {
            id: 'program-choi',
            cls: 'Lớp Chồi',
            age: '4–5 tuổi',
            icon: '🌿',
            bg: '#FEF3C7',
            col: '#D97706',
            delay: 'd2',
            desc: 'Phát triển tư duy logic, toán học và vốn từ vựng qua khám phá thế giới.',
            feats: ['🔢 Làm quen với con số', '📖 Nhận biết chữ cái', '🌍 Khám phá thiên nhiên'],
        },
        {
            id: 'program-la',
            cls: 'Lớp Lá',
            age: '5–6 tuổi',
            icon: '🌳',
            bg: '#D1FAE5',
            col: '#059669',
            delay: 'd3',
            desc: 'Chuẩn bị toàn diện vào lớp 1 với kỹ năng đọc viết, tính toán và tư duy độc lập.',
            feats: ['✏️ Tập viết chữ & số', '🧩 Tư duy logic & sáng tạo', '🎤 Tự tin giao tiếp'],
        },
    ],
    publicEvents: [],
}

const PROGRAM_META = {
    'Lớp Mầm': {
        icon: '🌱',
        desc: 'Làm quen môi trường học, phát triển ngôn ngữ và kỹ năng xã hội qua vui chơi.',
        feats: ['🎨 Vẽ và tô màu sáng tạo', '🎵 Học qua bài hát & vần điệu', '🤝 Kỹ năng sống căn bản'],
        bg: '#EDE9FE',
        col: '#6D28D9',
        delay: 'd1',
    },
    'Lớp Chồi': {
        icon: '🌿',
        desc: 'Phát triển tư duy logic, toán học và vốn từ vựng qua khám phá thế giới.',
        feats: ['🔢 Làm quen với con số', '📖 Nhận biết chữ cái', '🌍 Khám phá thiên nhiên'],
        bg: '#FEF3C7',
        col: '#D97706',
        delay: 'd2',
    },
    'Lớp Lá': {
        icon: '🌳',
        desc: 'Chuẩn bị toàn diện vào lớp 1 với kỹ năng đọc viết, tính toán và tư duy độc lập.',
        feats: ['✏️ Tập viết chữ & số', '🧩 Tư duy logic & sáng tạo', '🎤 Tự tin giao tiếp'],
        bg: '#D1FAE5',
        col: '#059669',
        delay: 'd3',
    },
}

const FALLBACK_PROGRAMS = [
    { id: 'program-mam', name: 'Lớp Mầm', ageGroup: '3-4 tuổi' },
    { id: 'program-choi', name: 'Lớp Chồi', ageGroup: '4-5 tuổi' },
    { id: 'program-la', name: 'Lớp Lá', ageGroup: '5-6 tuổi' },
]

function cleanText(value, max = 160) {
    return String(value || '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, max)
}

function formatAgeGroup(value) {
    return cleanText(value).replace('-', '–')
}

function plusCount(value) {
    return value > 0 ? `${value}+` : '—'
}

export function buildPublicLandingData(db = getDB()) {
    const students = Array.isArray(db.students) ? db.students : []
    const teachers = Array.isArray(db.teachers) ? db.teachers : []
    const classes = Array.isArray(db.classes) && db.classes.length ? db.classes : FALLBACK_PROGRAMS
    const events = Array.isArray(db.events) ? db.events : []

    const activeStudentCount = students.filter(s => s.status !== 'inactive').length
    const activeTeacherCount = teachers.filter(t => t.status !== 'inactive').length
    const classCount = classes.length
    const publicEvents = events
        .filter(event => event.date && !['finance', 'private'].includes(event.type))
        .sort((a, b) => String(a.date).localeCompare(String(b.date)))
        .slice(0, 3)
        .map(event => ({
            id: event.id,
            title: cleanText(event.title, 80),
            date: event.date,
            type: event.type,
            desc: cleanText(event.desc, 120),
        }))

    const programs = classes.map((cls, index) => {
        const meta = PROGRAM_META[cls.name] || {}
        return {
            id: cls.id || `class-${index}`,
            cls: cls.name || `Nhóm lớp ${index + 1}`,
            age: formatAgeGroup(cls.ageGroup) || 'Mầm non',
            icon: meta.icon || '🌼',
            desc: meta.desc || 'Chương trình học tập và chăm sóc phù hợp với độ tuổi của trẻ.',
            feats: meta.feats || ['🎨 Học qua vui chơi', '🤝 Kỹ năng xã hội', '🌿 Hoạt động mỗi ngày'],
            bg: meta.bg || '#EDE9FE',
            col: meta.col || '#6D28D9',
            delay: meta.delay || `d${Math.min(index + 1, 3)}`,
        }
    })

    return {
        stats: {
            activeStudentCount,
            activeTeacherCount,
            classCount,
        },
        heroCards: [
            ['👦', plusCount(activeStudentCount), 'Học sinh đang học'],
            ['👩‍🏫', plusCount(activeTeacherCount), 'Giáo viên phụ trách'],
            ['⭐', classCount || '—', 'Nhóm lớp mầm non'],
            ['🔒', 'Riêng tư', 'Phân quyền bảo mật'],
        ],
        statStrip: [
            [classCount || '—', 'Nhóm lớp mầm non'],
            ['Hằng ngày', 'Điểm danh và nhật ký'],
            [plusCount(activeTeacherCount), 'Giáo viên và nhân sự'],
            ['Riêng tư', 'Quyền truy cập theo vai trò'],
        ],
        programs,
        publicEvents,
    }
}

export function getInitialPublicLandingData() {
    return isSupabaseBackend() ? PLACEHOLDER_LANDING_DATA : buildPublicLandingData(getDB())
}

export async function loadPublicLandingData() {
    if (isSupabaseBackend() && supabase) {
        const { data, error } = await supabase.rpc('get_public_landing')
        if (error) throw new Error(error.message || 'Không tải được dữ liệu landing.')
        return data
    }

    if (hasBackendAPI()) {
        const payload = await publicApiRequest('/api/public/landing')
        return payload.data
    }
    return buildPublicLandingData(getDB())
}

export async function submitTourRequest(input) {
    const payload = {
        parentName: cleanText(input.parentName, 80),
        phone: cleanText(input.phone, 24),
        childAge: cleanText(input.childAge, 24),
        note: cleanText(input.note, 240),
        website: cleanText(input.website, 120),
    }

    if (!payload.parentName) throw new Error('Vui lòng nhập tên phụ huynh.')
    if (!/^(\+?84|0)[0-9\s.-]{8,13}$/.test(payload.phone)) throw new Error('Số điện thoại chưa hợp lệ.')

    if (isSupabaseBackend() && supabase) {
        if (payload.website) return { status: 'received' }
        const { error } = await supabase.from('tour_requests').insert({
            parent_name: payload.parentName,
            phone: payload.phone,
            child_age: payload.childAge || null,
            note: payload.note || null,
            source: 'landing',
        })
        if (error) throw new Error(error.message || 'Chưa gửi được đăng ký.')
        return { status: 'new' }
    }

    if (hasBackendAPI()) {
        const response = await publicApiRequest('/api/public/tour-requests', {
            method: 'POST',
            body: JSON.stringify(payload),
        })
        return response.data
    }

    return createTourRequest(payload)
}
