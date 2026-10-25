import { test, expect, type Page } from "@playwright/test";
import { gzipSync } from "node:zlib";
import { decodeCloudPayload } from "../src/sync";
import {
  empty,
  merge,
  serialize,
  type Result,
  type State,
  type Word,
} from "../src/core";

// Protocol emulator only: real Supabase RLS, mail delivery and Google require a configured project.
const word: Word = {
  id: "sync-word",
  word: "suggest",
  meaning_vi: "đề nghị",
  example_en: "I suggest leaving early.",
  example_vi: "Tôi đề nghị đi sớm.",
  learning_status: "ready",
  level: "B1",
};
const account = "f635f123-b572-4fb7-8a73-c1e85d1c3bd6";
const result = (id: string, time: number): Result => ({
  id,
  wordId: word.id,
  time,
  skill: 1,
  answer: "suggest",
  correct: true,
  hint: false,
  method: "rule",
  elapsed: 1000,
  session: id,
  review: id,
  gap: 0,
  first: true,
});
const encode = (state: State) => {
  const text = JSON.stringify(state);
  return {
    transport: "jeongyeon-gzip-v1",
    uncompressedBytes: Buffer.byteLength(text),
    data: gzipSync(text).toString("base64"),
  };
};
async function stored(page: Page): Promise<State> {
  return page.evaluate(async () => {
    const path = "/src/core.ts";
    return (await import(/* @vite-ignore */ path)).read();
  });
}
async function openSettings(page: Page) {
  await page
    .getByRole("button", { name: "Cài đặt & sao lưu", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Góc học của bạn" }),
  ).toBeVisible();
}

async function setup(page: Page, concurrent = false, conflicting = false) {
  let remote = merge(empty(), [word], "default");
  remote.history = [result("remote-first", 100)];
  if (conflicting) remote.entries[word.id].notes = "Ghi chú từ điện thoại";
  let revision = 1,
    writes = 0,
    reads = 0,
    collisions = 0;
  const publicKey = "sb_publishable_1234567890abcdefghijklmnopqrstuv";
  await page.addInitScript(
    ({ publicKey }) => {
      localStorage.setItem(
        "jeongyeon-public-service",
        JSON.stringify({
          url: "https://sync-test.supabase.co",
          anonKey: publicKey,
        }),
      );
    },
    { publicKey },
  );
  await page.route("**/data/vocabulary.txt", (route) =>
    route.fulfill({
      contentType: "text/plain;charset=utf-8",
      body: serialize([word]),
    }),
  );
  await page.route("https://sync-test.supabase.co/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    const headers = request.headers();
    expect(headers.apikey).toBe(publicKey);
    if (url.pathname === "/auth/v1/otp") {
      expect(request.postDataJSON().email).toBe("learner@example.com");
      return route.fulfill({ json: {} });
    }
    if (url.pathname === "/auth/v1/verify")
      return route.fulfill({
        json: {
          access_token: "session-test-jwt",
          refresh_token: "refresh-test",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: account, email: "learner@example.com" },
        },
      });
    if (url.pathname === "/auth/v1/logout")
      return route.fulfill({ status: 204 });
    expect(headers.authorization).toBe("Bearer session-test-jwt");
    if (url.pathname === "/rest/v1/learning_snapshots") {
      reads++;
      expect(url.searchParams.get("user_id")).toBe(`eq.${account}`);
      const select = url.searchParams.get("select");
      expect(["revision", "revision,payload"]).toContain(select);
      return route.fulfill({
        json: [
          select === "revision"
            ? { revision }
            : { revision, payload: encode(remote) },
        ],
      });
    }
    expect(url.pathname).toBe("/rest/v1/rpc/cas_learning_snapshot");
    const body = request.postDataJSON();
    expect(body.user_id).toBeUndefined();
    expect(body.new_payload.transport).toBe("jeongyeon-gzip-v1");
    writes++;
    if (concurrent && collisions === 0) {
      remote.history.push(result("remote-concurrent", 300));
      revision++;
      collisions++;
    }
    if (body.expected_revision !== revision)
      return route.fulfill({ json: null });
    // Supabase stores the transport opaquely. Decode only so this emulator can
    // inspect the resulting history and simulate a second device's edits.
    remote = await decodeCloudPayload(body.new_payload);
    revision++;
    return route.fulfill({ json: revision });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Hôm nay, mình học gì?" }),
  ).toBeVisible();
  const initial = await stored(page);
  initial.history = [result("local-first", 200)];
  if (conflicting) initial.entries[word.id].notes = "Ghi chú từ laptop";
  await page.evaluate(async (value) => {
    const path = "/src/core.ts";
    const core = await import(/* @vite-ignore */ path);
    const base = await core.read();
    await core.save(value, base, { replace: true });
  }, initial);
  await page.reload();
  await openSettings(page);
  await page.getByLabel("Email", { exact: true }).fill("learner@example.com");
  await page
    .getByRole("button", { name: "Gửi mã đăng nhập", exact: true })
    .click();
  await page.getByLabel("Mã trong email", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "Xác nhận mã", exact: true }).click();
  await expect(page.getByText("Đăng nhập:", { exact: false })).toContainText(
    "learner@example.com",
  );
  return {
    state: () => remote,
    writes: () => writes,
    reads: () => reads,
    collisions: () => collisions,
  };
}

