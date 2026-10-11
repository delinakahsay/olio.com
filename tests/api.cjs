const test = require("node:test");
const assert = require("node:assert/strict");
const dbForSearch = require("../api/db");
dbForSearch.getUserByToken = async (token) => ({
  user: token === "valid" ? { id: "test" } : null,
});
const search = require("../api/search");
const { stableId } = require("../api/agent");
const idOf = (link) => stableId(link);
async function call(
  handler,
  body,
  headers = { authorization: "Bearer valid" },
) {
  let code = 200,
    payload;
  await handler(
    { method: "POST", body, headers },
    {
      status(n) {
        code = n;
        return this;
      },
      json(d) {
        payload = d;
        return this;
      },
    },
  );
  return { code, payload };
}
test("the agent sees the exchange with roles, and its picks drive the order", async () => {
  process.env.SERP_API_KEY = "test";
  process.env.OPENAI_API_KEY = "test";
  const original = global.fetch;
  let sent = null;
  const queries = [];
  global.fetch = async (url, options) => {
    if (String(url).includes("openai")) {
      sent = JSON.parse(options.body);
      // First turn: search twice. Second: present, citing the cheaper id.
      const searched = sent.messages.some((m) => m.role === "tool");
      const call = (name, args, id) => ({
        id,
        type: "function",
        function: { name, arguments: JSON.stringify(args) },
      });
      const msg = searched
        ? {
            role: "assistant",
            tool_calls: [
              call(
                "present",
                {
                  message: "Peach and coral, since cool pastels fight warm colouring.",
                  requirements: [
                    { text: "Warm pastels", hard: false },
                    { text: "Under $150", hard: true },
                  ],
                  picks: [{ id: idOf("https://b.com/x"), fit: 90, why: "Peach chiffon" }],
                  gap: "Nothing under $50.",
                  refinements: ["Midi length"],
                },
                "p1",
              ),
            ],
          }
        : {
            role: "assistant",
            tool_calls: [
              call("search_products", { query: "peach chiffon dress" }, "s1"),
              call("search_products", { query: "coral maxi dress" }, "s2"),
            ],
          };
      return { ok: true, json: async () => ({ choices: [{ message: msg }] }) };
    }
    queries.push(new URL(url).searchParams.get("q"));
    return {
      ok: true,
      json: async () => ({
        shopping_results: [
          { title: "Cheap", price: "$40", extracted_price: 40, link: "https://b.com/x" },
          { title: "Dear", price: "$900", extracted_price: 900, link: "https://b.com/y" },
        ],
      }),
    };
  };
  try {
    const r = await call(search, {
      query: "something warm toned",
      history: [
        { role: "user", text: "a dress for a beach wedding" },
        { role: "assistant", text: "What is your budget?" },
      ],
    });
    assert.equal(r.code, 200);
    assert.equal(r.payload.mode, "results");
    // Both sides of the exchange reach the model, as roles not a joined string.
    const roles = sent.messages.map((m) => m.role);
    assert(roles.includes("system") && roles.includes("assistant"));
    assert(
      sent.messages.some(
        (m) => m.role === "assistant" && m.content === "What is your budget?",
      ),
    );
    // It searched more than once, from different angles.
    assert.equal(queries.length, 2);
    // The pick leads, and its reasoning is attached.
    assert.equal(r.payload.products[0].why, "Peach chiffon");
    assert.equal(r.payload.products[0].fit, 90);
    // Inferred constraints survive, not just stated ones, and hard
    // requirements are marked so a later turn cannot quietly drop them.
    assert.deepEqual(r.payload.reading.constraints, ["Warm pastels", "Under $150"]);
    assert.deepEqual(
      r.payload.reading.requirements.filter((q) => q.hard).map((q) => q.text),
      ["Under $150"],
    );
    assert(r.payload.summary.includes("Nothing under $50."));
  } finally {
    global.fetch = original;
  }
});
test("conversation is answered, not searched", async () => {
  process.env.SERP_API_KEY = "test";
  process.env.OPENAI_API_KEY = "test";
  const original = global.fetch;
  let searches = 0;
  global.fetch = async (url) => {
    if (String(url).includes("openai"))
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { role: "assistant", content: "10." } }],
        }),
      };
    searches += 1;
    return { ok: true, json: async () => ({ shopping_results: [] }) };
  };
  try {
    const r = await call(search, { query: "what is 5+5" });
    assert.equal(r.payload.mode, "chat");
    assert.equal(r.payload.summary, "10.");
    assert.equal(searches, 0);
    // null, not [], so the client keeps whatever is already on screen.
    assert.equal(r.payload.products, null);
  } finally {
    global.fetch = original;
  }
});
test("without a model key it refuses rather than degrading to keyword search", async () => {
  // Reasoning is the product. Silently becoming a worse search engine is the
  // same failure mode as silently writing accounts to /tmp.
  const saved = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  const original = global.fetch;
  let searches = 0;
  global.fetch = async () => {
    searches += 1;
    return { ok: true, json: async () => ({ shopping_results: [] }) };
  };
  try {
    const r = await call(search, { query: "a lamp" });
    assert.equal(r.code, 500);
    assert.match(r.payload.error, /OPENAI_API_KEY/);
    assert.equal(searches, 0);
  } finally {
    global.fetch = original;
    process.env.OPENAI_API_KEY = saved;
  }
});
test("upstream failure detail never reaches the shopper", async () => {
  process.env.SERP_API_KEY = "test";
  process.env.OPENAI_API_KEY = "test";
  const original = global.fetch;
  global.fetch = async (url) =>
    String(url).includes("openai")
      ? { ok: false, status: 500, text: async () => "internal-provider-detail" }
      : { ok: true, json: async () => ({ shopping_results: [] }) };
  try {
    const r = await call(search, { query: "lamp" });
    assert.equal(r.code, 500);
    assert(!JSON.stringify(r.payload).includes("internal-provider-detail"));
  } finally {
    global.fetch = original;
  }
});
test("profile changes require auth; password changes verify current password", async () => {
  const db = require("../api/db");
  const oldGet = db.getUserByToken,
    oldUpdate = db.updateUser;
  let user = {
    id: "test",
    name: "Before",
    salt: "salt",
    passwordHash: db.hashPassword("old-pass", "salt"),
  };
  db.getUserByToken = async (token) => ({
    user: token === "valid" ? user : null,
  });
  db.updateUser = async (id, updates) => (user = { ...user, ...updates });
  delete require.cache[require.resolve("../api/profile")];
  const profile = require("../api/profile");
  try {
    assert.equal(
      (await call(profile, { action: "updateProfile", name: "After" }, {}))
        .code,
      401,
    );
    let r = await call(
      profile,
      { action: "updateProfile", name: "After" },
      { authorization: "Bearer valid" },
    );
    assert.equal(r.payload.name, "After");
    r = await call(
      profile,
      {
        action: "changePassword",
        currentPassword: "wrong",
        newPassword: "new-password",
      },
      { authorization: "Bearer valid" },
    );
    assert.equal(r.code, 400);
    r = await call(
      profile,
      {
        action: "changePassword",
        currentPassword: "old-pass",
        newPassword: "new-password",
      },
      { authorization: "Bearer valid" },
    );
    assert.equal(r.code, 200);
    assert.equal(user.passwordHash, db.hashPassword("new-password", user.salt));
    assert.notEqual(user.salt, "salt");
  } finally {
    db.getUserByToken = oldGet;
    db.updateUser = oldUpdate;
    delete require.cache[require.resolve("../api/profile")];
  }
});

test("search rejects missing or invalid sessions before contacting providers", async () => {
  assert.equal((await call(search, { query: "lamp" }, {})).code, 401);
  assert.equal(
    (await call(search, { query: "lamp" }, { authorization: "Bearer invalid" }))
      .code,
    401,
  );
});
