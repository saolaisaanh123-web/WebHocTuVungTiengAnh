import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import {
  contentKey,
  empty,
  merge,
  serialize,
  type State,
  type Word,
} from "../src/core";

const DAY = 86_400_000;
const recordWord: Word = {
  id: "integrity-record-verb",
  word: "record",
  part_of_speech: "verb",
  meaning_vi: "ghi lại",
  definition_en: "To preserve information for later use.",
  example_en: "Please record the meeting for our colleague.",
  example_vi: "Hãy ghi lại cuộc họp cho đồng nghiệp của chúng ta.",
  content_status: "reviewed",
  learning_status: "ready",
};
const garden: Word = {
  ...recordWord,
  id: "integrity-garden",
  word: "garden",
  part_of_speech: "noun",
  meaning_vi: "khu vườn",
  definition_en: "An area where plants are grown.",
  example_en: "We have a small garden.",
  example_vi: "Chúng tôi có một khu vườn nhỏ.",
};

async function open(page: Page, words = [recordWord]) {
  const text = serialize(words);
  const version = createHash("sha256").update(text).digest("hex");
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
  await page.route("**/data/vocabulary.txt", (route) =>
    route.fulfill({ contentType: "text/plain;charset=utf-8", body: text }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Hôm nay, mình học gì/ }),
  ).toBeVisible();
}

async function snapshot(page: Page): Promise<State> {
  return page.evaluate(async () => {
    const path = "/src/core.ts";
    return (await import(/* @vite-ignore */ path)).read();
  });
}

async function seed(page: Page, state: State) {
  await page.evaluate(async (value) => {
    const path = "/src/core.ts";
    const core = await import(/* @vite-ignore */ path);
    const base = await core.read();
    await core.save({ ...value, sourceVersion: base.sourceVersion }, base, {
      replace: true,
    });
  }, state);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /Hôm nay, mình học gì/ }),
  ).toBeVisible();
}

function studiedState(now: number, words = [recordWord]) {
  const state = merge(empty(), words, "default");
  state.entries[recordWord.id].enrolled = true;
  state.entries[recordWord.id].enrolledAt = now - 8 * DAY;
  state.exposures = { [recordWord.id]: now - 8 * DAY };
  state.exposureEvents = [
    {
      id: "integrity-original-exposure",
      wordId: recordWord.id,
      time: now - 8 * DAY,
    },
  ];
  return state;
}

for (const skill of [1, 3, 4]) {
  test(`practice skill ${skill} does not reveal the upcoming target in its preview`, async ({
    page,
  }) => {
    const now = Date.now();
    await open(page);
    await seed(page, studiedState(now));
    await page.getByRole("button", { name: "Luyện tập", exact: true }).click();
    await page.locator(".practice-card").nth(skill).click();
    await expect(page.locator("main")).not.toContainText(/\brecord\b/i);
    await expect(
      page.getByText("Lý do ưu tiên lượt đầu:", { exact: true }),
    ).toBeVisible();
    const before = await snapshot(page);
    await page.waitForTimeout(1100);
    await page.getByRole("button", { name: /Bắt đầu luyện · 1 mục/ }).click();
    await expect(page.locator(".study")).toBeVisible();
    expect((await snapshot(page)).exposureEvents).toEqual(
      before.exposureEvents,
    );
    if (skill === 1) {
      await page
        .getByRole("textbox", { name: "Câu trả lời", exact: true })
        .fill("record");
      await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
      await expect
        .poll(async () => (await snapshot(page)).history.length)
        .toBe(1);
      const after = await snapshot(page);
      expect(after.history[0].correct).toBe(true);
      expect(after.history[0].independent).toBe(true);
      expect(after.history[0].exposureGap).toBeGreaterThanOrEqual(8 * DAY);
      expect(after.schedules).toEqual(before.schedules);
    }
  });
}

function dueState(now: number) {
  const state = studiedState(now, [recordWord, garden]);
  state.daily = 1;
  state.studySkills = [1];
  state.schedules[`${recordWord.id}:1`] = {
    step: 2,
    last: now - 7 * DAY,
    due: now + 60_000,
    contentVersion: contentKey(recordWord, 1),
  };
  return state;
}

test("starting after midnight computes newly due reviews even without a summary refresh", async ({
  page,
}) => {
  const now = Date.UTC(2026, 9, 25, 23, 59);
  await page.clock.setFixedTime(now);
  await open(page, [recordWord, garden]);
  await seed(page, dueState(now));
  await page.clock.setFixedTime(now + 120_000);
  await page.getByRole("button", { name: "Bắt đầu học", exact: true }).click();
  await expect(page.locator(".study")).toBeVisible();
  const after = await snapshot(page);
  expect(after.session?.queue.map(({ id }) => id)).toEqual([
    recordWord.id,
    garden.id,
  ]);
  expect(after.session?.goal).toEqual({ due: 1, continuing: 0, fresh: 1 });
});

