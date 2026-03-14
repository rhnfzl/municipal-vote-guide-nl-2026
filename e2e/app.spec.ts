import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test("redirects root to /en", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/en/);
  });

  test("shows municipality search with hero", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("h1")).toContainText("municipality");
    await expect(page.locator('input[type="search"]')).toBeVisible();
  });

  test("search filters municipalities including aliases", async ({ page }) => {
    await page.goto("/en");
    await page.fill('input[type="search"]', "Den Bosch");
    // Wait for data to load and filter
    await expect(page.locator("h3:has-text(\"'s-Hertogenbosch\")")).toBeVisible({ timeout: 8000 });
  });

  test("language toggle shows both flags", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByRole("link", { name: "English" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Nederlands" })).toBeVisible();
  });

  test("popular cities shown by default", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("text=Popular cities")).toBeVisible();
    await expect(page.locator("h3:has-text('Amsterdam')")).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Questionnaire", () => {
  test("loads with 3 info tabs (matching StemWijzer)", async ({ page }) => {
    await page.goto("/en/s-hertogenbosch/questionnaire");
    await page.waitForSelector("text=1/30", { timeout: 10000 });

    // Verify 3 tabs exist — use getByRole to avoid strict mode
    await expect(page.getByRole("button", { name: /parties/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Learn more/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Arguments/i }).first()).toBeVisible();
  });

  test("party positions tab shows agree/disagree groups", async ({ page }) => {
    await page.goto("/en/s-hertogenbosch/questionnaire");
    await page.waitForSelector("text=1/30", { timeout: 10000 });

    await page.getByRole("button", { name: /parties/i }).first().click();
    await expect(page.locator("h4:has-text('Agree')").first()).toBeVisible({ timeout: 5000 });
  });

  test("arguments tab shows for/against", async ({ page }) => {
    await page.goto("/en/s-hertogenbosch/questionnaire");
    await page.waitForSelector("text=1/30", { timeout: 10000 });

    await page.getByRole("button", { name: /Arguments/i }).first().click();
    await expect(page.locator("h4:has-text('For')").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("h4:has-text('Against')").first()).toBeVisible();
  });

  test("can answer and navigate", async ({ page }) => {
    await page.goto("/en/s-hertogenbosch/questionnaire");
    await page.waitForSelector("text=1/30", { timeout: 10000 });

    await page.getByRole("button", { name: /Agree/i }).first().click();
    await expect(page.locator("text=2/30")).toBeVisible();
  });

  test("dealbreaker switch works", async ({ page }) => {
    await page.goto("/en/s-hertogenbosch/questionnaire");
    await page.waitForSelector("text=1/30", { timeout: 10000 });

    // The switch is inside a label with "Dealbreaker" text
    const switchLabel = page.locator("label:has-text('Dealbreaker')");
    await switchLabel.click();
    // After clicking, the destructive badge should appear
    await expect(page.locator("[data-slot='badge']:has-text('Dealbreaker')")).toBeVisible({ timeout: 3000 });
  });

  test("view results appears after 5 answers", async ({ page }) => {
    await page.goto("/en/s-hertogenbosch/questionnaire");
    await page.waitForSelector("text=1/30", { timeout: 10000 });

    for (let i = 0; i < 5; i++) {
      await page.getByRole("button", { name: /Agree/i }).first().click();
      await page.waitForTimeout(200);
    }

    await expect(page.getByRole("button", { name: /View Results/i })).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Results", () => {
  test("shows ranked party matches", async ({ page }) => {
    await page.goto("/en/s-hertogenbosch/questionnaire");
    await page.waitForSelector("text=1/30", { timeout: 10000 });

    for (let i = 0; i < 10; i++) {
      await page.getByRole("button", { name: /Agree/i }).first().click();
      await page.waitForTimeout(100);
    }

    await page.getByRole("button", { name: /View Results/i }).click();
    await expect(page).toHaveURL(/\/results/);
    await expect(page.getByRole("heading", { name: "Your Results", exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("%").first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Compare", () => {
  test("loads with i18n title", async ({ page }) => {
    await page.goto("/en/s-hertogenbosch/compare");
    await expect(page.getByRole("heading", { name: "Compare Parties" })).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Explore", () => {
  test("shows themes chart and municipality browser", async ({ page }) => {
    await page.goto("/en/explore");
    await expect(page.getByRole("heading", { name: "Explore All Municipalities" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("heading", { name: "Most Common Themes" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Browse All Municipalities" })).toBeVisible();
  });

  test("municipality search works in explore", async ({ page }) => {
    await page.goto("/en/explore");
    await page.waitForSelector("text=Browse All Municipalities", { timeout: 10000 });
    await page.fill('input[type="search"]', "Amsterdam");
    await expect(page.locator("button:has-text('Amsterdam')").first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Dutch locale", () => {
  test("loads Dutch home page", async ({ page }) => {
    await page.goto("/nl");
    await expect(page.locator("h1")).toContainText("gemeente");
  });

  test("footer shows Dutch election text", async ({ page }) => {
    await page.goto("/nl");
    await expect(page.getByText("Gemeenteraadsverkiezingen 18 maart 2026").first()).toBeVisible();
  });
});

test.describe("Footer", () => {
  test("English footer shows translated election info", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByText("Municipal council elections March 18, 2026")).toBeVisible();
    await expect(page.getByText("We do not store any personal data")).toBeVisible();
  });
});

// OG image uses edge runtime — skip in dev
test.describe("OG Image API", () => {
  test.skip("OG endpoint generates image (production only)", async () => {});
});
