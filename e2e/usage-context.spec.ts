import { readFileSync, readdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import {
  cloze,
  contentKey,
  empty,
  merge,
  parse,
  serialize,
  type Result,
  type State,
  type Word,
} from "../src/core";
import type { UsageEntry } from "../src/usage";
const supplements: UsageEntry[] = readdirSync("data/usage")
  .filter((name) => name.endsWith(".json"))
  .flatMap((name) => JSON.parse(readFileSync(`data/usage/${name}`, "utf8")));
const getUsage = (word: Word) =>
  supplements.find((entry) => entry.wordId === word.id);

const DAY = 86_400_000;
const corpus = parse(readFileSync("public/data/vocabulary.txt", "utf8"));
const target = corpus.find((word) => word.word === "suggest")!;
const fillers: Word[] = ["apple", "window", "coffee"].map((word, index) => ({
  id: `context-retry-${index}`,
  word,
  part_of_speech: "noun",
  meaning_vi: ["quả táo", "cửa sổ", "cà phê"][index],
  example_en: `I can see the ${word}.`,
  example_vi: "Đây là câu đệm để kiểm tra khoảng cách giữa các lượt sửa sai.",
}));

async function open(page: Page, words: Word[] = [target]) {
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
}

async function read(page: Page): Promise<State> {
  return page.evaluate(async () => {
    const path = "/src/core.ts";
    return (await import(/* @vite-ignore */ path)).read();
  });
}

async function seed(page: Page, state: State) {
  await page.evaluate(async (value) => {
    const path = "/src/core.ts";
    const core = await import(/* @vite-ignore */ path);
    await core.save(value, await core.read(), { replace: true });
  }, state);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Hôm nay, mình học gì?" }),
  ).toBeVisible();
}

async function resume(page: Page) {
  await page
    .getByRole("button", { name: "Tiếp tục phiên học", exact: true })
    .click();
  await expect(page.locator(".study")).toBeVisible();
}

function previousBase(): Result {
  return {
    id: "previous-base-context",
    wordId: target.id,
    time: Date.now() - 8 * DAY,
    skill: 4,
    answer: target.word,
    correct: true,
    hint: false,
    method: "rule",
    elapsed: 1500,
    session: "previous-base-session",
    review: "previous-base-review",
    gap: 0,
    first: true,
    independent: true,
    evidenceVersion: 2,
    scheduled: true,
    contentVersion: contentKey(target, 4),
    exposureGap: 8 * DAY,
  };
}

for (const width of [320, 390]) {
  test(`source-reviewed usage and a second bilingual context remain readable at ${width}px without awarding recall`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await open(page);
    await page.getByRole("button", { name: "Kho từ", exact: true }).click();
    await page.locator(".word-card").click();
    const usage = getUsage(target)!;
    const panel = page.locator(".dict-usage");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText(usage.patterns[0].form);
    await expect(panel).toContainText(usage.mistake.explanation);
    await expect(page.locator(".dict-entry")).toContainText(usage.example.en);
    await expect(page.locator(".dict-entry")).toContainText(usage.example.vi);
    await expect(
      panel.locator(`a[href="${usage.sources[0].url}"]`),
    ).toHaveAttribute("rel", "noopener noreferrer");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    const rects = await panel.locator("button, a").evaluateAll((items) =>
      items.map((item) => {
        const rect = item.getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: rect.width };
      }),
    );
    expect(
      rects.every(
        (rect) => rect.width > 0 && rect.left >= 0 && rect.right <= width,
      ),
    ).toBe(true);
    const saved = await read(page);
    expect(saved.history).toEqual([]);
    expect(saved.schedules).toEqual({});
  });
}

test("a newly started context drill alternates the authored example and preserves its snapshot through reload and JSON backup", async ({
  page,
}) => {
  await open(page);
  const initial = merge(empty(), [target], "default");
  initial.history = [previousBase()];
  await seed(page, initial);
  await page.getByRole("button", { name: "Luyện tập", exact: true }).click();
  await page.locator(".practice-card").nth(4).click();
  await page.getByRole("button", { name: /Bắt đầu luyện/ }).click();
  await expect(page.locator(".study")).toBeVisible();
  const started = await read(page);
  const context = started.session!.queue[0].context!;
  const usage = getUsage(target)!;
  expect(context).toMatchObject({
    id: usage.example.id,
    en: usage.example.en,
    vi: usage.example.vi,
    targetVersion: contentKey(target, 4),
  });
  const question = cloze({ ...target, example_en: context.en });
  await expect(page.locator(".study .context")).toHaveText(question);
  await expect(page.locator(".study")).not.toContainText(context.vi);
  await page
    .getByRole("textbox", { name: "Câu trả lời", exact: true })
    .fill("sug");
  await page.reload();
  await resume(page);
  await expect(page.locator(".study .context")).toHaveText(question);
  await expect(
    page.getByRole("textbox", { name: "Câu trả lời", exact: true }),
  ).toHaveValue("sug");
  expect((await read(page)).session?.queue).toEqual(started.session!.queue);
  const restored = await page.evaluate(async () => {
    const path = "/src/core.ts";
    const core = await import(/* @vite-ignore */ path);
    const current = await core.read();
    const json = JSON.parse(JSON.stringify(current));
    return core.validateBackup(json);
  });
  expect(restored.session?.queue).toEqual(started.session!.queue);
  await page
    .getByRole("textbox", { name: "Câu trả lời", exact: true })
    .fill(target.word);
  await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
  await expect(page.getByText(/Chính xác!/)).toBeVisible();
  const answered = await read(page);
  expect(answered.history.at(-1)).toMatchObject({
    context,
    correct: true,
    first: true,
  });
  expect(answered.history[0]).toEqual(initial.history[0]);
  expect(answered.schedules).toEqual(initial.schedules);
  await page.reload();
  await resume(page);
  expect((await read(page)).history).toEqual(answered.history);
});

