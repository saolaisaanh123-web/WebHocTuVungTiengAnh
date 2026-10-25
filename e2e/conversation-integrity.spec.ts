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

const sample = dialogues.find(
  (dialogue) => dialogue.id === "assignment-feedback",
)!;
const other = dialogues.find((dialogue) => dialogue.id === "buying-a-desk")!;
const corpus = parse(readFileSync("public/data/vocabulary.txt", "utf8"));

for (const id of ["preparing-for-a-visit", "booking-a-later-train"]) {
  test(`new reviewed verb senses can be practised and saved in a complete mobile dialogue: ${id}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const dialogue = dialogues.find((item) => item.id === id)!;
    const ids = new Set(dialogue.targets.map((target) => target.id));
    const words = corpus.filter((word) => ids.has(word.id));
    await page.route("**/data/vocabulary.txt", (route) =>
      route.fulfill({
        contentType: "text/plain;charset=utf-8",
        body: serialize(words),
      }),
    );
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Hôm nay, mình học gì/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Luyện tập", exact: true }).click();
    await page
      .getByRole("button", { name: "Mở luyện hội thoại", exact: true })
      .click();
    await expect(page.locator(".conversation-title h3")).toHaveText(
      dialogue.title,
    );
    await expect(page.locator(".conversation-reason")).toContainText(
      "chưa có lịch sử phù hợp",
    );
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
    await page
      .getByRole("button", { name: "Lưu và xem phản hồi", exact: true })
      .click();
    await expect(page.locator(".conversation-report")).toContainText(
      "Đã lưu: 3/3",
    );
    const state = await page.evaluate(async () =>
      (await import("/src/core.ts")).read(),
    );
    expect(state.conversations).toHaveLength(1);
    expect(state.conversations[0].targetIds).toEqual([...ids]);
    expect(
      state.conversations[0].answers.every(
        (answer) => answer.correct && answer.hint,
      ),
    ).toBe(true);
    expect(state.history).toEqual([]);
    expect(state.schedules).toEqual({});
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

async function openFixture(page: Page, includeOther = false) {
  const ids = new Set(
    [sample, ...(includeOther ? [other] : [])].flatMap((dialogue) =>
      dialogue.targets.map((target) => target.id),
    ),
  );
  const words = corpus.filter((word) => ids.has(word.id));
  await page.route("**/data/vocabulary.txt", (route) =>
    route.fulfill({
      contentType: "text/plain;charset=utf-8",
      body: serialize(words),
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Hôm nay, mình học gì/ }),
  ).toBeVisible();
  return words;
}

async function seed(page: Page, state: State) {
  await page.evaluate(async (value) => {
    const core = await import("/src/core.ts");
    await core.save(value, await core.read(), { replace: true });
  }, state);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /Hôm nay, mình học gì/ }),
  ).toBeVisible();
}

test("separate transcript views keep immutable exposure events without grading words or changing schedules", async ({
  page,
}) => {
  const words = await openFixture(page);
  const state = merge(empty(), words, "default");
  await seed(page, state);
  const before = await page.evaluate(async () =>
    (await import("/src/core.ts")).read(),
  );
  const targetIds = sample.targets.map((target) => target.id);
  const beforeEventIds = new Set(
    before.exposureEvents?.map((event) => event.id) || [],
  );
  await page.getByRole("button", { name: "Luyện tập", exact: true }).click();
  await page
    .getByRole("button", { name: "Mở luyện hội thoại", exact: true })
    .click();
  await expect(page.locator(".conversation-title h3")).toHaveText(sample.title);
  await expect
    .poll(async () => {
      const saved = await page.evaluate(async () =>
        (await import("/src/core.ts")).read(),
      );
      return saved.exposureEvents?.filter(
        (event) =>
          targetIds.includes(event.wordId) && !beforeEventIds.has(event.id),
      ).length;
    })
    .toBe(targetIds.length);
  const first = await page.evaluate(async () =>
    (await import("/src/core.ts")).read(),
  );
  const firstEvents = first.exposureEvents!.filter(
    (event) =>
      targetIds.includes(event.wordId) && !beforeEventIds.has(event.id),
  );
  expect(new Set(firstEvents.map((event) => event.time)).size).toBe(1);
  expect(firstEvents.every((event) => event.resultId === undefined)).toBe(true);
  await page
    .getByRole("button", { name: "Ẩn đoạn để tự thử nhớ", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Xem lại đoạn · tính là gợi ý", exact: true })
    .click();
  await expect
    .poll(async () => {
      const saved = await page.evaluate(async () =>
        (await import("/src/core.ts")).read(),
      );
      return saved.exposureEvents?.filter(
        (event) =>
          targetIds.includes(event.wordId) && !beforeEventIds.has(event.id),
      ).length;
    })
    .toBe(2 * targetIds.length);
  const after = await page.evaluate(async () =>
    (await import("/src/core.ts")).read(),
  );
  for (const firstEvent of firstEvents)
    expect(
      after.exposureEvents?.find((event) => event.id === firstEvent.id),
    ).toEqual(firstEvent);
  for (const id of targetIds) {
    const events = after.exposureEvents!.filter(
      (event) => event.wordId === id && !beforeEventIds.has(event.id),
    );
    expect(events).toHaveLength(2);
    expect(events[0].id).not.toBe(events[1].id);
    expect(after.exposures[id]).toBe(
      Math.max(...events.map((event) => event.time)),
    );
  }
  expect(after.history).toEqual(before.history);
  expect(after.schedules).toEqual(before.schedules);
  expect(after.conversations).toEqual(before.conversations);
});

test("a progress recommendation opens a text containing its exact target IDs ahead of the remembered unrelated text", async ({
  page,
}) => {
  const words = await openFixture(page, true);
  const state = merge(empty(), words, "default");
  const now = Date.now();
  const requested = sample.targets.slice(0, 3).map((target) => target.id);
  state.history = requested.map((id, index) => ({
    id: `current-sense-${index}`,
    wordId: id,
    time: now - 1000,
    skill: 0,
    answer: state.entries[id].word.word,
    correct: true,
    hint: false,
    method: "rule",
    first: true,
    elapsed: 1500,
    session: `s-${index}`,
    review: `r-${index}`,
    evidenceVersion: 2,
    independent: true,
    gap: 2 * 86400000,
    exposureGap: 2 * 86400000,
    contentVersion: contentKey(state.entries[id].word),
  }));
  other.targets.forEach((target) => {
    state.entries[target.id].enrolled = true;
  });
  await page.evaluate(
    (id) =>
      localStorage.setItem(
        "jeongyeon:conversation-drafts:v1",
        JSON.stringify({ selected: id, drafts: {} }),
      ),
    other.id,
  );
  await seed(page, state);
  await page.getByRole("button", { name: "Tiến độ", exact: true }).click();
  const recommendation = page.locator(".insight-recommendation").filter({
    has: page.getByRole("heading", {
      name: "Thử dùng từ trong hội thoại",
      exact: true,
    }),
  });
  await recommendation
    .getByRole("button", { name: "Luyện ngay", exact: true })
    .click();
  await expect(page.locator(".conversation-title h3")).toHaveText(sample.title);
  await expect(page.getByLabel("Chọn hội thoại", { exact: true })).toHaveValue(
    sample.id,
  );
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Đang ưu tiên đoạn có từ được đề xuất" }),
  ).toContainText(
    requested.map((id) => state.entries[id].word.word).join(", "),
  );
  await expect(
    page
      .getByLabel("Chọn hội thoại", { exact: true })
      .locator(`option[value="${other.id}"]`),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Xem mọi hội thoại", exact: true })
    .click();
  await expect(
    page
      .getByLabel("Chọn hội thoại", { exact: true })
      .locator(`option[value="${other.id}"]`),
  ).toHaveCount(1);
  const after = await page.evaluate(async () =>
    (await import("/src/core.ts")).read(),
  );
  expect(after.history).toEqual(state.history);
  expect(after.schedules).toEqual(state.schedules);
});

for (const mode of ["one-us-one-gb", "gb-only"] as const) {
  test(`conversation playback keeps one regional accent and discloses real voices: ${mode}`, async ({
    page,
  }) => {
    await page.addInitScript((mode) => {
      const voices =
        mode === "gb-only"
          ? [{ name: "British test", lang: "en-GB", voiceURI: "gb-1" }]
          : [
              { name: "British test", lang: "en-GB", voiceURI: "gb-1" },
              { name: "American test", lang: "en-US", voiceURI: "us-1" },
            ];
      const calls: { lang: string; voice: string }[] = [];
      Object.defineProperty(window, "conversationSpeech", { value: calls });
      class Utterance {
        constructor(public text: string) {}
        lang = "";
        voice?: { lang: string; name: string };
        onend?: () => void;
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
          cancel() {},
          pause() {},
          resume() {},
          speak(utterance: Utterance) {
            calls.push({
              lang: utterance.lang,
              voice: utterance.voice?.name || "",
            });
            setTimeout(() => utterance.onend?.(), 0);
          },
        },
      });
    }, mode);
    await openFixture(page);
    await page.getByRole("button", { name: "Luyện tập", exact: true }).click();
    await page
      .getByRole("button", { name: "Mở luyện hội thoại", exact: true })
      .click();
    await expect(page.locator(".conversation-title h3")).toHaveText(
      sample.title,
    );
    const status = page.getByTestId("conversation-voice-status");
    await expect(status).toContainText(
      mode === "gb-only"
        ? "đang dùng giọng tiếng Anh thay thế en-GB"
        : "Giọng tổng hợp đang dùng: en-US",
    );
    await expect(status).toContainText("Hai nhân vật dùng chung một giọng");
    await page
      .getByRole("button", { name: "Nghe toàn bộ", exact: true })
      .click();
    await expect(page.locator(".conversation-audio-status")).toContainText(
      "Đã nghe hết đoạn hội thoại",
    );
    const calls = await page.evaluate(
      () =>
        (
          window as unknown as {
            conversationSpeech: { lang: string; voice: string }[];
          }
        ).conversationSpeech,
    );
    expect(calls).toHaveLength(sample.lines.length);
    expect(
      calls.every(
        (call) => call.lang === (mode === "gb-only" ? "en-GB" : "en-US"),
      ),
    ).toBe(true);
  });
}
