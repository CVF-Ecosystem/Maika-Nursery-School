export const DATA_BACKEND = import.meta.env.VITE_DATA_BACKEND || 'local'

export function isSupabaseBackend() {
    return DATA_BACKEND === 'supabase'
}

export function setActiveDataBackend(mode) {
    if (typeof sessionStorage === 'undefined') return
    sessionStorage.setItem('maika_data_backend', mode)
}

export function isSupabaseSession() {
    if (!isSupabaseBackend()) return false
    if (typeof sessionStorage === 'undefined') return false
    return sessionStorage.getItem('maika_data_backend') === 'supabase'
}
