import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const scope = "https://example.test/jeongyeon/";
function worker() {
  const data = new Map<string, Response>();
  const legacy = new Map<string, Response>();
  const previous = new Map<string, Response>();
  const network = new Map<string, Response>();
  let failedWrite: ((url: string) => boolean) | undefined;
  const prefix = "jeongyeon-offline:%2Fjeongyeon%2F:";
  const stores = new Map<string, Map<string, Response>>([
    [`${prefix}v3`, data],
    [`${prefix}v2`, previous],
    [`${prefix}v1`, legacy],
  ]);
  const handlers: Record<string, (event: unknown) => void> = {};
  const clients: { id: string; url: string }[] = [];
  const key = (value: string | { url: string }) =>
    typeof value === "string" ? value : value.url;
  const cache = (data: Map<string, Response>) => ({
    async match(value: string | { url: string }) {
      return data.get(key(value))?.clone();
    },
    async put(value: string | { url: string }, response: Response) {
      if (failedWrite?.(key(value)))
        throw new Error("QuotaExceededError: injected cache write failure");
      data.set(key(value), response.clone());
    },
    async keys() {
      return [...data.keys()].map((url) => ({ url }));
    },
    async delete(value: string | { url: string }) {
      return data.delete(key(value));
    },
  });
  let online = true;
  const context = vm.createContext({
    URL,
    Response,
    Headers,
    TextDecoder,
    crypto,
    Uint8Array,
    Set,
    Error,
    caches: {
      async open(name: string) {
        if (!stores.has(name)) stores.set(name, new Map());
        return cache(stores.get(name)!);
      },
      async keys() {
        return [...stores.keys()];
      },
      async delete(name: string) {
        return stores.delete(name);
      },
    },
    fetch: async (value: string | { url: string }) => {
      if (!online) throw Error("offline");
      return (
        network.get(key(value))?.clone() || new Response("/* public asset */")
      );
    },
    self: {
      registration: { scope },
      addEventListener(name: string, handler: (event: unknown) => void) {
        handlers[name] = handler;
      },
      clients: {
        async matchAll() {
          return clients.map((client) => ({ ...client, postMessage() {} }));
        },
        async claim() {},
      },
    },
  });
  vm.runInContext(
    readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"),
    context,
  );
  return {
    data,
    legacy,
    previous,
    network,
    stores,
    clients,
    failWrites(test?: (url: string) => boolean) {
      failedWrite = test;
    },
    async corpus(body: string, manifestBody = body) {
      context.corpus = new Response(body);
      context.manifest = manifestResponse(manifestBody);
      await vm.runInContext("cacheCorpus(corpus, manifest)", context);
    },
    async ready() {
      return vm.runInContext("isReady()", context);
    },
    async activate() {
      let pending: Promise<unknown> | undefined;
      handlers.activate({
        waitUntil(value: Promise<unknown>) {
          pending = value;
        },
      });
      await pending;
    },
    async shell(hash: string, replacing: string[] = []) {
      context.response = new Response(
        `<title>Jeongyeon</title><div id="root"></div><script src="./assets/index-${hash}.js"></script>`,
      );
      context.replacing = replacing;
      await vm.runInContext("cacheShell(response, replacing)", context);
    },
    async request(
      url: string,
      headers: Record<string, string> = {},
      onlineRequest = false,
    ) {
      online = onlineRequest;
      let response: Promise<Response> | undefined;
      const pending: Promise<unknown>[] = [];
      handlers.fetch({
        request: {
          method: "GET",
          mode: "navigate",
          url,
          headers: new Headers(headers),
        },
        respondWith(value: Promise<Response>) {
          response = value;
        },
        waitUntil(value: Promise<unknown>) {
          pending.push(value);
        },
      });
      const result = await response;
      await Promise.all(pending);
      return result;
    },
  };
}

const corpusURL = `${scope}data/vocabulary.txt`;
const manifestURL = `${scope}data/vocabulary-version.json`;
const oldBody = "id: old-01\nword: old\nmeaning_vi: cũ\n";
const newBody = "id: new-01\nword: new\nmeaning_vi: mới\n";
function manifestResponse(body: string) {
  return new Response(
    JSON.stringify({
      version: createHash("sha256").update(body).digest("hex"),
      entryCount: (body.match(/^id: /gm) || []).length,
      bytes: Buffer.byteLength(body),
    }),
  );
}
async function expectOfflinePair(w: ReturnType<typeof worker>, body: string) {
  expect(await (await w.request(corpusURL))?.text()).toBe(body);
  expect(await (await w.request(manifestURL))?.json()).toEqual(
    await manifestResponse(body).json(),
  );
  expect(await w.ready()).toBe(true);
}

