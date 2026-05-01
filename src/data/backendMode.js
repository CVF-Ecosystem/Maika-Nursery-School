export const DATA_BACKEND = import.meta.env.VITE_DATA_BACKEND || 'supabase'
export const LEGACY_BACKENDS_ENABLED = Boolean(
    import.meta.env.DEV ||
    import.meta.env.VITE_DEMO_MODE === 'true' ||
    import.meta.env.VITE_ENABLE_LEGACY_BACKENDS === 'true'
)

export function isSupabaseBackend() {
    return DATA_BACKEND === 'supabase' || !LEGACY_BACKENDS_ENABLED
}

export function isLegacyBackendAllowed() {
    return LEGACY_BACKENDS_ENABLED && DATA_BACKEND !== 'supabase'
}

export function setActiveDataBackend(mode) {
    if (typeof sessionStorage === 'undefined') return
    sessionStorage.setItem('maika_data_backend', mode)
}

export function isSupabaseSession() {
    return isSupabaseBackend()
}
