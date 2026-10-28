import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import {
  contentKey,
  empty,
  merge,
  serialize,
  validateBackup,
  type State,
  type Word,
} from "../src/core";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 28, 12);
const target: Word = {
  id: "assessment-decision-record",
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
  ...target,
  id: "assessment-decision-garden",
  word: "garden",
  part_of_speech: "noun",
  meaning_vi: "khu vườn",
  definition_en: "An area where plants are grown.",
  example_en: "We have a small garden.",
  example_vi: "Chúng tôi có một khu vườn nhỏ.",
};
const words = [target, garden];

function lesson(skill: number): State {
  const state = merge(empty(), words, "personal");
  state.entries[target.id].enrolled = true;
  state.entries[target.id].enrolledAt = NOW - 8 * DAY;
  state.exposures = { [target.id]: NOW - 8 * DAY };
  state.exposureEvents = [
    { id: "old-contact", wordId: target.id, time: NOW - 8 * DAY },
  ];
  state.schedules[`${target.id}:${skill}`] = {
    step: 3,
    last: NOW - 14 * DAY,
    due: NOW - 1000,
    contentVersion: contentKey(target, skill),
  };
  state.session = {
    id: "assessment-decision-session",
    started: NOW - 5000,
    index: 0,
    count: 2,
    scheduled: true,
    queue: [
      { id: target.id, skill, review: "original-review" },
      { id: garden.id, skill: 1, review: "next-review" },
    ],
  };
  return state;
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
    const base = await core.read();
    sessionStorage.removeItem("jeongyeon-session-draft");
    await core.save({ ...next, sourceVersion: base.sourceVersion }, base, {
      replace: true,
    });
  }, state);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /Hôm nay, mình học gì/ }),
  ).toBeVisible();
}
async function resume(page: Page) {
  await page
    .getByRole("button", { name: "Tiếp tục phiên học", exact: true })
    .click();
  await expect(page.locator(".study")).toBeVisible();
}
async function open(page: Page, skill: number) {
  const text = serialize(words);
  const version = createHash("sha256").update(text).digest("hex");
  await page.clock.setFixedTime(NOW);
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
  const state = lesson(skill);
  await seed(page, state);
  await resume(page);
  return state;
}
const pendingNotice = (page: Page) =>
  page.getByRole("status", {
    name: "Đối chiếu đáp án trước khi chấm",
    exact: true,
  });
async function mismatch(page: Page, answer = "another-word") {
  await page
    .getByRole("textbox", { name: "Câu trả lời", exact: true })
    .fill(answer);
  await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
  await expect(pendingNotice(page)).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Câu trả lời", exact: true }),
  ).toBeDisabled();
  return read(page);
}

test("a blind mismatch waits for confirmation and preserves its original answer/time across pause and reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const before = await open(page, 1);
  const pending = await mismatch(page);
  expect(pending.history).toEqual(before.history);
  expect(pending.schedules).toEqual(before.schedules);
  expect(pending.session?.queue).toEqual(before.session?.queue);
  expect(pending.session?.draft).toMatchObject({
    answer: "another-word",
    revealed: true,
    assessment: { time: NOW, hint: false, independent: true },
  });
  expect(
    pending.exposureEvents?.some(
      (event) => event.wordId === target.id && event.time > NOW,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: /Lưu & tạm dừng/ }).click();
  await page.clock.setFixedTime(NOW + 3_600_000);
  await page.reload();
  await resume(page);
  await expect(pendingNotice(page)).toBeVisible();
  expect((await read(page)).session?.draft).toEqual(pending.session?.draft);
  await page
    .getByRole("button", { name: "Tính sai và ôn lại", exact: true })
    .click();
  await expect.poll(async () => (await read(page)).history.length).toBe(1);
  const after = await read(page);
  expect(after.history[0]).toMatchObject({
    answer: "another-word",
    time: NOW,
    correct: false,
    hint: false,
    first: true,
    method: "rule",
    independent: true,
  });
  expect(after.history[0].elapsed).toBe(
    pending.session?.draft?.assessment?.elapsed,
  );
  expect(after.schedules[`${target.id}:1`]).toMatchObject({
    step: 0,
    last: NOW,
    due: NOW + DAY,
  });
  expect(after.session?.queue).toHaveLength(3);
  expect(after.session?.queue[2]).toEqual(before.session?.queue[0]);
  await page.reload();
  await resume(page);
  expect((await read(page)).history).toEqual(after.history);
  expect((await read(page)).schedules).toEqual(after.schedules);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
});

