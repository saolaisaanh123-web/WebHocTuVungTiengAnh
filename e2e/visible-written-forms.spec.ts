import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import {
  contentKey,
  empty,
  merge,
  parse,
  serialize,
  type State,
} from "../src/core";

const corpus = parse(readFileSync("public/data/vocabulary.txt", "utf8"));
const verb = corpus.find((word) => word.id === "interest-verb-01")!;
const adjective = corpus.find(
  (word) => word.word === "interested" && word.part_of_speech === "adjective",
)!;
const words = [verb, adjective];
const DAY = 86_400_000;

async function snapshot(page: Page): Promise<State> {
  return page.evaluate(async () => {
    const path = "/src/core.ts";
    return (await import(/* @vite-ignore */ path)).read();
  });
}
async function open(page: Page, target = adjective) {
  await page.setViewportSize({ width: 390, height: 844 });
  const text = serialize(words);
  const version = createHash("sha256").update(text).digest("hex");
  await page.route("**/data/vocabulary.txt", (route) =>
    route.fulfill({ contentType: "text/plain;charset=utf-8", body: text }),
  );
  await page.route("**/data/vocabulary-version.json", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        version,
        entryCount: words.length,
        bytes: Buffer.byteLength(text),
      }),
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Hôm nay, mình học gì/ }),
  ).toBeVisible();
  const state = merge(empty(), words, "default");
  state.sourceVersion = version;
  const now = Date.now();
  for (const entry of Object.values(state.entries)) {
    entry.enrolled = true;
    entry.enrolledAt = now - 8 * DAY;
  }
  state.exposures = Object.fromEntries(
    words.map((word) => [word.id, now - 8 * DAY]),
  );
  state.exposureEvents = words.map((word) => ({
    id: `old-${word.id}`,
    wordId: word.id,
    time: now - 8 * DAY,
  }));
  state.schedules[`${adjective.id}:1`] = {
    due: now + DAY,
    step: 2,
    contentVersion: contentKey(adjective, 1),
  };
  state.session = {
    id: "forms-pending",
    queue: [{ id: target.id, skill: 1, review: "forms-review" }],
    index: 0,
    started: now,
    count: 1,
    scheduled: false,
  };
  await page.evaluate(async (value) => {
    const path = "/src/core.ts";
    const core = await import(/* @vite-ignore */ path);
    await core.save(value, await core.read(), { replace: true });
  }, state);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /Hôm nay, mình học gì/ }),
  ).toBeVisible();
  return state;
}
async function openDictionary(page: Page) {
  await page.getByRole("button", { name: "Kho từ", exact: true }).click();
  await page
    .locator(".word-card")
    .filter({
      has: page.getByRole("heading", { name: "interest", exact: true }),
    })
    .click();
  return page.getByRole("dialog");
}
async function showFirstFormOnly(page: Page) {
  await page
    .locator(".usage-forms dd")
    .first()
    .evaluate((field) => {
      const container = field.closest(".modal-content")!;
      const bottom = container.getBoundingClientRect().bottom;
      container.scrollTop += field.getBoundingClientRect().top - (bottom - 40);
    });
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
}
const observedForms = (state: State) =>
  (state.exposureEvents || []).filter((event) => event.writtenForms);

test("only actually read table cells prime written recall, without exposing the other meaning or changing the saved schedule", async ({
  page,
}) => {
  const original = await open(page);
  const dialog = await openDictionary(page);
  await page.waitForTimeout(950);
  expect(observedForms(await snapshot(page))).toEqual([]);
  await showFirstFormOnly(page);
  await expect
    .poll(async () => observedForms(await snapshot(page)).length)
    .toBe(1);
  const viewed = await snapshot(page);
  expect(observedForms(viewed)[0]).toMatchObject({
    wordId: verb.id,
    writtenForms: ["interested"],
  });
  expect(viewed.exposures?.[adjective.id]).toBe(
    original.exposures?.[adjective.id],
  );
  expect(viewed.history).toEqual(original.history);
  expect(viewed.schedules).toEqual(original.schedules);
  expect(viewed.session).toEqual(original.session);
  await page.waitForTimeout(950);
  expect(observedForms(await snapshot(page))).toHaveLength(1);
  await dialog.getByRole("button", { name: "Đóng", exact: true }).click();
  await page.getByRole("button", { name: "Hôm nay", exact: true }).click();
  await page
    .getByRole("button", { name: "Tiếp tục phiên học", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Câu trả lời", exact: true })
    .fill("interested");
  await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).history.length).toBe(1);
  const answered = await snapshot(page);
  expect(answered.history[0]).toMatchObject({
    wordId: adjective.id,
    correct: true,
    independent: false,
    scheduled: false,
  });
  expect(answered.history[0].exposureGap).toBeLessThan(DAY);
  expect(answered.schedules).toEqual(original.schedules);
});

test("a closed post-answer supplement does not expose forms until it is expanded and read", async ({
  page,
}) => {
  const original = await open(page, verb);
  await page
    .getByRole("button", { name: "Tiếp tục phiên học", exact: true })
    .click();
  await page.getByRole("button", { name: /Mở đáp án/ }).click();
  await page.waitForTimeout(950);
  expect(observedForms(await snapshot(page))).toEqual([]);
  await page
    .getByText("Xem lại cách dùng đã đối chiếu", { exact: true })
    .click();
  await page.locator(".usage-forms dd").first().scrollIntoViewIfNeeded();
  await expect
    .poll(async () =>
      observedForms(await snapshot(page)).some((event) =>
        event.writtenForms?.includes("interested"),
      ),
    )
    .toBe(true);
  const viewed = await snapshot(page);
  expect(viewed.exposures?.[adjective.id]).toBe(
    original.exposures?.[adjective.id],
  );
  expect(viewed.history).toEqual([]);
  expect(viewed.schedules).toEqual(original.schedules);
});

test("a hidden tab cannot record table forms and resumes the visible dwell when shown", async ({
  page,
}) => {
  await open(page);
  await openDictionary(page);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await showFirstFormOnly(page);
  await page.waitForTimeout(950);
  expect(observedForms(await snapshot(page))).toEqual([]);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect
    .poll(async () => observedForms(await snapshot(page)).length)
    .toBeGreaterThan(0);
});
