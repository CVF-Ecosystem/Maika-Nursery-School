const SHELL_CACHE = 'maika-shell-v2'
const DATA_CACHE = 'maika-data-v1'
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg', '/favicon.svg']

// Data cache TTLs (ms)
const ATTENDANCE_TTL = 7 * 24 * 60 * 60 * 1000
const REPORTS_TTL = 7 * 24 * 60 * 60 * 1000
const NOTIFICATIONS_TTL = 30 * 24 * 60 * 60 * 1000

function isCacheableSupabaseRequest(url) {
  try {
    const u = new URL(url)
    if (!u.hostname.includes('supabase')) return false
    const path = u.pathname
    if (path.includes('/rest/v1/attendance')) return { ttl: ATTENDANCE_TTL }
    if (path.includes('/rest/v1/daily_reports')) return { ttl: REPORTS_TTL }
    if (path.includes('/rest/v1/notifications')) return { ttl: NOTIFICATIONS_TTL }
    return false
  } catch { return false }
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== SHELL_CACHE && key !== DATA_CACHE).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('push', event => {
  let data = { title: 'Maika', body: '' }
  try { data = event.data?.json() || data } catch { /* ignore */ }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icon.svg',
      badge: '/favicon.svg',
      tag: data.tag || 'maika-push',
      renotify: true,
      data: { url: data.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = request.url
  const isOwnOrigin = new URL(url).origin === self.location.origin

  // App shell: network-first with cache fallback
  if (isOwnOrigin) {
    if (request.mode === 'navigate') {
      event.respondWith(
        fetch(request)
          .then(response => {
            const clone = response.clone()
            caches.open(SHELL_CACHE).then(cache => cache.put('/index.html', clone))
            return response
          })
          .catch(() => caches.match('/index.html'))
      )
      return
    }
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(response => {
        const clone = response.clone()
        caches.open(SHELL_CACHE).then(cache => cache.put(request, clone))
        return response
      }))
    )
    return
  }

  // Supabase read data: stale-while-revalidate with TTL
  const cacheConfig = isCacheableSupabaseRequest(url)
  if (cacheConfig) {
    event.respondWith(
      caches.open(DATA_CACHE).then(async cache => {
        const cached = await cache.match(request)
        const now = Date.now()

        if (cached) {
          const cachedTime = Number(cached.headers.get('x-sw-cached-at') || 0)
          const isExpired = now - cachedTime > cacheConfig.ttl
          if (!isExpired) return cached
        }

        try {
          const response = await fetch(request)
          if (response.ok) {
            const headers = new Headers(response.headers)
            headers.set('x-sw-cached-at', String(now))
            const blob = await response.blob()
            const cachedResponse = new Response(blob, { status: response.status, headers })
            cache.put(request, cachedResponse.clone())
            return new Response(blob, { status: response.status, headers: response.headers })
          }
          return response
        } catch {
          return cached || new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } })
        }
      })
    )
  }
})