describe("offline public navigation and asset retirement", () => {
  it("serves an offline UTM bookmark from the canonical shell without caching the query", async () => {
    const w = worker();
    await w.shell("aaaaaa");
    const response = await w.request(
      `${scope}?utm_source=bookmark&utm_campaign=review`,
    );
    expect(await response?.text()).toContain("Jeongyeon");
    expect([...w.data.keys()].some((url) => new URL(url).search)).toBe(false);
  });

  it.each([
    `${scope}?access_token=secret`,
    `${scope}?code=private-pkce-code`,
    `${scope}?utm_source=bookmark&account=private`,
    `${scope}?private-test=1`,
    `${scope}private-sync?utm_source=bookmark`,
    `https://other.test/?utm_source=bookmark`,
  ])(
    "does not intercept auth, private or out-of-scope navigation: %s",
    async (url) => {
      const w = worker();
      await w.shell("aaaaaa");
      expect(await w.request(url)).toBeUndefined();
    },
  );

  it("keeps authenticated and range requests out of the offline cache", async () => {
    const w = worker();
    await w.shell("aaaaaa");
    expect(
      await w.request(scope, { authorization: "Bearer private" }),
    ).toBeUndefined();
    expect(await w.request(scope, { range: "bytes=0-100" })).toBeUndefined();
  });

  it("retires obsolete hashes when no old app window still needs them", async () => {
    const w = worker();
    for (const hash of ["aaaaaa", "bbbbbb", "cccccc"]) await w.shell(hash);
    expect([...w.data.keys()].sort()).toEqual(
      [scope, `${scope}assets/index-cccccc.js`].sort(),
    );
  });

  it("preserves assets for another open app tab and prunes only after it closes", async () => {
    const w = worker();
    await w.shell("aaaaaa");
    w.clients.push({ id: "old", url: scope }, { id: "new", url: scope });
    await w.shell("bbbbbb", ["new"]);
    expect(w.data.has(`${scope}assets/index-aaaaaa.js`)).toBe(true);
    w.clients.splice(0, 1);
    await w.shell("bbbbbb", ["new"]);
    expect(w.data.has(`${scope}assets/index-aaaaaa.js`)).toBe(false);
    expect(w.data.has(`${scope}assets/index-bbbbbb.js`)).toBe(true);
  });
  it("keeps old-tab assets across a v1-to-v3 activation without migrating private responses or stale content", async () => {
    const w = worker();
    await w.shell("bbbbbb");
    w.legacy.set(
      `${scope}assets/index-aaaaaa.js`,
      new Response("old public script"),
    );
    w.legacy.set(
      `${scope}assets/private-aaaaaa.js?token=secret`,
      new Response("private"),
    );
    w.legacy.set(`${scope}data/vocabulary.txt`, new Response("stale corpus"));
    w.legacy.set(scope, new Response("stale shell"));
    w.clients.push({ id: "old", url: scope }, { id: "new", url: scope });
    await w.activate();
    expect(
      await (await w.request(`${scope}assets/index-aaaaaa.js`))?.text(),
    ).toBe("old public script");
    expect(w.data.has(`${scope}assets/private-aaaaaa.js?token=secret`)).toBe(
      false,
    );
    expect(w.data.has(`${scope}data/vocabulary.txt`)).toBe(false);
    expect(await w.data.get(scope)?.clone().text()).toContain(
      "index-bbbbbb.js",
    );
    await w.shell("bbbbbb", ["new"]);
    expect(w.data.has(`${scope}assets/index-aaaaaa.js`)).toBe(true);
    w.clients.splice(0, 1);
    await w.shell("bbbbbb", ["new"]);
    expect(w.data.has(`${scope}assets/index-aaaaaa.js`)).toBe(false);
  });
});

