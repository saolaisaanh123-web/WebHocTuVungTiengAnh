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
import { dialogues } from "../src/conversations";

const dialogue = dialogues.find((d) => d.id === "assignment-feedback")!;
const ids = new Set(dialogue.targets.map((t) => t.id));
const words = parse(readFileSync("public/data/vocabulary.txt", "utf8")).filter(
  (w) => ids.has(w.id),
);

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
}
async function snapshot(page: Page): Promise<State> {
  return page.evaluate(async () => {
    const path = "/src/core.ts";
    const core = await import(/* @vite-ignore */ path);
    return core.read();
  });
}
async function seed(page: Page, saved: State) {
  await page.evaluate(async (value) => {
    const path = "/src/core.ts";
    const core = await import(/* @vite-ignore */ path);
    await core.save(value, await core.read(), { replace: true });
  }, saved);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Hôm nay, mình học gì?" }),
  ).toBeVisible();
}
async function openConversation(page: Page) {
  await page.getByRole("button", { name: "Luyện tập", exact: true }).click();
  await page
    .getByRole("button", { name: "Mở luyện hội thoại", exact: true })
    .click();
  await expect(page.locator(".conversation-practice h3").first()).toHaveText(
    dialogue.title,
  );
}
async function fillAnswers(page: Page, wrongFirst = false) {
  for (let i = 0; i < dialogue.questions.length; i++) {
    const q = dialogue.questions[i];
    if (q.options) {
      const value =
        wrongFirst && i === 0
          ? q.options.find((o) => !q.accepted.includes(o))!
          : q.accepted[0];
      await page.getByRole("radio", { name: value, exact: true }).check();
    } else
      await page
        .getByRole("textbox", { name: `Câu ${i + 1}: điền từ` })
        .fill(q.accepted[0]);
  }
}

