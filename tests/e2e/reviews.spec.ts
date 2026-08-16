import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const reviewCards = (page: Page) =>
  page.getByLabel("Pending fuzzy vocabulary reviews").locator("article");

test.describe("vocabulary review queue", () => {
  test("renders rich match evidence within the performance budget", async ({ page }) => {
    const startedAt = Date.now();
    await page.goto("/reviews", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Vocabulary Reviews" })).toBeVisible();

    const navigation = await page.evaluate(() => {
      const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      return entry ? {
        domContentLoaded: entry.domContentLoadedEventEnd - entry.startTime,
        loadEvent: entry.loadEventEnd - entry.startTime,
      } : null;
    });
    expect(Date.now() - startedAt).toBeLessThan(10_000);
    expect(navigation?.domContentLoaded ?? 0).toBeLessThan(5_000);

    await expect(reviewCards(page)).toHaveCount(2);
    await expect(page.getByText("91% match")).toHaveCount(2);
    await expect(page.getByText("same normalized kanji surface")).toHaveCount(2);
    await expect(page.getByText("high confidence")).toHaveCount(2);
    await expect(page.getByText("medium collision risk")).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Accept match" })).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Keep separate" })).toHaveCount(2);

    await page.locator("summary").first().click();
    await expect(page.getByText(/The Japanese surface agrees and the reading differs by one character/).first()).toBeVisible();
    await expect(page.getByText(/character-bigram similarity/).first()).toBeVisible();
  });

  test("has no automated accessibility violations on the review page", async ({ page }) => {
    await page.goto("/reviews");
    await expect(page.getByRole("heading", { name: "Vocabulary Reviews" })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("accepts one match and rejects another through accessible controls", async ({ page, request }) => {
    await page.goto("/reviews");

    const acceptCard = page.locator("article").filter({ hasText: "playwright-accept.pdf" });
    await expect(acceptCard).toHaveCount(1);
    await acceptCard.getByRole("button", { name: "Accept match" }).click();
    await expect(acceptCard).toHaveCount(0);
    await expect(reviewCards(page)).toHaveCount(1);

    const pendingAfterAccept = await request.get("/api/vocabulary/reviews");
    expect(pendingAfterAccept.ok()).toBeTruthy();
    expect((await pendingAfterAccept.json()).reviews).toHaveLength(1);

    const rejectCard = page.locator("article").filter({ hasText: "playwright-reject.pdf" });
    await expect(rejectCard).toHaveCount(1);
    await rejectCard.getByRole("button", { name: "Keep separate" }).click();
    await expect(rejectCard).toHaveCount(0);
    await expect(page.getByText("No pending fuzzy matches.")).toBeVisible();

    const pendingAfterReject = await request.get("/api/vocabulary/reviews");
    expect(pendingAfterReject.ok()).toBeTruthy();
    expect((await pendingAfterReject.json()).reviews).toHaveLength(0);
  });

  test("resolves a duplicate collision by keeping the selected vocabulary row", async ({ page, request }) => {
    await page.goto("/reviews");

    const collision = page.locator("article").filter({ hasText: "playwright-collision.pdf" });
    await expect(collision).toHaveCount(1);
    await expect(page.getByText("Identity collision")).toBeVisible();

    await collision.getByRole("button", { name: /Keep .*remove other duplicates/ }).first().click();
    await expect(page.getByText("No duplicate collision groups detected.")).toBeVisible();

    const response = await request.get("/api/vocabulary/collisions");
    expect(response.ok()).toBeTruthy();
    expect((await response.json()).collisions).toHaveLength(0);
  });
});
