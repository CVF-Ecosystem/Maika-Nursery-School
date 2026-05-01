import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('your-project') &&
    !supabaseAnonKey.includes('your-supabase')
)

export const supabase = isSupabaseConfigured
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

export function requireSupabase() {
    if (!supabase) {
        throw new Error('Supabase chưa được cấu hình. Kiểm tra VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY.')
    }
    return supabase
}
