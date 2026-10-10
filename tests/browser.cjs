const { firefox } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  require("node:fs").mkdirSync("test-output", { recursive: true });
  const browser = await firefox.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const requests = [];
  const products = [
    {
      id: "bag",
      title: "Everyday tote",
      price: "$68",
      priceNum: 68,
      source: "Example retailer",
      link: "https://example.com/bag",
      thumbnail: "",
      why: "Room for your daily essentials",
    },
    {
      id: "lamp",
      title: "Mushroom desk lamp",
      price: "$48",
      priceNum: 48,
      source: "Example retailer",
      link: "https://example.com/lamp",
      thumbnail: "",
    },
  ];
  await page.route("**/api/search", async (route) => {
    assert.equal(route.request().headers().authorization, "Bearer valid");
    requests.push(route.request().postDataJSON());
    await route.fulfill({
      json: {
        products,
        summary: "Two options to explore.",
        reading: {
          constraints: ["Under $100"],
          refinements: ["Waterproof", "Lightweight"],
        },
      },
    });
  });
  let savedItems = [];
  const user = {
    token: "valid",
    email: "shopper@example.com",
    name: "Shopper",
  };
  await page.route("**/api/auth", (r) => r.fulfill({ json: user }));
  await page.route("**/api/profile", (r) => {
    if (r.request().method() === "POST") {
      const body = r.request().postDataJSON();
      if (body.action === "saveItem") savedItems.push(body.item);
      if (body.action === "removeItem")
        savedItems = savedItems.filter((p) => p.id !== body.itemId);
    }
    return r.fulfill({ json: { ...user, savedItems, cart: [] } });
  });
  await page.goto("http://127.0.0.1:5173");
  await page.waitForTimeout(400);
  await page.screenshot({
    path: "test-output/home-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("textbox", { name: "Message Olio" })
    .fill("A bag for class");
  await page.getByRole("button", { name: "Send message" }).click();
  await page.getByRole("dialog").waitFor();
  assert.equal(
    requests.length,
    0,
    "Guest search must not contact search endpoint",
  );
  await page.getByLabel("Name", { exact: true }).fill("Shopper");
  await page.getByLabel("Email", { exact: true }).fill("shopper@example.com");
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page.locator(".account-submit").click();
  await page.getByText("Two options to explore.").waitFor();
  await page.getByRole("button", { name: "Waterproof", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".message.assistant").length === 2,
  );
  assert.deepEqual(requests[1].messages, ["A bag for class"]);
  await page
    .getByRole("button", { name: "Save Everyday tote", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save Mushroom desk lamp", exact: true })
    .click();
  await page.getByRole("link", { name: "Saved", exact: true }).click();
  await page.getByRole("button", { name: "New collection" }).click();
  await page.getByLabel("Collection name").fill("For class");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("button", { name: "All saved", exact: true }).click();
  await page
    .getByLabel("Collection for Everyday tote")
    .selectOption("For class");
  for (const check of await page.getByLabel("Compare this find").all())
    await check.check();
  await page.getByRole("button", { name: "Compare (2)", exact: true }).click();
  await page
    .getByRole("heading", { name: "Your finds, side by side" })
    .waitFor();
  await page.goto("http://127.0.0.1:5173/#/account/appearance");
  await page.getByRole("button", { name: "Forest", exact: true }).click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  assert.equal(await page.locator("html").getAttribute("data-mode"), "dark");
  await page.reload();
  await page.waitForFunction(
    () => document.documentElement.dataset.palette === "forest",
  );
  assert.equal(
    await page.locator("html").getAttribute("data-palette"),
    "forest",
  );
  await page.waitForTimeout(400);
  await page.screenshot({
    path: "test-output/settings-dark.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Reset to default" }).click();
  await page.goto("http://127.0.0.1:5173/#/saved");
  assert.equal(await page.locator(".product-card").count(), 2);
  await page
    .getByRole("link", { name: "View at retailer" })
    .first()
    .evaluate((el) => el.removeAttribute("target"));
  await page.route("https://example.com/**", (r) =>
    r.fulfill({ body: "Retailer" }),
  );
  await page.getByRole("link", { name: "View at retailer" }).first().click();
  await page.goto("http://127.0.0.1:5173/#/account/history");
  await page
    .getByRole("button", { name: "Mark as bought", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Marked as bought", exact: true })
    .click();
  await page.locator(".history-row").waitFor();
  assert.equal(await page.locator(".history-row").count(), 1);
  await page.getByRole("button", { name: "Undo bought", exact: true }).click();
  await page.locator(".history-row").waitFor({ state: "detached" });
  assert.equal(await page.locator(".history-row").count(), 0);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [
      "chat",
      "discover",
      "saved",
      "account/appearance",
      "account/profile",
      "account/history",
      "about",
    ]) {
      await page.goto("http://127.0.0.1:5173/#/" + route);
      await page.waitForTimeout(100);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `Overflow ${width} ${route}`,
      );
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:5173/#/chat");
  await page.waitForTimeout(400);
  await page.screenshot({
    path: "test-output/home-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: follow-up context, saved persistence, collections, comparison, appearance persistence, clicked/bought history, and 28 responsive route checks.",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
