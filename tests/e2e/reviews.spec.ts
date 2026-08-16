import { expect, test } from "@playwright/test";

test.describe("vocabulary review queue", () => {
  test("renders a fuzzy candidate with its evidence", async ({ page }) => {
    await page.goto("/reviews");

    const cards = page.locator("article");
    await expect(cards).toHaveCount(2);
    await expect(page.getByRole("heading", { name: "Vocabulary Reviews" })).toBeVisible();
    await expect(page.getByText("91% match")).toHaveCount(2);
    await expect(page.getByText("same normalized kanji surface")).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Accept match" })).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Keep separate" })).toHaveCount(2);
  });

  test("accepts one match and rejects another through the UI", async ({ page, request }) => {
    await page.goto("/reviews");

    const acceptCard = page.locator("article").filter({ hasText: "playwright-accept.pdf" });
    await expect(acceptCard).toHaveCount(1);
    await acceptCard.getByRole("button", { name: "Accept match" }).click();
    await expect(acceptCard).toHaveCount(0);
    await expect(page.locator("article")).toHaveCount(1);

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
});
