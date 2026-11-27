/* Service worker: makes "Install app" appear in Chrome. It does NOT cache anything –
   every page and file always comes fresh from the internet, so updates show up at once. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== self.location.origin || r.mode !== "navigate") return;   // everything else: browser as usual
  e.respondWith(fetch(r).catch(() => new Response(
    '<!doctype html><meta name="viewport" content="width=device-width"><body style="font-family:system-ui;padding:40px;text-align:center;background:#eef2f1;color:#17312e"><h2>No internet</h2><p>Family Prayers needs the internet. Connect and try again.</p></body>',
    { headers: { "Content-Type": "text/html; charset=utf-8" } })));
});
