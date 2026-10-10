const test = require("node:test");
const assert = require("node:assert/strict");
const dbForSearch = require("../api/db");
dbForSearch.getUserByToken = async (token) => ({
  user: token === "valid" ? { id: "test" } : null,
});
const search = require("../api/search");
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
test("follow-up context reaches interpretation, strict budget holds, stable IDs survive", async () => {
  process.env.SERP_API_KEY = "test";
  process.env.OPENAI_API_KEY = "test";
  const original = global.fetch;
  let prompt = "";
  global.fetch = async (url, options) => {
    if (url.includes("openai")) {
      const content = JSON.parse(options.body).messages[0].content;
      if (content.includes("Earlier requests")) {
        prompt = content;
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    search_terms: "waterproof laptop tote",
                    constraints: ["Waterproof"],
                    max_price: 100,
                    refinements: ["Lighter"],
                  }),
                },
              },
            ],
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content:
                  '{"verdicts":[{"i":0,"fit":80,"why":"Laptop-sized bag"}]}',
              },
            },
          ],
        }),
      };
    }
    assert(
      new URL(url).searchParams.get("q").includes("waterproof laptop tote"),
    );
    return {
      ok: true,
      json: async () => ({
        shopping_results: [
          {
            title: "Laptop tote",
            price: "$60",
            link: "https://example.com/tote",
          },
          {
            title: "Luxury tote",
            price: "$200",
            link: "https://example.com/expensive",
          },
        ],
      }),
    };
  };
  try {
    const a = await call(search, {
      query: "Waterproof",
      messages: ["A bag for class"],
      priceMax: 100,
    });
    assert.equal(a.code, 200);
    assert(prompt.includes("A bag for class"));
    assert.equal(a.payload.products.length, 1);
    const b = await call(search, {
      query: "Waterproof",
      messages: ["A bag for class"],
      priceMax: 100,
    });
    assert.equal(a.payload.products[0].id, b.payload.products[0].id);
  } finally {
    global.fetch = original;
  }
});
test("no model key preserves context and search fallback", async () => {
  delete process.env.OPENAI_API_KEY;
  const original = global.fetch;
  global.fetch = async (url) => {
    const q = new URL(url).searchParams.get("q");
    assert(q.includes("laptop bag"));
    assert(q.includes("waterproof"));
    return { ok: true, json: async () => ({ shopping_results: [] }) };
  };
  try {
    const r = await call(search, {
      query: "waterproof",
      messages: ["laptop bag"],
    });
    assert.equal(r.code, 200);
    assert.deepEqual(r.payload.products, []);
  } finally {
    global.fetch = original;
  }
});
test("model failure keeps product search working; upstream errors do not leak", async () => {
  process.env.OPENAI_API_KEY = "test";
  const original = global.fetch;
  global.fetch = async (url) =>
    url.includes("openai")
      ? { ok: false }
      : {
          ok: true,
          json: async () => ({
            shopping_results: [
              { title: "Lamp", price: "$30", link: "https://example.com/lamp" },
            ],
          }),
        };
  try {
    let r = await call(search, { query: "lamp" });
    assert.equal(r.payload.products.length, 1);
    global.fetch = async (url) =>
      url.includes("openai")
        ? { ok: false }
        : {
            ok: false,
            status: 500,
            text: async () => "internal-provider-detail",
          };
    const log = console.error;
    console.error = () => {};
    try {
      r = await call(search, { query: "lamp" });
      assert.equal(r.code, 500);
      assert(!r.payload.error.includes("internal-provider-detail"));
    } finally {
      console.error = log;
    }
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
