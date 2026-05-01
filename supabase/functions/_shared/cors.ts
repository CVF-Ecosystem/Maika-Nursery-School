const allowedOrigins = new Set([
    'https://maikaschool.netlify.app',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
])

function isAllowedNetlifyPreview(origin: string) {
    try {
        const host = new URL(origin).hostname
        return host.endsWith('.netlify.app')
    } catch {
        return false
    }
}

export function corsHeadersFor(request: Request) {
    const origin = request.headers.get('Origin') || ''
    const allowOrigin = allowedOrigins.has(origin) || isAllowedNetlifyPreview(origin)
        ? origin
        : 'https://maikaschool.netlify.app'

    return {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Vary': 'Origin',
    }
}