test("sign-in alone never uploads local data; explicit link unions both devices and retries concurrent CAS", async ({
  page,
}) => {
  const server = await setup(page, true);
  expect(server.writes()).toBe(0);
  expect(server.reads()).toBe(0);
  await page
    .getByRole("button", {
      name: "Liên kết và hợp nhất dữ liệu của tôi",
      exact: true,
    })
    .click();
  await expect(page.locator(".sync-status")).toContainText("Đã đồng bộ");
  expect(server.collisions()).toBe(1);
  expect(server.writes()).toBe(2);
  expect(server.state().history.map((r) => r.id)).toEqual([
    "remote-first",
    "local-first",
    "remote-concurrent",
  ]);
  expect((await stored(page)).history.map((r) => r.id)).toEqual([
    "remote-first",
    "local-first",
    "remote-concurrent",
  ]);
  expect(server.state().session).toBeUndefined();
  const reads = server.reads();
  await page.getByRole("button", { name: "Đồng bộ ngay", exact: true }).click();
  await expect(page.locator(".sync-status")).toContainText("Đã đồng bộ");
  expect(server.writes()).toBe(2);
  expect(server.reads()).toBe(reads + 1);
});

test("offline settings remain local, reconnect merges, and logout preserves all progress", async ({
  page,
  context,
}) => {
  const server = await setup(page);
  await page
    .getByRole("button", {
      name: "Liên kết và hợp nhất dữ liệu của tôi",
      exact: true,
    })
    .click();
  await expect(page.locator(".sync-status")).toContainText("Đã đồng bộ");
  const before = server.writes();
  await context.setOffline(true);
  await page.getByLabel("Từ mới / ngày", { exact: true }).fill("7");
  await expect.poll(async () => (await stored(page)).daily).toBe(7);
  await page.getByRole("button", { name: "Đồng bộ ngay", exact: true }).click();
  await expect(page.locator(".sync-notice")).toContainText("ngoại tuyến");
  expect(server.writes()).toBe(before);
  await context.setOffline(false);
  await expect(page.locator(".sync-status")).toContainText("Đã đồng bộ");
  expect(server.state().daily).toBe(7);
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Gửi mã đăng nhập", exact: true }),
  ).toBeVisible();
  const saved = await stored(page);
  expect(saved.daily).toBe(7);
  expect(saved.history).toHaveLength(2);
  expect(
    await page.evaluate(() => localStorage.getItem("jeongyeon-auth")),
  ).toBeNull();
});

test("conflicting personal edits block upload until two backups and an explicit field choice", async ({
  page,
}) => {
  const server = await setup(page, false, true);
  await page
    .getByRole("button", {
      name: "Liên kết và hợp nhất dữ liệu của tôi",
      exact: true,
    })
    .click();
  await expect(page.locator(".sync-status")).toContainText(
    "Cần xử lý xung đột",
  );
  expect(server.writes()).toBe(0);
  const apply = page.getByRole("button", {
    name: "Áp dụng lựa chọn và hợp nhất",
    exact: true,
  });
  await expect(apply).toBeDisabled();
  await page
    .getByRole("combobox", {
      name: "Xử lý entries.sync-word.notes",
      exact: true,
    })
    .selectOption("local");
  await expect(apply).toBeDisabled();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Tải hai bản JSON dự phòng", exact: true })
    .click();
  expect((await downloaded).suggestedFilename()).toMatch(/Jeongyeon-xung-dot/);
  await expect(apply).toBeEnabled();
  await apply.click();
  await expect(page.locator(".sync-status")).toContainText("Đã đồng bộ");
  expect(server.state().entries[word.id].notes).toBe("Ghi chú từ laptop");
  expect(server.state().history).toHaveLength(2);
});

test("checkpoint reads keep revision and data atomic, and project changes cannot reuse another project's checkpoint", async ({
  page,
}) => {
  await page.route("**/data/vocabulary.txt", (route) =>
    route.fulfill({
      contentType: "text/plain;charset=utf-8",
      body: serialize([word]),
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Hôm nay, mình học gì?" }),
  ).toBeVisible();
  const state = await stored(page);
  const check = await page.evaluate(
    async ({ state, account }) => {
      const path = "/src/sync.ts";
      const sync = await import(/* @vite-ignore */ path);
      const anonKey = "sb_publishable_1234567890abcdefghijklmnopqrstuv";
      sync.setServiceConfig({ url: "https://project-a.supabase.co", anonKey });
      sync.bindSyncAccount(account);
      await sync.saveSyncBase(account, { ...state, daily: 1 }, 1);
      const pairs: { value: number; revision: number }[] = [];
      for (let revision = 2; revision <= 12; revision++) {
        const [, checkpoint] = await Promise.all([
          sync.saveSyncBase(account, { ...state, daily: revision }, revision),
          sync.loadSyncCheckpoint(account),
        ]);
        pairs.push({
          value: checkpoint.payload.daily,
          revision: checkpoint.revision,
        });
      }
      sync.setServiceConfig({ url: "https://project-b.supabase.co", anonKey });
      const other = await sync.loadSyncCheckpoint(account);
      const otherBinding = sync.syncAccount();
      await sync.saveSyncBase(account, { ...state, daily: 25 }, 12);
      sync.setServiceConfig({ url: "https://project-a.supabase.co", anonKey });
      const original = await sync.loadSyncCheckpoint(account);
      return {
        pairs,
        other,
        otherBinding,
        originalValue: original.payload.daily,
        originalRevision: original.revision,
      };
    },
    { state, account },
  );
  expect(check.pairs.every((item) => item.value === item.revision)).toBe(true);
  expect(check.other).toBeUndefined();
  expect(check.otherBinding).toBeUndefined();
  expect(check.originalValue).toBe(12);
  expect(check.originalRevision).toBe(12);
});
