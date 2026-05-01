import 'dotenv/config'
import dotenv from 'dotenv'
import { createWriteStream, mkdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { spawn } from 'node:child_process'
import { gzip } from 'node:zlib'
import { promisify } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'

const gzipAsync = promisify(gzip)

dotenv.config({ path: '.env.local', override: false, quiet: true })
dotenv.config({ path: '.env.backup.local', override: false, quiet: true })

const BACKUP_DIR = resolve(process.env.MAIKA_SUPABASE_BACKUP_DIR || process.env.MAIKA_BACKUP_DIR || 'server/backups/supabase')
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-')
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'maika-media'
const DOWNLOAD_STORAGE_OBJECTS = process.env.SUPABASE_BACKUP_STORAGE_OBJECTS !== 'false'

mkdirSync(BACKUP_DIR, { recursive: true })

function requireEnv(name) {
    const value = process.env[name]
    if (!value) throw new Error(`Missing ${name}`)
    return value
}

async function runPgDump() {
    const postgresUrl = requireEnv('SUPABASE_POSTGRES_URL')
    const outputPath = join(BACKUP_DIR, `supabase-public-${TIMESTAMP}.sql.gz`)
    const pgDump = spawn('pg_dump', [
        postgresUrl,
        '--schema=public',
        '--no-owner',
        '--no-acl',
    ], { stdio: ['ignore', 'pipe', 'pipe'] })

    let stderr = ''
    pgDump.stderr.on('data', chunk => { stderr += chunk.toString() })

    const chunks = []
    pgDump.stdout.on('data', chunk => chunks.push(chunk))

    const exitCode = await new Promise((resolveProcess, rejectProcess) => {
        pgDump.on('error', rejectProcess)
        pgDump.on('close', resolveProcess)
    })

    if (exitCode !== 0) {
        throw new Error(`pg_dump failed (${exitCode}): ${stderr || 'no stderr'}`)
    }

    const compressed = await gzipAsync(Buffer.concat(chunks))
    await pipeline(Readable.from([compressed]), createWriteStream(outputPath))
    return { path: outputPath, size: statSync(outputPath).size }
}

function quoteIdentifier(name) {
    return `"${String(name).replace(/"/g, '""')}"`
}

// Fallback dùng pg driver (TCP port 5432) — chỉ dùng khi có SUPABASE_POSTGRES_URL
async function runJsonSnapshotBackup(reason) {
    const postgresUrl = requireEnv('SUPABASE_POSTGRES_URL')
    const client = new pg.Client({
        connectionString: postgresUrl,
        ssl: { rejectUnauthorized: false },
    })
    await client.connect()
    try {
        const tablesResult = await client.query(`
            select table_name
            from information_schema.tables
            where table_schema = 'public'
              and table_type = 'BASE TABLE'
            order by table_name
        `)
        const columnsResult = await client.query(`
            select table_name, column_name, data_type, is_nullable, column_default
            from information_schema.columns
            where table_schema = 'public'
            order by table_name, ordinal_position
        `)

        const tables = {}
        for (const { table_name: tableName } of tablesResult.rows) {
            const rows = await client.query(`select * from public.${quoteIdentifier(tableName)}`)
            tables[tableName] = {
                columns: columnsResult.rows
                    .filter(column => column.table_name === tableName)
                    .map(({ table_name, ...column }) => column),
                rowCount: rows.rowCount,
                rows: rows.rows,
            }
        }

        const payload = {
            app: 'maika',
            source: 'supabase',
            format: 'public-schema-json-snapshot',
            warning: 'Use pg_dump/PITR for production restore. This JSON fallback preserves table data for environments without pg_dump.',
            pgDumpFallbackReason: reason,
            createdAt: new Date().toISOString(),
            tableCount: Object.keys(tables).length,
            tables,
        }
        const outputPath = join(BACKUP_DIR, `supabase-public-${TIMESTAMP}.json.gz`)
        const compressed = await gzipAsync(Buffer.from(JSON.stringify(payload, null, 2), 'utf8'))
        await pipeline(Readable.from([compressed]), createWriteStream(outputPath))
        return { path: outputPath, size: statSync(outputPath).size, format: payload.format, tableCount: payload.tableCount }
    } finally {
        await client.end()
    }
}

// Fallback REST API — dùng HTTPS, không cần port 5432, hoạt động trên CI/GitHub Actions
const KNOWN_TABLES = [
    'facilities', 'profiles', 'students', 'attendance',
    'parent_student_links', 'media_albums', 'media_assets', 'import_batches',
    'health_records', 'incidents', 'invoices', 'student_consents', 'audit_logs',
    'notifications', 'notification_reads', 'school_settings',
    'academic_years', 'school_holidays', 'tuition_plans', 'meal_menus',
]

async function runRestApiSnapshot(reason) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    if (!supabaseUrl) throw new Error('Missing SUPABASE_URL')
    const serviceKey = requireEnv('SUPABASE_SERVICE_KEY')
    const client = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    })

    const tables = {}
    for (const tableName of KNOWN_TABLES) {
        const { data, error } = await client.from(tableName).select('*')
        tables[tableName] = error
            ? { error: error.message, rows: [] }
            : { rowCount: data.length, rows: data }
    }

    const payload = {
        app: 'maika',
        source: 'supabase-rest-api',
        format: 'public-schema-json-snapshot',
        warning: 'Use pg_dump/PITR for production restore. This JSON snapshot uses REST API (HTTPS).',
        fallbackReason: reason,
        createdAt: new Date().toISOString(),
        tableCount: KNOWN_TABLES.length,
        tables,
    }
    const outputPath = join(BACKUP_DIR, `supabase-public-${TIMESTAMP}.json.gz`)
    const compressed = await gzipAsync(Buffer.from(JSON.stringify(payload, null, 2), 'utf8'))
    await pipeline(Readable.from([compressed]), createWriteStream(outputPath))
    return { path: outputPath, size: statSync(outputPath).size, format: payload.format, tableCount: KNOWN_TABLES.length }
}

