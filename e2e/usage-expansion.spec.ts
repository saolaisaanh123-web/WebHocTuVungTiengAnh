import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import {
  cloze,
  contentKey,
  empty,
  merge,
  parse,
  serialize,
  type State,
  type Word,
} from "../src/core";
import type { UsageEntry } from "../src/usage";

const corpus = parse(readFileSync("public/data/vocabulary.txt", "utf8"));
const supplements: UsageEntry[] = readdirSync("data/usage")
  .filter((file) => file.endsWith(".json"))
  .flatMap((file) => JSON.parse(readFileSync(`data/usage/${file}`, "utf8")));
const targets = ["ask", "knowledge", "capable"].map((headword) =>
  corpus.find((word) => word.word === headword)!,
);
const nextTargets = ["spend", "paper", "familiar"].map((headword) =>
  corpus.find((word) => word.word === headword)!,
);
const latestTargets = ["drink", "search", "think"].map((headword) =>
  corpus.find(
    (word) => word.word === headword && word.part_of_speech === "verb",
  )!,
);
const apple: Word = {
  id: "usage-filter-apple",
  word: "apple",
  part_of_speech: "noun",
  meaning_vi: "quả táo",
  example_en: "There is an apple on the desk.",
  example_vi: "Có một quả táo trên bàn.",
  learning_status: "ready",
  content_status: "reviewed",
};
const fixture = [...targets, apple];
const filterLabel = "Có cách dùng và ngữ cảnh bổ sung";
const DAY = 86_400_000;

async function snapshot(page: Page): Promise<State> {
  return page.evaluate(async () => {
    const path = "/src/core.ts";
    return (await import(/* @vite-ignore */ path)).read();
  });
}

async function open(page: Page, words = fixture) {
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
  return version;
}

function enrolledState(words: Word[], version: string): State {
  const state = merge(empty(), words, "default");
  state.sourceVersion = version;
  const time = Date.now() - 8 * DAY;
  for (const entry of Object.values(state.entries)) {
    entry.enrolled = true;
    entry.enrolledAt = time;
  }
  return state;
}

function preservedStudyState(version: string): State {
  const state = enrolledState(fixture, version);
  const word = targets[0];
  const time = Date.now() - 8 * DAY;
  state.history = [
    {
      id: "expanded-preserved-result",
      wordId: word.id,
      time,
      skill: 1,
      answer: word.word,
      correct: true,
      hint: false,
      method: "rule",
      elapsed: 1600,
      session: "expanded-earlier-session",
      review: "expanded-earlier-review",
      gap: 7 * DAY,
      first: true,
      independent: true,
      evidenceVersion: 2,
      contentVersion: contentKey(word, 1),
      exposureGap: 7 * DAY,
      scheduled: true,
    },
  ];
  state.exposures = { [word.id]: time };
  state.exposureEvents = [
    {
      id: "result:expanded-preserved-result",
      wordId: word.id,
      time,
      resultId: "expanded-preserved-result",
    },
  ];
  state.schedules[`${word.id}:1`] = {
    last: time,
    due: Date.now() - 1000,
    step: 2,
    contentVersion: contentKey(word, 1),
  };
  state.session = {
    id: "expanded-preserved-session",
    index: 0,
    started: Date.now() - 1000,
    scheduled: true,
    count: 2,
    queue: [
      { id: word.id, skill: 1, review: "expanded-scheduled-review" },
      { id: targets[1].id, skill: 4, review: "expanded-pending-review" },
    ],
    draft: {
      key: "expanded-preserved-session:0",
      answer: "An unfinished answer",
      hint: false,
      revealed: false,
    },
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
    page.getByRole("heading", { name: /Hôm nay, mình học gì/ }),
  ).toBeVisible();
}

