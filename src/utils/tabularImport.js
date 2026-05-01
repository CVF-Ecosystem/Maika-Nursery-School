export function normalizeImportKey(value = '') {
    return String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]/g, '')
}

export function pickImportValue(row, keys) {
    for (const key of keys) {
        const value = row[key]
        if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim()
    }
    return ''
}

export function initialsFromName(name = '') {
    return name.split(' ').filter(Boolean).slice(-2).map(word => word[0]?.toUpperCase()).join('') || '?'
}

export function normalizeImportDate(value) {
    if (!value) return ''
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
    const text = String(value).trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
    const match = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/)
    if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
    const shortYearMatch = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2})$/)
    if (shortYearMatch) {
        const year = Number(shortYearMatch[3]) >= 70 ? `19${shortYearMatch[3]}` : `20${shortYearMatch[3]}`
        return `${year}-${shortYearMatch[2].padStart(2, '0')}-${shortYearMatch[1].padStart(2, '0')}`
    }
    return text
}

function parseCsvLine(line) {
    const cells = []
    let cell = ''
    let quoted = false
    for (let i = 0; i < line.length; i += 1) {
        const ch = line[i]
        const next = line[i + 1]
        if (ch === '"' && quoted && next === '"') {
            cell += '"'
            i += 1
        } else if (ch === '"') {
            quoted = !quoted
        } else if (ch === ',' && !quoted) {
            cells.push(cell)
            cell = ''
        } else {
            cell += ch
        }
    }
    cells.push(cell)
    return cells
}

export async function readTabularRows(file) {
    const lowerName = file.name.toLowerCase()
    if (lowerName.endsWith('.csv')) {
        const text = await file.text()
        const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim())
        return lines.map(parseCsvLine)
    }
    const sheets = await readWorkbookTables(file)
    return sheets[0]?.rows || []
}

export async function readWorkbookTables(file) {
    const lowerName = file.name.toLowerCase()
    if (lowerName.endsWith('.csv')) {
        return [{ name: file.name, rows: await readTabularRows(file) }]
    }
    const XLSX = await import('@e965/xlsx')
    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data, { type: 'array', cellDates: true })
    return workbook.SheetNames.map(name => ({
        name,
        rows: XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '', raw: false }),
    }))
}

function rowText(row = []) {
    return row.map(cell => normalizeImportKey(cell)).filter(Boolean).join(' ')
}

function countHeaderHits(row = [], keywords = []) {
    const keys = row.map(normalizeImportKey).filter(Boolean)
    const wanted = keywords.map(normalizeImportKey).filter(Boolean)
    if (!wanted.length) return keys.length ? 1 : 0
    return wanted.reduce((count, key) => count + (keys.includes(key) ? 1 : 0), 0)
}

function findHeaderIndex(rows = [], keywords = []) {
    let best = { index: -1, hits: 0, filled: 0 }
    rows.forEach((row, index) => {
        const filled = row.filter(cell => String(cell ?? '').trim()).length
        if (filled < 2) return
        const hits = countHeaderHits(row, keywords)
        if (hits > best.hits || (hits === best.hits && filled > best.filled && best.index < 0)) {
            best = { index, hits, filled }
        }
    })
    if (best.index >= 0 && (best.hits > 0 || !keywords.length)) return best.index
    return rows.findIndex(row => row.filter(cell => String(cell ?? '').trim()).length >= 2)
}

function chooseSheet(sheets = [], preferredSheetNames = [], headerKeywords = []) {
    const preferred = preferredSheetNames.map(normalizeImportKey).filter(Boolean)
    return sheets.find(sheet => preferred.some(name => normalizeImportKey(sheet.name).includes(name)))
        || sheets.find(sheet => preferred.some(name => rowText(sheet.rows?.[0] || []).includes(name)))
        || sheets.find(sheet => findHeaderIndex(sheet.rows || [], headerKeywords) >= 0)
        || sheets[0]
}

export function objectsFromRows(rows = [], { headerKeywords = [] } = {}) {
    const headerIndex = findHeaderIndex(rows, headerKeywords)
    if (headerIndex < 0) return []
    const headers = rows[headerIndex] || []
    const body = rows.slice(headerIndex + 1)
    const keys = headers.map(normalizeImportKey)
    return body.map(cells => {
        const row = {}
        keys.forEach((key, index) => { row[key] = cells[index] ?? '' })
        return row
    }).filter(row => Object.values(row).some(value => String(value ?? '').trim()))
}

export async function readObjectsFromTable(file, options = {}) {
    const lowerName = file.name.toLowerCase()
    if (lowerName.endsWith('.csv')) return objectsFromRows(await readTabularRows(file), options)
    const sheets = await readWorkbookTables(file)
    const sheet = chooseSheet(sheets, options.preferredSheetNames, options.headerKeywords)
    return objectsFromRows(sheet?.rows || [], options)
}
