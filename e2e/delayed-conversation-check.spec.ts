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
import {
  listeningDialogues,
  makeConversationAttempt,
} from "../src/conversations";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 29, 12);
const dialogue = listeningDialogues[0];
const ids = new Set(dialogue.targets.map((target) => target.id));
const corpus = parse(readFileSync("public/data/vocabulary.txt", "utf8"));
const words = corpus.filter(
  (word) =>
    ids.has(word.id) ||
    (word.word === "garden" && word.part_of_speech === "noun"),
);
const values = Object.fromEntries(
  dialogue.questions.map((question) => [question.id, question.accepted[0]]),
);
const lines = dialogue.lines.map((_, index) => `line-${index}`);

async function state(page: Page): Promise<State> {
  return page.evaluate(async () => (await import("/src/core.ts")).read());
}
async function speech(page: Page) {
  await page.addInitScript(() => {
    class Utterance {
      constructor(public text: string) {}
      lang = "";
      rate = 1;
      voice: unknown;
      onend?: () => void;
      onerror?: (event: { error: string }) => void;
    }
    let timer: ReturnType<typeof setTimeout>;
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: Utterance,
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        getVoices: () => [
          { name: "American test voice", lang: "en-US", voiceURI: "us-test" },
        ],
        addEventListener() {},
        removeEventListener() {},
        pause() {},
        resume() {},
        cancel() {
          clearTimeout(timer);
        },
        speak(value: Utterance) {
          timer = setTimeout(() => value.onend?.(), 1);
        },
      },
    });
  });
}
function fixture(contactTime: number, localDraft = true) {
  const saved = merge(empty(), words, "default");
  for (const id of ids) {
    saved.entries[id].enrolled = true;
    saved.entries[id].enrolledAt = contactTime - DAY;
  }
  const wrong = dialogue.questions.find(
    (question) => question.kind === "cloze",
  )!;
  const previous = makeConversationAttempt(
    saved,
    dialogue,
    { ...values, [wrong.id]: "wrong" },
    {
      mode: "listen",
      complete: true,
      lines,
      transcriptRevealed: false,
    },
  );
  previous.time = contactTime - 1000;
  saved.conversations = [previous];
  saved.exposures = Object.fromEntries([...ids].map((id) => [id, contactTime]));
  saved.exposureEvents = [...ids].map((id) => ({
    id: `before-${id}`,
    wordId: id,
    time: contactTime,
  }));
  const first = dialogue.targets[0].id;
  saved.schedules[`${first}:1`] = {
    due: NOW + 7 * DAY,
    last: contactTime,
    step: 3,
    contentVersion: contentKey(saved.entries[first].word, 1),
  };
  const bank = {
    selected: dialogue.id,
    drafts: localDraft
      ? {
          [dialogue.id]: {
            version: dialogue.version,
            mode: "listen",
            transcriptRevealed: false,
            values: Object.fromEntries(
              previous.answers.map((answer) => [
                answer.questionId,
                answer.answer,
              ]),
            ),
            translation: false,
            lines,
            complete: true,
            savedId: previous.id,
            recall: false,
            usedHint: false,
          },
        }
      : {},
  };
  return { saved, bank, previous };
}
async function setup(page: Page, contactTime: number, localDraft = true) {
  await page.clock.setFixedTime(NOW);
  await speech(page);
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
        bytes: Buffer.byteLength(text),
        entryCount: words.length,
      }),
    }),
  );
  await page.goto("/");
  await page.getByRole("heading", { name: /Hôm nay, mình học gì/ }).waitFor();
  const data = fixture(contactTime, localDraft);
  await page.evaluate(async ({ saved, bank }) => {
    const core = await import("/src/core.ts");
    const before = await core.read();
    await core.save({ ...saved, sourceVersion: before.sourceVersion }, before, {
      replace: true,
    });
    localStorage.setItem(
      "jeongyeon:conversation-drafts:v1",
      JSON.stringify(bank),
    );
  }, data);
  await page.reload();
  await page.getByRole("heading", { name: /Hôm nay, mình học gì/ }).waitFor();
  return data;
}
async function open(page: Page) {
  await page.getByRole("button", { name: "Luyện tập", exact: true }).click();
  await page
    .getByRole("button", { name: "Mở luyện hội thoại", exact: true })
    .click();
  await expect(page.locator(".conversation-title h3")).toHaveText(
    dialogue.title,
  );
}
async function fill(page: Page) {
  for (const [index, question] of dialogue.questions.entries()) {
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
async function listen(page: Page) {
  await page.getByRole("button", { name: "Nghe toàn bộ", exact: true }).click();
  await expect(page.locator(".conversation-audio-status")).toContainText(
    "Đã nghe hết đoạn hội thoại",
  );
}

test("a saved lesson offers a genuinely new delayed check before exposing old answers and preserves it across reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const { previous, saved } = await setup(page, NOW - 2 * DAY);
  const baseline = await state(page);
  await open(page);
  const begin = page.getByRole("button", {
    name: "Kiểm tra lại sau khoảng nghỉ",
    exact: true,
  });
  await expect(begin).toBeVisible();
  await expect(page.locator(".conversation-lines")).toHaveCount(0);
  await expect(page.locator(".conversation-feedback")).toHaveCount(0);
  await expect(page.locator(".conversation-exercises fieldset")).toHaveCount(0);
  expect(
    (await state(page)).exposureEvents?.filter((event) =>
      ids.has(event.wordId),
    ),
  ).toEqual(baseline.exposureEvents?.filter((event) => ids.has(event.wordId)));
  await begin.click();
  await expect(
    page.getByText(/Lượt kiểm tra mới sau khoảng nghỉ · bắt đầu/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Lưu và xem phản hồi", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await page.getByRole("heading", { name: /Hôm nay, mình học gì/ }).waitFor();
  await open(page);
  await expect(
    page.getByText(/Lượt kiểm tra mới sau khoảng nghỉ · bắt đầu/),
  ).toBeVisible();
  await expect(page.locator(".conversation-exercises fieldset")).toHaveCount(0);
  await listen(page);
  await fill(page);
  await page
    .getByRole("button", { name: "Lưu và xem phản hồi", exact: true })
    .click();
  await expect
    .poll(async () => (await state(page)).conversations?.length)
    .toBe(2);
  const after = await state(page);
  expect(after.conversations![0]).toEqual(previous);
  expect(after.conversations![1]).toMatchObject({
    delayedCheck: {
      previousAttemptId: previous.id,
      startedAt: NOW,
      previousContactAt: NOW - 2 * DAY,
    },
    mode: "listen",
    transcriptRevealed: false,
  });
  expect(after.conversations![1].retryOf).toBeUndefined();
  expect(
    after.conversations![1].answers.every(
      (answer) => answer.correct && !answer.hint,
    ),
  ).toBe(true);
  expect(after.history).toEqual(saved.history);
  expect(after.schedules).toEqual(saved.schedules);
  const proof = await page.evaluate(async () => {
    const core = await import("/src/core.ts");
    const conversations = await import("/src/conversations.ts");
    const analytics = await import("/src/analytics.ts");
    const current = await core.read();
    return {
      backup: core.validateBackup(JSON.parse(JSON.stringify(current)))
        .conversations,
      weak: conversations
        .recommendDialogues(current, { weakOnly: true })
        .map((item) => item.dialogue.id),
      retained: analytics.analyzeLearning(current).counts.retained,
    };
  });
  expect(proof.backup).toEqual(after.conversations);
  expect(proof.weak).not.toContain(dialogue.id);
  expect(proof.retained).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
});

test("an immediate repair stays supported and only a later return can start a fresh check", async ({
  page,
}) => {
  const { previous } = await setup(page, NOW - 60_000);
  await open(page);
  await expect(
    page.getByRole("button", {
      name: "Kiểm tra lại sau khoảng nghỉ",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Làm lại toàn bài", exact: true })
    .click();
  await listen(page);
  await fill(page);
  await page
    .getByRole("button", { name: "Lưu và xem phản hồi", exact: true })
    .click();
  await expect
    .poll(async () => (await state(page)).conversations?.length)
    .toBe(2);
  const after = await state(page);
  expect(after.conversations![1].retryOf).toBe(previous.id);
  expect(after.conversations![1].answers.every((answer) => answer.hint)).toBe(
    true,
  );
  expect(after.conversations![1].delayedCheck).toBeUndefined();
  await page.clock.setFixedTime(NOW + DAY + 1000);
  await page.reload();
  await page.getByRole("heading", { name: /Hôm nay, mình học gì/ }).waitFor();
  await open(page);
  await expect(
    page.getByRole("button", {
      name: "Kiểm tra lại sau khoảng nghỉ",
      exact: true,
    }),
  ).toBeVisible();
  expect((await state(page)).conversations).toEqual(after.conversations);
});

test("restored history is gated too, and explicitly viewing old results restarts the recorded rest", async ({
  page,
}) => {
  const { previous } = await setup(page, NOW - 2 * DAY, false);
  await open(page);
  await expect(
    page.getByRole("button", {
      name: "Kiểm tra lại sau khoảng nghỉ",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Xem lại kết quả cũ · tính là tiếp xúc",
      exact: true,
    })
    .click();
  await expect(page.locator(".conversation-report")).toBeVisible();
  await expect
    .poll(async () => {
      const current = await state(page);
      return dialogue.targets.every(
        (target) => current.exposures?.[target.id] === NOW,
      );
    })
    .toBe(true);
  await page.clock.setFixedTime(NOW + 1000);
  await page.reload();
  await page.getByRole("heading", { name: /Hôm nay, mình học gì/ }).waitFor();
  await open(page);
  await expect(
    page.getByRole("button", {
      name: "Kiểm tra lại sau khoảng nghỉ",
      exact: true,
    }),
  ).toHaveCount(0);
  expect((await state(page)).conversations).toEqual([previous]);
});
