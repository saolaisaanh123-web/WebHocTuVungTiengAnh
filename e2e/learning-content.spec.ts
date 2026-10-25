import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { empty, merge, parse, serialize, type State } from "../src/core";

const corpus = parse(readFileSync("public/data/vocabulary.txt", "utf8"));
const ids = new Set([
  "work-noun-activity-01",
  "fast-adverb-speed-01",
  "hard-adverb-effort-01",
  "present-noun-gift-01",
  "miss-verb-transport-01",
  "ox-4cd0e21a9a0795-01",
  "ox-00b109cf1123a5-01",
  "ox-71ca7d932e5a9b-01",
]);
const words = corpus.filter((word) => ids.has(word.id));

for (const width of [320, 390]) {
  test(`reviewed senses, principal parts and regional guidance remain readable without changing the pending lesson at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
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
    const initial = merge(empty(), words, "default");
    initial.sourceVersion = version;
    const target = words.find((word) => word.word === "go")!;
    initial.session = {
      id: "preserved-content-session",
      queue: [{ id: target.id, skill: 1, review: "preserved-review" }],
      index: 0,
      started: Date.now(),
      count: 1,
      scheduled: true,
      draft: {
        key: "preserved-content-session:0",
        answer: "unfinished",
        hint: false,
        revealed: false,
      },
    };
    initial.schedules[`${target.id}:1`] = {
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
    for (const word of words) {
      await page
        .locator(".word-card")
        .filter({
          has: page.getByRole("heading", { name: word.word, exact: true }),
        })
        .click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.locator(".dict-pos")).toContainText(
        word.part_of_speech!,
      );
      if (word.word === "go" || word.word === "miss") {
        await expect(
          dialog.getByLabel("Các dạng động từ đã đối chiếu"),
        ).toContainText(word.word === "go" ? "went" : "missed");
      }
      if (word.word === "queue" || word.word === "rubbish") {
        await expect(dialog.locator(".dict-expression-tags")).toContainText(
          "Anh–Anh",
        );
        await expect(dialog.locator(".dict-spelling-note")).toContainText(
          word.word === "queue" ? "line" : "garbage",
        );
        await expect(
          dialog.getByRole("link", { name: /Đối chiếu Oxford/ }),
        ).toHaveAttribute("href", /\/definition\/english\//);
      } else {
        await expect(
          dialog.getByRole("region", { name: "Cách dùng đã đối chiếu" }),
        ).toBeVisible();
        await expect(dialog.locator(".usage-second-example")).toBeVisible();
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
      await page.getByRole("button", { name: "Đóng", exact: true }).click();
    }
    const after: State = await page.evaluate(async () => {
      const path = "/src/core.ts";
      return (await import(/* @vite-ignore */ path)).read();
    });
    expect(after.history).toEqual(initial.history);
    expect(after.schedules).toEqual(initial.schedules);
    expect(after.session).toEqual(initial.session);
  });
}
