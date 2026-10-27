import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import {
  canPractice,
  contentKey,
  empty,
  merge,
  parse,
  serialize,
  type State,
  type Word,
} from "../src/core";

const DAY = 86_400_000;
const corpus = parse(readFileSync("public/data/vocabulary.txt", "utf8"));
const word = (headword: string, pos?: string) => {
  const found = corpus.find(
    (item) => item.word === headword && (!pos || item.part_of_speech === pos),
  );
  if (!found) throw new Error(`Missing real corpus fixture: ${headword}`);
  return found;
};
const study = word("study", "verb");
const garden = word("garden", "noun");

async function open(page: Page, words: Word[]) {
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

async function read(page: Page): Promise<State> {
  return page.evaluate(async () => {
    const path = "/src/core.ts";
    return (await import(/* @vite-ignore */ path)).read();
  });
}

async function seed(page: Page, state: State) {
  await page.evaluate(async (next) => {
    const path = "/src/core.ts";
    const core = await import(/* @vite-ignore */ path);
    const current = await core.read();
    await core.save(
      { ...next, sourceVersion: current.sourceVersion },
      current,
      { replace: true },
    );
  }, state);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /Hôm nay, mình học gì/ }),
  ).toBeVisible();
}

function learnedStudy(now: number) {
  const state = merge(empty(), [study, garden], "default");
  state.entries[study.id].enrolled = true;
  state.entries[study.id].enrolledAt = now - 8 * DAY;
  state.exposures = { [study.id]: now - 8 * DAY };
  state.exposureEvents = [
    { id: "stable-old-study", wordId: study.id, time: now - 8 * DAY },
  ];
  return state;
}

for (const filter of ["topic", "collection", "search"] as const) {
  test(`blind practice keeps ${filter} metadata out of its preview without inventing exposure`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, [study, garden]);
    await seed(page, learnedStudy(Date.now()));
    const before = await read(page);
    // Select the scope and leave before any word meaning has been visible for
    // 700ms. This isolates metadata leakage from a genuine dictionary visit.
    await page.evaluate(async (kind) => {
      const button = (name: string) => {
        const element = [...document.querySelectorAll("button")].find(
          (item) => item.textContent?.trim() === name,
        );
        if (!element) throw new Error(`Missing navigation button: ${name}`);
        element.click();
      };
      const frame = () => new Promise(requestAnimationFrame);
      button("Kho từ");
      await frame();
      if (kind === "search") {
        const input = document.querySelector<HTMLInputElement>(
          'input[aria-label="Tìm từ và nghĩa"]',
        )!;
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )!.set!.call(input, "study");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        const label = kind === "topic" ? "Chủ đề" : "Bộ từ";
        const select = document.querySelector<HTMLSelectElement>(
          `select[aria-label="${label}"]`,
        )!;
        select.value = kind === "topic" ? "study" : "academic";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      await frame();
      button("Luyện tập");
    }, filter);
    await page.locator(".practice-card").nth(1).click();
    const scope = page.getByText(/Phạm vi hiện tại:/);
    await expect(scope).toBeVisible();
    await expect(scope).not.toContainText(/\b(?:study|academic)\b/i);
    await expect(page.locator("main")).not.toContainText(/\bstudy\b/i);
    await page.waitForTimeout(1100);
    expect(
      (await read(page)).exposureEvents?.filter(
        (event) => event.wordId === study.id,
      ),
    ).toEqual(
      before.exposureEvents?.filter((event) => event.wordId === study.id),
    );
    await page.getByRole("button", { name: /Bắt đầu luyện · 1 mục/ }).click();
    await page
      .getByRole("textbox", { name: "Câu trả lời", exact: true })
      .fill("study");
    await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
    await expect.poll(async () => (await read(page)).history.length).toBe(1);
    const after = await read(page);
    expect(after.history[0]).toMatchObject({
      wordId: study.id,
      correct: true,
      independent: true,
    });
    expect(after.history[0].exposureGap).toBeGreaterThanOrEqual(8 * DAY);
    expect(after.schedules).toEqual(before.schedules);
  });
}

