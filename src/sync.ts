import { validateBackup, type State, type Schedule } from "./core";
import { scheduleForEntries } from "./schedule-state";
import { exposureEventsForSnapshot } from "./exposure-events";

export type ServiceConfig = { url: string; anonKey: string };
export type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email?: string };
};
const CONFIG_KEY = "jeongyeon-public-service";
const AUTH_KEY = "jeongyeon-auth";
const BIND_KEY = "jeongyeon-sync-account";
const PKCE_KEY = "jeongyeon-pkce";
const listeners = new Set<() => void>();
let generation = 0;
let controller = new AbortController();
let refreshInFlight: Promise<AuthSession> | undefined;
const notify = () => listeners.forEach((listener) => listener());
const readLocal = (key: string) => {
  try {
    return globalThis.localStorage?.getItem(key);
  } catch {
    return null;
  }
};
const writeLocal = (key: string, value?: string) => {
  if (value === undefined) globalThis.localStorage.removeItem(key);
  else globalThis.localStorage.setItem(key, value);
};

/** Only public Supabase project keys belong in a browser. Never accept service-role keys. */
export function validateServiceConfig(value: ServiceConfig): ServiceConfig {
  const url = new URL(value.url.trim());
  if (
    url.protocol !== "https:" ||
    !/^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname) ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "")
  )
    throw Error(
      "Dùng URL HTTPS của project Supabase (https://…supabase.co). Không dùng URL tùy ý.",
    );
  const anonKey = value.anonKey.trim();
  let publicKey = anonKey.startsWith("sb_publishable_") && anonKey.length > 25;
  try {
    const payload = JSON.parse(
      atob(anonKey.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    publicKey ||= payload.role === "anon";
  } catch {
    /* New publishable keys are opaque, legacy anon keys are JWTs. */
  }
  if (!publicKey)
    throw Error(
      "Chỉ nhập publishable key hoặc anon key công khai; tuyệt đối không nhập service_role/secret key.",
    );
  return { url: url.origin, anonKey };
}
export function getServiceConfig(): ServiceConfig | undefined {
  const env = import.meta.env;
  const provided =
    env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY
      ? { url: env.VITE_SUPABASE_URL, anonKey: env.VITE_SUPABASE_ANON_KEY }
      : undefined;
  try {
    const stored = readLocal(CONFIG_KEY);
    return validateServiceConfig(
      provided || (stored ? JSON.parse(stored) : { url: "", anonKey: "" }),
    );
  } catch {
    return undefined;
  }
}
export function setServiceConfig(value: ServiceConfig) {
  const config = validateServiceConfig(value);
  const current = getServiceConfig();
  if (current && current.url !== config.url) signOutLocal();
  writeLocal(CONFIG_KEY, JSON.stringify(config));
  notify();
}
export function getAuthSession(): AuthSession | undefined {
  try {
    const raw = readLocal(AUTH_KEY);
    if (!raw) return undefined;
    const auth = JSON.parse(raw);
    if (
      typeof auth.access_token !== "string" ||
      typeof auth.refresh_token !== "string" ||
      !Number.isFinite(auth.expires_at) ||
      typeof auth.user?.id !== "string"
    )
      return undefined;
    return auth;
  } catch {
    return undefined;
  }
}
export function subscribeAuth(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function installAuth(raw: Record<string, unknown>): AuthSession {
  const auth = {
    access_token: raw.access_token,
    refresh_token: raw.refresh_token,
    expires_at:
      raw.expires_at ||
      Math.floor(Date.now() / 1000) + Number(raw.expires_in || 3600),
    user: raw.user,
  } as AuthSession;
  if (!auth.access_token || !auth.refresh_token || !auth.user?.id)
    throw Error("Dịch vụ trả phiên đăng nhập không hợp lệ.");
  const previous = getAuthSession();
  if (previous?.user.id !== auth.user.id) {
    generation++;
    controller.abort();
    controller = new AbortController();
  }
  writeLocal(AUTH_KEY, JSON.stringify(auth));
  notify();
  return auth;
}
export function signOutLocal() {
  generation++;
  controller.abort();
  controller = new AbortController();
  refreshInFlight = undefined;
  writeLocal(AUTH_KEY);
  notify();
}
export async function signOut() {
  const previous = getAuthSession();
  signOutLocal(); // Abort pending uploads immediately, even when the network is slow/offline.
  if (previous && isOnline() && getServiceConfig()) {
    const response = await safeSupabase(
      "/auth/v1/logout",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${previous.access_token}` },
      },
      false,
    );
    if (!response.ok)
      throw Error(
        "Đã đăng xuất trên máy; chưa hủy được phiên tại dịch vụ. Dữ liệu tại máy vẫn được giữ.",
      );
  }
}
export function syncAccount(): string | undefined {
  try {
    const raw = readLocal(BIND_KEY);
    const binding = raw ? JSON.parse(raw) : undefined;
    return binding?.project === getServiceConfig()?.url &&
      typeof binding.account === "string"
      ? binding.account
      : undefined;
  } catch {
    return undefined;
  } // Legacy UUID-only bindings require a new explicit link.
}
export function bindSyncAccount(id: string) {
  const project = getServiceConfig()?.url;
  if (!project) throw Error("Chưa cấu hình project để liên kết dữ liệu.");
  writeLocal(BIND_KEY, JSON.stringify({ project, account: id }));
}
export function getSyncEpoch() {
  return generation;
}
/** Explicit restore/replace must require a fresh user-approved account merge. */
export function clearSyncBinding() {
  writeLocal(BIND_KEY);
  generation++;
  controller.abort();
  controller = new AbortController();
  notify();
}
export function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

async function errorMessage(response: Response) {
  let body: Record<string, unknown> = {};
  try {
    body = await response.json();
  } catch {
    /* Preserve a helpful status for non-JSON gateways. */
  }
  const message =
    body.msg || body.message || body.error_description || body.error;
  return typeof message === "string"
    ? message.slice(0, 300)
    : `HTTP ${response.status}`;
}
async function authRequest(
  path: string,
  body: object,
): Promise<Record<string, unknown>> {
  const response = await safeSupabase(
    path,
    { method: "POST", body: JSON.stringify(body) },
    false,
  );
  if (!response.ok)
    throw Error(
      `Đăng nhập thất bại (${response.status}): ${await errorMessage(response)}`,
    );
  return response.json();
}
export async function refreshAuth(): Promise<AuthSession> {
  if (refreshInFlight) return refreshInFlight;
  const auth = getAuthSession();
  if (!auth) throw Error("Bạn cần đăng nhập để dùng dịch vụ trực tuyến.");
  const started = generation;
  refreshInFlight = (async () => {
    const data = await authRequest("/auth/v1/token?grant_type=refresh_token", {
      refresh_token: auth.refresh_token,
    });
    if (started !== generation || getAuthSession()?.user.id !== auth.user.id)
      throw Error("Tài khoản đã thay đổi; bỏ qua phản hồi cũ.");
    return installAuth(data);
  })().finally(() => {
    refreshInFlight = undefined;
  });
  return refreshInFlight;
}
/** Requests are restricted to this project's Supabase host and abort across account changes. */
export async function safeSupabase(
  path: string,
  init: RequestInit = {},
  requireAuth = true,
): Promise<Response> {
  const config = getServiceConfig();
  if (!config)
    throw Error(
      "Chưa cấu hình Supabase. Việc học và lưu trên thiết bị vẫn hoạt động.",
    );
  if (!isOnline())
    throw Error(
      "Đang ngoại tuyến. Dữ liệu vẫn ở thiết bị và sẽ thử đồng bộ khi có mạng.",
    );
  if (
    !/^\/(auth|rest|functions)\/v1\//.test(path) ||
    path.includes("..") ||
    path.includes("#")
  )
    throw Error("Đường dẫn dịch vụ không hợp lệ.");
  const started = generation;
  let auth = getAuthSession();
  if (requireAuth) {
    if (!auth) throw Error("Bạn cần đăng nhập để dùng dịch vụ trực tuyến.");
    if (auth.expires_at * 1000 < Date.now() + 60_000)
      auth = await refreshAuth();
    if (started !== generation) throw Error("Tài khoản đã thay đổi.");
  }
  const headers = new Headers(init.headers);
  headers.set("apikey", config.anonKey);
  if (auth && requireAuth)
    headers.set("Authorization", `Bearer ${auth.access_token}`);
  headers.set("Content-Type", "application/json");
  const signal = AbortSignal.any([
    controller.signal,
    AbortSignal.timeout(20_000),
    ...(init.signal ? [init.signal] : []),
  ]);
  const response = await fetch(`${config.url}${path}`, {
    ...init,
    headers,
    signal,
  });
  if (started !== generation)
    throw Error("Tài khoản đã thay đổi; bỏ qua phản hồi cũ.");
  return response;
}
export async function requestEmailCode(email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw Error("Nhập địa chỉ email hợp lệ.");
  await authRequest("/auth/v1/otp", { email: email.trim(), create_user: true });
}
export async function verifyEmailCode(email: string, token: string) {
  const data = await authRequest("/auth/v1/verify", {
    email: email.trim(),
    token: token.trim(),
    type: "email",
  });
  return installAuth(data);
}
const callbackUrl = () => `${location.origin}${location.pathname}`;
export async function startGoogleLogin() {
  const config = getServiceConfig();
  if (!config) throw Error("Chưa cấu hình Supabase.");
  const bytes = crypto.getRandomValues(new Uint8Array(48));
  const verifier = Array.from(bytes, (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
  );
  const challenge = btoa(String.fromCharCode(...digest))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  sessionStorage.setItem(PKCE_KEY, verifier);
  const query = new URLSearchParams({
    provider: "google",
    redirect_to: callbackUrl(),
    code_challenge: challenge,
    code_challenge_method: "s256",
  });
  location.assign(`${config.url}/auth/v1/authorize?${query}`);
}
/** Consume redirect tokens only from the current page and clear them from the address bar. */
export async function completeAuthRedirect() {
  if (!getServiceConfig()) return;
  const url = new URL(location.href);
  const code = url.searchParams.get("code");
  const hash = new URLSearchParams(url.hash.slice(1));
  if (code) {
    const verifier = sessionStorage.getItem(PKCE_KEY);
    if (!verifier)
      throw Error(
        "Không tìm thấy phiên xác thực. Hãy đăng nhập lại trên thiết bị này.",
      );
    const data = await authRequest("/auth/v1/token?grant_type=pkce", {
      auth_code: code,
      code_verifier: verifier,
    });
    installAuth(data);
    sessionStorage.removeItem(PKCE_KEY);
    url.searchParams.delete("code");
    history.replaceState(null, "", `${url.pathname}${url.search}`);
  } else if (hash.has("access_token")) {
    const token = hash.get("access_token")!;
    const response = await safeSupabase(
      "/auth/v1/user",
      { headers: { Authorization: `Bearer ${token}` } },
      false,
    );
    if (!response.ok)
      throw Error("Liên kết đăng nhập đã hết hạn hoặc không hợp lệ.");
    const user = await response.json();
    installAuth({
      access_token: token,
      refresh_token: hash.get("refresh_token"),
      expires_in: Number(hash.get("expires_in") || 3600),
      user,
    });
    history.replaceState(null, "", `${url.pathname}${url.search}`);
  } else if (hash.has("error_description")) {
    history.replaceState(null, "", `${url.pathname}${url.search}`);
    throw Error(hash.get("error_description")!.slice(0, 250));
  }
}

type JsonRecord = Record<string, unknown>;
export type SyncConflict = {
  path: string;
  local: unknown;
  remote: unknown;
  immutable?: boolean;
};
export type SyncMerge = { state: State; conflicts: SyncConflict[] };
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const copy = <T>(value: T): T =>
  value === undefined ? value : structuredClone(value);
const isObject = (value: unknown): value is JsonRecord =>
  !!value && typeof value === "object" && !Array.isArray(value);

/** Immutable history is never replaced. Conflicting edits stop upload until explicitly resolved. */
export function mergeCloudState(
  base: State | undefined,
  local: State,
  remote: State,
  resolutions: Record<string, "local" | "remote"> = {},
): SyncMerge {
  const conflicts: SyncConflict[] = [];
  function field(
    before: unknown,
    left: unknown,
    right: unknown,
    path: string,
  ): unknown {
    if (equal(left, right)) return copy(left);
    if (base && equal(left, before)) return copy(right);
    if (base && equal(right, before)) return copy(left);
    if (left === undefined) return copy(right); // deletion never silently removes another device's record
    if (right === undefined) return copy(left);
    if (
      path.endsWith(".reports") &&
      Array.isArray(left) &&
      Array.isArray(right)
    )
      return [...new Set([...left, ...right])];
    if (
      path.endsWith(".enrolledAt") &&
      typeof left === "number" &&
      typeof right === "number"
    )
      return Math.min(left, right);
    if (isObject(left) && isObject(right)) {
      const output: JsonRecord = {};
      for (const key of new Set([
        ...Object.keys(left),
        ...Object.keys(right),
      ])) {
        const value = field(
          isObject(before) ? before[key] : undefined,
          left[key],
          right[key],
          `${path}.${key}`,
        );
        if (value !== undefined)
          Object.defineProperty(output, key, {
            value,
            enumerable: true,
            writable: true,
            configurable: true,
          });
      }
      return output;
    }
    if (resolutions[path])
      return copy(resolutions[path] === "local" ? left : right);
    conflicts.push({ path, local: copy(left), remote: copy(right) });
    return copy(left);
  }
  const output = copy(local) as State & JsonRecord;
  output.entries = {};
  for (const id of new Set([
    ...Object.keys(local.entries),
    ...Object.keys(remote.entries),
  ])) {
    const left = local.entries[id],
      right = remote.entries[id];
    // Missing records can result from an older import, not an intentional cloud delete.
    output.entries[id] =
      left && right
        ? (field(
            base?.entries[id],
            left,
            right,
            `entries.${id}`,
          ) as State["entries"][string])
        : copy(left || right);
  }
  // These records are append-only. An ID collision with different contents is an integrity error.
  for (const key of [
    "history",
    "conversations",
    "writing",
    "exposureEvents",
  ] as const) {
    const left = (
      key === "exposureEvents"
        ? exposureEventsForSnapshot(local) || []
        : (local as State & JsonRecord)[key] || []
    ) as JsonRecord[];
    const right = (
      key === "exposureEvents"
        ? exposureEventsForSnapshot(remote) || []
        : (remote as State & JsonRecord)[key] || []
    ) as JsonRecord[];
    const records = new Map<string, JsonRecord>();
    for (const item of [...left, ...right]) {
      const id = String(item.id);
      const previous = records.get(id);
      if (previous && !equal(previous, item))
        conflicts.push({
          path: `${key}.${id}`,
          local: copy(previous),
          remote: copy(item),
          immutable: true,
        });
      else records.set(id, copy(item));
    }
    if (left.length || right.length || key === "history")
      output[key] = [...records.values()].sort(
        (a, b) =>
          Number(a.time || a.started || 0) - Number(b.time || b.started || 0) ||
          String(a.id).localeCompare(String(b.id)),
      ) as never;
  }
  output.exposures = { ...local.exposures };
  for (const [id, time] of Object.entries(remote.exposures || {}))
    output.exposures[id] = Math.max(time, output.exposures[id] || 0);
  output.schedules = {};
  for (const key of new Set([
    ...Object.keys(local.schedules),
    ...Object.keys(remote.schedules),
  ])) {
    const left = scheduleForEntries(local, key, output.entries),
      right = scheduleForEntries(remote, key, output.entries),
      before = base && scheduleForEntries(base, key, output.entries);
    let merged: Schedule | undefined;
    if (equal(left, right)) merged = left;
    else if (base && equal(left, before)) merged = right;
    else if (base && equal(right, before)) merged = left;
    else if (left && right) {
      const last = Math.max(left.last, right.last);
      merged = {
        due: Math.max(last, Math.min(left.due, right.due)),
        last,
        step: Math.min(left.step, right.step),
        ...(left.contentVersion || right.contentVersion
          ? { contentVersion: left.contentVersion || right.contentVersion }
          : {}),
      };
    } else merged = left || right;
    if (merged) output.schedules[key] = copy(merged);
  }
  const special = new Set([
    "entries",
    "history",
    "schedules",
    "session",
    "pausedScheduled",
    "exposures",
    "exposureEvents",
    "conversations",
    "writing",
    "sourceVersion",
  ]);
  for (const key of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    if (special.has(key)) continue;
    const value = field(
      (base as (State & JsonRecord) | undefined)?.[key],
      (local as State & JsonRecord)[key],
      (remote as State & JsonRecord)[key],
      key,
    );
    if (value !== undefined) output[key] = value;
  }
  // The repository source is checked independently on each device; active queues never migrate.
  output.session = local.session;
  output.pausedScheduled = local.pausedScheduled;
  output.sourceVersion = local.sourceVersion;
  return { state: output, conflicts };
}
export function cloudPayload(state: State): State {
  const {
    session: _session,
    pausedScheduled: _paused,
    sourceVersion: _source,
    ...rest
  } = state;
  return rest as State;
}
export type CloudSnapshot = { revision: number; payload: State };
const MAX_RAW_BYTES = 20 * 1024 * 1024;
const MAX_WIRE_BYTES = 20 * 1024 * 1024;
// Shared strings and record shapes remove duplicated vocabulary metadata and
// history keys before the existing 20 MiB transport limit. No canonical corpus
// needs to be downloaded to decode: personal edits and old meanings stay exact.
const MAX_EXPANDED_BYTES = 64 * 1024 * 1024;
type Packed =
  | null
  | boolean
  | number
  | string
  | Packed[]
  | { s: number }
  | { o: [number, ...Packed[]] };
type CompactState = {
  format: "jeongyeon-compact-state-v1";
  strings: string[];
  shapes: string[][];
  state: Packed;
};
const invalidCompact = () =>
  Error("Cấu trúc bản đồng bộ rút gọn không hợp lệ.");

function compactState(state: State): CompactState {
  const frequencies = new Map<string, number>();
  function count(value: unknown, depth = 0) {
    if (depth > 80) throw invalidCompact();
    if (typeof value === "string" && value.length >= 16)
      frequencies.set(value, (frequencies.get(value) || 0) + 1);
    else if (Array.isArray(value))
      for (const item of value) count(item, depth + 1);
    else if (isObject(value))
      for (const item of Object.values(value)) count(item, depth + 1);
  }
  count(state);
  const strings = [...frequencies]
    .filter(([, count]) => count > 1)
    .map(([value]) => value);
  const references = new Map(strings.map((value, index) => [value, index]));
  const shapes: string[][] = [];
  const shapeIds = new Map<string, number>();
  function pack(value: unknown, depth = 0): Packed {
    if (depth > 80) throw invalidCompact();
    if (typeof value === "string") {
      const index = references.get(value);
      return index === undefined ? value : { s: index };
    }
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw invalidCompact();
      return value;
    }
    if (Array.isArray(value))
      return value.map((item) =>
        pack(item === undefined ? null : item, depth + 1),
      );
    if (!isObject(value)) throw invalidCompact();
    const keys = Object.keys(value).filter((key) => value[key] !== undefined);
    const signature = JSON.stringify(keys);
    let shape = shapeIds.get(signature);
    if (shape === undefined) {
      shape = shapes.length;
      shapeIds.set(signature, shape);
      shapes.push(keys);
    }
    return { o: [shape, ...keys.map((key) => pack(value[key], depth + 1))] };
  }
  return {
    format: "jeongyeon-compact-state-v1",
    strings,
    shapes,
    state: pack(state),
  };
}

/** Check references and expanded UTF-8 JSON size before materializing records.
 * A tiny dictionary with millions of references must not become a memory bomb. */
function expandCompact(value: JsonRecord, materialize = true): unknown {
  if (
    Object.keys(value).some(
      (key) => !["format", "strings", "shapes", "state"].includes(key),
    ) ||
    !Array.isArray(value.strings) ||
    !value.strings.every((item) => typeof item === "string") ||
    !Array.isArray(value.shapes) ||
    !value.shapes.every(
      (shape) =>
        Array.isArray(shape) &&
        shape.every((key) => typeof key === "string") &&
        new Set(shape).size === shape.length,
    )
  )
    throw invalidCompact();
  const strings = value.strings as string[];
  const shapes = value.shapes as string[][];
  const encoder = new TextEncoder();
  const lengths = new Map<string, number>();
  const stringBytes = (text: string) => {
    let size = lengths.get(text);
    if (size === undefined) {
      size = encoder.encode(JSON.stringify(text)).length;
      lengths.set(text, size);
    }
    return size;
  };
  let bytes = 0;
  let nodes = 0;
  function add(size: number) {
    bytes += size;
    if (bytes > MAX_EXPANDED_BYTES)
      throw Error(
        "Bản đồng bộ giải nén vượt giới hạn an toàn. Dữ liệu tại máy vẫn được giữ.",
      );
  }
  function inspect(item: unknown, depth = 0): void {
    if (++nodes > 2_000_000 || depth > 80) throw invalidCompact();
    if (
      item === null ||
      typeof item === "boolean" ||
      typeof item === "number"
    ) {
      if (typeof item === "number" && !Number.isFinite(item))
        throw invalidCompact();
      add(String(item).length);
      return;
    }
    if (typeof item === "string") {
      add(stringBytes(item));
      return;
    }
    if (Array.isArray(item)) {
      add(2 + Math.max(0, item.length - 1));
      for (const child of item) inspect(child, depth + 1);
      return;
    }
    if (!isObject(item) || Object.keys(item).length !== 1)
      throw invalidCompact();
    if (Object.hasOwn(item, "s")) {
      if (
        !Number.isSafeInteger(item.s) ||
        Number(item.s) < 0 ||
        Number(item.s) >= strings.length
      )
        throw invalidCompact();
      add(stringBytes(strings[Number(item.s)]));
      return;
    }
    if (!Object.hasOwn(item, "o") || !Array.isArray(item.o))
      throw invalidCompact();
    const [index, ...items] = item.o;
    if (
      !Number.isSafeInteger(index) ||
      Number(index) < 0 ||
      Number(index) >= shapes.length
    )
      throw invalidCompact();
    const keys = shapes[Number(index)];
    if (items.length !== keys.length) throw invalidCompact();
    add(2 + Math.max(0, keys.length - 1));
    for (let i = 0; i < keys.length; i++) {
      add(stringBytes(keys[i]) + 1);
      inspect(items[i], depth + 1);
    }
  }
  inspect(value.state);
  if (!materialize) return;
  function unpack(item: Packed): unknown {
    if (Array.isArray(item)) return item.map(unpack);
    if (item === null || typeof item !== "object") return item;
    if ("s" in item) return strings[item.s];
    const [shape, ...items] = item.o;
    const output: JsonRecord = {};
    for (const [index, key] of shapes[shape].entries())
      Object.defineProperty(output, key, {
        value: unpack(items[index]),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    return output;
  }
  return unpack(value.state as Packed);
}
type CompressedPayload = {
  transport: "jeongyeon-gzip-v1";
  uncompressedBytes: number;
  data: string;
};
async function readBounded(stream: ReadableStream<Uint8Array>, limit: number) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw Error(
          "Bản đồng bộ vượt giới hạn an toàn 20 MiB. Dữ liệu trên máy vẫn được giữ.",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}
export async function encodeCloudPayload(
  state: State,
): Promise<State | CompressedPayload> {
  // Reject malformed merges locally before a successful CAS can poison the shared snapshot.
  const payload = validateBackup(cloudPayload(state));
  if (typeof CompressionStream === "undefined") {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    if (bytes.length > 512 * 1024)
      throw Error(
        "Trình duyệt chưa hỗ trợ nén bản đồng bộ lớn. Dùng trình duyệt mới hơn; việc học tại máy vẫn hoạt động.",
      );
    return payload;
  }
  const compact = compactState(payload);
  // Validate the same expansion budget used by the receiver before upload.
  expandCompact(compact as unknown as JsonRecord, false);
  const bytes = new TextEncoder().encode(JSON.stringify(compact));
  if (bytes.length > MAX_RAW_BYTES)
    throw Error(
      "Bản đồng bộ rút gọn vượt 20 MiB. Xuất JSON để giữ bản dự phòng; không có dữ liệu bị xóa.",
    );
  const compressed = await readBounded(
    new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip")),
    MAX_WIRE_BYTES,
  );
  let binary = "";
  for (let i = 0; i < compressed.length; i += 8192)
    binary += String.fromCharCode(...compressed.subarray(i, i + 8192));
  const encoded: CompressedPayload = {
    transport: "jeongyeon-gzip-v1",
    uncompressedBytes: bytes.length,
    data: btoa(binary),
  };
  // PostgreSQL jsonb::text adds insignificant spaces around these fields.
  // Leave a small margin so a browser-accepted envelope also fits its SQL cap.
  if (
    new TextEncoder().encode(JSON.stringify(encoded)).length >
    MAX_WIRE_BYTES - 256
  )
    throw Error("Bản đồng bộ nén vượt 20 MiB. Dữ liệu tại máy vẫn được giữ.");
  return encoded;
}
export async function decodeCloudPayload(value: unknown): Promise<State> {
  if (isObject(value) && value.transport === "jeongyeon-gzip-v1") {
    if (
      typeof value.data !== "string" ||
      value.data.length > MAX_WIRE_BYTES ||
      !Number.isInteger(value.uncompressedBytes) ||
      Number(value.uncompressedBytes) < 1 ||
      Number(value.uncompressedBytes) > MAX_RAW_BYTES
    )
      throw Error("Bản nén đồng bộ không hợp lệ hoặc quá lớn.");
    if (typeof DecompressionStream === "undefined")
      throw Error(
        "Trình duyệt chưa hỗ trợ giải nén. Cập nhật trình duyệt để đồng bộ; dữ liệu trên máy vẫn được giữ.",
      );
    const bytes = Uint8Array.from(atob(value.data), (character) =>
      character.charCodeAt(0),
    );
    const raw = await readBounded(
      new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")),
      MAX_RAW_BYTES,
    );
    if (raw.length !== value.uncompressedBytes)
      throw Error("Bản nén đồng bộ không khớp kích thước khai báo.");
    const decoded: unknown = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(raw),
    );
    return validateBackup(
      isObject(decoded) && decoded.format === "jeongyeon-compact-state-v1"
        ? expandCompact(decoded)
        : decoded,
    );
  }
  const serialized = JSON.stringify(value);
  if (typeof serialized !== "string") throw Error("Bản đồng bộ không hợp lệ.");
  if (new TextEncoder().encode(serialized).length > MAX_RAW_BYTES)
    throw Error("Bản đồng bộ quá lớn.");
  return validateBackup(value);
}
export async function fetchCloud(
  known?: CloudSnapshot,
): Promise<CloudSnapshot | undefined> {
  const auth = getAuthSession();
  if (!auth) throw Error("Chưa đăng nhập.");
  const path = `/rest/v1/learning_snapshots?user_id=eq.${encodeURIComponent(auth.user.id)}`;
  // Idle checks transfer only a revision number, not the entire vocabulary corpus.
  if (known) {
    const check = await safeSupabase(`${path}&select=revision`);
    if (!check.ok)
      throw Error(`Không kiểm tra được phiên bản đồng bộ (${check.status}).`);
    const revisions = await check.json();
    if (!Array.isArray(revisions) || revisions.length > 1)
      throw Error("Phiên bản đám mây không hợp lệ.");
    if (!revisions.length) return undefined;
    if (revisions[0].revision === known.revision) return known;
  }
  const response = await safeSupabase(`${path}&select=revision,payload`);
  if (!response.ok)
    throw Error(
      `Không đọc được dữ liệu đám mây (${response.status}): ${await errorMessage(response)}`,
    );
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length > 1)
    throw Error("Phản hồi đồng bộ không hợp lệ.");
  if (!rows.length) return undefined;
  if (!Number.isSafeInteger(rows[0].revision) || rows[0].revision < 1)
    throw Error("Phiên bản đám mây không hợp lệ.");
  return {
    revision: Number(rows[0].revision),
    payload: await decodeCloudPayload(rows[0].payload),
  };
}
export async function compareAndSwapCloud(
  expected: number,
  state: State,
): Promise<number | undefined> {
  const startedEpoch = generation;
  const account = getAuthSession()?.user.id;
  const project = getServiceConfig()?.url;
  if (!account || !project)
    throw Error("Bạn cần đăng nhập và cấu hình project trước khi đồng bộ.");
  const encoded = await encodeCloudPayload(state);
  if (
    generation !== startedEpoch ||
    getAuthSession()?.user.id !== account ||
    getServiceConfig()?.url !== project
  )
    throw Error(
      "Tài khoản hoặc project đã thay đổi; không tải dữ liệu của phiên cũ lên.",
    );
  const response = await safeSupabase("/rest/v1/rpc/cas_learning_snapshot", {
    method: "POST",
    body: JSON.stringify({
      expected_revision: expected,
      new_payload: encoded,
    }),
  });
  if (!response.ok)
    throw Error(
      `Không ghi được dữ liệu đám mây (${response.status}): ${await errorMessage(response)}`,
    );
  const result = await response.json();
  return typeof result === "number" && result > 0 ? result : undefined;
}
function syncDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("jeongyeon-sync", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("bases");
    request.onerror = () =>
      reject(Error("Không mở được bộ đệm đồng bộ. Dữ liệu học vẫn được giữ."));
    request.onsuccess = () => resolve(request.result);
  });
}
function syncBaseKey(account: string) {
  const project = getServiceConfig()?.url;
  if (!project) throw Error("Chưa cấu hình project để đọc mốc đồng bộ.");
  return `${project}/users/${account}`;
}
export async function loadSyncBase(
  account: string,
): Promise<State | undefined> {
  return (await loadSyncCheckpoint(account))?.payload;
}
export async function loadSyncRevision(
  account: string,
): Promise<number | undefined> {
  return (await loadSyncCheckpoint(account))?.revision;
}
/** Snapshot and revision must come from one IDB transaction, including across tabs. */
export async function loadSyncCheckpoint(
  account: string,
): Promise<{ payload: State; revision?: number } | undefined> {
  const key = syncBaseKey(account);
  const db = await syncDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("bases", "readonly");
    const payload = tx.objectStore("bases").get(key);
    const revision = tx.objectStore("bases").get(`${key}:revision`);
    tx.oncomplete = () => {
      db.close();
      resolve(
        payload.result
          ? { payload: payload.result, revision: revision.result }
          : undefined,
      );
    };
    tx.onerror = () => {
      db.close();
      reject(Error("Không đọc được cặp mốc và phiên bản đồng bộ."));
    };
  });
}
export async function saveSyncBase(
  account: string,
  state: State,
  revision?: number,
) {
  const key = syncBaseKey(account);
  const db = await syncDatabase();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("bases", "readwrite");
    tx.objectStore("bases").put(cloudPayload(state), key);
    if (revision !== undefined)
      tx.objectStore("bases").put(revision, `${key}:revision`);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(
        Error(
          "Không lưu được mốc đồng bộ; sẽ hợp nhất lại, không xóa tiến độ.",
        ),
      );
    };
  });
}
// Coordinate authentication across tabs without sharing a mutable in-flight request.
if (typeof window !== "undefined")
  window.addEventListener("storage", (event) => {
    if (
      event.key === AUTH_KEY ||
      event.key === CONFIG_KEY ||
      event.key === BIND_KEY
    ) {
      generation++;
      controller.abort();
      controller = new AbortController();
      notify();
    }
  });
