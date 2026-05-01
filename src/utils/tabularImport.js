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
    const { default: readXlsxFile } = await import('read-excel-file/browser')
    return readXlsxFile(file)
}

export async function readObjectsFromTable(file) {
    const table = await readTabularRows(file)
    const [headers = [], ...body] = table
    const keys = headers.map(normalizeImportKey)
    return body.map(cells => {
        const row = {}
        keys.forEach((key, index) => { row[key] = cells[index] ?? '' })
        return row
    })
}