async function listStorageObjects(client, prefix = '') {
    const { data, error } = await client.storage.from(STORAGE_BUCKET).list(prefix, {
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw error

    const objects = []
    for (const item of data || []) {
        const path = prefix ? `${prefix}/${item.name}` : item.name
        if (item.id) {
            objects.push({
                path,
                size: item.metadata?.size || null,
                updatedAt: item.updated_at || null,
                contentType: item.metadata?.mimetype || item.metadata?.contentType || null,
            })
        } else {
            objects.push(...await listStorageObjects(client, path))
        }
    }
    return objects
}

function safeObjectTarget(rootDir, objectPath) {
    const parts = objectPath.split('/').filter(part => part && part !== '.' && part !== '..')
    const target = resolve(rootDir, ...parts)
    if (!target.startsWith(rootDir)) throw new Error(`Unsafe storage object path: ${objectPath}`)
    return target
}

async function downloadStorageObjects(client, objects) {
    const rootDir = resolve(BACKUP_DIR, `storage-${STORAGE_BUCKET}-${TIMESTAMP}`)
    mkdirSync(rootDir, { recursive: true })

    let downloaded = 0
    for (const object of objects) {
        const { data, error } = await client.storage.from(STORAGE_BUCKET).download(object.path)
        if (error) throw error

        const target = safeObjectTarget(rootDir, object.path)
        mkdirSync(dirname(target), { recursive: true })
        const buffer = Buffer.from(await data.arrayBuffer())
        await pipeline(Readable.from([buffer]), createWriteStream(target))
        downloaded += 1
    }

    return { path: rootDir, objectCount: downloaded }
}

async function writeStorageManifest() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    if (!supabaseUrl) throw new Error('Missing SUPABASE_URL or VITE_SUPABASE_URL')
    const serviceKey = requireEnv('SUPABASE_SERVICE_KEY')
    const client = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    })

    const objects = await listStorageObjects(client)
    const outputPath = join(BACKUP_DIR, `supabase-storage-${STORAGE_BUCKET}-${TIMESTAMP}.json`)
    const downloaded = DOWNLOAD_STORAGE_OBJECTS
        ? await downloadStorageObjects(client, objects)
        : { skipped: true, reason: 'SUPABASE_BACKUP_STORAGE_OBJECTS=false' }
    const payload = {
        app: 'maika',
        bucket: STORAGE_BUCKET,
        createdAt: new Date().toISOString(),
        downloaded,
        objectCount: objects.length,
        objects,
    }

    await pipeline(
        Readable.from([Buffer.from(JSON.stringify(payload, null, 2), 'utf8')]),
        createWriteStream(outputPath)
    )
    return { path: outputPath, size: statSync(outputPath).size, objectCount: objects.length, downloaded }
}

async function main() {
    const results = {}

    if (process.env.SUPABASE_POSTGRES_URL) {
        // Có POSTGRES_URL: thử pg_dump → pg driver → REST API
        try {
            results.database = await runPgDump()
        } catch (pgDumpError) {
            try {
                results.database = await runJsonSnapshotBackup(pgDumpError.message)
            } catch (pgError) {
                results.database = await runRestApiSnapshot(pgError.message)
            }
        }
    } else {
        // Không có POSTGRES_URL (CI/GitHub Actions): dùng REST API trực tiếp
        results.database = await runRestApiSnapshot('SUPABASE_POSTGRES_URL not configured')
    }

    if ((process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) && process.env.SUPABASE_SERVICE_KEY) {
        results.storageManifest = await writeStorageManifest()
    } else {
        results.storageManifest = {
            skipped: true,
            reason: 'SUPABASE_URL and SUPABASE_SERVICE_KEY are required to list storage objects.',
        }
    }

    console.log(JSON.stringify({ ok: true, backupDir: BACKUP_DIR, ...results }, null, 2))
}

main().catch(error => {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2))
    process.exit(1)
})