test("the seven-day forecast includes overdue tasks today and excludes unavailable entries", async ({
  page,
}) => {
  const now = new Date(2026, 9, 28, 12).getTime();
  await page.clock.setFixedTime(now);
  const archived = word("apple", "noun");
  const unavailable = {
    ...word("book", "noun"),
    learning_status: "lookup",
  };
  const words = [study, garden, archived, unavailable];
  await open(page, words);
  const state = merge(empty(), words, "default");
  for (const item of words) {
    state.entries[item.id].enrolled = true;
    state.entries[item.id].enrolledAt = now - 8 * DAY;
  }
  state.entries[archived.id].archived = true;
  const schedule = (item: Word, skill: number, due: number) => {
    state.schedules[`${item.id}:${skill}`] = {
      last: now - 8 * DAY,
      due,
      step: 2,
      contentVersion: contentKey(item, skill),
    };
  };
  schedule(study, 1, now - 2 * DAY);
  schedule(garden, 1, now + 3_600_000);
  schedule(study, 4, now + DAY);
  schedule(archived, 1, now - DAY);
  schedule(unavailable, 1, now - DAY);
  expect(canPractice(unavailable, 1)).toBe(false);
  await seed(page, state);
  await page.getByRole("button", { name: "Tiến độ", exact: true }).click();
  const forecast = page.locator("section.panel").filter({
    has: page.getByRole("heading", { name: "Lượng ôn sắp tới", exact: true }),
  });
  await expect(forecast.locator(".skill-row").first()).toContainText("Hôm nay");
  await expect(forecast.locator(".skill-row").first().locator("b")).toHaveText(
    "2 lượt kỹ năng",
  );
  await expect(forecast.locator(".skill-row").nth(1).locator("b")).toHaveText(
    "1 lượt kỹ năng",
  );
  await expect(forecast.locator(".skill-row").nth(2).locator("b")).toHaveText(
    "0 lượt kỹ năng",
  );
  expect((await read(page)).schedules).toEqual(state.schedules);
});

test("Home estimates the actual skill plan rather than a fixed number per word", async ({
  page,
}) => {
  const words = [study, garden, word("apple", "noun")];
  await open(page, words);
  const minutes: number[] = [];
  for (const chosen of [[1], [0, 1, 2, 3, 4, 5]]) {
    const state = merge(empty(), words, "default");
    state.daily = 3;
    state.studySkills = chosen;
    await seed(page, state);
    const estimate = await page.locator(".hero-copy > small").innerText();
    const parsed = estimate.match(/(\d+)\s*phút/);
    expect(parsed, estimate).not.toBeNull();
    minutes.push(Number(parsed![1]));
    await page
      .getByRole("button", { name: "Bắt đầu học", exact: true })
      .click();
    await expect(page.locator(".study")).toBeVisible();
    const session = (await read(page)).session!;
    expect(session.queue).toHaveLength(3 * chosen.length);
    expect(new Set(session.queue.map((task) => task.skill))).toEqual(
      new Set(chosen),
    );
  }
  expect(minutes[1]).toBeGreaterThan(minutes[0]);
});

test("a saved queue, context and unfinished answer survive reference navigation and reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const now = Date.now();
  await open(page, [study, garden]);
  const state = learnedStudy(now);
  const context = {
    id: "stable-frozen-context",
    en: "We study English together twice a week.",
    vi: "Chúng tôi học tiếng Anh cùng nhau hai lần mỗi tuần.",
    targetVersion: contentKey(study, 4),
  };
  state.session = {
    id: "stable-existing-session",
    index: 1,
    count: 2,
    started: now - 60_000,
    scheduled: true,
    queue: [
      { id: garden.id, skill: 0, review: "stable-first-review" },
      { id: study.id, skill: 4, review: "stable-second-review", context },
    ],
    draft: {
      key: "stable-existing-session:1",
      answer: "unfinished answer",
      hint: false,
      revealed: false,
    },
  };
  state.schedules[`${study.id}:4`] = {
    last: now - 8 * DAY,
    due: now - DAY,
    step: 2,
    contentVersion: contentKey(study, 4),
  };
  await seed(page, state);
  const before = await read(page);
  await page.getByRole("button", { name: "Kho từ", exact: true }).click();
  await page.getByRole("textbox", { name: "Tìm từ và nghĩa" }).fill("study");
  await page.getByRole("button", { name: "Luyện tập", exact: true }).click();
  await page.locator(".practice-card").nth(3).click();
  await page.getByRole("button", { name: "Tiến độ", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Tiếp tục phiên học", exact: true }),
  ).toBeVisible();
  const after = await read(page);
  expect(after.session).toEqual(before.session);
  expect(after.schedules).toEqual(before.schedules);
  expect(after.history).toEqual(before.history);
  await page
    .getByRole("button", { name: "Tiếp tục phiên học", exact: true })
    .click();
  await expect(page.getByRole("textbox", { name: "Câu trả lời" })).toHaveValue(
    "unfinished answer",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
});
