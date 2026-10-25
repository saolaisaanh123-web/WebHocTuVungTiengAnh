/* Jeongyeon offline shell. Learner records stay in IndexedDB, never here. */
const scope = new URL(self.registration.scope);
const prefix = `jeongyeon-offline:${encodeURIComponent(scope.pathname)}:`;
const cacheName = `${prefix}v2`;
const shellURL = scope.href;
const corpusURL = new URL("data/vocabulary.txt", scope).href;
const manifestURL = new URL("data/vocabulary-version.json", scope).href;

function assetURL(value, base = scope) {
  try {
    const url = new URL(value, base);
    return url.origin === scope.origin &&
      !url.search &&
      !url.hash &&
      url.pathname.startsWith(`${scope.pathname}assets/`) &&
      /-[a-z0-9_-]{6,}\.(?:js|css|woff2?|ttf|otf|png|jpe?g|webp|avif|svg|ico)$/i.test(
        url.pathname,
      )
      ? url.href
      : null;
  } catch {
    return null;
  }
}
function shellAssets(html) {
  const urls = new Set();
  for (const match of html.matchAll(
    /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi,
  )) {
    const url = assetURL(match[1]);
    if (url) urls.add(url);
  }
  return [...urls];
}
function cssAssets(css, base) {
  const urls = new Set();
  for (const match of css.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/gi)) {
    const url = assetURL(match[1], base);
    if (url) urls.add(url);
  }
  return [...urls];
}
function publicFetch(url) {
  return fetch(url, {
    cache: "no-store",
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
}
function usable(response) {
  return response.ok && response.type !== "opaque";
}
async function readManifest(response) {
  if (!usable(response)) throw Error("Vocabulary manifest unavailable");
  const data = await response.clone().json();
  if (
    !/^[a-f0-9]{64}$/.test(data.version) ||
    !Number.isInteger(data.entryCount) ||
    data.entryCount < 1 ||
    !Number.isInteger(data.bytes) ||
    data.bytes < 1 ||
    data.bytes > 32 * 1024 * 1024
  )
    throw Error("Invalid vocabulary manifest");
  return data;
}
async function verifyCorpus(corpus, manifest) {
  if (!usable(corpus)) throw Error("Vocabulary unavailable");
  const bytes = await corpus.clone().arrayBuffer();
  if (bytes.byteLength !== manifest.bytes) throw Error("Incomplete vocabulary");
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  if (
    hash !== manifest.version ||
    (new TextDecoder().decode(bytes).match(/^id: /gm) || []).length !==
      manifest.entryCount
  )
    throw Error("Vocabulary version mismatch");
}

// Cache assets before the matching HTML, so an interrupted update can still
// reload the previous shell. Only same-origin assets inside this app's scope.
let shellWork = Promise.resolve();
function cacheShell(response, replacingClients = []) {
  // Concurrent navigations must not prune each other's in-progress assets.
  const pending = shellWork.then(() => storeShell(response, replacingClients));
  shellWork = pending.catch(() => {});
  return pending;
}
async function storeShell(response, replacingClients) {
  if (!usable(response)) throw Error("Application unavailable");
  const html = await response.clone().text();
  if (!html.includes("Jeongyeon") || !/id=["']root["']/.test(html))
    throw Error("Invalid application shell");
  const assets = shellAssets(html);
  if (!assets.some((url) => url.endsWith(".js")))
    throw Error("Application JavaScript missing");
  const cache = await caches.open(cacheName);
  const pending = [...assets];
  const visited = new Set();
  while (pending.length) {
    const url = pending.shift();
    if (visited.has(url)) continue;
    visited.add(url);
    let asset = await cache.match(url);
    if (!asset) asset = await publicFetch(url);
    if (!usable(asset)) throw Error("Application asset unavailable");
    if (url.endsWith(".css"))
      pending.push(...cssAssets(await asset.clone().text(), url));
    await cache.put(url, asset);
  }
  await cache.put(shellURL, response);
  // An old tab can still request a lazy asset after a new shell is published.
  // Only prune when every app window is the document this navigation replaces,
  // or when no app windows remain (installation). Never touch learner storage.
  try {
    const clients = await self.clients.matchAll({
      includeUncontrolled: true,
      type: "window",
    });
    const otherApp = clients.some((client) => {
      const url = new URL(client.url);
      return (
        url.origin === scope.origin &&
        url.pathname.startsWith(scope.pathname) &&
        !replacingClients.includes(client.id)
      );
    });
    if (!otherApp)
      for (const request of await cache.keys()) {
        const url = assetURL(request.url);
        if (url && !visited.has(url)) await cache.delete(request);
      }
  } catch {
    // Retain assets when client enumeration is unavailable or races a window.
  }
}
async function cacheCorpus(corpusResponse, manifestResponse) {
  const manifest = await readManifest(manifestResponse);
  await verifyCorpus(corpusResponse, manifest);
  const cache = await caches.open(cacheName);
  await cache.put(corpusURL, corpusResponse);
  await cache.put(manifestURL, manifestResponse);
}
async function prepare() {
  const [shell, corpus, manifest] = await Promise.all([
    publicFetch(shellURL),
    publicFetch(corpusURL),
    publicFetch(manifestURL),
  ]);
  await cacheShell(shell);
  await cacheCorpus(corpus, manifest);
}
async function isReady() {
  try {
    const cache = await caches.open(cacheName);
    const [shell, corpus, manifestResponse] = await Promise.all([
      cache.match(shellURL),
      cache.match(corpusURL),
      cache.match(manifestURL),
    ]);
    if (!shell || !corpus || !manifestResponse) return false;
    await verifyCorpus(corpus, await readManifest(manifestResponse));
    const pending = shellAssets(await shell.text());
    const seen = new Set();
    while (pending.length) {
      const url = pending.shift();
      if (seen.has(url)) continue;
      seen.add(url);
      const response = await cache.match(url);
      if (!response) return false;
      if (url.endsWith(".css"))
        pending.push(...cssAssets(await response.text(), url));
    }
    return true;
  } catch {
    return false;
  }
}
async function notify(target) {
  const message = {
    type: "jeongyeon-offline-status",
    available: await isReady(),
  };
  if (target) target.postMessage(message);
  else
    for (const client of await self.clients.matchAll({
      includeUncontrolled: true,
    }))
      if (client.url.startsWith(scope.href)) client.postMessage(message);
}

self.addEventListener("install", (event) => {
  event.waitUntil(prepare());
  // Wait for old tabs to close. Never silently replace an active application.
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const current = await caches.open(cacheName);
      for (const key of await caches.keys()) {
        if (!key.startsWith(prefix) || key === cacheName) continue;
        // Normally activation waits for old controlled tabs to close. Retain
        // their public hashed assets as well for uncontrolled-window races.
        // Never migrate an old HTML/corpus pair or arbitrary/private requests.
        const old = await caches.open(key);
        for (const request of await old.keys()) {
          const url = assetURL(request.url);
          if (!url || (await current.match(url))) continue;
          const response = await old.match(request);
          if (response && usable(response)) await current.put(url, response);
        }
        await caches.delete(key);
      }
      await self.clients.claim();
      await notify();
    })(),
  );
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "jeongyeon-offline-status")
    event.waitUntil(notify(event.source));
});

