import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  contentKey,
  empty,
  merge,
  parse,
  serialize,
  type State,
  type Word,
} from "../src/core";

const noun: Word = {
  id: "pos-record-noun",
  word: "record",
  part_of_speech: "noun",
  meaning_vi: "bản ghi chép",
  example_en: "The clinic keeps a record of every visit.",
  example_vi: "Phòng khám lưu hồ sơ của mỗi lần thăm khám.",
  content_status: "reviewed",
  learning_status: "ready",
  example_type: "authored",
};
const verb: Word = {
  ...noun,
  id: "pos-record-verb",
  part_of_speech: "verb",
  meaning_vi: "ghi lại",
  definition_en: "To preserve information for later use.",
  example_en: "Please record the meeting for our colleague.",
  example_vi: "Hãy ghi lại cuộc họp cho đồng nghiệp của chúng ta.",
};
const fixture = [noun, verb];
const DAY = 86_400_000;

async function open(page: Page) {
  // Serve the TXT and its matching manifest together so a production corpus
  // update cannot replace these deliberately distinct noun and verb senses.
  const text = serialize(fixture);
  const version = createHash("sha256").update(text).digest("hex");
  await page.route("**/data/vocabulary-version.json", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        version,
        entryCount: fixture.length,
        bytes: Buffer.byteLength(text),
      }),
    }),
  );
  await page.route("**/data/vocabulary.txt", (route) =>
    route.fulfill({ contentType: "text/plain;charset=utf-8", body: text }),
  );
  await page.addInitScript(() => {
    class Utterance {
      text: string;
      lang = "";
      rate = 1;
      voice?: { lang: string; name: string };
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
        getVoices: () => [{ lang: "en-US", name: "POS test voice" }],
        cancel: () => {},
        speak: (utterance: Utterance) =>
          setTimeout(() => utterance.onend?.(), 0),
      },
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Hôm nay, mình học gì/ }),
  ).toBeVisible();
  return version;
}

async function snapshot(page: Page): Promise<State> {
  return page.evaluate(async () => {
    const path = "/src/core.ts";
    return (await import(/* @vite-ignore */ path)).read();
  });
}

