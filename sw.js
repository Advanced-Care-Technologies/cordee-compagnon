// Keeps the application itself available without network. Data never goes through here: GitHub is not cached.
// v3: the icon became Nodi's face (1.19); a new name makes every phone fetch it again.
const CACHE = 'cordee-compagnon-v3'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['./', './index.html', './manifest.webmanifest', './icon-512.png'])))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  // The page itself: the newest when online, the last one seen otherwise.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy))
          return response
        })
        .catch(() => caches.match('./index.html'))
    )
    return
  }
  // Built files carry their content's hash in their name: once fetched, they never change.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
    )
  )
})

// A notification sent by a computer of the team. The browser has already opened it: only this phone could.
self.addEventListener('push', (event) => {
  let payload = { title: 'Cordée', body: 'Du nouveau dans votre espace.' }
  try {
    payload = { ...payload, ...event.data.json() }
  } catch {
    // Unreadable: the generic words are shown, the person opens the application.
  }
  const target = payload.taskId ? `tache:${payload.taskId}` : payload.projectId ? `projet:${payload.projectId}` : ''
  event.waitUntil(
    self.registration.showNotification(String(payload.title).slice(0, 120), {
      body: String(payload.body ?? '').slice(0, 300),
      icon: './icon-512.png',
      badge: './icon-512.png',
      tag: String(payload.tag ?? target ?? 'cordee'),
      data: { ouvrir: target },
      lang: 'fr'
    })
  )
})

// A tap on the notification: the application, open on what it was about.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const ouvrir = event.notification.data?.ouvrir ?? ''
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => new URL(client.url).pathname.startsWith(new URL(self.registration.scope).pathname))
      if (open) {
        if (ouvrir) open.postMessage({ ouvrir })
        return open.focus()
      }
      const url = new URL(self.registration.scope)
      if (ouvrir) url.searchParams.set('ouvrir', ouvrir)
      return self.clients.openWindow(url.href)
    })
  )
})
