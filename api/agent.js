// The shopping agent.
//
// The previous version was a pipeline: extract keywords, run one search, score
// the titles. The model never decided anything, which is why asking it for a
// warm pastel dress returned icy blue ones and why "what is 5+5" returned
// dresses. There was nothing in the system allowed to think.
//
// This is a loop instead. The model holds the conversation, decides whether to
// search at all, decides how many times and with what terms, and then decides
// what to show and why. Its own knowledge is the point: it knows that a warm
// palette means peach, coral, terracotta and butter yellow rather than lilac
// and ice blue, and nothing here stops it using that.
const crypto = require("crypto");

const str = (v, max) =>
  String(v == null ? "" : v)
    .trim()
    .slice(0, max);

function stableId(seed) {
  return crypto.createHash("sha1").update(String(seed)).digest("hex").slice(0, 16);
}

const isHttpUrl = (value) => {
  try {
    if (!value) return false;
    const u = new URL(String(value).trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};
const safeUrl = (v) => (isHttpUrl(String(v || "").trim()) ? String(v).trim() : null);
const fallbackSearchLink = (t) =>
  "https://www.google.com/search?tbm=shop&q=" + encodeURIComponent(t || "product");

async function fetchWithTimeout(url, options, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const SYSTEM = `You are Olio, a shopping assistant. You talk like a knowledgeable friend who is good at finding things, not like a search box.

WHAT YOU KNOW IS THE POINT.
Use everything you know about colour, fit, materials, seasons, occasions, brands and construction. If someone says they lean warm in their colouring, you know that means peach, coral, warm blush, butter yellow, terracotta, camel and olive, and that it rules out icy blue, lilac, stark white and cool fuchsia. Search for the specific things you know they mean, not the words they happened to use. A shopper saying "warm pastels" should never get a lavender dress back.

HOW TO WORK.
- You can call search_products more than once. Prefer two to four searches that attack the request from different angles over one broad search. Different colours, different garment types, different price bands.
- Searches are keyword queries against a retail index. Write them the way a good shopper would type them: "peach chiffon maxi dress", not "a dress that suits warm colouring".
- Once you have enough, call present to show your shortlist. Say honestly which items miss, and what no option delivers.
- You can only search retail products. There are no cars, property, services, travel, tickets or prescriptions in the index. If asked for those, just say so in conversation.

WHEN NOT TO SEARCH.
If the person is chatting, asking you a question, answering one of yours, or saying something that is not a shopping request, just reply. Do not search. Do not call present. "What is 5+5" gets "10", not a grid of dresses.

GETTING TO KNOW THEM.
Ask a short, specific question when one answer would genuinely change what you look for, and you cannot reasonably guess. Never ask more than one at a time, and never ask what you could infer. Remember what they tell you within the conversation and apply it without being asked again.

TONE.
Warm, concise, specific. No bullet lists in replies. Never say "I found some options for you". Say what you went looking for and why, in a sentence or two.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_products",
      description:
        "Search a retail product index. Call several times with different angles when the request is open-ended. Returns products with ids you can cite in present.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Keyword query a shopping index would match, 2-8 words. Be specific about colour, material and garment type.",
          },
          max_price: { type: "number", description: "Optional ceiling in USD." },
          min_price: { type: "number", description: "Optional floor in USD." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "present",
      description:
        "Show a shortlist to the shopper. Only call this after searching. Order picks best first.",
      parameters: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description:
              "One or two sentences to the shopper: what you went looking for and what you found. Conversational.",
          },
          picks: {
            type: "array",
            description: "The products worth showing, best first.",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                fit: { type: "number", description: "0-100 how well it meets the request." },
                why: {
                  type: "string",
                  description:
                    "Max 12 words on why it fits or where it misses. Be concrete: name the colour, the material, the rating.",
                },
              },
              required: ["id", "fit", "why"],
            },
          },
          gap: {
            type: "string",
            description:
              "One sentence on what NO option delivers, or omit if the request is fully met.",
          },
          constraints: {
            type: "array",
            description:
              "2-5 short labels for what you understood they need, including things you inferred rather than were told. For warm colouring that might be 'Warm pastels', not 'Pastels'.",
            items: { type: "string" },
          },
          refinements: {
            type: "array",
            description: "2-4 short labels for ways to narrow further that they did not already ask for.",
            items: { type: "string" },
          },
        },
        required: ["message", "picks"],
      },
    },
  },
];

function mapProduct(item) {
  const title = item.title || "Product";
  const priceStr = String(item.extracted_price || item.price || "").replace(/[^0-9.]/g, "");
  const link =
    safeUrl(item.link) || safeUrl(item.product_link) || fallbackSearchLink(title);
  return {
    id: stableId(link !== fallbackSearchLink(title) ? link : title),
    title,
    price: item.price || (priceStr ? "$" + Number(priceStr).toFixed(2) : ""),
    priceNum: parseFloat(priceStr) || 0,
    source: item.source || "Shop",
    link,
    snippet: item.snippet || item.description || "",
    thumbnail: safeUrl(item.thumbnail) || safeUrl(item.image) || null,
    imageQuery: title,
    rating: Number(item.rating) || null,
    reviews: Number(item.reviews) || null,
    delivery: str(item.delivery, 60) || null,
    tags: Array.isArray(item.extensions)
      ? item.extensions.map((e) => str(e, 40)).filter(Boolean).slice(0, 6)
      : [],
  };
}

async function runSearch(serpKey, { query, min_price, max_price }) {
  const url =
    `https://serpapi.com/search.json?q=${encodeURIComponent(str(query, 120))}` +
    `&engine=google_shopping&gl=us&hl=en&api_key=${serpKey}`;
  const res = await fetchWithTimeout(url, {}, 25000);
  if (!res.ok) throw new Error(`index returned ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error("index error");
  let rows = (data.shopping_results || []).map(mapProduct);
  const ceil = Number(max_price);
  const floor = Number(min_price);
  if (Number.isFinite(ceil) && ceil > 0)
    rows = rows.filter((p) => !p.priceNum || p.priceNum <= ceil);
  if (Number.isFinite(floor) && floor > 0)
    rows = rows.filter((p) => !p.priceNum || p.priceNum >= floor);
  return rows.slice(0, 10);
}

// What the model sees back from a search: enough to judge on, not so much that
// four searches blow the context.
function describe(p) {
  const bits = [`${p.id}`, p.title, p.price || "price n/a", p.source];
  if (p.rating) bits.push(`${p.rating}/5 (${p.reviews || "?"} reviews)`);
  if (p.tags.length) bits.push(p.tags.slice(0, 3).join("; "));
  return bits.join(" | ");
}

async function callModel(key, model, messages, timeout) {
  const res = await fetchWithTimeout(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages, tools: TOOLS, tool_choice: "auto", temperature: 0.4 }),
    },
    timeout,
  );
  if (!res.ok) throw new Error(`model returned ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message;
}

/**
 * One turn. Returns either a chat reply or a shortlist, because the model
 * decides which this was.
 */
async function runAgent({ openaiKey, serpKey, model, history, message, maxRounds = 5 }) {
  const messages = [
    { role: "system", content: SYSTEM },
    ...history.slice(-12),
    { role: "user", content: message },
  ];
  const pool = new Map();
  const searches = [];

  for (let round = 0; round < maxRounds; round++) {
    const reply = await callModel(openaiKey, model, messages, 30000);
    if (!reply) break;

    const calls = reply.tool_calls || [];
    if (!calls.length) {
      // Plain conversation. No search happened and none was wanted.
      return {
        mode: "chat",
        message: str(reply.content, 1200) || "Tell me a bit more and I'll look.",
        products: null,
        searches,
      };
    }

    messages.push(reply);

    for (const call of calls) {
      let args = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {}

      if (call.function.name === "present") {
        const picks = Array.isArray(args.picks) ? args.picks : [];
        const ordered = [];
        const used = new Set();
        for (const pick of picks) {
          const p = pool.get(String(pick.id));
          if (!p || used.has(p.id)) continue;
          used.add(p.id);
          const fit = Number(pick.fit);
          ordered.push({
            ...p,
            fit: Number.isFinite(fit) ? Math.max(0, Math.min(100, fit)) : null,
            why: str(pick.why, 90),
          });
        }
        // Anything it found but did not pick still goes in, after the picks,
        // so a thin shortlist does not look like a broken search.
        for (const p of pool.values())
          if (!used.has(p.id)) ordered.push({ ...p, fit: null, why: "" });

        return {
          mode: "results",
          message:
            str(args.message, 600) ||
            `${ordered.length} options, best first.`,
          gap: str(args.gap, 200) || null,
          products: ordered.slice(0, 24),
          reading: {
            constraints: Array.isArray(args.constraints)
              ? args.constraints.map((c) => str(c, 28)).filter(Boolean).slice(0, 5)
              : [],
            refinements: Array.isArray(args.refinements)
              ? args.refinements.map((r) => str(r, 28)).filter(Boolean).slice(0, 4)
              : [],
          },
          searches,
        };
      }

      if (call.function.name === "search_products") {
        let content;
        try {
          const rows = await runSearch(serpKey, args);
          rows.forEach((r) => pool.set(r.id, r));
          searches.push(str(args.query, 80));
          content = rows.length
            ? `${rows.length} results for "${str(args.query, 80)}":\n` +
              rows.map(describe).join("\n")
            : `No results for "${str(args.query, 80)}". Try different words.`;
        } catch (err) {
          content = `Search failed: ${err.message}`;
        }
        messages.push({ role: "tool", tool_call_id: call.id, content });
      } else {
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: "Unknown tool.",
        });
      }
    }
  }

  // Ran out of rounds with products in hand: show them rather than nothing.
  if (pool.size) {
    const products = [...pool.values()].map((p) => ({ ...p, fit: null, why: "" }));
    return {
      mode: "results",
      message: "Here is what I turned up. Tell me what to change.",
      gap: null,
      products: products.slice(0, 24),
      reading: { constraints: [], refinements: [] },
      searches,
    };
  }
  return {
    mode: "chat",
    message: "I could not get that one. Try saying it a different way.",
    products: null,
    searches,
  };
}

module.exports = { runAgent, SYSTEM, TOOLS, mapProduct, stableId };
