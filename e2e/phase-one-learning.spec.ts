import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import {
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
const entry = (headword: string) => corpus.find((w) => w.word === headword)!;

async function open(page: Page, words: Word[]) {
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
    return (await import(/* @vite-ignore */ path)).read();
  });
}

function lesson(words: Word[], target: Word, skill: number) {
  const state = merge(empty(), words, "default");
  const now = Date.now();
  const previous = now - 8 * DAY;
  state.entries[target.id].enrolled = true;
  state.schedules[`${target.id}:${skill}`] = {
    last: previous,
    due: now - 1000,
    step: 2,
  };
  state.history = [
    {
      id: "previous-valid-answer",
      wordId: target.id,
      time: previous,
      skill,
      answer: target.word,
      correct: true,
      hint: false,
      method: skill === 0 ? "self" : "rule",
      elapsed: 2000,
      session: "previous",
      review: "previous",
      gap: 0,
      first: true,
      independent: true,
      evidenceVersion: 2,
      scheduled: true,
      contentVersion: contentKey(target, skill),
      ...([2, 3].includes(skill) ? { audioPlayed: true } : {}),
    },
  ];
  state.session = {
    id: "phase-one-session",
    queue: [{ id: target.id, skill, review: "phase-one-review" }],
    index: 0,
    started: now,
    count: 1,
    scheduled: true,
  };
  return state;
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

test("Nhớ rõ extends a due self-rated schedule after reveal and survives reload without extra credit", async ({
  page,
}) => {
  const word = entry("neighbour");
  await open(page, [word]);
  const before = lesson([word], word, 0);
  await seed(page, before);
  await resume(page);
  await page.getByRole("button", { name: "Mở đáp án để tự đánh giá" }).click();
  await page.getByRole("button", { name: "Nhớ rõ", exact: true }).click();
  await expect(page.getByText("Đã lưu tự đánh giá.")).toBeVisible();
  const after = await snapshot(page);
  expect(after.history).toHaveLength(2);
  expect(after.history[0]).toEqual(before.history[0]);
  expect(after.history.at(-1)).toMatchObject({
    method: "self",
    correct: true,
    independent: false,
  });
  const schedule = after.schedules[`${word.id}:0`];
  expect(schedule.step).toBe(3);
  expect((schedule.due - schedule.last) / DAY).toBeCloseTo(14, 1);
  expect(after.session?.queue).toEqual(before.session?.queue);
  await page.reload();
  expect((await snapshot(page)).history).toEqual(after.history);
  expect((await snapshot(page)).schedules).toEqual(after.schedules);
});

test("a spelling-only corpus update keeps existing evidence, draft and queue, then accepts the US spelling", async ({
  page,
}) => {
  const updated = entry("neighbour");
  const old = { ...updated };
  delete old.spelling_variants;
  await open(page, [updated]);
  const before = lesson([old], old, 1);
  before.session!.draft = {
    key: "phase-one-session:0",
    answer: "neighbor",
    hint: false,
    revealed: false,
  };
  await seed(page, before);
  await page.getByRole("button", { name: "Kho từ", exact: true }).click();
  await page.getByRole("button", { name: /Cập nhật kho mặc định/ }).click();
  await page
    .getByRole("button", { name: "Xác nhận cập nhật", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await snapshot(page)).entries[updated.id].word.spelling_variants,
    )
    .toBe("neighbor");
  const merged = await snapshot(page);
  expect(merged.history).toEqual(before.history);
  expect(merged.schedules).toEqual(before.schedules);
  expect(merged.session).toEqual(before.session);
  await page.getByRole("button", { name: "Hôm nay", exact: true }).click();
  await resume(page);
  await expect(page.getByRole("textbox", { name: "Câu trả lời" })).toHaveValue(
    "neighbor",
  );
  await expect(page.locator(".study > .part-of-speech")).toHaveText(
    "Danh từ · noun",
  );
  await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
  await expect(page.getByText(/Chính xác!/)).toBeVisible();
  expect((await snapshot(page)).history.at(-1)?.correct).toBe(true);
});

test("a valid alternative to an underspecified Vietnamese cue is saved neutrally without reset or retry", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const target = entry("everyone");
  const words = [target, entry("everybody")];
  await open(page, words);
  const before = lesson(words, target, 1);
  // Hiding a duplicate word from study must not make its valid spelling an
  // English error when it still fits the visible Vietnamese cue.
  before.entries[entry("everybody").id].archived = true;
  await seed(page, before);
  await resume(page);
  await expect(page.locator(".study > .part-of-speech")).toHaveText(
    "Đại từ · pronoun",
  );
  await page.getByRole("textbox", { name: "Câu trả lời" }).fill("everybody");
  await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
  await expect(page.getByText(/Chưa đủ căn cứ tính sai/)).toBeVisible();
  const after = await snapshot(page);
  expect(after.history.at(-1)).toMatchObject({
    method: "ungraded",
    correct: false,
    independent: false,
  });
  expect(after.history.at(-1)?.assessmentNote).toContain("không tính đúng/sai");
  expect(after.schedules).toEqual(before.schedules);
  expect(after.session?.queue).toEqual(before.session?.queue);
  await page.reload();
  await resume(page);
  await expect(page.getByText(/Chưa đủ căn cứ tính sai/)).toBeVisible();
  expect((await snapshot(page)).history).toEqual(after.history);
});

test("a reviewed alternative in the cloze sentence does not become a false weakness", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const target = entry("film");
  await open(page, [target]);
  const before = lesson([target], target, 4);
  await seed(page, before);
  await resume(page);
  await page.getByRole("textbox", { name: "Câu trả lời" }).fill("movie");
  await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
  await expect(page.getByText(/phù hợp trong câu này/)).toBeVisible();
  const after = await snapshot(page);
  expect(after.history.at(-1)?.method).toBe("ungraded");
  expect(after.schedules).toEqual(before.schedules);
  expect(after.session?.queue).toEqual(before.session?.queue);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});

for (const answer of ["write", "right"]) {
  test(`dictation plays the full context and handles ${answer} without unsupported failure or credit`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      class Utterance {
        text: string;
        voice: unknown;
        lang = "";
        rate = 1;
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
          getVoices: () => [{ name: "Test voice", lang: "en-GB" }],
          cancel: () => {},
          speak: (value: Utterance) => {
            (window as unknown as { spokenSentence: string }).spokenSentence =
              value.text;
            setTimeout(() => value.onend?.(), 0);
          },
        },
      });
    });
    const target = entry("write");
    await open(page, [target]);
    const before = lesson([target], target, 3);
    await seed(page, before);
    await resume(page);
    await expect(page.locator(".context")).toContainText("________");
    await page.getByRole("textbox", { name: "Câu trả lời" }).fill(answer);
    await expect(
      page.getByRole("button", { name: "Kiểm tra", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Nghe câu", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Kiểm tra", exact: true }),
    ).toBeEnabled();
    expect(
      await page.evaluate(
        () => (window as unknown as { spokenSentence: string }).spokenSentence,
      ),
    ).toBe(target.example_en);
    await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Tiếp tục", exact: true }),
    ).toBeVisible();
    const after = await snapshot(page);
    expect(after.history.at(-1)).toMatchObject({
      answer,
      audioPlayed: true,
      method: answer === "write" ? "rule" : "ungraded",
      correct: answer === "write",
    });
    if (answer === "right") {
      expect(after.schedules).toEqual(before.schedules);
      expect(after.session?.queue).toEqual(before.session?.queue);
      await expect(page.getByText(/có thể đồng âm/)).toBeVisible();
    }
  });
}
