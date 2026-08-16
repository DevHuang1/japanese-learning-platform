import { execFileSync } from "node:child_process";
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const databaseURL = "file:/tmp/wagaku-playwright.db";

test.describe("ingestion quality and OCR correction workflow", () => {
  test.beforeEach(() => {
    execFileSync("npx", ["tsx", "scripts/seed-ingestion-fixture.ts"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseURL },
      stdio: "ignore",
    });
  });

  test("shows the persisted source image and provenance", async ({ page, request }) => {
    await page.goto("/ingestion", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Ingestion Quality" })).toBeVisible();
    await page.getByRole("button", { name: /playwright-ingestion-scanned\.pdf/ }).click();
    await expect(page.getByRole("heading", { name: /OCR correction workspace/ })).toBeVisible();
    await expect(page.getByAltText("Scanned source preview for page 1")).toBeVisible();
    await expect(page.getByText("Page 1 · ocr · jpn+mya")).toBeVisible();

    const pagesResponse = await request.get("/api/ingestion/batches?limit=5");
    expect(pagesResponse.ok()).toBeTruthy();
    const batch = (await pagesResponse.json()).batches.find((row: { sourceName: string }) => row.sourceName === "playwright-ingestion-scanned.pdf");
    expect(batch).toBeTruthy();
    const pageResponse = await request.get(`/api/ingestion/batches/${batch.id}/pages`);
    expect(pageResponse.ok()).toBeTruthy();
    const pageData = (await pageResponse.json()).pages[0];
    const imageResponse = await request.get(`/api/ingestion/pages/${pageData.id}/image`);
    expect(imageResponse.ok()).toBeTruthy();
    expect(imageResponse.headers()["content-type"]).toBe("image/png");
    expect(imageResponse.headers()["x-ingestion-page"]).toBe("1");
    expect((await imageResponse.body()).length).toBeGreaterThan(1000);
  });

  test("completes correction, reprocess, preview, and approval", async ({ page }) => {
    await page.goto("/ingestion");
    await page.getByRole("button", { name: /playwright-ingestion-scanned\.pdf/ }).click();
    const editor = page.getByLabel("OCR text");
    await editor.fill("校正 こうせい စာပြင်ဆင်ခြင်း");
    await page.getByLabel("Correction reason").fill("Verified against the scanned source page");
    await page.getByRole("button", { name: "Save correction" }).click();
    await expect(page.getByText("Page corrected.")).toBeVisible();
    await expect(page.getByText("Revision 1.")).toBeVisible();

    await page.getByRole("button", { name: "Reprocess" }).click();
    await expect(page.getByText("Page needs_review.")).toBeVisible();
    await expect(page.locator("article").filter({ hasText: "校正" }).first()).toBeVisible();
    await expect(page.getByText("no exact canonical match")).toBeVisible();

    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText(/Page (approved|needs_review)\./)).toBeVisible();
  });

  test("rejects a page and protects stale correction revisions", async ({ page, request }) => {
    await page.goto("/ingestion");
    await page.getByRole("button", { name: /playwright-ingestion-scanned\.pdf/ }).click();
    const batchResponse = await request.get("/api/ingestion/batches?limit=5");
    const batch = (await batchResponse.json()).batches.find((row: { sourceName: string }) => row.sourceName === "playwright-ingestion-scanned.pdf");
    const pagesResponse = await request.get(`/api/ingestion/batches/${batch.id}/pages`);
    const pageId = (await pagesResponse.json()).pages[0].id;

    const firstCorrection = await request.post(`/api/ingestion/pages/${pageId}/corrections`, { data: { baseRevision: 0, correctedText: "校正 こうせい စာပြင်ဆင်ခြင်း", reason: "first" } });
    expect(firstCorrection.status()).toBe(201);
    const staleCorrection = await request.post(`/api/ingestion/pages/${pageId}/corrections`, { data: { baseRevision: 0, correctedText: "校正 こうせい စာပြင်ဆင်ခြင်း", reason: "stale" } });
    expect(staleCorrection.status()).toBe(409);

    const rejected = await request.post(`/api/ingestion/pages/${pageId}/reject`, { data: { reason: "Source page is too noisy" } });
    expect(rejected.ok()).toBeTruthy();
    expect((await rejected.json()).status).toBe("rejected");
  });

  test("passes WCAG 2.1 A/AA scan and performance budget", async ({ page }) => {
    const startedAt = Date.now();
    await page.goto("/ingestion", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Ingestion Quality" })).toBeVisible();
    const navigation = await page.evaluate(() => {
      const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      return entry ? { domContentLoaded: entry.domContentLoadedEventEnd - entry.startTime, loadEvent: entry.loadEventEnd - entry.startTime } : null;
    });
    const totalMs = Date.now() - startedAt;
    expect(totalMs).toBeLessThan(Number(process.env.INGESTION_PERF_MAX_TOTAL_MS ?? 10_000));
    expect(navigation?.domContentLoaded ?? 0).toBeLessThan(Number(process.env.INGESTION_PERF_MAX_DOM_MS ?? 5_000));
    await test.info().attach("ingestion-performance.json", { body: JSON.stringify({ totalMs, navigation }, null, 2), contentType: "application/json" });

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    await test.info().attach("ingestion-accessibility.json", { body: JSON.stringify(results, null, 2), contentType: "application/json" });
    expect(results.violations).toEqual([]);
  });
});
