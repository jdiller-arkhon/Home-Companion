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

  test("month calendar, email paste, notifications", async () => {
    await page.goto("/planner?tab=agenda");
    await expect(page.getByRole("link", { name: "Next month" })).toBeVisible();
    await page.getByRole("link", { name: "Next month" }).click();
    await expect(page.getByText(/November 2026|December 2026/)).toBeVisible();
    await shot(page, "calendar");

    await page.goto("/packages");
    await page.getByRole("button", { name: "Paste shipping email" }).click();
    await page.locator("[role=dialog] textarea").fill("From: \"Bloom Coffee\" <x@y.z>\nSubject: Your scale has shipped\nUPS tracking: 1Z999AA10123456785\nArriving Nov 5");
    await page.getByRole("button", { name: "Find tracking number" }).click();
    await expect(page.locator("[role=dialog] [name=tracking]")).toHaveValue("1Z999AA10123456785");
    await page.locator("[role=dialog] button", { hasText: /^Add / }).click();
    await expect(page.getByText("Your scale has shipped")).toBeVisible();
    await expect(page.locator('a[href*="ups.com/track"]').first()).toBeVisible();

    await page.goto("/settings");
    await expect(page.getByRole("button", { name: "Enable on this device" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Notifications/ }).first()).toBeVisible();
  });

  test("Siri shortcut key adds groceries; calendar feed exports items", async ({ request }) => {
    await page.goto("/settings");
    const siri = page.locator("section", { hasText: "Siri & Shortcuts" });
    await siri.getByLabel("Name").fill("Test iPhone");
    await siri.getByRole("button", { name: "Create" }).click();
    await page.locator("[role=dialog] input[type=password]").fill("correct-horse-battery");
    await page.locator("[role=dialog] button", { hasText: "Confirm" }).click();
    const key = await siri.locator("input[readonly]").inputValue();
    expect(key).toMatch(/^sho_/);

    const add = await request.post("/api/shortcuts", { headers: { Authorization: `Bearer ${key}` }, data: { text: "Add bananas and coffee to the grocery list" } });
    expect(await add.text()).toBe("Added bananas and coffee to the grocery list.");
    expect((await request.post("/api/shortcuts", { headers: { Authorization: "Bearer nope" }, data: { text: "hi" } })).status()).toBe(401);
    const brief = await request.post("/api/shortcuts", { headers: { Authorization: `Bearer ${key}` }, data: { text: "What's my day look like?" } });
    expect(await brief.text()).toContain("calendar");
    await page.goto("/planner?tab=groceries");
    await expect(page.getByText("Bananas")).toBeVisible();
    await expect(page.getByText("Pantry", { exact: true })).toBeVisible(); // auto store-section

    await page.goto("/settings");
    const cal = page.locator("#calendars");
    await cal.getByLabel("Name", { exact: true }).fill("My iPhone");
    await cal.getByRole("button", { name: "Create" }).click();
    const feedUrl = await cal.locator("input[readonly]").inputValue();
    const ics = await (await request.get(new URL(feedUrl).pathname)).text();
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("Book furnace service");
    await expect(cal.getByRole("link", { name: "Add to iPhone Calendar" })).toHaveAttribute("href", /^webcal:/);
  });

  test("emergency card shares read-only and revokes", async ({ browser }) => {
    await page.goto("/emergency?tab=edit");
    await page.locator("[name=water_shutoff]").fill("Garage, left wall");
    await page.locator("[name=plumber]").fill("Ace Plumbing (555) 010-2222");
    await page.locator("[name=wifi_password]").fill("sunflower-42");
    await page.locator("[name=share_wifi]").check();
    await page.getByRole("button", { name: "Save card" }).click();
    await expect(page.getByRole("status")).toContainText("Saved");
    await page.goto("/emergency?tab=share");
    await page.getByLabel("Name").fill("Sitter Pat");
    await page.getByRole("button", { name: "Create" }).click();
    const url = await page.locator("input[readonly]").inputValue();
    const guest = await (await browser.newContext()).newPage();
    await guest.goto(url);
    await expect(guest.getByText("Garage, left wall")).toBeVisible();
    await expect(guest.getByText("sunflower-42")).toBeVisible();
    await shot(guest, "emergency-shared");
    await page.getByRole("button", { name: "Revoke Sitter Pat" }).click();
    await page.waitForTimeout(500);
    expect((await guest.goto(url))!.status()).toBe(404);
    await page.goto("/emergency");
    await shot(page, "emergency");
  });

  test("display mode, year report, photo capture without AI", async () => {
    await page.goto("/display");
    await expect(page.getByText("Up next")).toBeVisible();
    await shot(page, "display");
    await page.goto("/report");
    await expect(page.getByText("Who did what")).toBeVisible();
    await shot(page, "report");
    await page.goto("/maintenance?tab=appliances");
    await page.getByRole("button", { name: "Add from photo" }).click();
    await page.setInputFiles("[role=dialog] input[type=file]", { name: "label.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64") });
    await page.getByRole("button", { name: "Read photo" }).click();
    await expect(page.getByText(/Saved to the Vault/)).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("[role=dialog] [name=notes]")).toHaveValue(/Receipts & Manuals/);
  });

  test("iPhone layout", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, storageState: await page.context().storageState() });
    const p = await ctx.newPage();
    for (const r of ["", "maintenance", "planner"]) { await p.goto(`/${r}`); await p.screenshot({ path: `${SHOTS}/iphone-${r || "today"}.png` }); }
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
