export const DATA_BACKEND = import.meta.env.VITE_DATA_BACKEND || 'supabase'

export function isSupabaseBackend() {
    return DATA_BACKEND === 'supabase'
}

export function setActiveDataBackend(mode) {
    if (typeof sessionStorage === 'undefined') return
    sessionStorage.setItem('maika_data_backend', mode)
}

export function isSupabaseSession() {
    return isSupabaseBackend()
}