async function selectUsage(page: Page) {
  await page.getByRole("button", { name: "Kho từ", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Trạng thái", exact: true })
    .selectOption("usage");
}

function protectedLearning(state: State) {
  return {
    entries: state.entries,
    history: state.history,
    schedules: state.schedules,
    session: state.session,
    pausedScheduled: state.pausedScheduled,
    writing: state.writing,
    conversations: state.conversations,
    voice: state.voice,
    rate: state.rate,
    daily: state.daily,
    learningFloor: state.learningFloor,
    studySkills: state.studySkills,
  };
}

for (const width of [320, 390]) {
  test(`expanded verb, noun and adjective usage is discoverable and readable at ${width}px without grading or changing the saved lesson`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    for (const word of targets)
      expect(supplements.find((item) => item.wordId === word.id)).toBeDefined();
    const version = await open(page);
    await seed(page, preservedStudyState(version));
    const before = await snapshot(page);
    await selectUsage(page);
    await expect(page.locator(".word-grid")).toHaveAttribute(
      "data-total-items",
      "3",
    );
    await expect(page.locator(".word-card")).toHaveCount(3);
    await expect(page.locator("main")).toContainText(
      `Trạng thái: ${filterLabel}`,
    );
    await expect(page.locator(".word-card h3")).not.toContainText(["apple"]);

    for (const word of targets) {
      const usage = supplements.find((item) => item.wordId === word.id)!;
      await page
        .locator(".word-card")
        .filter({
          has: page.getByRole("heading", { name: word.word, exact: true }),
        })
        .click();
      const panel = page.getByRole("region", {
        name: "Cách dùng đã đối chiếu",
      });
      await expect(panel).toBeVisible();
      await expect(panel).toContainText(usage.patterns[0].form);
      if (usage.countability)
        await expect(panel.locator(".usage-countability")).toHaveText(
          usage.countability,
        );
      await expect(panel.locator(".usage-second-example")).toContainText(
        usage.example.en,
      );
      await expect(panel.locator(".usage-second-example")).toContainText(
        usage.example.vi,
      );
      await panel
        .getByText("Lỗi dễ gặp trong cách dùng này", { exact: true })
        .click();
      await expect(panel.locator(".usage-mistake")).toContainText(
        usage.mistake.explanation,
      );
      const source = panel.locator(".usage-sources a").first();
      await expect(source).toHaveAttribute("href", usage.sources[0].url);
      await expect(source).toHaveAttribute("rel", "noopener noreferrer");
      const bounds = await source.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
      await page.getByRole("button", { name: "Đóng", exact: true }).click();
    }

    await page
      .getByRole("combobox", { name: "Trạng thái", exact: true })
      .selectOption("");
    await expect(page.locator(".word-card")).toHaveCount(4);
    await page
      .getByRole("combobox", { name: "Trạng thái", exact: true })
      .selectOption("usage");
    expect(protectedLearning(await snapshot(page))).toEqual(
      protectedLearning(before),
    );
  });
}

test("personal sense and word-class changes do not inherit the source supplement or enter its filter", async ({
  page,
}) => {
  const personal = [
    { ...targets[1], meaning_vi: "Nghĩa riêng đã thay đổi của tôi" },
    { ...targets[2], part_of_speech: "noun" },
  ];
  const version = await open(page, personal);
  const state = enrolledState(personal, version);
  for (const entry of Object.values(state.entries)) entry.origin = "personal";
  await seed(page, state);
  await selectUsage(page);
  await expect(page.locator(".word-card")).toHaveCount(0);
  await expect(page.locator(".empty-state")).toContainText(
    "Không có từ phù hợp",
  );
  await page
    .getByRole("combobox", { name: "Trạng thái", exact: true })
    .selectOption("");
  await expect(page.locator(".word-card")).toHaveCount(2);
  await page
    .locator(".word-card")
    .filter({
      has: page.getByRole("heading", { name: "knowledge", exact: true }),
    })
    .click();
  await expect(page.locator(".dict-translation")).toHaveText(
    personal[0].meaning_vi,
  );
  await expect(page.locator(".dict-usage")).toHaveCount(0);
  expect((await snapshot(page)).history).toEqual([]);
  expect((await snapshot(page)).schedules).toEqual({});
});

test("the source-usage filter carries into real context practice and preserves the paused scheduled lesson", async ({
  page,
}) => {
  const version = await open(page);
  const initial = preservedStudyState(version);
  await seed(page, initial);
  await selectUsage(page);
  await page.getByRole("button", { name: "Luyện tập", exact: true }).click();
  await page.locator(".practice-card").nth(4).click();
  await expect(page.locator("main")).toContainText(
    `Trạng thái: ${filterLabel}`,
  );
  await expect(
    page.getByRole("button", { name: /Bắt đầu luyện · 3 mục/ }),
  ).toBeEnabled();
  await page.getByRole("button", { name: /Bắt đầu luyện · 3 mục/ }).click();
  await expect(page.locator(".study")).toBeVisible();
  const started = await snapshot(page);
  expect(started.session?.scheduled).toBe(false);
  expect(started.session?.queue).toHaveLength(3);
  expect(new Set(started.session?.queue.map((task) => task.id))).toEqual(
    new Set(targets.map((word) => word.id)),
  );
  expect(started.session?.queue.every((task) => task.skill === 4)).toBe(true);
  expect(started.pausedScheduled).toEqual(initial.session);
  expect(started.schedules).toEqual(initial.schedules);
  expect(started.history).toEqual(initial.history);
  await page.getByRole("button", { name: /Lưu & tạm dừng/ }).click();
  await page.reload();
  const restored = await snapshot(page);
  expect(restored.session).toEqual(started.session);
  expect(restored.pausedScheduled).toEqual(initial.session);
  expect(restored.schedules).toEqual(initial.schedules);
  expect(restored.history).toEqual(initial.history);
});

for (const contextTargets of [nextTargets, latestTargets]) {
  for (const width of [320, 390]) {
    test(`reviewed ${contextTargets.map((word) => word.word).join(", ")} supplements stay readable and their second contexts survive real practice, reload and JSON export at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      for (const word of contextTargets)
        expect(
          supplements.find((item) => item.wordId === word.id),
        ).toBeDefined();
      const words = [...contextTargets, apple];
      const version = await open(page, words);
      const initial = enrolledState(words, version);
      const time = Date.now() - 8 * DAY;
      initial.history = contextTargets.map((word, index) => ({
        id: `next-usage-base-${index}`,
        wordId: word.id,
        time,
        skill: 4,
        answer: word.word,
        correct: true,
        hint: false,
        method: "rule",
        elapsed: 1400,
        session: "next-usage-base-session",
        review: `next-usage-base-review-${index}`,
        gap: 7 * DAY,
        first: true,
        independent: true,
        evidenceVersion: 2,
        contentVersion: contentKey(word, 4),
        exposureGap: 7 * DAY,
        scheduled: true,
      }));
      initial.exposures = Object.fromEntries(
        contextTargets.map((word) => [word.id, time]),
      );
      initial.exposureEvents = initial.history.map((result) => ({
        id: `result:${result.id}`,
        wordId: result.wordId,
        time,
        resultId: result.id,
      }));
      for (const word of contextTargets)
        initial.schedules[`${word.id}:4`] = {
          last: time,
          due: Date.now() - 1000,
          step: 2,
          contentVersion: contentKey(word, 4),
        };
      await seed(page, initial);
      await selectUsage(page);
      await expect(page.locator(".word-grid")).toHaveAttribute(
        "data-total-items",
        "3",
      );
      await expect(page.locator(".word-card")).toHaveCount(3);
      for (const word of contextTargets) {
        const usage = supplements.find((item) => item.wordId === word.id)!;
        await page
          .locator(".word-card")
          .filter({
            has: page.getByRole("heading", { name: word.word, exact: true }),
          })
          .click();
        const panel = page.getByRole("region", {
          name: "Cách dùng đã đối chiếu",
        });
        await expect(panel).toContainText(usage.patterns[0].form);
        await expect(panel.locator(".usage-second-example")).toContainText(
          usage.example.en,
        );
        await expect(panel.locator(".usage-second-example")).toContainText(
          usage.example.vi,
        );
        if (word.word === "paper") {
          expect(usage.countability).toBeTruthy();
          await expect(panel.locator(".usage-countability")).toHaveText(
            usage.countability!,
          );
        }
        await panel
          .getByText("Lỗi dễ gặp trong cách dùng này", { exact: true })
          .click();
        await expect(panel.locator(".usage-mistake")).toContainText(
          usage.mistake.explanation,
        );
        await expect(panel.locator(".usage-sources a").first()).toHaveAttribute(
          "href",
          usage.sources[0].url,
        );
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBe(width);
        await page.getByRole("button", { name: "Đóng", exact: true }).click();
      }
      expect((await snapshot(page)).history).toEqual(initial.history);
      expect((await snapshot(page)).schedules).toEqual(initial.schedules);

      await page
        .getByRole("button", { name: "Luyện tập", exact: true })
        .click();
      await page.locator(".practice-card").nth(4).click();
      await page.getByRole("button", { name: /Bắt đầu luyện · 3 mục/ }).click();
      await expect(page.locator(".study")).toBeVisible();
      const started = await snapshot(page);
      const queue = started.session!.queue;
      expect(queue).toHaveLength(3);
      expect(new Set(queue.map((task) => task.id))).toEqual(
        new Set(contextTargets.map((word) => word.id)),
      );
      for (const task of queue) {
        const word = contextTargets.find((item) => item.id === task.id)!;
        const usage = supplements.find((item) => item.wordId === task.id)!;
        expect(task.skill).toBe(4);
        expect(task.context).toMatchObject({
          id: usage.example.id,
          en: usage.example.en,
          vi: usage.example.vi,
          targetVersion: contentKey(word, 4),
        });
      }
      const word = contextTargets.find((item) => item.id === queue[0].id)!;
      const context = queue[0].context!;
      const question = cloze({ ...word, example_en: context.en });
      await expect(page.locator(".study .context")).toHaveText(question);
      await expect(page.locator(".study")).not.toContainText(context.vi);
      const draft = `unfinished answer ${width}`;
      await page
        .getByRole("textbox", { name: "Câu trả lời", exact: true })
        .fill(draft);
      await page.reload();
      await page
        .getByRole("button", { name: "Tiếp tục phiên học", exact: true })
        .click();
      await expect(page.locator(".study .context")).toHaveText(question);
      await expect(
        page.getByRole("textbox", { name: "Câu trả lời", exact: true }),
      ).toHaveValue(draft);
      expect((await snapshot(page)).session?.queue).toEqual(queue);

      await page.getByRole("button", { name: /Lưu & tạm dừng/ }).click();
      await page.getByRole("button", { name: "Cài đặt", exact: true }).click();
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page
          .getByRole("button", { name: "Sao lưu toàn bộ JSON", exact: true })
          .click(),
      ]);
      const backup = JSON.parse(readFileSync((await download.path())!, "utf8"));
      const validated = await page.evaluate(async (value) => {
        const path = "/src/core.ts";
        const core = await import(/* @vite-ignore */ path);
        return core.validateBackup(value);
      }, backup);
      expect(validated.session?.queue).toEqual(queue);
      expect(validated.session?.draft?.answer).toBe(draft);
      expect(validated.history).toEqual(initial.history);
      expect(validated.schedules).toEqual(initial.schedules);
    });
  }
}

for (const viewport of [
  { width: 320, height: 568 },
  { width: 844, height: 320 },
  { width: 1440, height: 1000 },
]) {
  test(`long usage notes scroll below a separate close control and their source is keyboard reachable at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const paper = nextTargets.find((word) => word.word === "paper")!;
    const version = await open(page, [paper]);
    await seed(page, enrolledState([paper], version));
    await selectUsage(page);
    await page.locator(".word-card").click();
    const dialog = page.getByRole("dialog", { name: "Chi tiết mục từ" });
    await expect(dialog.locator(".usage-countability")).toBeVisible();

    // Test the actual text rectangles while moving long explanations and
    // source text past the close button. Clipped text outside the scrollport
    // is excluded; a sticky button covering visible text must fail.
    const overlaps = await dialog.evaluate((modal) => {
      const body =
        modal.querySelector<HTMLElement>(".modal-content") ||
        (modal as HTMLElement);
      const close = modal.querySelector<HTMLElement>(".close")!;
      const paragraphs = Array.from(
        modal.querySelectorAll<HTMLElement>(
          ".usage-patterns p, .usage-countability, .usage-sources a",
        ),
      );
      const overlaps: { text: string; width: number; height: number }[] = [];
      for (const paragraph of paragraphs) {
        body.scrollTop +=
          paragraph.getBoundingClientRect().top -
          close.getBoundingClientRect().top -
          4;
        const clip = body.getBoundingClientRect();
        const button = close.getBoundingClientRect();
        const walker = document.createTreeWalker(
          modal.querySelector(".dict-entry")!,
          NodeFilter.SHOW_TEXT,
        );
        let node: Node | null;
        while ((node = walker.nextNode())) {
          if (!node.textContent?.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const rect of range.getClientRects()) {
            const left = Math.max(rect.left, clip.left, button.left);
            const right = Math.min(rect.right, clip.right, button.right);
            const top = Math.max(rect.top, clip.top, button.top);
            const bottom = Math.min(rect.bottom, clip.bottom, button.bottom);
            if (right - left > 1 && bottom - top > 1)
              overlaps.push({
                text: node.textContent.trim().slice(0, 100),
                width: right - left,
                height: bottom - top,
              });
          }
        }
      }
      return overlaps;
    });
    expect(
      overlaps,
      "The close button must not cover readable usage text",
    ).toEqual([]);

    const controls = dialog.locator(".modal-controls");
    const body = dialog.locator(".modal-content");
    const close = dialog.getByRole("button", { name: "Đóng", exact: true });
    await expect(controls).toBeVisible();
    await expect(body).toBeVisible();
    const controlBounds = (await controls.boundingBox())!;
    const bodyBounds = (await body.boundingBox())!;
    expect(bodyBounds.y).toBeGreaterThanOrEqual(
      controlBounds.y + controlBounds.height - 1,
    );
    expect(
      await body.evaluate(
        (element) => element.scrollHeight > element.clientHeight,
      ),
    ).toBe(true);
    await body.evaluate((element) => {
      element.scrollTop = 0;
    });
    await body.focus();
    await page.keyboard.press("PageDown");
    await expect
      .poll(() => body.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    await expect(close).toBeInViewport({ ratio: 1 });
    expect(await dialog.evaluate((element) => element.scrollTop)).toBe(0);

    const source = dialog.locator(".usage-sources a").first();
    await close.focus();
    const possibleStops = await dialog
      .locator(
        'button, a[href], input, select, textarea, summary, [tabindex="0"]',
      )
      .count();
    let reachedSource = false;
    for (let index = 0; index <= possibleStops; index++) {
      await page.keyboard.press("Tab");
      if (
        await source.evaluate((element) => document.activeElement === element)
      ) {
        reachedSource = true;
        break;
      }
    }
    expect(reachedSource, "Tab navigation must reach the usage source").toBe(
      true,
    );
    await expect(source).toBeInViewport({ ratio: 1 });
    const sourceBounds = (await source.boundingBox())!;
    expect(sourceBounds.y).toBeGreaterThanOrEqual(bodyBounds.y - 1);
    expect(sourceBounds.y + sourceBounds.height).toBeLessThanOrEqual(
      bodyBounds.y + bodyBounds.height + 1,
    );
    await expect(close).toBeInViewport({ ratio: 1 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(viewport.width);
    await close.focus();
    await page.keyboard.press("Enter");
    await expect(dialog).toHaveCount(0);

    // The final unconfigured-cloud disclosure must participate in the same
    // keyboard loop; trapping at the preceding backup button hides it.
    await page.getByRole("button", { name: "Cài đặt", exact: true }).click();
    const settings = page.getByRole("dialog", { name: "Cài đặt và sao lưu" });
    const settingsClose = settings.getByRole("button", {
      name: "Đóng",
      exact: true,
    });
    const configuration = settings.locator("details").filter({
      hasText: "Cấu hình Supabase công khai trên thiết bị này",
    });
    const summary = configuration.locator("summary");
    await expect(configuration).not.toHaveAttribute("open", "");
    await settingsClose.focus();
    const settingsStops = await settings
      .locator(
        'button, a[href], input, select, textarea, summary, [tabindex="0"]',
      )
      .count();
    let reachedConfiguration = false;
    for (let index = 0; index <= settingsStops; index++) {
      await page.keyboard.press("Tab");
      if (
        await summary.evaluate((element) => document.activeElement === element)
      ) {
        reachedConfiguration = true;
        break;
      }
    }
    expect(
      reachedConfiguration,
      "Tab navigation must reach the final settings disclosure",
    ).toBe(true);
    await expect(summary).toBeInViewport({ ratio: 1 });
    await page.keyboard.press("Enter");
    await expect(configuration).toHaveAttribute("open", "");
    await expect(
      settings.getByRole("textbox", { name: "URL project", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(configuration).not.toHaveAttribute("open", "");
    await page.keyboard.press("Tab");
    await expect(settingsClose).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(summary).toBeFocused();
    await settingsClose.focus();
    await page.keyboard.press("Enter");
    await expect(settings).toHaveCount(0);
  });
}