async function cachedOrError(url) {
  const cached = await (await caches.open(cacheName)).match(url);
  return cached || Response.error();
}
async function htmlFirst(request, event) {
  try {
    const response = await fetch(request);
    if (!usable(response)) return cachedOrError(shellURL);
    event.waitUntil(
      cacheShell(
        response.clone(),
        [event.clientId, event.resultingClientId].filter(Boolean),
      ).catch(() => {}),
    );
    return response;
  } catch {
    return cachedOrError(shellURL);
  }
}
async function vocabularyFirst(request, event) {
  try {
    const response = await fetch(request);
    if (!usable(response)) return cachedOrError(request.url);
    if (request.url === corpusURL)
      event.waitUntil(
        publicFetch(manifestURL)
          .then((manifest) => cacheCorpus(response.clone(), manifest))
          .then(() => notify())
          .catch(() => {}),
      );
    // The manifest is saved together with a verified corpus, never on its own.
    return response;
  } catch {
    return cachedOrError(request.url);
  }
}
async function assetFirst(request) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request.url);
  if (cached) return cached;
  const response = await fetch(request);
  if (usable(response)) await cache.put(request.url, response.clone());
  return response;
}
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (
    request.method !== "GET" ||
    request.headers.has("authorization") ||
    request.headers.has("range")
  )
    return;
  const url = new URL(request.url);
  if (url.origin !== scope.origin) return;
  // Only harmless public bookmark parameters may use the canonical app shell.
  // Auth callbacks and unknown/private query strings still bypass this worker.
  const publicNavigationQuery = [...url.searchParams.keys()].every((key) =>
    /^utm_(?:source|medium|campaign|term|content|id)$/i.test(key),
  );
  if (
    request.mode === "navigate" &&
    publicNavigationQuery &&
    (url.pathname === scope.pathname ||
      url.pathname === new URL("index.html", scope).pathname)
  )
    event.respondWith(htmlFirst(request, event));
  else if (!url.search && (url.href === corpusURL || url.href === manifestURL))
    event.respondWith(vocabularyFirst(request, event));
  else if (assetURL(url.href)) event.respondWith(assetFirst(request));
});
