const API_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '')

export function hasBackendAPI() {
    return Boolean(API_URL)
}

export async function loginWithBackend(credentials) {
    if (!API_URL) return null

    const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
    })

    if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'Đăng nhập không thành công.')
    }

    return response.json()
}
