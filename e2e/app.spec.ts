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
    // Test alias search: "Den Bosch" should find "'s-Hertogenbosch"
    await page.fill('input[type="search"]', "Den Bosch");
    await expect(page.locator("text='s-Hertogenbosch").first()).toBeVisible({ timeout: 5000 });
  });

  test("language toggle shows both flags", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByRole("link", { name: "English" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Nederlands" })).toBeVisible();
  });

  test("popular cities shown by default", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("text=Popular cities")).toBeVisible();
    await expect(page.locator("text=Amsterdam")).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Questionnaire", () => {
  test("loads with 3 info tabs (matching StemWijzer)", async ({ page }) => {
    await page.goto("/en/s-hertogenbosch/questionnaire");
    await page.waitForSelector("text=1/30", { timeout: 10000 });

    // Verify 3 tabs exist
    await expect(page.locator("text=What do parties think?")).toBeVisible();
    await expect(page.locator("text=Learn more")).toBeVisible();
    await expect(page.locator("text=Arguments")).toBeVisible();
  });

  test("party positions tab shows agree/disagree groups", async ({ page }) => {
    await page.goto("/en/s-hertogenbosch/questionnaire");
    await page.waitForSelector("text=1/30", { timeout: 10000 });

    // Click "What do parties think?" tab
    await page.click("text=What do parties think?");
    await expect(page.locator("text=Agree").first()).toBeVisible();
    await expect(page.locator("text=Disagree").first()).toBeVisible();
  });

  test("arguments tab shows for/against", async ({ page }) => {
    await page.goto("/en/s-hertogenbosch/questionnaire");
    await page.waitForSelector("text=1/30", { timeout: 10000 });

    await page.click("text=Arguments");
    await expect(page.locator("text=For").first()).toBeVisible();
    await expect(page.locator("text=Against").first()).toBeVisible();
  });

  test("can answer and navigate", async ({ page }) => {
    await page.goto("/en/s-hertogenbosch/questionnaire");
    await page.waitForSelector("text=1/30", { timeout: 10000 });

    // Answer first question
    await page.click('button:has-text("Agree")');
    await expect(page.locator("text=2/30")).toBeVisible();
  });

  test("dealbreaker switch works", async ({ page }) => {
    await page.goto("/en/s-hertogenbosch/questionnaire");
    await page.waitForSelector("text=1/30", { timeout: 10000 });

    // Find and click the dealbreaker switch
    const switchEl = page.locator("button[role='switch']");
    await switchEl.click();
    await expect(page.locator("text=Dealbreaker").first()).toBeVisible();
  });

  test("view results appears after 5 answers", async ({ page }) => {
    await page.goto("/en/s-hertogenbosch/questionnaire");
    await page.waitForSelector("text=1/30", { timeout: 10000 });

    for (let i = 0; i < 5; i++) {
      await page.click('button:has-text("Agree")');
    }

    await expect(page.locator('button:has-text("View Results")')).toBeVisible();
  });
});

test.describe("Results", () => {
  test("shows ranked party matches", async ({ page }) => {
    await page.goto("/en/s-hertogenbosch/questionnaire");
    await page.waitForSelector("text=1/30", { timeout: 10000 });

    for (let i = 0; i < 10; i++) {
      await page.click('button:has-text("Agree")');
    }

    await page.click('button:has-text("View Results")');
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
    // Municipality browser should be visible
    await expect(page.getByRole("heading", { name: "Browse All Municipalities" })).toBeVisible();
  });

  test("municipality search works in explore", async ({ page }) => {
    await page.goto("/en/explore");
    await page.waitForSelector("text=Browse All Municipalities", { timeout: 10000 });
    await page.fill('input[type="search"]', "Amsterdam");
    await expect(page.locator("text=Amsterdam").first()).toBeVisible();
  });
});

test.describe("Dutch locale", () => {
  test("loads Dutch home page", async ({ page }) => {
    await page.goto("/nl");
    await expect(page.locator("h1")).toContainText("gemeente");
  });

  test("footer shows Dutch text", async ({ page }) => {
    await page.goto("/nl");
    await expect(page.locator("text=Gemeenteraadsverkiezingen")).toBeVisible();
  });
});

test.describe("Footer", () => {
  test("English footer shows translated election info", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("text=Municipal council elections March 18, 2026")).toBeVisible();
    await expect(page.locator("text=We do not store any personal data")).toBeVisible();
  });
});

// OG image uses edge runtime — skip in dev
test.describe("OG Image API", () => {
  test.skip("OG endpoint generates image (production only)", async () => {});
});
