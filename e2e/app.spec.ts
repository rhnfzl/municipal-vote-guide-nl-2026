import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test("redirects root to /en", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/en/);
  });

  test("shows municipality search", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("h1")).toContainText("municipality");
    await expect(page.locator('input[type="search"]')).toBeVisible();
  });

  test("search filters municipalities", async ({ page }) => {
    await page.goto("/en");
    await page.fill('input[type="search"]', "amsterdam");
    const cards = page.locator('[class*="cursor-pointer"]');
    await expect(cards.first()).toContainText("Amsterdam");
  });

  test("language toggle link exists", async ({ page }) => {
    await page.goto("/en");
    const nlLink = page.getByRole("link", { name: "NL", exact: false }).filter({ hasText: "🇳🇱" });
    await expect(nlLink).toBeVisible();
  });
});

test.describe("Questionnaire", () => {
  test("loads questionnaire for s-hertogenbosch", async ({ page }) => {
    await page.goto("/en/s-hertogenbosch/questionnaire");
    await expect(page.locator("text=Question 1")).toBeVisible({ timeout: 10000 });
  });

  test("can answer agree/disagree/neither", async ({ page }) => {
    await page.goto("/en/s-hertogenbosch/questionnaire");
    await page.waitForSelector("text=Question 1", { timeout: 10000 });

    // Answer first question
    await page.click('button:has-text("Agree")');
    await expect(page.locator("text=Question 2")).toBeVisible();

    // Answer second question
    await page.click('button:has-text("Disagree")');
    await expect(page.locator("text=Question 3")).toBeVisible();

    // Answer third with neither
    await page.click('button:has-text("Neither")');
    await expect(page.locator("text=Question 4")).toBeVisible();
  });

  test("dealbreaker toggle works", async ({ page }) => {
    await page.goto("/en/s-hertogenbosch/questionnaire");
    await page.waitForSelector("text=Question 1", { timeout: 10000 });

    // Click the flag icon to set dealbreaker
    await page.click('button:has-text("⚐")');
    await expect(page.locator("text=Dealbreaker")).toBeVisible();
  });

  test("view results button appears after 5 answers", async ({ page }) => {
    await page.goto("/en/s-hertogenbosch/questionnaire");
    await page.waitForSelector("text=Question 1", { timeout: 10000 });

    for (let i = 0; i < 5; i++) {
      await page.click('button:has-text("Agree")');
    }

    await expect(page.locator('button:has-text("View Results")')).toBeVisible();
  });
});

test.describe("Results", () => {
  test("shows results after completing questionnaire", async ({ page }) => {
    await page.goto("/en/s-hertogenbosch/questionnaire");
    await page.waitForSelector("text=Question 1", { timeout: 10000 });

    // Answer 10 questions quickly
    for (let i = 0; i < 10; i++) {
      await page.click('button:has-text("Agree")');
    }

    await page.click('button:has-text("View Results")');
    await expect(page).toHaveURL(/\/results/);
    await expect(page.getByRole("heading", { name: "Your Results", exact: true })).toBeVisible({ timeout: 10000 });
    // Should show party results with percentages
    await expect(page.getByText("%").first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Compare", () => {
  test("loads compare page", async ({ page }) => {
    await page.goto("/en/s-hertogenbosch/compare");
    await expect(page.locator("text=Compare Parties")).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Explore", () => {
  test("shows national statistics", async ({ page }) => {
    await page.goto("/en/explore");
    await expect(page.getByRole("heading", { name: "Explore All Municipalities" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("heading", { name: "Most Common Themes" })).toBeVisible();
  });
});

// OG image uses edge runtime — skip in dev, tested manually in production
test.describe("OG Image API", () => {
  test.skip("OG endpoint generates image (production only)", async () => {
    // This test requires production build with edge runtime
  });
});
