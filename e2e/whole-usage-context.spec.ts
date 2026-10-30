import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { parse, serialize } from "../src/core";

const corpus = parse(readFileSync("public/data/vocabulary.txt", "utf8"));
const examples: {
  wordId: string;
  en: string;
  vi: string;
  phrase: string;
  phraseExplanation: string;
  sourceId: string;
}[] = readdirSync("data/usage-contexts")
  .filter((name) => /^range-.*\.json$/.test(name))
  .sort()
  .map(
    (name) =>
      JSON.parse(readFileSync(`data/usage-contexts/${name}`, "utf8"))[0],
  );
const evidence = JSON.parse(
  readFileSync("data/usage-contexts/evidence.json", "utf8"),
);
const words = examples.map((row) =>
  corpus.find((word) => word.id === row.wordId)!,
);

for (const width of [320, 390, 1366]) {
  test(`new contextual material from every range is readable and meaning-bound at ${width}px without changing learning results`, async ({
    page,
  }) => {
    expect(examples).toHaveLength(6);
    await page.setViewportSize({ width, height: 800 });
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
    await page.goto("/");
    await page.getByRole("heading", { name: /Hôm nay, mình học gì/ }).waitFor();
    const before = await page.evaluate(async () => {
      const core = await import("/src/core.ts");
      const state = await core.read();
      return {
        history: state.history,
        schedules: state.schedules,
        session: state.session,
      };
    });
    await page.getByRole("button", { name: "Kho từ", exact: true }).click();
    await page
      .getByRole("combobox", { name: "Trạng thái", exact: true })
      .selectOption("usage");
    await expect(page.locator(".word-grid")).toHaveAttribute(
      "data-total-items",
      "6",
    );
    for (const row of examples) {
      await page
        .locator(".word-card")
        .filter({ has: page.locator(`p[data-exposure-id="${row.wordId}"]`) })
        .click();
      const panel = page.getByRole("region", {
        name: "Cách dùng và ngữ cảnh biên soạn",
        exact: true,
      });
      await expect(panel.locator(".usage-second-example")).toContainText(
        row.en,
      );
      await expect(panel.locator(".usage-second-example")).toContainText(
        row.vi,
      );
      await expect(panel.locator(".usage-patterns")).toContainText(row.phrase);
      await expect(panel).toContainText(row.phraseExplanation);
      await expect(panel).toContainText("Tham chiếu nghĩa và từ loại");
      await expect(panel).toContainText("không phải quy tắc dùng từ đầy đủ");
      await expect(panel.locator(".usage-mistake")).toHaveCount(0);
      const source = evidence.receipts[evidence.senses[row.sourceId].receiptId];
      await expect(panel.locator(".usage-sources a").first()).toHaveAttribute(
        "href",
        source.url,
      );
      await panel.locator(".usage-sources a").first().scrollIntoViewIfNeeded();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
      const close = page.getByRole("button", { name: "Đóng", exact: true });
      await close.click();
      await expect(page.locator(".dict-entry")).toHaveCount(0);
    }
    const after = await page.evaluate(async () => {
      const core = await import("/src/core.ts");
      const state = await core.read();
      return {
        history: state.history,
        schedules: state.schedules,
        session: state.session,
      };
    });
    expect(after).toEqual(before);
  });
}

test("a newly covered word uses the second context in real practice and keeps its saved snapshot through reload", async ({
  page,
}) => {
  const row = examples[0];
  const word = words[0];
  const text = serialize([word]);
  const version = createHash("sha256").update(text).digest("hex");
  await page.route("**/data/vocabulary.txt", (route) =>
    route.fulfill({ contentType: "text/plain;charset=utf-8", body: text }),
  );
  await page.route("**/data/vocabulary-version.json", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        version,
        entryCount: 1,
        bytes: Buffer.byteLength(text),
      }),
    }),
  );
  await page.goto("/");
  await page.getByRole("heading", { name: /Hôm nay, mình học gì/ }).waitFor();
  await page.evaluate(async () => {
    const core = await import("/src/core.ts");
    const state = await core.read();
    const word = Object.values(state.entries)[0].word;
    const time = Date.now() - 8 * 86_400_000;
    const entry = state.entries[word.id];
    entry.enrolled = true;
    entry.enrolledAt = time;
    state.history = [
      {
        id: "previous-base-context",
        wordId: word.id,
        time,
        skill: 4,
        answer: word.word,
        correct: true,
        hint: false,
        method: "rule",
        elapsed: 1500,
        session: "previous",
        review: "previous",
        gap: 7 * 86_400_000,
        first: true,
        independent: true,
        evidenceVersion: 2,
        scheduled: true,
        contentVersion: core.contentKey(word, 4),
        exposureGap: 7 * 86_400_000,
      },
    ];
    state.exposures = { [word.id]: time };
    state.exposureEvents = [
      {
        id: "result:previous-base-context",
        wordId: word.id,
        time,
        resultId: "previous-base-context",
      },
    ];
    await core.save(state, await core.read(), { replace: true });
  });
  await page.reload();
  await page.getByRole("heading", { name: /Hôm nay, mình học gì/ }).waitFor();
  await page.getByRole("button", { name: "Luyện tập", exact: true }).click();
  await page.locator(".practice-card").nth(4).click();
  await page.getByRole("button", { name: /Bắt đầu luyện · 1 mục/ }).click();
  const started = await page.evaluate(async () =>
    (await import("/src/core.ts")).read(),
  );
  expect(started.session!.queue[0].context).toMatchObject({
    id: `context-2:${word.id}`,
    en: row.en,
    vi: row.vi,
  });
  const frozen = structuredClone(started.session!.queue);
  const answer = page.getByRole("textbox", {
    name: "Câu trả lời",
    exact: true,
  });
  await answer.fill("draft that is not submitted");
  await page.reload();
  await page
    .getByRole("button", { name: "Tiếp tục phiên học", exact: true })
    .click();
  await expect(answer).toHaveValue("draft that is not submitted");
  const resumed = await page.evaluate(async () =>
    (await import("/src/core.ts")).read(),
  );
  expect(resumed.session!.queue).toEqual(frozen);
  expect(resumed.history).toEqual(started.history);
  expect(resumed.schedules).toEqual(started.schedules);
  await answer.fill(word.word);
  await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await page.evaluate(async () => (await import("/src/core.ts")).read()))
          .history.length,
    )
    .toBe(2);
  const after = await page.evaluate(async () =>
    (await import("/src/core.ts")).read(),
  );
  expect(after.history[1]).toMatchObject({
    correct: true,
    method: "rule",
    context: frozen[0].context,
  });
  expect(after.schedules).toEqual(started.schedules);
});