test("personalized authored conversation appends results and retries without altering SRS or paused study", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openFixture(page);
  const saved = merge(empty(), words, "default");
  dialogue.targets.slice(0, 3).forEach((t) => {
    saved.entries[t.id].enrolled = true;
  });
  const id = dialogue.targets[0].id;
  saved.history = [
    {
      id: "conversation-existing-review",
      wordId: id,
      time: Date.now() - 2 * 86400000,
      skill: 0,
      answer: "wrong",
      correct: false,
      hint: false,
      method: "rule",
      elapsed: 1800,
      session: "old-session",
      review: "old-review",
      gap: 86400000,
      first: true,
      evidenceVersion: 2,
      independent: true,
      scheduled: true,
      contentVersion: contentKey(saved.entries[id].word),
    },
  ];
  saved.schedules[`${id}:0`] = {
    due: Date.now() + 86400000,
    last: Date.now() - 86400000,
    step: 1,
  };
  saved.pausedScheduled = {
    id: "conversation-paused-scheduled",
    queue: [
      { id, skill: 0, review: "paused-review" },
      { id: dialogue.targets[1].id, skill: 1, review: "paused-next" },
    ],
    index: 0,
    started: Date.now() - 30000,
    scheduled: true,
    count: 2,
    draft: {
      key: "paused-draft",
      answer: "Still here",
      hint: false,
      revealed: false,
    },
  };
  await seed(page, saved);
  await openConversation(page);
  await expect(page.locator(".conversation-reason")).toContainText(
    "3/4 từ đã chọn học hoặc luyện theo nghĩa hiện tại",
  );
  await expect(page.locator(".conversation-reason")).toContainText(
    "1 từ cần củng cố",
  );
  await expect(page.locator(".conversation-lines mark")).toHaveCount(4);
  await expect(page.locator(".conversation-translation")).toHaveCount(0);
  await page
    .getByRole("checkbox", { name: "Bản dịch tiếng Việt", exact: true })
    .check();
  await expect(page.locator(".conversation-translation")).toHaveCount(6);
  const afterReading = await snapshot(page);
  expect(dialogue.targets.every((t) => !!afterReading.exposures?.[t.id])).toBe(
    true,
  );
  expect(afterReading.history).toEqual(saved.history);
  expect(afterReading.schedules).toEqual(saved.schedules);
  expect(afterReading.pausedScheduled).toEqual(saved.pausedScheduled);
  expect(afterReading.conversations || []).toEqual([]);

  await fillAnswers(page, true);
  const reply = "Thanks, Ben. Could we meet at three tomorrow?";
  await page.locator(".conversation-reply textarea").fill(reply);
  await page
    .getByRole("button", { name: "Lưu và xem phản hồi", exact: true })
    .dblclick();
  await expect(page.locator(".conversation-report")).toContainText(
    "Đã lưu: 2/3",
  );
  const afterFirst = await snapshot(page);
  expect(afterFirst.conversations).toHaveLength(1);
  const first = afterFirst.conversations![0];
  expect(first.answers.find((a) => a.kind === "reply")).toMatchObject({
    answer: reply,
  });
  expect(
    first.answers.find((a) => a.kind === "reply")?.correct,
  ).toBeUndefined();
  expect(first.answers.filter((a) => a.correct === false)).toHaveLength(1);
  expect(first.listenedComplete).toBe(false);
  expect(first.answers.every((a) => a.hint)).toBe(true);
  expect(first.targetContentVersions).toEqual(
    Object.fromEntries(
      dialogue.targets.map((t) => [t.id, contentKey(saved.entries[t.id].word)]),
    ),
  );

  await page
    .getByRole("button", { name: "Làm lại phần chưa đúng", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Câu 2: điền từ" }),
  ).toHaveValue("deadline");
  await page
    .getByRole("radio", {
      name: dialogue.questions[0].accepted[0],
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Lưu và xem phản hồi", exact: true })
    .click();
  await expect(page.locator(".conversation-report")).toContainText(
    "Đã lưu: 3/3",
  );
  const afterRetry = await snapshot(page);
  expect(afterRetry.conversations).toHaveLength(2);
  expect(afterRetry.conversations![0]).toEqual(first);
  expect(afterRetry.conversations![1].retryOf).toBe(first.id);
  expect(afterRetry.history).toEqual(saved.history);
  expect(afterRetry.schedules).toEqual(saved.schedules);
  expect(afterRetry.pausedScheduled).toEqual(saved.pausedScheduled);
  expect(errors).toEqual([]);
});

test("first-use conversation stays honest, keeps mobile drafts across reload and works offline after loading", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await openFixture(page);
  await openConversation(page);
  await expect(page.locator(".conversation-reason")).toContainText(
    "Bài mẫu biên soạn sẵn",
  );
  await page.getByRole("textbox", { name: "Câu 2: điền từ" }).fill("deadline");
  await page
    .locator(".conversation-reply textarea")
    .fill("Could we meet at three tomorrow?");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Hôm nay, mình học gì?" }),
  ).toBeVisible();
  await openConversation(page);
  await expect(
    page.getByRole("textbox", { name: "Câu 2: điền từ" }),
  ).toHaveValue("deadline");
  await expect(page.locator(".conversation-reply textarea")).toHaveValue(
    "Could we meet at three tomorrow?",
  );
  await expect(page.locator(".conversation-reason")).toContainText(
    "Bài mẫu biên soạn sẵn",
  );
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);

  // Load the inspection module before disconnecting; the app's already-loaded
  // production logic itself never imports a dev-only source module on save.
  await snapshot(page);
  await context.setOffline(true);
  await fillAnswers(page);
  await page
    .getByRole("button", { name: "Lưu và xem phản hồi", exact: true })
    .click();
  await expect(page.locator(".conversation-report")).toContainText(
    "Đã lưu: 3/3",
  );
  expect((await snapshot(page)).conversations).toHaveLength(1);
  await context.setOffline(false);
});