function enrolledState(version: string): State {
  const state = merge(empty(), parse(serialize(fixture)), "default");
  state.sourceVersion = version;
  for (const entry of Object.values(state.entries)) {
    entry.enrolled = true;
    entry.enrolledAt = Date.now() - 8 * DAY;
  }
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

async function expectLabel(badge: Locator, label: string, caption = "Từ loại") {
  await expect(badge).toBeVisible();
  await expect(badge).toHaveText(label);
  await expect(badge).toHaveAttribute("aria-label", caption);
}

async function fitsViewport(page: Page, width: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    width,
  );
  for (const badge of await page.locator(".part-of-speech:visible").all()) {
    const bounds = (await badge.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
  }
}

function protectedLearning(state: State) {
  return {
    entries: state.entries,
    history: state.history,
    schedules: state.schedules,
    session: state.session,
    pausedScheduled: state.pausedScheduled,
    writing: state.writing,
    writingDrafts: state.writingDrafts,
    conversations: state.conversations,
    daily: state.daily,
    voice: state.voice,
    rate: state.rate,
    learningMode: state.learningMode,
    learningFloor: state.learningFloor,
    studySkills: state.studySkills,
  };
}

for (const width of [320, 390]) {
  test(`all six study skills show the declared word class before and after revealing without leaking recall answers at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    const version = await open(page);
    for (let skill = 0; skill < 6; skill++) {
      const state = enrolledState(version);
      state.session = {
        id: `pos-six-skills-${skill}`,
        queue: [{ id: verb.id, skill, review: `pos-review-${skill}` }],
        index: 0,
        started: Date.now(),
        scheduled: true,
        count: 1,
      };
      await seed(page, state);
      await page
        .getByRole("button", { name: "Tiếp tục phiên học", exact: true })
        .click();
      const study = page.locator(".study");
      await expectLabel(
        study.locator(":scope > .part-of-speech"),
        "Động từ · verb",
      );
      await expect(study.locator(".answer")).toHaveCount(0);
      if ([1, 2, 3, 4].includes(skill))
        await expect(study).not.toContainText(/\brecord\b/i);
      await fitsViewport(page, width);
      if (skill === 4)
        await page.screenshot({
          path: testInfo.outputPath(`context-before-answer-${width}.png`),
          fullPage: true,
        });

      const reveal = study.getByRole("button", { name: /Mở đáp án/ });
      if ([2, 3].includes(skill)) {
        await expect(reveal).toBeDisabled();
        await study.locator(".audio-big").click();
        await expect(reveal).toBeEnabled();
        await expect(study).not.toContainText(/\brecord\b/i);
      }
      await reveal.click();
      const answer = study.locator(".answer");
      await expect(answer).toContainText(verb.word);
      await expect(answer).toContainText(verb.meaning_vi);
      await expectLabel(answer.locator(".part-of-speech"), "Động từ · verb");
      await fitsViewport(page, width);
      if (skill === 4)
        await page.screenshot({
          path: testInfo.outputPath(`context-after-answer-${width}.png`),
          fullPage: true,
        });
      const after = await snapshot(page);
      expect(after.entries).toEqual(state.entries);
      expect(after.history).toEqual([]);
      expect(after.schedules).toEqual({});
      expect(after.session?.queue).toEqual(state.session.queue);
    }
  });
}

test("one headword retains separate noun and verb labels, senses and IDs in the library and dictionary", async ({
  page,
}) => {
  const version = await open(page);
  const initial = enrolledState(version);
  initial.session = {
    id: "pos-separate-senses",
    queue: fixture.map((word) => ({
      id: word.id,
      skill: 1,
      review: `${word.id}-review`,
    })),
    index: 0,
    started: Date.now(),
    scheduled: true,
    count: 2,
  };
  await seed(page, initial);
  const before = await snapshot(page);
  await page.getByRole("button", { name: "Kho từ", exact: true }).click();
  await expect(page.locator(".word-card h3")).toHaveText(["record", "record"]);
  for (const [word, label] of [
    [noun, "Danh từ · noun"],
    [verb, "Động từ · verb"],
  ] as const) {
    const card = page
      .locator(".word-card")
      .filter({ hasText: word.meaning_vi });
    await expectLabel(card.locator(".part-of-speech"), label);
    await card.click();
    const dictionary = page.locator(".dict-entry");
    await expect(dictionary.locator(".dict-headword")).toHaveText("record");
    await expect(dictionary.locator(".dict-translation")).toHaveText(
      word.meaning_vi,
    );
    await expectLabel(dictionary.locator(".part-of-speech"), label);
    await page.getByRole("button", { name: "Đóng", exact: true }).click();
  }
  const after = await snapshot(page);
  expect(Object.keys(after.entries).sort()).toEqual([noun.id, verb.id].sort());
  expect(after.entries[noun.id].word.part_of_speech).toBe("noun");
  expect(after.entries[verb.id].word.part_of_speech).toBe("verb");
  expect(protectedLearning(after)).toEqual(protectedLearning(before));
  await page.getByRole("button", { name: "Hôm nay", exact: true }).click();
  await page
    .getByRole("button", { name: "Tiếp tục phiên học", exact: true })
    .click();
  await expectLabel(page.locator(".study > .part-of-speech"), "Danh từ · noun");
  await expect(page.locator(".study")).not.toContainText(/\brecord\b/i);
  await page.getByRole("button", { name: /Mở đáp án/ }).click();
  await expectLabel(
    page.locator(".answer > .part-of-speech"),
    "Danh từ · noun",
  );
  await expect(page.locator(".answer")).toContainText(noun.meaning_vi);
  expect((await snapshot(page)).session?.queue).toEqual(initial.session.queue);
  expect((await snapshot(page)).history).toEqual(before.history);
});

test("personal TXT keeps missing, custom and phrase declarations explicit through import and reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await open(page);
  const personal = [
    {
      ...noun,
      id: "pos-personal-unknown",
      word: "morrowmark",
      part_of_speech: "",
      meaning_vi: "dấu nhắc của riêng tôi",
    },
    {
      ...noun,
      id: "pos-personal-custom",
      word: "brightfold",
      part_of_speech: "personal category",
      meaning_vi: "nếp gấp riêng",
    },
    {
      ...noun,
      id: "pos-personal-phrase",
      word: "quiet circle",
      part_of_speech: "noun phrase",
      meaning_vi: "nhóm yên tĩnh",
    },
    {
      ...noun,
      id: "pos-personal-noun-word",
      word: "noun",
      meaning_vi: "từ chỉ người, vật hoặc ý niệm",
      example_en: "A noun can name a person, place, or thing.",
      example_vi: "Danh từ có thể chỉ người, nơi chốn hoặc vật.",
    },
  ];
  // Leave the field out of the TXT entirely for the missing declaration.
  const text = serialize(personal).replace("part_of_speech: \n", "");
  await page.getByRole("button", { name: "Kho từ", exact: true }).click();
  await page
    .locator('input[type=file][accept=".txt,text/plain"]')
    .setInputFiles({
      name: "personal-pos.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(text),
    });
  await expect(
    page.getByRole("heading", { name: "Xem trước cập nhật kho" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Xác nhận cập nhật" }).click();
  await expect(page.locator(".word-card h3")).toContainText([personal[0].word]);
  await page.reload();
  await page.getByRole("button", { name: "Kho từ", exact: true }).click();
  const expected = [
    [personal[0], "Chưa khai báo từ loại", "Từ loại"],
    [personal[1], "personal category", "Từ loại"],
    [personal[2], "Cụm danh từ · noun phrase", "Dạng từ / cụm"],
    [personal[3], "Danh từ · noun", "Từ loại"],
  ] as const;
  for (const [word, label, caption] of expected) {
    const card = page.locator(".word-card").filter({
      has: page.getByRole("heading", { name: word.word, exact: true }),
    });
    await expectLabel(card.locator(".part-of-speech"), label, caption);
    await card.click();
    await expectLabel(
      page.locator(".dict-entry .part-of-speech"),
      label,
      caption,
    );
    await fitsViewport(page, 320);
    await page.getByRole("button", { name: "Đóng", exact: true }).click();
  }
  const state = await snapshot(page);
  for (const word of personal) {
    expect(state.entries[word.id].origin).toBe("personal");
    expect(state.entries[word.id].word.part_of_speech || "").toBe(
      word.part_of_speech,
    );
  }
  expect(state.history).toEqual([]);
  expect(state.schedules).toEqual({});
  // The metadata itself can contain the English answer. Keep the Vietnamese
  // class visible while masking that answer during a real saved recall task.
  state.session = {
    id: "pos-metadata-answer",
    queue: [{ id: personal[3].id, skill: 1, review: "pos-metadata-review" }],
    index: 0,
    started: Date.now(),
    scheduled: false,
    count: 1,
  };
  await seed(page, state);
  await page
    .getByRole("button", { name: "Tiếp tục phiên học", exact: true })
    .click();
  await expectLabel(
    page.locator(".study > .part-of-speech"),
    "Danh từ · ________",
  );
  await expect(page.locator(".study")).not.toContainText(/\bnoun\b/i);
  await page.getByRole("button", { name: /Mở đáp án/ }).click();
  await expectLabel(
    page.locator(".answer > .part-of-speech"),
    "Danh từ · noun",
  );
  await expect(page.locator(".answer h3")).toContainText("noun");
  expect((await snapshot(page)).history).toEqual([]);
});

test("reading word classes preserves the active queue, history, schedules and draft through reload and JSON backup", async ({
  page,
}) => {
  const version = await open(page);
  const state = enrolledState(version);
  const time = Date.now() - 8 * DAY;
  state.history = [
    {
      id: "pos-preserved-result",
      wordId: noun.id,
      time,
      skill: 1,
      answer: noun.word,
      correct: true,
      hint: false,
      method: "rule",
      elapsed: 1600,
      session: "pos-earlier-session",
      review: "pos-earlier-review",
      gap: 7 * DAY,
      first: true,
      independent: true,
      evidenceVersion: 2,
      contentVersion: contentKey(noun, 1),
      exposureGap: 7 * DAY,
      scheduled: true,
    },
  ];
  state.exposures = { [noun.id]: time };
  state.exposureEvents = [
    {
      id: "result:pos-preserved-result",
      wordId: noun.id,
      time,
      resultId: "pos-preserved-result",
    },
  ];
  state.schedules[`${noun.id}:1`] = {
    last: time,
    due: Date.now() - 1000,
    step: 2,
    contentVersion: contentKey(noun, 1),
  };
  state.session = {
    id: "pos-preserved-session",
    queue: [
      { id: verb.id, skill: 1, review: "pos-active-review" },
      { id: noun.id, skill: 4, review: "pos-pending-review" },
    ],
    index: 0,
    started: Date.now() - 1000,
    scheduled: true,
    count: 2,
    draft: {
      key: "pos-preserved-session:0",
      answer: "An unfinished answer",
      hint: false,
      revealed: false,
    },
  };
  await seed(page, state);
  const before = await snapshot(page);
  await page.getByRole("button", { name: "Kho từ", exact: true }).click();
  await page.locator(".word-card").filter({ hasText: noun.meaning_vi }).click();
  await expectLabel(
    page.locator(".dict-entry .part-of-speech"),
    "Danh từ · noun",
  );
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  expect(protectedLearning(await snapshot(page))).toEqual(
    protectedLearning(before),
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Tiếp tục phiên học", exact: true })
    .click();
  await expectLabel(page.locator(".study > .part-of-speech"), "Động từ · verb");
  await expect(
    page.getByRole("textbox", { name: "Câu trả lời", exact: true }),
  ).toHaveValue("An unfinished answer");
  await page.getByRole("button", { name: /Lưu & tạm dừng/ }).click();
  expect(protectedLearning(await snapshot(page))).toEqual(
    protectedLearning(before),
  );
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
    return (await import(/* @vite-ignore */ path)).validateBackup(value);
  }, backup);
  expect(protectedLearning(validated)).toEqual(protectedLearning(before));
});
