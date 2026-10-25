import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  contentKey,
  empty,
  merge,
  parse,
  type Result,
  type State,
} from "./core";
import type { ConversationAttempt, WritingAttempt } from "./practice-data";
import {
  bindSyncAccount,
  clearSyncBinding,
  cloudPayload,
  compareAndSwapCloud,
  decodeCloudPayload,
  encodeCloudPayload,
  fetchCloud,
  getAuthSession,
  mergeCloudState,
  requestEmailCode,
  safeSupabase,
  setServiceConfig,
  signOutLocal,
  syncAccount,
  validateServiceConfig,
} from "./sync";

const key = "sb_publishable_1234567890abcdefghijklmnopqrstuv";
const sample = (): State => ({
  ...empty(),
  entries: {
    word: {
      word: {
        id: "word",
        word: "suggest",
        meaning_vi: "đề nghị",
        example_en: "I suggest leaving early.",
        example_vi: "Tôi đề nghị đi sớm.",
      },
      origin: "personal",
      archived: false,
    },
  },
});
const result = (id: string, time = 100): Result => ({
  id,
  wordId: "word",
  time,
  skill: 1,
  answer: "suggest",
  correct: true,
  hint: false,
  method: "rule",
  elapsed: 300,
  session: id,
  review: id,
  gap: 0,
  first: true,
});
const memory = new Map<string, string>();
async function gzipEnvelope(value: unknown) {
  const raw = new TextEncoder().encode(JSON.stringify(value));
  const bytes = new Uint8Array(
    await new Response(
      new Blob([raw]).stream().pipeThrough(new CompressionStream("gzip")),
    ).arrayBuffer(),
  );
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return {
    transport: "jeongyeon-gzip-v1",
    uncompressedBytes: raw.length,
    data: btoa(binary),
  };
}
function authenticate(id = "account-a") {
  memory.set(
    "jeongyeon-auth",
    JSON.stringify({
      access_token: `token-${id}`,
      refresh_token: "refresh",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id, email: `${id}@example.com` },
    }),
  );
}
beforeEach(() => {
  memory.clear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => memory.get(k) || null,
    setItem: (k: string, v: string) => memory.set(k, v),
    removeItem: (k: string) => memory.delete(k),
  });
  vi.stubGlobal("navigator", { onLine: true });
  setServiceConfig({ url: "https://project.supabase.co", anonKey: key });
});
afterEach(() => {
  signOutLocal();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("non-destructive cloud merge", () => {
  it("unions independent offline histories without migrating another device's live session", () => {
    const base = sample(),
      local = structuredClone(base),
      remote = structuredClone(base);
    local.history.push(result("l", 200));
    remote.history.push(result("r", 100));
    local.session = {
      id: "local-session",
      queue: [],
      index: 0,
      started: 1,
      scheduled: false,
      count: 0,
    };
    remote.session = {
      id: "remote-session",
      queue: [],
      index: 0,
      started: 1,
      scheduled: false,
      count: 0,
    };
    const merged = mergeCloudState(base, local, remote);
    expect(merged.conflicts).toEqual([]);
    expect(merged.state.history.map((r) => r.id)).toEqual(["r", "l"]);
    expect(merged.state.session?.id).toBe("local-session");
    expect(cloudPayload(merged.state).session).toBeUndefined();
    expect(local.history).toHaveLength(1);
  });
  it("blocks immutable ID collisions instead of replacing an answer or fabricating evidence", () => {
    const local = sample(),
      remote = sample();
    local.history = [result("same")];
    remote.history = [{ ...result("same"), correct: false }];
    const merged = mergeCloudState(undefined, local, remote, {
      "history.same": "remote",
    });
    expect(merged.conflicts).toMatchObject([
      { path: "history.same", immutable: true },
    ]);
    expect(local.history[0].correct).toBe(true);
    expect(remote.history[0].correct).toBe(false);
  });
  it("merges distinct fields but asks for a real same-field edit and honors explicit choice", () => {
    const base = sample(),
      local = structuredClone(base),
      remote = structuredClone(base);
    local.entries.word.notes = "local note";
    remote.entries.word.goal = "active";
    local.daily = 7;
    remote.daily = 9;
    local.entries.word.word.meaning_vi = "đề xuất";
    remote.entries.word.word.meaning_vi = "gợi ý";
    const first = mergeCloudState(base, local, remote);
    expect(first.state.entries.word.notes).toBe("local note");
    expect(first.state.entries.word.goal).toBe("active");
    expect(first.conflicts.map((c) => c.path)).toEqual([
      "entries.word.word.meaning_vi",
      "daily",
    ]);
    const resolved = mergeCloudState(base, local, remote, {
      "entries.word.word.meaning_vi": "remote",
      daily: "local",
    });
    expect(resolved.conflicts).toEqual([]);
    expect(resolved.state.entries.word.word.meaning_vi).toBe("gợi ý");
    expect(resolved.state.daily).toBe(7);
  });
  it("keeps weak concurrent reviews due sooner; respects an uncontested content reset", () => {
    const base = sample(),
      local = sample(),
      remote = sample();
    base.schedules["word:1"] = { due: 100, last: 10, step: 2 };
    local.schedules["word:1"] = { due: 900, last: 20, step: 4 };
    remote.schedules["word:1"] = { due: 200, last: 30, step: 0 };
    expect(
      mergeCloudState(base, local, remote).state.schedules["word:1"],
    ).toEqual({ due: 200, last: 30, step: 0 });
    remote.schedules = structuredClone(base.schedules);
    local.schedules = {};
    expect(mergeCloudState(base, local, remote).state.schedules).toEqual({});
  });
  it("never removes vocabulary referenced by another device and discards schedules for a different meaning", () => {
    const base = sample(),
      local = sample(),
      remote = sample();
    remote.history = [result("saved")];
    delete local.entries.word;
    const retained = mergeCloudState(base, local, remote);
    expect(retained.state.entries.word).toBeDefined();
    expect(retained.state.history).toHaveLength(1);
    local.entries = structuredClone(base.entries);
    local.entries.word.word.meaning_vi = "nghĩa mới";
    remote.schedules["word:1"] = { due: 900, last: 200, step: 4 };
    expect(
      mergeCloudState(base, local, remote).state.schedules["word:1"],
    ).toBeUndefined();
  });
  it("keeps divergent valid reviews due no earlier than their combined last timestamp", async () => {
    const base = sample(),
      local = sample(),
      remote = sample();
    local.schedules["word:1"] = { due: 20, last: 10, step: 1 };
    remote.schedules["word:1"] = { due: 200, last: 100, step: 3 };
    const merged = mergeCloudState(base, local, remote);
    expect(merged.state.schedules["word:1"]).toEqual({
      due: 100,
      last: 100,
      step: 1,
    });
    expect(
      (await decodeCloudPayload(await encodeCloudPayload(merged.state)))
        .schedules,
    ).toEqual(merged.state.schedules);
  });
  it("unions writing/conversation evidence and reports, takes most recent exposure and earliest enrollment", () => {
    const local = sample() as State & Record<string, unknown>,
      remote = sample() as State & Record<string, unknown>;
    const written: WritingAttempt = {
      id: "w1",
      time: 20,
      wordId: "word",
      text: "I suggest leaving early.",
      source: "local",
      status: "ungraded",
      issues: [],
      summary: "Chưa thể chấm tự động",
      assessment: {
        grammar: "uncertain",
        usage: "uncertain",
        naturalness: "uncertain",
      },
      contentVersion: "v1",
    };
    const conversation: ConversationAttempt = {
      id: "c1",
      time: 10,
      dialogueId: "d1",
      dialogueVersion: "v1",
      targetIds: ["word"],
      targetContentVersions: { word: "v1" },
      answers: [],
      read: true,
      listenedLineIds: [],
      listenedComplete: false,
    };
    local.writing = [written];
    remote.writing = [{ ...written, id: "w2", time: 30 }];
    local.conversations = [conversation];
    remote.conversations = [{ ...conversation, id: "c2", time: 40 }];
    local.exposures = { word: 100 };
    remote.exposures = { word: 200 };
    local.entries.word.reports = ["one"];
    remote.entries.word.reports = ["two"];
    local.entries.word.enrolledAt = 100;
    remote.entries.word.enrolledAt = 200;
    const merged = mergeCloudState(undefined, local, remote);
    expect(merged.conflicts).toEqual([]);
    expect(merged.state.writing).toHaveLength(2);
    expect(merged.state.conversations).toHaveLength(2);
    expect(merged.state.exposures?.word).toBe(200);
    expect(merged.state.entries.word.reports).toEqual(["one", "two"]);
    expect(merged.state.entries.word.enrolledAt).toBe(100);
  });

  it("unions separate writing drafts and requests a choice for competing edits of the same draft", () => {
    const base = sample(),
      local = sample(),
      remote = sample();
    const draft = {
      wordId: "word",
      text: "I suggest leaving early.",
      updatedAt: 100,
    };
    base.writingDrafts = { first: draft };
    local.writingDrafts = {
      first: { ...draft, text: "I suggest taking the train.", updatedAt: 200 },
      localOnly: { ...draft, parentId: "local-parent" },
    };
    remote.writingDrafts = {
      first: {
        ...draft,
        text: "I suggest bringing some water.",
        updatedAt: 300,
      },
      remoteOnly: { ...draft, parentId: "remote-parent" },
    };
    const merged = mergeCloudState(base, local, remote);
    expect(merged.state.writingDrafts?.localOnly).toEqual(
      local.writingDrafts.localOnly,
    );
    expect(merged.state.writingDrafts?.remoteOnly).toEqual(
      remote.writingDrafts.remoteOnly,
    );
    expect(merged.conflicts.map((conflict) => conflict.path)).toContain(
      "writingDrafts.first.text",
    );
    const choices = Object.fromEntries(
      merged.conflicts.map((conflict) => [conflict.path, "remote" as const]),
    );
    const resolved = mergeCloudState(base, local, remote, choices);
    expect(resolved.conflicts).toEqual([]);
    expect(resolved.state.writingDrafts?.first).toEqual(
      remote.writingDrafts.first,
    );
    expect(local.writingDrafts.first.text).toBe("I suggest taking the train.");
  });
});

describe("Supabase protocol and account boundaries", () => {
  it("roundtrips all current vocabulary IDs through the bounded compressed transport", async () => {
    const state = merge(
      empty(),
      parse(readFileSync("public/data/vocabulary.txt", "utf8")),
      "default",
    );
    const payload = await encodeCloudPayload(state);
    const restored = await decodeCloudPayload(payload);
    expect(Object.keys(restored.entries)).toEqual(Object.keys(state.entries));
    expect(restored.entries).toEqual(state.entries);
    expect(JSON.stringify(payload).length).toBeLessThan(
      JSON.stringify(state).length / 2,
    );
  });
  it("compresses and roundtrips UTF-8 data, accepts old snapshots and bounds invalid envelopes", async () => {
    const state = sample();
    state.entries.word.notes = "Tiếng Việt có dấu. ".repeat(1000);
    const encoded = await encodeCloudPayload(state);
    expect(JSON.stringify(encoded).length).toBeLessThan(
      JSON.stringify(state).length / 2,
    );
    expect(await decodeCloudPayload(encoded)).toEqual(cloudPayload(state));
    expect(await decodeCloudPayload(state)).toEqual(state);
    expect(await decodeCloudPayload(await gzipEnvelope(state))).toEqual(state);
    await expect(
      decodeCloudPayload({
        transport: "jeongyeon-gzip-v1",
        data: "",
        uncompressedBytes: 30_000_000,
      }),
    ).rejects.toThrow(/quá lớn/);
    if ("transport" in encoded)
      await expect(
        decodeCloudPayload({ ...encoded, uncompressedBytes: 1 }),
      ).rejects.toThrow(/kích thước/);
  });
  it("roundtrips the full corpus with twenty thousand answers/exposures beyond the former raw ceiling", async () => {
    const words = parse(
      readFileSync(
        new URL("../public/data/vocabulary.txt", import.meta.url),
        "utf8",
      ),
    );
    const state = merge(empty(), words, "default");
    state.entries[words[0].id].notes = "Ghi chú cá nhân cần giữ nguyên.";
    state.exposures = {};
    state.exposureEvents = [];
    for (let i = 0; i < 20_000; i++) {
      const word = words[i % words.length];
      const time = 1_792_915_200_000 + i;
      const id = `transport-history-${i}`;
      state.history.push({
        ...result(id, time),
        wordId: word.id,
        answer: word.word,
        contentVersion: contentKey(word, 1),
        evidenceVersion: 2,
        independent: true,
        exposureGap: 86_400_000,
        scheduled: true,
      });
      state.exposures[word.id] = time;
      state.exposureEvents.push({
        id: `transport-view-${i}`,
        wordId: word.id,
        time,
        resultId: id,
      });
    }
    expect(
      new TextEncoder().encode(JSON.stringify(cloudPayload(state))).length,
    ).toBeGreaterThan(20 * 1024 * 1024);
    const encoded = await encodeCloudPayload(state);
    expect("transport" in encoded).toBe(true);
    if ("transport" in encoded)
      expect(encoded.uncompressedBytes).toBeLessThan(20 * 1024 * 1024);
    const restored = await decodeCloudPayload(encoded);
    expect(restored).toEqual(cloudPayload(state));
    expect(restored.history).toHaveLength(20_000);
    expect(restored.exposureEvents).toHaveLength(20_000);
  }, 30_000);

  it.each([
    { strings: ["valid"], shapes: [], state: { s: 3 } },
    { strings: [], shapes: [["version", "version"]], state: { o: [0, 1, 1] } },
    { strings: [], shapes: [["version"]], state: { o: [0] } },
    { strings: [], shapes: [], state: { o: [-1] } },
    { strings: [], shapes: [], state: { unexpected: 1 } },
  ])(
    "rejects malformed compact references/shapes before restoring data",
    async (malformed) => {
      const encoded = await gzipEnvelope({
        format: "jeongyeon-compact-state-v1",
        ...malformed,
      });
      await expect(decodeCloudPayload(encoded)).rejects.toThrow(
        /rút gọn không hợp lệ/,
      );
    },
  );

  it("bounds dictionary expansion before constructing a large learner state", async () => {
    const encoded = await gzipEnvelope({
      format: "jeongyeon-compact-state-v1",
      strings: ["x".repeat(1024 * 1024)],
      shapes: [],
      state: Array.from({ length: 65 }, () => ({ s: 0 })),
    });
    await expect(decodeCloudPayload(encoded)).rejects.toThrow(
      /giải nén vượt giới hạn/,
    );
  });
  it("preserves literal marker-like objects, UTF-8 and dangerous-looking keys without changing prototypes", async () => {
    const state = sample() as State & Record<string, unknown>;
    state.entries.word.notes = "Nghĩa tiếng Việt: ‘gợi ý’ 📝 \ud800";
    state.extra = {
      s: 12,
      o: ["literal content"],
      nested: { constructor: "literal" },
    };
    Object.defineProperty(state.extra, "__proto__", {
      value: { polluted: "must stay an own property" },
      enumerable: true,
    });
    const restored = (await decodeCloudPayload(
      await encodeCloudPayload(state),
    )) as State & Record<string, unknown>;
    expect(restored).toEqual(cloudPayload(state));
    expect(Object.getPrototypeOf(restored.extra)).toBe(Object.prototype);
    expect(Object.hasOwn(restored.extra as object, "__proto__")).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("continues to support small plain payloads when browser gzip is unavailable", async () => {
    const state = sample();
    vi.stubGlobal("CompressionStream", undefined);
    expect(await encodeCloudPayload(state)).toEqual(cloudPayload(state));
  });
  it("measures the legacy plain limit in UTF-8 bytes rather than JavaScript characters", async () => {
    const state = sample();
    state.entries.word.notes = "ệ".repeat(7 * 1024 * 1024);
    expect(JSON.stringify(state).length).toBeLessThan(20 * 1024 * 1024);
    await expect(decodeCloudPayload(state)).rejects.toThrow(/quá lớn/);
  });
  it("checks only the revision when cloud has not changed", async () => {
    authenticate();
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response('[{"revision":7}]', { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const known = { revision: 7, payload: sample() };
    expect(await fetchCloud(known)).toBe(known);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0][0]).toMatch(/select=revision$/);
  });
  it("rejects secret keys and arbitrary or insecure hosts", () => {
    for (const url of [
      "http://project.supabase.co",
      "https://evil.example",
      "https://project.supabase.co.evil.example",
      "https://project.supabase.co/path",
    ]) {
      expect(() => validateServiceConfig({ url, anonKey: key })).toThrow();
    }
    const secret = `a.${btoa(JSON.stringify({ role: "service_role" }))}.c`;
    expect(() =>
      validateServiceConfig({
        url: "https://project.supabase.co",
        anonKey: secret,
      }),
    ).toThrow(/secret/);
  });
  it("never reuses an account binding from another project with the same user UUID", () => {
    authenticate();
    bindSyncAccount("account-a");
    expect(syncAccount()).toBe("account-a");
    setServiceConfig({
      url: "https://other-project.supabase.co",
      anonKey: key,
    });
    authenticate();
    expect(syncAccount()).toBeUndefined();
    bindSyncAccount("account-a");
    expect(syncAccount()).toBe("account-a");
  });
  it.each(["account", "restore", "project"])(
    "does not upload an old snapshot if %s changes during compression",
    async (change) => {
      authenticate();
      bindSyncAccount("account-a");
      const NativeCompression = globalThis.CompressionStream;
      let release!: () => void,
        entered = false;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      vi.stubGlobal("CompressionStream", function () {
        const wait = new TransformStream<BufferSource, BufferSource>({
          async transform(chunk, controller) {
            entered = true;
            await gate;
            controller.enqueue(chunk);
          },
        });
        return {
          writable: wait.writable,
          readable: wait.readable.pipeThrough(new NativeCompression("gzip")),
        };
      });
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      const pending = compareAndSwapCloud(1, sample());
      await vi.waitFor(() => expect(entered).toBe(true));
      if (change === "restore") clearSyncBinding();
      else if (change === "account") authenticate("account-b");
      else {
        setServiceConfig({
          url: "https://other-project.supabase.co",
          anonKey: key,
        });
        authenticate();
      }
      release();
      await expect(pending).rejects.toThrow(
        /Tài khoản hoặc project đã thay đổi/,
      );
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it("does not send requests offline and can retry the same local progress after reconnecting", async () => {
    authenticate();
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("navigator", { onLine: false });
    await expect(fetchCloud()).rejects.toThrow(/ngoại tuyến/);
    expect(fetch).not.toHaveBeenCalled();
    vi.stubGlobal("navigator", { onLine: true });
    await expect(fetchCloud()).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("uses JWT identity and CAS revision, treating concurrent CAS failure as a merge retry", async () => {
    authenticate();
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response("null", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    expect(await compareAndSwapCloud(5, sample())).toBeUndefined();
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(
      "https://project.supabase.co/rest/v1/rpc/cas_learning_snapshot",
    );
    expect(init.headers.get("Authorization")).toBe("Bearer token-account-a");
    expect(JSON.parse(init.body).expected_revision).toBe(5);
    expect(JSON.parse(init.body).user_id).toBeUndefined();
  });
  it("never posts malformed local data to the shared snapshot", async () => {
    authenticate();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const invalid = sample();
    invalid.schedules["word:1"] = { due: 20, last: 100, step: 1 };
    await expect(compareAndSwapCloud(1, invalid)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("reports auth HTTP errors without accepting a bogus session", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ msg: "Email sending limit exceeded" }),
            { status: 429 },
          ),
        ),
    );
    await expect(requestEmailCode("learner@example.com")).rejects.toThrow(
      /429.*Email sending limit/,
    );
    expect(getAuthSession()).toBeUndefined();
  });
  it("discards responses when account changes or an explicit restore invalidates its binding", async () => {
    authenticate();
    bindSyncAccount("account-a");
    let resolve!: (r: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Promise<Response>((r) => {
            resolve = r;
          }),
      ),
    );
    const request = safeSupabase("/rest/v1/learning_snapshots");
    await Promise.resolve();
    clearSyncBinding();
    expect(syncAccount()).toBeUndefined();
    resolve(new Response("[]", { status: 200 }));
    await expect(request).rejects.toThrow(/Tài khoản đã thay đổi/);
    expect(getAuthSession()?.user.id).toBe("account-a");
  });
});
