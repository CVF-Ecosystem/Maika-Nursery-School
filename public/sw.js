const CACHE_NAME = 'maika-shell-v1'
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg', '/favicon.svg']

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
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
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put('/index.html', clone))
          return response
        })
        .catch(() => caches.match('/index.html'))
    )
    return
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      const clone = response.clone()
      caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
      return response
    }))
  )
})
