import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { empty, merge, parse, serialize, type State } from "../src/core";

const corpus = parse(readFileSync("public/data/vocabulary.txt", "utf8"));
const ids = new Set([
  "ox-4cd0e21a9a0795-01",
  "work-noun-activity-01",
  "neighbour-01",
  "advice-01",
]);
const words = corpus.filter((word) => ids.has(word.id));

for (const width of [320, 1280]) {
  test(`reference lookup finds verb forms and unaccented Vietnamese while retaining the lesson at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    expect(words).toHaveLength(4);
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
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Hôm nay, mình học gì/ }),
    ).toBeVisible();
    const initial = merge(empty(), words, "default");
    initial.sourceVersion = version;
    const go = words.find((word) => word.word === "go")!;
    initial.session = {
      id: "lookup-pending-session",
      queue: [{ id: go.id, skill: 1, review: "lookup-review" }],
      index: 0,
      started: Date.now(),
      count: 1,
      scheduled: true,
      draft: {
        key: "lookup-pending-session:0",
        answer: "unfinished",
        hint: false,
        revealed: false,
      },
    };
    initial.schedules[`${go.id}:1`] = {
      last: Date.now() - 86400000,
      due: Date.now() + 86400000,
      step: 2,
    };
    await page.evaluate(async (state) => {
      const path = "/src/core.ts";
      const core = await import(/* @vite-ignore */ path);
      await core.save(state, await core.read(), { replace: true });
    }, initial);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: /Hôm nay, mình học gì/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Kho từ", exact: true }).click();
    const originalOrder = await page.locator(".word-card h3").allTextContents();
    const search = page.getByRole("textbox", {
      name: "Tìm từ và nghĩa",
      exact: true,
    });
    await expect(search).toHaveAccessibleDescription(/Tra cả dạng động từ/);
    await search.fill("went");
    await expect(page.locator(".word-card h3")).toHaveText(["go"]);
    await search.fill("go home");
    await expect(page.locator(".word-card h3")).toHaveText(["go"]);
    await search.fill("khong dem duoc");
    await expect(page.locator(".word-card")).toHaveCount(2);
    await expect(page.locator(".word-card h3")).toContainText([
      "work",
      "advice",
    ]);
    await search.fill("VIEC CAN LAM");
    await expect(page.locator(".word-card h3")).toHaveText(["work"]);
    await search.fill("neighbor");
    await expect(page.locator(".word-card h3")).toHaveText(["neighbor"]);
    await search.fill("hang xom");
    await expect(page.locator(".word-card h3")).toHaveText(["neighbor"]);
    await search.fill("oxfordlearnersdictionaries");
    await expect(page.locator(".word-card")).toHaveCount(0);
    await search.fill("");
    await expect(page.locator(".word-card h3")).toHaveText(originalOrder);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    const after: State = await page.evaluate(async () => {
      const path = "/src/core.ts";
      return (await import(/* @vite-ignore */ path)).read();
    });
    expect(after.history).toEqual(initial.history);
    expect(after.schedules).toEqual(initial.schedules);
    expect(after.session).toEqual(initial.session);
    expect(errors).toEqual([]);
  });
}