describe("atomic offline vocabulary updates", () => {
  it("publishes a verified body and manifest with one replacement write", async () => {
    const w = worker();
    await w.shell("aaaaaa");
    await w.corpus(oldBody);
    await expectOfflinePair(w, oldBody);
    // The old second-write failure is impossible: no separate manifest entry
    // is published. A healthy replacement exposes the complete new pair.
    w.failWrites((url) => url === manifestURL);
    await w.corpus(newBody);
    await expectOfflinePair(w, newBody);
    expect(w.data.has(manifestURL)).toBe(false);
  });

  it("keeps the complete last-good version when replacing the cache entry fails", async () => {
    const w = worker();
    await w.shell("aaaaaa");
    await w.corpus(oldBody);
    w.failWrites((url) => url === corpusURL);
    await expect(w.corpus(newBody)).rejects.toThrow("QuotaExceededError");
    await expectOfflinePair(w, oldBody);
  });

  it("does not claim first-time offline readiness after a failed cache write", async () => {
    const w = worker();
    await w.shell("aaaaaa");
    w.failWrites((url) => url === corpusURL);
    await expect(w.corpus(newBody)).rejects.toThrow("QuotaExceededError");
    expect(await w.ready()).toBe(false);
    expect((await w.request(corpusURL))?.type).toBe("error");
    expect((await w.request(manifestURL))?.type).toBe("error");
  });

  it.each([
    ["a mismatched body and manifest", newBody, oldBody],
    ["an incomplete body", newBody.slice(0, -1), newBody],
  ])(
    "retains the last-good version after %s",
    async (_, body, manifestBody) => {
      const w = worker();
      await w.shell("aaaaaa");
      await w.corpus(oldBody);
      await expect(w.corpus(body, manifestBody)).rejects.toThrow();
      await expectOfflinePair(w, oldBody);
    },
  );

  it("updates the offline pair after a successful verified network refresh", async () => {
    const w = worker();
    await w.shell("aaaaaa");
    await w.corpus(oldBody);
    w.network.set(corpusURL, new Response(newBody));
    w.network.set(manifestURL, manifestResponse(newBody));
    expect(await (await w.request(corpusURL, {}, true))?.text()).toBe(newBody);
    await expectOfflinePair(w, newBody);
  });

  it("retains the last-good pair when a network update has an unavailable manifest", async () => {
    const w = worker();
    await w.shell("aaaaaa");
    await w.corpus(oldBody);
    w.network.set(corpusURL, new Response(newBody));
    w.network.set(manifestURL, new Response("unavailable", { status: 503 }));
    expect(await (await w.request(corpusURL, {}, true))?.text()).toBe(newBody);
    await expectOfflinePair(w, oldBody);
  });

  it("migrates only a verified complete v2 pair into the atomic entry", async () => {
    const w = worker();
    await w.shell("aaaaaa");
    w.previous.set(corpusURL, new Response(oldBody));
    w.previous.set(manifestURL, manifestResponse(oldBody));
    await w.activate();
    expect(w.data.has(corpusURL)).toBe(true);
    expect(w.data.has(manifestURL)).toBe(false);
    expect(w.stores.has("jeongyeon-offline:%2Fjeongyeon%2F:v2")).toBe(false);
    await expectOfflinePair(w, oldBody);
  });

  it("keeps a verified v2 pair usable if quota blocks migration while offline", async () => {
    const w = worker();
    await w.shell("aaaaaa");
    w.previous.set(corpusURL, new Response(oldBody));
    w.previous.set(manifestURL, manifestResponse(oldBody));
    w.failWrites((url) => url === corpusURL);
    await w.activate();
    expect(w.stores.has("jeongyeon-offline:%2Fjeongyeon%2F:v2")).toBe(true);
    await expectOfflinePair(w, oldBody);
  });

  it("does not modify the v2 pair while an old app tab can still use it", async () => {
    const w = worker();
    await w.shell("aaaaaa");
    w.previous.set(corpusURL, new Response(oldBody));
    w.previous.set(manifestURL, manifestResponse(oldBody));
    w.clients.push({ id: "old", url: scope });
    await w.activate();
    await w.corpus(newBody);
    await expectOfflinePair(w, newBody);
    expect(w.stores.has("jeongyeon-offline:%2Fjeongyeon%2F:v2")).toBe(true);
    expect(await w.previous.get(corpusURL)?.clone().text()).toBe(oldBody);
    expect(await w.previous.get(manifestURL)?.clone().json()).toEqual(
      await manifestResponse(oldBody).json(),
    );
  });

  it("rejects a partial or mismatched old pair instead of claiming readiness", async () => {
    const w = worker();
    await w.shell("aaaaaa");
    w.previous.set(corpusURL, new Response(newBody));
    w.previous.set(manifestURL, manifestResponse(oldBody));
    await w.activate();
    expect(await w.ready()).toBe(false);
    expect(w.data.has(corpusURL)).toBe(false);
    expect((await w.request(corpusURL))?.type).toBe("error");
  });
});
