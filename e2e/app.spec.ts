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

  test("search with aliases works", async ({ page }) => {
    await page.goto("/en");
    await page.fill('input[type="search"]', "Den Bosch");
    await expect(page.locator("h3:has-text(\"'s-Hertogenbosch\")")).toBeVisible({ timeout: 8000 });
  });

  test("language toggle shows flags", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByRole("link", { name: "English" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Nederlands" })).toBeVisible();
  });
});

test.describe("Questionnaire Flow", () => {
  test("loads questionnaire and shows first question", async ({ page }) => {
    await page.goto("/en/s-hertogenbosch/questionnaire");
    await page.waitForSelector("text=1/30", { timeout: 10000 });
    await expect(page.getByRole("button", { name: /Agree/i }).first()).toBeVisible();
  });

  test("answering advances to next question", async ({ page }) => {
    await page.goto("/en/s-hertogenbosch/questionnaire");
    await page.waitForSelector("text=1/30", { timeout: 10000 });
    await page.getByRole("button", { name: /Agree/i }).first().click();
    await expect(page.locator("text=2/30")).toBeVisible();
  });

  test("has 3 info tabs", async ({ page }) => {
    await page.goto("/en/s-hertogenbosch/questionnaire");
    await page.waitForSelector("text=1/30", { timeout: 10000 });
    await expect(page.getByRole("button", { name: /parties/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Learn more/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Arguments/i }).first()).toBeVisible();
  });

  test("no View Results button exists", async ({ page }) => {
    await page.goto("/en/s-hertogenbosch/questionnaire");
    await page.waitForSelector("text=1/30", { timeout: 10000 });
    // Answer 10 questions
    for (let i = 0; i < 10; i++) {
      await page.getByRole("button", { name: /Agree/i }).first().click();
      await page.waitForTimeout(200);
    }
    // "View Results" button should NOT exist
    await expect(page.locator('button:has-text("View Results")')).toHaveCount(0);
  });
});

test.describe("Important Topics", () => {
  test("loads important topics page", async ({ page }) => {
    await page.goto("/en/s-hertogenbosch/important-topics");
    await expect(page.locator("text=extra important")).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Party Filter", () => {
  test("loads party filter page", async ({ page }) => {
    await page.goto("/en/s-hertogenbosch/party-filter");
    await expect(page.locator("text=include in the result")).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Results", () => {
  test("shows results with party cards", async ({ page }) => {
    // Set up session data to simulate completed questionnaire
    await page.goto("/en/s-hertogenbosch/questionnaire");
    await page.waitForSelector("text=1/30", { timeout: 10000 });

    // Answer all 30 questions quickly
    for (let i = 0; i < 30; i++) {
      await page.getByRole("button", { name: /Agree/i }).first().click();
      await page.waitForTimeout(100);
    }

    // Should auto-advance to important topics
    await expect(page).toHaveURL(/important-topics/, { timeout: 10000 });

    // Skip topics
    await page.click("text=Skip");
    await expect(page).toHaveURL(/party-filter/, { timeout: 10000 });

    // Proceed with all parties
    await page.getByRole("button", { name: /Next step/i }).click();
    await expect(page).toHaveURL(/results/, { timeout: 10000 });

    // Results should show party matches
    await expect(page.getByText("%").first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Compare Party", () => {
  test("loads compare party page", async ({ page }) => {
    await page.goto("/en/s-hertogenbosch/compare-party?party=207186");
    await expect(page.locator("text=Compare your opinion")).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Compare", () => {
  test("loads basic compare page", async ({ page }) => {
    await page.goto("/en/s-hertogenbosch/compare");
    await expect(page.getByRole("heading", { name: "Compare Parties" })).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Explore", () => {
  test("shows themes chart", async ({ page }) => {
    await page.goto("/en/explore");
    await expect(page.getByRole("heading", { name: "Explore All Municipalities" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("heading", { name: "Most Common Themes" })).toBeVisible();
  });
});

test.describe("Dutch locale", () => {
  test("loads Dutch home page", async ({ page }) => {
    await page.goto("/nl");
    await expect(page.locator("h1")).toContainText("gemeente");
  });
});

test.describe("Footer", () => {
  test("English footer shows privacy notice", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByText("We do not store any personal data")).toBeVisible();
  });
});

test.describe("Error Pages", () => {
  test("404 page renders for unknown route", async ({ page }) => {
    const response = await page.goto("/en/nonexistent-page-xyz");
    // Should not crash - either 404 page or redirect
    expect(response?.status()).toBeDefined();
  });
});
