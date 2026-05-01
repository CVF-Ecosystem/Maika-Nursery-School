import 'dotenv/config'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local', override: false, quiet: true })
dotenv.config({ path: '.env.backup.local', override: false, quiet: true })

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_KEY
const password = process.env.SUPABASE_TEST_PASSWORD

if (!url || !serviceKey || !password) {
    throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY, or SUPABASE_TEST_PASSWORD')
}

const emails = process.argv.slice(2)
const targets = emails.length ? emails : [
    'admin@maika.test',
    'teacher.cs1@maika.test',
    'teacher.cs2@maika.test',
    'parent@maikaschool.vn',
]

const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
})

async function findUserByEmail(email) {
    let page = 1
    while (true) {
        const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 })
        if (error) throw error
        const user = data.users.find(item => item.email?.toLowerCase() === email.toLowerCase())
        if (user) return user
        if (data.users.length < 100) return null
        page += 1
    }
}

const result = []
for (const email of targets) {
    const user = await findUserByEmail(email)
    if (!user) {
        result.push({ email, ok: false, reason: 'not_found' })
        continue
    }
    const { error } = await client.auth.admin.updateUserById(user.id, {
        password,
        email_confirm: true,
        user_metadata: { ...(user.user_metadata || {}), maika_test_password_reset_at: new Date().toISOString() },
    })
    result.push({ email, ok: !error, reason: error?.message || null })
}

console.log(JSON.stringify({ ok: result.every(item => item.ok), result }, null, 2))
