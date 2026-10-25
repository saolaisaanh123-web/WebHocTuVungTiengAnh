import { createServer } from "node:http";
import { readFile, stat, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const root = resolve("dist");
const expectedCount = (
  await readFile("public/data/vocabulary.txt", "utf8")
).match(/^id: /gm).length;
const grammarFiles = (await readdir("data/grammar")).filter((name) =>
  name.endsWith(".json"),
);
const expectedGrammarCount = (
  await Promise.all(
    grammarFiles.map(
      async (name) =>
        JSON.parse(await readFile("data/grammar/" + name, "utf8")).length,
    ),
  )
).reduce((total, count) => total + count, 0);
const usageEntries = (
  await Promise.all(
    (await readdir("data/usage"))
      .filter((name) => name.endsWith(".json"))
      .map(async (name) =>
        JSON.parse(await readFile("data/usage/" + name, "utf8")),
      ),
  )
).flat();
async function checkGrammar(page) {
  await page
    .getByRole("button", { name: "Tra cứu ngữ pháp", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Tra cứu ngữ pháp", exact: true })
    .waitFor();
  assert.equal(
    await page.locator(".grammar-card").count(),
    expectedGrammarCount,
  );
  await page
    .getByRole("searchbox", { name: "Tìm chủ điểm ngữ pháp" })
    .fill("bi dong");
  await page.locator('.grammar-card[data-grammar-id="passive"]').click();
  assert.match(
    await page.locator(".grammar-article h1").innerText(),
    /bị động/i,
  );
  assert.ok((await page.locator(".grammar-summary").innerText()).length > 35);
  const sources = await page
    .locator(".grammar-sources a")
    .evaluateAll((links) => links.map((link) => link.href));
  assert.ok(sources.length > 0);
  assert.ok(
    sources.every((href) =>
      href.startsWith(
        "https://learnenglish.britishcouncil.org/free-resources/grammar/",
      ),
    ),
  );
  await page
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: "Lỗi thường gặp" }) })
    .locator("summary")
    .click();
  assert.ok(
    (await page.locator(".grammar-mistakes").innerText()).includes("Nên dùng"),
  );
}
async function checkUsage(page) {
  await page.getByRole("button", { name: "Kho từ", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Trạng thái", exact: true })
    .selectOption("usage");
  assert.equal(
    Number(await page.locator(".word-grid").getAttribute("data-total-items")),
    usageEntries.length,
  );
  for (const headword of ["suggest", "spend", "paper", "familiar"]) {
    const usage = usageEntries.find((entry) => entry.headword === headword);
    assert.ok(usage, `Missing authored usage for ${headword}`);
    await page.getByPlaceholder(/Tìm từ/).fill(headword);
    await page
      .locator(".word-card")
      .filter({
        has: page.getByRole("heading", { name: headword, exact: true }),
      })
      .click();
    const panel = page.getByRole("region", { name: "Cách dùng đã đối chiếu" });
    await panel.waitFor();
    assert.ok(
      (await panel.locator(".usage-patterns").innerText()).includes(
        usage.patterns[0].form,
      ),
    );
    assert.ok(
      (await panel.locator(".usage-second-example").innerText()).includes(
        usage.example.en,
      ),
    );
    assert.ok(
      (await panel.locator(".usage-second-example").innerText()).includes(
        usage.example.vi,
      ),
    );
    if (usage.countability)
      assert.equal(
        await panel.locator(".usage-countability").innerText(),
        usage.countability,
      );
    assert.equal(
      await panel.locator(".usage-sources a").first().getAttribute("href"),
      usage.sources[0].url,
    );
    await page.getByRole("button", { name: "Đóng", exact: true }).click();
  }
  await page.getByPlaceholder(/Tìm từ/).fill("");
  await page
    .getByRole("combobox", { name: "Trạng thái", exact: true })
    .selectOption("");
}
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".txt": "text/plain",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(
      new URL(req.url, "http://local").pathname,
    ).replace(/^\/pages-test\//, "/");
    let file = resolve(root, "." + path);
    if (file !== root && !file.startsWith(root + sep))
      throw Error("Invalid path");
    if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
    const bytes = await readFile(file);
    res.setHeader(
      "Content-Type",
      (mime[extname(file)] || "application/octet-stream") + ";charset=utf-8",
    );
    res.end(bytes);
  } catch {
    res.statusCode = 404;
    res.end("Not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  args: ["--no-sandbox"],
});
try {
  for (const path of ["/", "/pages-test/"]) {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${port}${path}`);
    assert.match(await page.title(), /^Jeongyeon/);
    await page
      .getByRole("heading", { name: "Hôm nay, mình học gì?" })
      .waitFor();
    await page.getByRole("button", { name: "Kho từ", exact: true }).click();
    assert.equal(
      Number(await page.locator(".word-grid").getAttribute("data-total-items")),
      expectedCount,
    );
    assert.equal(
      await page.locator(".word-card").count(),
      Math.min(60, expectedCount),
    );
    await page.reload();
    await page
      .getByRole("heading", { name: "Hôm nay, mình học gì?" })
      .waitFor();
    await checkGrammar(page);
    await checkUsage(page);
    assert.deepEqual(errors, []);
    console.log(
      `PASS: production ${path} renders, loads ${expectedCount} entries, reloads without error`,
    );
    await page.waitForFunction(() => !!navigator.serviceWorker?.controller);
    const offlineAvailable = await page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(
            () => reject(Error("Offline corpus was not prepared")),
            15000,
          );
          const receive = (event) => {
            if (event.data?.type !== "jeongyeon-offline-status") return;
            clearTimeout(timer);
            navigator.serviceWorker.removeEventListener("message", receive);
            resolve(event.data.available);
          };
          navigator.serviceWorker.addEventListener("message", receive);
          navigator.serviceWorker.controller.postMessage({
            type: "jeongyeon-offline-status",
          });
        }),
    );
    assert.equal(
      offlineAvailable,
      true,
      "Complete shell and verified corpus must be cached",
    );
    await page.evaluate(async () => {
      await fetch("./private-sync?account=test", {
        headers: { Authorization: "Bearer test-only" },
      });
      await fetch("./data/vocabulary-version.json?private-test=1");
      await fetch("./data/vocabulary-version.json", {
        method: "POST",
        body: "private-test-only",
      });
    });
    const cachedURLs = await page.evaluate(async () => {
      const urls = [];
      for (const name of await caches.keys()) {
        if (!name.startsWith("jeongyeon-offline:")) continue;
        for (const request of await (await caches.open(name)).keys()) {
          if (request.method !== "GET")
            throw Error("Private request entered the offline cache");
          urls.push(request.url);
        }
      }
      return urls;
    });
    const appURL = `http://127.0.0.1:${port}${path}`;
    assert.ok(cachedURLs.length > 3);
    assert.ok(
      cachedURLs.every((href) => {
        const url = new URL(href);
        return (
          href.startsWith(appURL) &&
          !url.search &&
          (href === appURL ||
            href === `${appURL}data/vocabulary.txt` ||
            href === `${appURL}data/vocabulary-version.json` ||
            href.startsWith(`${appURL}assets/`))
        );
      }),
      "Only scoped public static files may enter the offline cache",
    );
    await page.context().setOffline(true);
    await page.reload();
    await page
      .getByRole("heading", { name: "Hôm nay, mình học gì?" })
      .waitFor();
    await page.getByRole("button", { name: "Kho từ", exact: true }).click();
    assert.equal(
      Number(await page.locator(".word-grid").getAttribute("data-total-items")),
      expectedCount,
    );
    await checkGrammar(page);
    await checkUsage(page);
    assert.deepEqual(errors, []);
    await page.goto(`${appURL}?utm_source=bookmark`);
    await page
      .getByRole("heading", { name: "Hôm nay, mình học gì?" })
      .waitFor();
    await page.getByRole("button", { name: "Kho từ", exact: true }).click();
    assert.equal(
      Number(await page.locator(".word-grid").getAttribute("data-total-items")),
      expectedCount,
    );
    console.log(
      `PASS: production ${path} reloads offline at canonical and UTM bookmark URLs with ${expectedCount} entries, grammar and source-reviewed usage; private/API requests are not cached`,
    );
    await page.close();
  }
  const page = await browser.newPage();
  await page.route("**/assets/*.js", (r) => r.abort());
  await page.goto(`http://127.0.0.1:${port}/pages-test/`);
  await page.getByText("Không tải được ứng dụng.", { exact: false }).waitFor();
  console.log(
    "PASS: missing JavaScript displays an error instead of a blank page",
  );
  await page.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