test("returning to an idle tab refreshes its due summary without changing a pending session", async ({
  page,
}) => {
  const now = Date.UTC(2026, 9, 25, 23, 59);
  await page.clock.setFixedTime(now);
  await open(page, [recordWord, garden]);
  const state = dueState(now);
  state.session = {
    id: "integrity-pending-session",
    index: 0,
    started: now - 60_000,
    count: 1,
    scheduled: true,
    queue: [{ id: garden.id, skill: 1, review: "integrity-original-review" }],
  };
  await seed(page, state);
  const before = await snapshot(page);
  await page.clock.setFixedTime(now + 120_000);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(
    page.locator(".stat").filter({ hasText: "Đến hạn ôn" }).locator("strong"),
  ).toContainText("1");
  expect((await snapshot(page)).session).toEqual(before.session);
  await page
    .getByRole("button", { name: "Tiếp tục phiên học", exact: true })
    .click();
  await expect(page.locator(".study")).toBeVisible();
  expect((await snapshot(page)).session?.queue).toEqual(before.session?.queue);
});

test("the new-word allowance resets at midnight when a new session is created", async ({
  page,
}) => {
  const now = Date.UTC(2026, 9, 25, 23, 59);
  await page.clock.setFixedTime(now);
  await open(page, [recordWord, garden]);
  const state = dueState(now);
  state.entries[recordWord.id].enrolledAt = now - 60_000;
  state.schedules[`${recordWord.id}:1`].due = now + 7 * DAY;
  await seed(page, state);
  await expect(
    page
      .locator(".stat")
      .filter({ hasText: "Từ mới hôm nay" })
      .locator("strong"),
  ).toContainText("0");
  await page.clock.setFixedTime(now + 120_000);
  await page.getByRole("button", { name: "Bắt đầu học", exact: true }).click();
  await expect(page.locator(".study")).toBeVisible();
  const after = await snapshot(page);
  expect(after.session?.queue.map(({ id }) => id)).toEqual([garden.id]);
  expect(after.session?.goal).toEqual({ due: 0, continuing: 0, fresh: 1 });
  expect(after.schedules).toEqual(state.schedules);
});

test("a learner can leave an ambiguous question ungraded without a schedule penalty or retry", async ({
  page,
}) => {
  const now = Date.now();
  await open(page, [recordWord, garden]);
  const state = dueState(now);
  state.schedules[`${recordWord.id}:1`].due = now - 60_000;
  state.schedules[`${recordWord.id}:1`].step = 3;
  state.session = {
    id: "integrity-ambiguous-session",
    index: 0,
    started: now,
    count: 2,
    scheduled: true,
    queue: [
      { id: recordWord.id, skill: 1, review: "ambiguous-first" },
      { id: garden.id, skill: 1, review: "ambiguous-second" },
    ],
  };
  await seed(page, state);
  const before = await snapshot(page);
  await page
    .getByRole("button", { name: "Tiếp tục phiên học", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Câu trả lời", exact: true })
    .fill("archive");
  page.once("dialog", (dialog) =>
    dialog.accept("Tôi nghĩ còn cách diễn đạt khác."),
  );
  await page
    .getByRole("button", { name: "Bỏ qua chấm câu này", exact: true })
    .click();
  await expect.poll(async () => (await snapshot(page)).history.length).toBe(1);
  const after = await snapshot(page);
  expect(after.history[0]).toMatchObject({
    answer: "archive",
    method: "ungraded",
    correct: false,
    independent: false,
  });
  expect(after.history[0].assessmentNote).toContain(
    "Tôi nghĩ còn cách diễn đạt khác.",
  );
  expect(after.entries[recordWord.id].reports).toContain(
    after.history[0].assessmentNote,
  );
  expect(after.schedules).toEqual(before.schedules);
  expect(after.session?.queue).toEqual(before.session?.queue);
  await expect(page.locator(".answer")).toContainText("record");
  await expect(
    page.locator(".notice.success").filter({ hasText: "không tính đúng/sai" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
  await expect(page.locator(".study h2")).toHaveText(garden.meaning_vi);
  expect((await snapshot(page)).session?.index).toBe(1);
});

test.describe("touch answer controls", () => {
  test.use({ hasTouch: true });
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 320 },
  ]) {
    test(`the context answer can be tapped without opening navigation at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await open(page);
      const state = studiedState(Date.now());
      state.session = {
        id: "integrity-touch-session",
        index: 0,
        started: Date.now(),
        scheduled: true,
        count: 1,
        queue: [
          { id: recordWord.id, skill: 4, review: "integrity-touch-review" },
        ],
      };
      await seed(page, state);
      await page
        .getByRole("button", { name: "Tiếp tục phiên học", exact: true })
        .click();
      const input = page.getByRole("textbox", {
        name: "Câu trả lời",
        exact: true,
      });
      await expect(input).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await expect
        .poll(async () =>
          input.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return (
              document.elementFromPoint(
                rect.x + rect.width / 2,
                rect.y + rect.height / 2,
              ) === element
            );
          }),
        )
        .toBe(true);
      // Use coordinates, not fill()/locator.tap() auto-scrolling, to reproduce
      // the actual tap that used to land on Slang in the fixed navigation.
      const point = await input.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      });
      await page.touchscreen.tap(point.x, point.y);
      await page.keyboard.type("record");
      await expect(input).toHaveValue("record");
      await expect(page.locator(".study")).toBeVisible();
      expect((await snapshot(page)).session?.id).toBe(state.session.id);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(viewport.width);
    });
  }
});
