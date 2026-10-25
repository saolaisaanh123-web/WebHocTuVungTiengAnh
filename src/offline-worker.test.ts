import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const scope = "https://example.test/jeongyeon/";
function worker() {
  const data = new Map<string, Response>();
  const legacy = new Map<string, Response>();
  const prefix = "jeongyeon-offline:%2Fjeongyeon%2F:";
  const stores = new Map<string, Map<string, Response>>([
    [`${prefix}v2`, data],
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
    fetch: async () => {
      if (!online) throw Error("offline");
      return new Response("/* public asset */");
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
    clients,
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
    async request(url: string, headers: Record<string, string> = {}) {
      online = false;
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
  it("keeps old-tab assets across a v1-to-v2 activation without migrating private responses or stale content", async () => {
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
