import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { parse } from "../src/core";

const corpus = parse(readFileSync("public/data/vocabulary.txt", "utf8"));
// These tests import and persist the real ~9 MB corpus on a cold browser.
// Keep a bounded startup allowance separate from normal UI assertions.
test.setTimeout(90000);

test("the reviewed corpus exposes American Oxford and OPAL sources and usable Blog terms with their emerging-usage caveats", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Hôm nay, mình học gì?" }),
  ).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: "Kho từ", exact: true }).click();
  await expect(page.locator(".word-grid")).toHaveAttribute(
    "data-total-items",
    String(corpus.length),
  );
  const search = page.getByRole("textbox", {
    name: "Tìm từ và nghĩa",
    exact: true,
  });
  const collection = page.getByRole("combobox", { name: "Bộ từ", exact: true });

  await collection.selectOption("american-3000");
  await search.fill("elevator");
  await page
    .locator(".word-card")
    .filter({
      has: page.getByRole("heading", { name: "elevator", exact: true }),
    })
    .click();
  await expect(page.locator(".dict-translation")).toContainText("thang máy");
  await expect(page.locator(".dict-reference-list a").first()).toHaveAttribute(
    "href",
    /oxfordlearnersdictionaries\.com/,
  );
  await expect(
    page.getByRole("link", { name: "Nghe người Mỹ dùng từ (YouGlish)" }),
  ).toHaveAttribute(
    "href",
    "https://youglish.com/pronounce/elevator/english/us",
  );
  await page.getByRole("button", { name: "Đóng", exact: true }).click();

  await collection.selectOption("academic");
  await search.fill("qualitative");
  await page
    .locator(".word-card")
    .filter({
      has: page.getByRole("heading", { name: "qualitative", exact: true }),
    })
    .click();
  await expect(page.locator(".dict-opal")).toContainText("Oxford OPAL");
  await expect(page.locator(".dict-ipa")).not.toContainText("chưa đối chiếu");
  await expect(page.locator(".dict-reference-list a").first()).toHaveAttribute(
    "href",
    "https://www.oxfordlearnersdictionaries.com/definition/academic/qualitative",
  );
  await page.getByRole("button", { name: "Đóng", exact: true }).click();

  await collection.selectOption("cambridge-blog");
  await search.fill("green hushing");
  await page
    .locator(".word-card")
    .filter({
      has: page.getByRole("heading", { name: "green hushing", exact: true }),
    })
    .click();
  await expect(page.locator(".dict-learning-note")).toContainText(
    "đối chiếu nguồn",
  );
  await expect(page.locator(".dict-source-note")).toContainText(
    /mới|chuyên biệt|không chứng minh|chưa chứng minh|ổn định|thuật ngữ/,
  );
  await expect(
    page.locator(
      ".dict-example:not(.usage-second-example) .dict-example-heading h3",
    ),
  ).toHaveText("Ví dụ biên soạn");
  await expect(page.locator(".dict-reference-list a").first()).toHaveAttribute(
    "href",
    /dictionaryblog\.cambridge\.org/,
  );
  await page.getByRole("button", { name: "Đóng", exact: true }).click();

  await context.setOffline(true);
  try {
    await collection.selectOption("american-3000");
    await search.fill("elevator");
    // The query also finds word-specific usage phrases. Exact headwords lead
    // those results while the other matches remain available for lookup.
    await expect(page.locator(".word-card h3").first()).toHaveText("elevator");
    await expect(
      page.locator(".word-card").filter({
        has: page.getByRole("heading", { name: "elevator", exact: true }),
      }),
    ).toHaveCount(1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(320);
    const progress = await page.evaluate(async () => {
      const path = "/src/core.ts";
      const state = await (await import(/* @vite-ignore */ path)).read();
      return { history: state.history, schedules: state.schedules };
    });
    expect(progress).toEqual({ history: [], schedules: {} });
  } finally {
    await context.setOffline(false);
  }
});

test("a formerly lookup-only word is learnable with its corrected meaning and licensed source on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Hôm nay, mình học gì?" }),
  ).toBeVisible({ timeout: 30000 });
  const initial = await page.evaluate(async () => {
    const path = "/src/core.ts";
    const core = await import(/* @vite-ignore */ path);
    const state = await core.read();
    const entries = Object.values(state.entries) as {
      word: Record<string, string>;
    }[];
    return {
      total: entries.length,
      usable: entries.filter(({ word }) => core.canPractice(word, 0)).length,
      history: state.history.length,
    };
  });
  expect(initial).toEqual({
    total: corpus.length,
    usable: corpus.length,
    history: 0,
  });
  await page.getByRole("button", { name: "Kho từ", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Tìm từ và nghĩa", exact: true })
    .fill("bee");
  await page
    .locator(".word-card")
    .filter({ has: page.getByRole("heading", { name: "bee", exact: true }) })
    .click();
  await expect(page.locator(".dict-translation")).toHaveText("con ong");
  await expect(page.locator(".dict-definition")).not.toBeEmpty();
  await expect(page.locator(".dict-meaning .dict-label").first()).toContainText(
    "Open English WordNet (CC BY 4.0)",
  );
  await expect(
    page.locator(".dict-example:not(.usage-second-example) .dict-example-en"),
  ).toContainText("A bee landed on the flower.");
  await expect(
    page.locator(".dict-example:not(.usage-second-example) .dict-example-vi"),
  ).toContainText("Một con ong");
  await expect(page.locator(".dict-learning-note")).toContainText(
    "đối chiếu nguồn",
  );
  await expect(page.locator(".dict-reference-list a").first()).toHaveAttribute(
    "href",
    /globalwordnet\/english-wordnet\//,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
});
