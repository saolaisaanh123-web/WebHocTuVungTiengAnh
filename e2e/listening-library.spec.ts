import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { parse, serialize } from "../src/core";
import { listeningDialogues } from "../src/conversations";

const lesson = listeningDialogues[0];
const corpus = parse(readFileSync("public/data/vocabulary.txt", "utf8"));

async function speech(page: Page, fail = false, delay = 1) {
  await page.addInitScript(
    ({ fail, delay }) => {
      const voices = [
        { name: "US One", lang: "en-US", voiceURI: "us-one" },
        { name: "US Two", lang: "en-US", voiceURI: "us-two" },
      ];
      const calls: { text: string; lang: string; rate: number }[] = [];
      let timer: ReturnType<typeof setTimeout> | undefined;
      Object.defineProperty(window, "listeningCalls", { value: calls });
      class Utterance {
        constructor(public text: string) {}
        lang = "";
        rate = 1;
        voice?: { lang: string };
        onend?: () => void;
        onerror?: (event: { error: string }) => void;
      }
      Object.defineProperty(window, "SpeechSynthesisUtterance", {
        configurable: true,
        value: Utterance,
      });
      Object.defineProperty(window, "speechSynthesis", {
        configurable: true,
        value: {
          getVoices: () => voices,
          addEventListener() {},
          removeEventListener() {},
          pause() {},
          resume() {},
          cancel() {
            clearTimeout(timer);
          },
          speak(utterance: Utterance) {
            calls.push({
              text: utterance.text,
              lang: utterance.lang,
              rate: utterance.rate,
            });
            timer = setTimeout(
              () =>
                fail
                  ? utterance.onerror?.({ error: "audio-busy" })
                  : utterance.onend?.(),
              delay,
            );
          },
        },
      });
    },
    { fail, delay },
  );
}

async function open(page: Page, all = false) {
  const wanted = new Set(
    (all ? listeningDialogues : [lesson]).flatMap((item) =>
      item.targets.map((target) => target.id),
    ),
  );
  const words = corpus.filter((word) => wanted.has(word.id));
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
  await page.addInitScript(
    (selected) =>
      !localStorage.getItem("jeongyeon:conversation-drafts:v1") &&
      localStorage.setItem(
        "jeongyeon:conversation-drafts:v1",
        JSON.stringify({ selected, drafts: {} }),
      ),
    lesson.id,
  );
  await page.goto("/");
  await page.getByRole("heading", { name: /Hôm nay, mình học gì/ }).waitFor();
  await page.getByRole("button", { name: "Luyện tập", exact: true }).click();
  const baseline = await state(page);
  await page
    .getByRole("button", { name: "Mở luyện hội thoại", exact: true })
    .click();
  await expect(page.locator(".conversation-title h3")).toHaveText(lesson.title);
  return baseline;
}
async function state(page: Page) {
  return page.evaluate(async () => (await import("/src/core.ts")).read());
}
async function answer(page: Page) {
  for (const [index, question] of lesson.questions.entries()) {
    if (question.options)
      await page
        .getByRole("radio", { name: question.accepted[0], exact: true })
        .check();
    else
      await page
        .getByRole("textbox", {
          name: `Câu ${index + 1}: điền từ`,
          exact: true,
        })
        .fill(question.accepted[0]);
  }
}

test("listen-first keeps transcript and questions hidden until successful full playback, then saves distinct evidence", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await speech(page);
  const baseline = await open(page);
  await expect(
    page.getByLabel("Cách luyện hội thoại", { exact: true }),
  ).toHaveValue("listen");
  await expect(page.locator(".conversation-lines")).toHaveCount(0);
  await expect(page.locator(".conversation-context")).toHaveCount(0);
  await expect(page.locator(".conversation-exercises fieldset")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Lưu và xem phản hồi", exact: true }),
  ).toBeDisabled();
  const before = await state(page);
  expect(before.conversations || []).toEqual([]);
  const exposedBefore =
    before.exposureEvents?.filter((event) =>
      lesson.targets.some((target) => target.id === event.wordId),
    ) || [];
  expect(exposedBefore).toEqual(
    baseline.exposureEvents?.filter((event) =>
      lesson.targets.some((target) => target.id === event.wordId),
    ) || [],
  );
  await page
    .getByLabel("Tốc độ nghe hội thoại", { exact: true })
    .selectOption("0.75");
  await page.getByRole("button", { name: "Nghe toàn bộ", exact: true }).click();
  await expect(page.locator(".conversation-audio-status")).toContainText(
    "Đã nghe hết đoạn hội thoại",
  );
  await expect(page.locator(".conversation-exercises fieldset")).toHaveCount(4);
  await answer(page);
  await page
    .getByRole("button", { name: "Lưu và xem phản hồi", exact: true })
    .click();
  await expect(page.locator(".conversation-report")).toContainText(
    "Đã lưu: 4/4",
  );
  const after = await state(page);
  expect(after.conversations).toHaveLength(1);
  expect(after.conversations![0]).toMatchObject({
    mode: "listen",
    read: false,
    transcriptRevealed: false,
    listenedComplete: true,
  });
  expect(
    after.conversations![0].answers.every((item) => item.correct && !item.hint),
  ).toBe(true);
  expect(after.history).toEqual(before.history);
  expect(after.schedules).toEqual(before.schedules);
  const calls = await page.evaluate(
    () =>
      (
        window as unknown as {
          listeningCalls: { lang: string; rate: number }[];
        }
      ).listeningCalls,
  );
  expect(calls).toHaveLength(lesson.lines.length);
  expect(
    calls.every((call) => call.lang === "en-US" && call.rate === 0.75),
  ).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  expect(
    await page.evaluate(async () => {
      const core = await import("/src/core.ts");
      return core.validateBackup(JSON.parse(JSON.stringify(await core.read())))
        .conversations;
    }),
  ).toEqual(after.conversations);
});

