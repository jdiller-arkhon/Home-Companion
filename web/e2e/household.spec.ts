import { test, expect, type Page } from "@playwright/test";

const SHOTS = process.env.SHOT_DIR ?? "test-results/shots";
const shot = async (p: Page, name: string) => { await p.waitForTimeout(700); return p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); };

async function addRecord(p: Page, fields: Record<string, string>) {
  await p.getByRole("button", { name: "Add", exact: true }).first().click();
  for (const [k, v] of Object.entries(fields)) {
    const el = p.locator(`[role=dialog] [name="${k}"]`);
    if ((await el.evaluate((e) => e.tagName)) === "SELECT") await el.selectOption(v); else await el.fill(v);
  }
  await p.locator("[role=dialog] button", { hasText: /^Add / }).click();
  await expect(p.getByRole("dialog")).toBeHidden();
}

test.describe.serial("household flows", () => {
  let page: Page;
  test.beforeAll(async ({ browser }) => { page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 }); });

  test("onboarding creates the household and signs in", async () => {
    await page.goto("/");
    await expect(page).toHaveURL(/welcome/);
    await page.fill("[name=household]", "The Diller Home");
    await page.fill("[name=name]", "Jordan");
    await page.fill("[name=email]", "jordan@home.local");
    await page.fill("[name=password]", "short");
    await page.getByRole("button", { name: "Create household" }).click();
    await expect(page.getByText("at least 10 characters")).toBeVisible();
    await page.fill("[name=password]", "correct-horse-battery");
    await page.getByRole("button", { name: "Create household" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Jordan");
  });

  test("planner: validation, add, complete", async () => {
    await page.goto("/planner?tab=groceries");
    await addRecord(page, { title: "Oat milk", quantity: "2", aisle: "Dairy" });
    await addRecord(page, { title: "Sourdough", aisle: "Bakery" });
    await page.getByRole("button", { name: "Done: Sourdough" }).click();
    await expect(page.locator("li", { hasText: "Sourdough" })).toHaveClass(/./);
    await page.goto("/planner?tab=tasks");
    await addRecord(page, { title: "Book furnace service", due_at: "2026-11-03" });
    await shot(page, "planner");
  });

  test("finance: bills, budgets, mark paid records an expense", async () => {
    await page.goto("/finance");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.locator("[role=dialog] [name=title]").fill("Electric");
    await page.locator("[role=dialog] button", { hasText: /^Add / }).click();
    expect(await page.locator("[role=dialog] [name=amount]").evaluate((e) => (e as HTMLInputElement).validity.valueMissing)).toBe(true);
    await page.locator("[role=dialog] [name=amount]").fill("abc");
    await page.locator("[role=dialog] [name=due_at]").fill("2026-11-04");
    await page.locator("[role=dialog] button", { hasText: /^Add / }).click();
    await expect(page.locator("[role=dialog]")).toContainText("Invalid amount");
    await page.locator("[role=dialog] [name=amount]").fill("142.18");
    await page.locator("[role=dialog] [name=due_at]").fill("2026-11-04");
    await page.locator("[role=dialog] [name=recurrence]").selectOption("monthly");
    await page.locator("[role=dialog] button", { hasText: /^Add / }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await addRecord(page, { title: "Internet", amount: "70", due_at: "2026-11-12", recurrence: "monthly" });
    await page.getByRole("button", { name: "Mark paid: Internet" }).click();
    await page.goto("/finance?tab=budgets");
    await addRecord(page, { title: "Utilities", amount: "400" });
    await page.goto("/finance");
    await expect(page.getByText("$70.00").first()).toBeVisible();
    await shot(page, "finance");
  });

  test("upkeep, packages, vault, system, settings, assistant render", async () => {
    await page.goto("/maintenance");
    await addRecord(page, { title: "Replace HVAC filter", due_at: "2026-11-15", recurrence: "quarterly", asset: "Furnace" });
    await shot(page, "upkeep");
    await page.goto("/packages");
    await addRecord(page, { title: "Espresso grinder", carrier: "UPS", tracking: "1Z999AA10123456784", due_at: "2026-10-31" });
    await shot(page, "packages");
    await page.goto("/vault");
    await page.getByRole("button", { name: "Upload" }).click();
    await page.setInputFiles("[role=dialog] input[type=file]", { name: "home-insurance.txt", mimeType: "text/plain", buffer: Buffer.from("Policy HX-2231. Water damage covered up to $25,000. Renewal March 2027.") });
    await page.locator("[role=dialog] [name=folder]").fill("Insurance");
    await page.locator("[role=dialog] button", { hasText: "Upload" }).click();
    await expect(page.getByText("home-insurance.txt")).toBeVisible();
    await page.goto("/vault?q=water+damage");
    await expect(page.getByText(/1 result/)).toBeVisible();
    await shot(page, "vault");
    await page.goto("/system");
    await expect(page.getByText("Services")).toBeVisible();
    await shot(page, "system");
    await page.goto("/devices");
    await expect(page.getByText("Connect Home Assistant")).toBeVisible();
    await shot(page, "home");
    await page.goto("/assistant");
    await shot(page, "assistant");
    await page.goto("/settings");
    await shot(page, "settings");
    await page.goto("/");
    await shot(page, "today");
  });

  test("assistant degrades gracefully when the AI service is offline", async () => {
    await page.goto("/assistant");
    await page.getByLabel("Message").fill("What's my day look like?");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText(/isn't reachable right now/)).toBeVisible({ timeout: 15_000 });
  });

  test("iPhone layout", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, storageState: await page.context().storageState() });
    const p = await ctx.newPage();
    for (const r of ["", "finance", "planner"]) { await p.goto(`/${r}`); await p.screenshot({ path: `${SHOTS}/iphone-${r || "today"}.png` }); }
    await ctx.close();
  });

  test("private records are invisible to the other profile", async ({ browser }) => {
    await page.goto("/settings");
    const people = page.locator("section", { hasText: "Two profiles" });
    await people.locator("[name=name]").fill("Riley");
    await people.locator("[name=email]").fill("riley@home.local");
    await people.locator("[name=password]").fill("temporary-pass-1");
    await people.getByRole("button", { name: "Create profile" }).click();
    await expect(people.getByRole("status")).toBeVisible();
    await page.goto("/planner?tab=notes");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.locator("[role=dialog] [name=title]").fill("Anniversary gift idea");
    await page.locator("[role=dialog] [name=_private]").check();
    await page.locator("[role=dialog] button", { hasText: /^Add / }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    const p2 = await (await browser.newContext()).newPage();
    await p2.goto("/login");
    await p2.fill("[name=email]", "riley@home.local");
    await p2.fill("[name=password]", "temporary-pass-1");
    await p2.getByRole("button", { name: "Sign in" }).click();
    await expect(p2.getByRole("heading", { level: 1 })).toContainText("Riley");
    await p2.goto("/planner?tab=notes");
    await expect(p2.getByText("Anniversary gift idea")).toHaveCount(0);
  });

  test("unauthenticated API access is refused", async ({ request }) => {
    expect((await request.get("/api/events")).status()).toBe(401);
    expect((await request.post("/api/internal/tools", { data: {} })).status()).toBe(403);
  });
});
