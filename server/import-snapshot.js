import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { replaceSnapshot, seedDatabase } from './db.js'

const filePath = process.argv[2]

if (!filePath) {
    console.error('Usage: node server/import-snapshot.js <maika-export.json>')
    process.exit(1)
}

await seedDatabase()

const payload = JSON.parse(readFileSync(resolve(filePath), 'utf8'))
const data = payload.data || payload
replaceSnapshot(data)

console.log(`Imported Maika snapshot from ${filePath}`)