test("a playback error cannot become a listening score and read fallback stays explicitly supported", async ({
  page,
}) => {
  await speech(page, true);
  await open(page);
  await page.getByRole("button", { name: "Nghe toàn bộ", exact: true }).click();
  await expect(page.locator(".conversation-audio-status")).toContainText(
    "Không phát được âm thanh",
  );
  await expect(
    page.getByRole("button", { name: "Lưu và xem phản hồi", exact: true }),
  ).toBeDisabled();
  expect((await state(page)).conversations || []).toEqual([]);
  await page
    .getByLabel("Cách luyện hội thoại", { exact: true })
    .selectOption("read");
  await expect(page.locator(".conversation-lines")).toHaveCount(1);
  await answer(page);
  await page
    .getByRole("button", { name: "Lưu và xem phản hồi", exact: true })
    .click();
  const result = (await state(page)).conversations![0];
  expect(result).toMatchObject({
    mode: "read",
    read: true,
    listenedComplete: false,
  });
  expect(result.answers.every((item) => item.hint)).toBe(true);
});

test("revealing words marks support and retry requires another complete playback", async ({
  page,
}) => {
  await speech(page);
  await open(page);
  await page
    .getByRole("button", {
      name: "Mở lời và nghĩa từ · tính là gợi ý",
      exact: true,
    })
    .click();
  await expect(page.locator(".conversation-lines")).toHaveCount(1);
  await page.getByRole("button", { name: "Nghe toàn bộ", exact: true }).click();
  await expect(page.locator(".conversation-exercises fieldset")).toHaveCount(4);
  await answer(page);
  await page
    .getByRole("button", { name: "Lưu và xem phản hồi", exact: true })
    .click();
  const first = (await state(page)).conversations![0];
  expect(first).toMatchObject({
    mode: "listen",
    read: true,
    transcriptRevealed: true,
  });
  expect(first.answers.every((item) => item.hint)).toBe(true);
  await page
    .getByRole("button", { name: "Làm lại toàn bài", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Lưu và xem phản hồi", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Nghe toàn bộ", exact: true }).click();
  await expect(page.locator(".conversation-exercises fieldset")).toHaveCount(4);
  await answer(page);
  await page
    .getByRole("button", { name: "Lưu và xem phản hồi", exact: true })
    .click();
  const all = (await state(page)).conversations!;
  expect(all).toHaveLength(2);
  expect(all[0]).toEqual(first);
  expect(all[1].retryOf).toBe(first.id);
  expect(all[1].answers.every((item) => item.hint)).toBe(true);
});

test("interrupted listening stays incomplete through reload and a resumed offline lesson can be saved", async ({
  page,
  context,
}) => {
  await speech(page, false, 120);
  await open(page);
  await page.getByRole("button", { name: "Nghe toàn bộ", exact: true }).click();
  await page.getByRole("button", { name: "Dừng", exact: true }).click();
  await expect(page.locator(".conversation-audio-status")).toContainText(
    "Đã dừng nghe",
  );
  await expect(page.locator(".conversation-exercises fieldset")).toHaveCount(0);
  await page.reload();
  await page.getByRole("heading", { name: /Hôm nay, mình học gì/ }).waitFor();
  await page.getByRole("button", { name: "Luyện tập", exact: true }).click();
  await page
    .getByRole("button", { name: "Mở luyện hội thoại", exact: true })
    .click();
  await expect(
    page.getByLabel("Cách luyện hội thoại", { exact: true }),
  ).toHaveValue("listen");
  await expect(page.locator(".conversation-lines")).toHaveCount(0);
  await expect(page.locator(".conversation-exercises fieldset")).toHaveCount(0);
  await state(page);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Nghe toàn bộ", exact: true }).click();
  await expect(page.locator(".conversation-exercises fieldset")).toHaveCount(4);
  await answer(page);
  await page
    .getByRole("button", { name: "Lưu và xem phản hồi", exact: true })
    .click();
  await expect(page.locator(".conversation-report")).toContainText(
    "Đã lưu: 4/4",
  );
  const attempt = (await state(page)).conversations![0];
  expect(attempt).toMatchObject({
    mode: "listen",
    read: false,
    listenedComplete: true,
    transcriptRevealed: false,
  });
  await context.setOffline(false);
});

test("the expanded catalog filters C1 and searches Vietnamese without accents and English target words", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, true);
  const level = page.getByRole("combobox", {
    name: "Mức độ hội thoại",
    exact: true,
  });
  const picker = page.getByRole("combobox", {
    name: "Chọn hội thoại",
    exact: true,
  });
  const search = page.getByRole("searchbox", {
    name: "Tìm bài nghe",
    exact: true,
  });
  await level.selectOption("C1");
  await expect(picker.locator('option[value^="listen-"]')).toHaveCount(6);
  await search.fill("transparency");
  await expect(picker.locator('option[value^="listen-"]')).toHaveCount(1);
  await picker.selectOption("listen-a-supplier-selection");
  await expect(page.locator(".conversation-title h3")).toHaveText(
    "Công khai mối liên hệ khi chọn nhà cung cấp",
  );
  await expect(page.locator(".conversation-lines")).toHaveCount(0);
  await search.fill("nghien cuu");
  await expect(picker.locator('option[value^="listen-"]')).toHaveCount(1);
  await picker.selectOption("listen-b-research-consent");
  await expect(page.locator(".conversation-title h3")).toHaveText(
    "Chuẩn bị lời mời tham gia nghiên cứu",
  );
  await search.fill("khong co bai nao nhu vay");
  await expect(picker).toBeDisabled();
  expect((await state(page)).conversations || []).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
});
