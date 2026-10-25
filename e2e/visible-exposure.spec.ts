import { expect, test, type Page } from "@playwright/test";
import {
  contentKey,
  empty,
  merge,
  serialize,
  type State,
  type Word,
} from "../src/core";

const words: Word[] = Array.from({ length: 72 }, (_, index) => ({
  id: `visible-${index.toString().padStart(3, "0")}`,
  word: `expression ${index.toString().padStart(3, "0")}`,
  meaning_vi: `nghĩa tiếng Việt riêng của mục ${index}`,
  example_en: `We use expression ${index.toString().padStart(3, "0")} in this example.`,
  example_vi: "Đây là ví dụ riêng cho kiểm thử việc hiển thị nghĩa.",
  accepted_answers: `expression ${index.toString().padStart(3, "0")}`,
  part_of_speech: "phrase",
  collections: "slang,phrasal-verbs",
  content_status: "reviewed",
  learning_status: "ready",
  source: "Nội dung giả lập riêng cho kiểm thử giao diện.",
}));

async function read(page: Page): Promise<State> {
  return page.evaluate(async () => {
    const path = "/src/core.ts";
    const core = await import(/* @vite-ignore */ path);
    return core.read();
  });
}

async function openFixture(page: Page) {
  await page.route("**/data/vocabulary.txt", (route) =>
    route.fulfill({
      contentType: "text/plain;charset=utf-8",
      body: serialize(words),
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Hôm nay, mình học gì?" }),
  ).toBeVisible();
  const state = merge(empty(), words, "default");
  const oldTime = Date.now() - 8 * 86_400_000;
  state.history = [
    {
      id: "visibility-previous-answer",
      wordId: words[71].id,
      time: oldTime,
      skill: 1,
      answer: words[71].word,
      correct: true,
      hint: false,
      method: "rule",
      elapsed: 1500,
      session: "previous-session",
      review: "previous-review",
      gap: 8 * 86_400_000,
      first: true,
      independent: true,
      evidenceVersion: 2,
      contentVersion: contentKey(words[71], 1),
    },
  ];
  state.schedules[`${words[71].id}:1`] = {
    last: oldTime,
    due: Date.now() + 86_400_000,
    step: 2,
  };
  state.session = {
    id: "visibility-pending-session",
    queue: [{ id: words[71].id, skill: 1, review: "pending-review" }],
    index: 0,
    started: Date.now(),
    count: 1,
    scheduled: true,
  };
  await page.evaluate(async (saved) => {
    const path = "/src/core.ts";
    const core = await import(/* @vite-ignore */ path);
    await core.save(saved, await core.read(), { replace: true });
  }, state);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Hôm nay, mình học gì?" }),
  ).toBeVisible();
  return read(page);
}

function changedExposures(before: State, after: State) {
  return Object.keys(after.exposures || {}).filter(
    (id) => after.exposures?.[id] !== before.exposures?.[id],
  );
}

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
]) {
  for (const section of ["Kho từ", "Slang", "Cụm động từ"]) {
    test(`${viewport.name}: ${section} only exposes readable meanings and keeps the pending lesson`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      const before = await openFixture(page);
      await page.getByRole("button", { name: section, exact: true }).click();
      const meanings = page.locator("[data-exposure-id]");
      await expect(meanings).toHaveCount(section === "Kho từ" ? 60 : 24);
      const visibleIds = await meanings.evaluateAll((nodes) =>
        nodes
          .filter((node) => {
            const rect = node.getBoundingClientRect();
            const width = Math.max(
              0,
              Math.min(innerWidth, rect.right) - Math.max(0, rect.left),
            );
            const height = Math.max(
              0,
              Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top),
            );
            return (
              rect.width * rect.height > 0 &&
              (width * height) / (rect.width * rect.height) >= 0.6
            );
          })
          .map((node) => (node as HTMLElement).dataset.exposureId!),
      );

      // Waiting beyond the dwell is intentional: merely mounting the whole
      // page must never mark the off-screen meanings as viewed.
      await page.waitForTimeout(950);
      const afterOpen = await read(page);
      const initiallyExposed = changedExposures(before, afterOpen);
      for (const id of initiallyExposed)
        expect(
          afterOpen.exposureEvents?.some(
            (event) =>
              event.wordId === id &&
              event.time === afterOpen.exposures?.[id] &&
              event.resultId === undefined,
          ),
        ).toBe(true);
      expect(initiallyExposed.every((id) => visibleIds.includes(id))).toBe(
        true,
      );
      expect(initiallyExposed.length).toBeLessThan(
        section === "Kho từ" ? 60 : 24,
      );
      if (!visibleIds.length) expect(initiallyExposed).toEqual([]);

      const target = meanings.nth(18);
      const targetId = await target.getAttribute("data-exposure-id");
      expect(targetId).toBeTruthy();
      expect(visibleIds).not.toContain(targetId);
      await target.scrollIntoViewIfNeeded();
      await expect
        .poll(async () => (await read(page)).exposures?.[targetId!])
        .toBeGreaterThan(afterOpen.exposures?.[targetId!] || 0);
      const afterScroll = await read(page);
      const recordedAt = afterScroll.exposures?.[targetId!];
      const targetEvents = afterScroll.exposureEvents?.filter(
        (event) => event.wordId === targetId,
      );
      expect(targetEvents).toHaveLength(1);
      expect(targetEvents?.[0]).toMatchObject({
        time: recordedAt,
        wordId: targetId,
      });
      expect(targetEvents?.[0].resultId).toBeUndefined();
      // The exposure write re-renders the component. It must not re-arm the
      // observer and repeatedly refresh that same exposure timestamp.
      await page.waitForTimeout(1100);
      const settled = await read(page);
      expect(settled.exposures?.[targetId!]).toBe(recordedAt);
      expect(
        settled.exposureEvents?.filter((event) => event.wordId === targetId),
      ).toEqual(targetEvents);
      expect(settled.history).toEqual(before.history);
      expect(settled.schedules).toEqual(before.schedules);
      expect(settled.session).toEqual(before.session);
    });
  }
}

test("a hidden tab does not accrue a visible-meaning dwell", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFixture(page);
  await page.getByRole("button", { name: "Slang", exact: true }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const target = page.locator("[data-exposure-id]").nth(18);
  const id = (await target.getAttribute("data-exposure-id"))!;
  const before = (await read(page)).exposures?.[id];
  await target.scrollIntoViewIfNeeded();
  await page.waitForTimeout(950);
  expect((await read(page)).exposures?.[id]).toBe(before);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect
    .poll(async () => (await read(page)).exposures?.[id])
    .toBeGreaterThan(before || 0);
});

test("scrolling past a meaning does not count as reading it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFixture(page);
  await page.getByRole("button", { name: "Slang", exact: true }).click();
  const target = page.locator("[data-exposure-id]").nth(18);
  const id = (await target.getAttribute("data-exposure-id"))!;
  const before = (await read(page)).exposures?.[id];
  await target.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(950);
  expect((await read(page)).exposures?.[id]).toBe(before);
  await target.scrollIntoViewIfNeeded();
  await expect
    .poll(async () => (await read(page)).exposures?.[id])
    .toBeGreaterThan(before || 0);
});