test("a pending contextual mismatch survives JSON export/import and can be saved neutrally without penalty", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const before = await open(page, 4);
  const pending = await mismatch(page, "preserve");
  await page.getByRole("button", { name: /Lưu & tạm dừng/ }).click();
  await page.getByRole("button", { name: "Cài đặt", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Sao lưu toàn bộ JSON", exact: true })
    .click();
  const download = await downloaded;
  const file = testInfo.outputPath("pending-assessment.json");
  await download.saveAs(file);
  const exported = validateBackup(JSON.parse(readFileSync(file, "utf8")));
  expect(exported.session?.draft).toEqual(pending.session?.draft);
  expect(exported.schedules).toEqual(before.schedules);
  expect(exported.history).toEqual(before.history);
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  await seed(page, merge(empty(), words, "personal"));
  await page.getByRole("button", { name: "Cài đặt", exact: true }).click();
  await page
    .locator('input[type=file][accept=".json,application/json"]')
    .setInputFiles(file);
  await expect(
    page.getByRole("heading", { name: "Khôi phục bản sao lưu", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: /Cách khôi phục/ })
    .selectOption("replace");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Xác nhận thay thế", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Khôi phục bản sao lưu", exact: true }),
  ).toHaveCount(0);
  await page
    .locator(".modal")
    .filter({
      has: page.getByRole("heading", { name: "Góc học của bạn", exact: true }),
    })
    .getByRole("button", { name: "Đóng", exact: true })
    .click();
  await resume(page);
  await expect(pendingNotice(page)).toBeVisible();
  expect((await read(page)).session?.draft).toEqual(pending.session?.draft);
  await page
    .getByRole("button", { name: "Đề chưa rõ — lưu không chấm", exact: true })
    .click();
  await expect.poll(async () => (await read(page)).history.length).toBe(1);
  const after = await read(page);
  expect(after.history[0]).toMatchObject({
    answer: "preserve",
    time: NOW,
    correct: false,
    method: "ungraded",
    independent: false,
  });
  expect(after.history[0].assessmentNote).toContain("không tính đúng/sai");
  expect(after.schedules).toEqual(before.schedules);
  expect(after.session?.queue).toEqual(before.session?.queue);
  expect(after.entries[target.id].reports?.at(-1)).toContain(
    "không tính đúng/sai",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
});

test("a dictation mismatch preserves completed playback through reload before the learner confirms", async ({
  page,
}) => {
  await page.addInitScript(() => {
    class Utterance {
      text: string;
      lang = "";
      rate = 1;
      voice: unknown;
      onend?: () => void;
      constructor(text: string) {
        this.text = text;
      }
    }
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: Utterance,
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        getVoices: () => [{ name: "Test American voice", lang: "en-US" }],
        cancel: () => {},
        speak: (value: Utterance) => setTimeout(() => value.onend?.(), 0),
      },
    });
  });
  const before = await open(page, 3);
  await page.getByRole("button", { name: "Nghe câu", exact: true }).click();
  await expect(
    page.getByText("Đã phát xong âm thanh cho lượt này.", { exact: true }),
  ).toBeVisible();
  const pending = await mismatch(page);
  expect(pending.session?.draft?.assessment?.audioPlayed).toBe(true);
  expect(pending.history).toEqual(before.history);
  await page.reload();
  await resume(page);
  await expect(pendingNotice(page)).toBeVisible();
  await page
    .getByRole("button", { name: "Tính sai và ôn lại", exact: true })
    .click();
  await expect.poll(async () => (await read(page)).history.length).toBe(1);
  const after = await read(page);
  expect(after.history[0]).toMatchObject({
    answer: "another-word",
    skill: 3,
    audioPlayed: true,
    correct: false,
    method: "rule",
    hint: false,
    time: NOW,
  });
  expect(after.schedules[`${target.id}:3`].step).toBe(0);
});
