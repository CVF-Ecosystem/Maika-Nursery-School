import 'dotenv/config'
import dotenv from 'dotenv'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'

dotenv.config({ path: '.env.local', override: false, quiet: true })
dotenv.config({ path: '.env.backup.local', override: false, quiet: true })

const file = process.argv[2]
if (!file) {
    console.error('Usage: node scripts/apply-supabase-migration.mjs supabase/migrations/NNN_name.sql')
    process.exit(1)
}

const connectionString = process.env.SUPABASE_POSTGRES_URL
if (!connectionString) {
    console.error('Missing SUPABASE_POSTGRES_URL')
    process.exit(1)
}

const sql = readFileSync(resolve(file), 'utf8')

function clientConfig() {
    const direct = new URL(connectionString)
    const poolerPath = resolve('supabase/.temp/pooler-url')
    if (!existsSync(poolerPath)) {
        return {
            connectionString,
            ssl: { rejectUnauthorized: false },
        }
    }

    const pooler = new URL(readFileSync(poolerPath, 'utf8').trim())
    return {
        host: pooler.hostname,
        port: Number(pooler.port || direct.port || 5432),
        database: pooler.pathname.replace(/^\//, '') || direct.pathname.replace(/^\//, '') || 'postgres',
        user: decodeURIComponent(pooler.username || direct.username),
        password: decodeURIComponent(pooler.password || direct.password),
        ssl: { rejectUnauthorized: false },
    }
}

const client = new pg.Client(clientConfig())

try {
    await client.connect()
    await client.query(sql)
    console.log(JSON.stringify({ ok: true, file }, null, 2))
} catch (error) {
    console.error(JSON.stringify({ ok: false, file, error: error.message }, null, 2))
    process.exitCode = 1
} finally {
    await client.end().catch(() => {})
}