test("a failed contextual recall returns after intervening tasks with the same context and retry success cannot advance its schedule", async ({
  page,
}) => {
  await open(page, [target, ...fillers]);
  const initial = merge(empty(), [target, ...fillers], "default");
  initial.history = [previousBase()];
  initial.entries[target.id].enrolled = true;
  initial.schedules[`${target.id}:4`] = {
    last: Date.now() - 8 * DAY,
    due: Date.now() - 1000,
    step: 2,
  };
  const example = getUsage(target)!.example;
  const context = {
    id: example.id,
    en: example.en,
    vi: example.vi,
    targetVersion: contentKey(target, 4),
  };
  initial.session = {
    id: "usage-repair-session",
    started: Date.now(),
    count: 4,
    index: 0,
    scheduled: true,
    queue: [
      { id: target.id, skill: 4, review: "usage-repair-review", context },
      ...fillers.map((word, index) => ({
        id: word.id,
        skill: 1,
        review: `filler-${index}`,
      })),
    ],
  };
  await seed(page, initial);
  await resume(page);
  await expect(page.locator(".session-goal")).toContainText(
    "4 từ · 4 lượt ban đầu",
  );
  await expect(page.locator(".session-goal")).toContainText(
    "0 lượt sửa sai đang chờ",
  );
  await expect(page.locator(".session-retry")).toHaveCount(0);
  await expect(page.locator(".study")).not.toContainText(context.vi);
  await page
    .getByRole("textbox", { name: "Câu trả lời", exact: true })
    .fill("wrong-target");
  await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
  await page
    .getByRole("button", { name: "Tính sai và ôn lại", exact: true })
    .click();
  await expect(page.getByText(/Cần củng cố/).last()).toBeVisible();
  await expect(page.locator(".session-goal")).toContainText(
    "1 lượt sửa sai đang chờ",
  );
  const failed = await read(page);
  expect(failed.session!.queue).toHaveLength(5);
  expect(failed.session!.queue[4]).toEqual(initial.session.queue[0]);
  expect(failed.schedules[`${target.id}:4`].step).toBe(0);
  for (const filler of fillers) {
    await page
      .getByRole("button", { name: /Tiếp tục/, exact: false })
      .last()
      .click();
    await page
      .getByRole("textbox", { name: "Câu trả lời", exact: true })
      .fill(filler.word);
    await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
    await expect(page.getByText(/Chính xác!/)).toBeVisible();
  }
  await page
    .getByRole("button", { name: /Tiếp tục/, exact: false })
    .last()
    .click();
  await expect(page.locator(".study .context")).toHaveText(
    cloze({ ...target, example_en: context.en }),
  );
  await page
    .getByRole("textbox", { name: "Câu trả lời", exact: true })
    .fill(target.word);
  await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
  await expect(page.locator(".session-retry")).toContainText(
    "Thử lại từ cần củng cố",
  );
  await expect(page.getByText(/Đã trả lời lại đúng\./)).toBeVisible();
  const repaired = await read(page);
  expect(repaired.history.at(-1)).toMatchObject({
    correct: true,
    first: false,
    independent: false,
    review: "usage-repair-review",
    context,
  });
  expect(repaired.schedules[`${target.id}:4`]).toEqual(
    failed.schedules[`${target.id}:4`],
  );
  expect(repaired.history[0]).toEqual(initial.history[0]);
  const report = await page.evaluate(async () => {
    const corePath = "/src/core.ts";
    const analyticsPath = "/src/analytics.ts";
    const core = await import(/* @vite-ignore */ corePath);
    const analytics = await import(/* @vite-ignore */ analyticsPath);
    return analytics.analyzeLearning(await core.read());
  });
  expect(
    report.skills.find((item: { skill: number }) => item.skill === 4).objective
      .total,
  ).toBe(2);
  await page
    .getByRole("button", { name: /Tiếp tục/ })
    .last()
    .click();
  await expect(page.locator(".session-summary")).toContainText(
    "Lần đầu: 3/4 lượt kiểm tra đúng không gợi ý",
  );
  await expect(page.locator(".session-summary")).toContainText(
    "Sửa sai: 1/1 bài trả lời sai ban đầu",
  );
  await expect(page.locator(".session-summary")).toContainText(
    "chưa phải bằng chứng nhớ lâu",
  );
});

test("an existing session without context metadata retains the original sentence and exact queue", async ({
  page,
}) => {
  await open(page);
  const initial = merge(empty(), [target], "default");
  initial.history = [previousBase()];
  initial.session = {
    id: "legacy-context-session",
    started: Date.now(),
    count: 1,
    index: 0,
    scheduled: false,
    queue: [{ id: target.id, skill: 4, review: "legacy-context-review" }],
  };
  await seed(page, initial);
  await resume(page);
  await expect(page.locator(".study .context")).toHaveText(cloze(target));
  expect((await read(page)).session?.queue).toEqual(initial.session.queue);
  await page.reload();
  await resume(page);
  await expect(page.locator(".study .context")).toHaveText(cloze(target));
  expect((await read(page)).session?.queue).toEqual(initial.session.queue);
});
