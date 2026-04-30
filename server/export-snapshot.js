import 'dotenv/config'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readSnapshot, seedDatabase } from './db.js'

const filePath = process.argv[2] || 'maika-snapshot.json'

await seedDatabase()
writeFileSync(resolve(filePath), JSON.stringify({ data: readSnapshot() }, null, 2))

console.log(`Exported Maika snapshot to ${filePath}`)
