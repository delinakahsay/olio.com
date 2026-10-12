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

THE BRIEF, AND WHY IT MATTERS MOST.
You keep a running brief of what this search has to satisfy. Every requirement is either HARD or SOFT.

HARD is a fact the item must satisfy or it is useless to them: it fits a 14 inch laptop, it is under $100, it is waterproof, it is a size 9. SOFT is taste: curvy and structured, looks like JW Pei, youthful, warm toned.

A new preference NEVER cancels a hard requirement. If someone asks for a laptop tote and then says they want something more like JW Pei, they want a laptop tote that looks like JW Pei. They do not want a small shoulder bag. A hard requirement only goes away when they say so, in words, and if a new preference genuinely cannot coexist with one, say that out loud and ask which they want rather than quietly dropping either.

Mark a requirement HARD whenever it carries a measurement, a price, a size or a capability: "fits a 14 inch laptop", "under $100", "size 9", "waterproof". When in doubt, hard. Treating a real requirement as taste is far worse than the reverse.

Before you call present, check every pick against every hard requirement. The why for each pick must speak to the hard ones, not only to taste: if the brief says it must fit a 14 inch laptop, every why says whether it does. If a pick fails a hard requirement, either leave it out or say so plainly in its why. A small top-handle bag presented against a laptop requirement, with a why that only mentions style, is the single worst thing you can do here.

HOW TO WORK.
- You can call search_products more than once. Prefer two to four searches that attack the request from different angles over one broad search. Different colours, different garment types, different price bands.
- Searches are keyword queries against a retail index. Write them the way a good shopper would type them: "peach chiffon maxi dress", not "a dress that suits warm colouring".
- Carry every hard requirement into every search. A follow-up about style still searches for the capacity they asked for: "structured leather laptop tote 14 inch", not "cute curved shoulder bag".
- Once you have enough, call present to show your shortlist. Say honestly which items miss, and what no option delivers.
- Presenting is not the end of the turn. Unless the request was already specific, close the present message with the one question that would sharpen it.
- You can only search retail products. There are no cars, property, services, travel, tickets or prescriptions in the index. If asked for those, just say so in conversation.

WHEN NOT TO SEARCH.
If the person is chatting, asking you a question, answering one of yours, or saying something that is not a shopping request, just reply. Do not search. Do not call present. "What is 5+5" gets "10", not a grid of dresses.

ANSWER FIRST, THEN NARROW. THIS IS THE RULE THAT MATTERS MOST.
Never make someone answer a question before they see anything. If the request names a thing you could type into a shop, search for it now, even when it is thin. Asking for a brand and a budget before doing any work is the opposite of helping.

When a request is vague, "best" means best reviewed. Lead with the highest rated options that carry enough reviews to mean something, and say that is what you did.

Then ask, in the same present message, the ONE question that actually splits this category, and show that you know the category by naming the real axes rather than generic ones. "Best blush brush" is answered with the best rated brushes, followed by: powder, cream and liquid blush each want a different brush, so which are you using? Density, bristle type and head shape follow from that. Never "do you have a brand preference" or "what is your budget" as the opening move. Teach them the dimension that matters while you ask about it.

Only ask before searching when you genuinely cannot tell what kind of object they mean: "a gift for my brother", "something for the new place". Even then, one short question, never a list.

When they tell you something that will still be true next month, call remember once. Their colouring, their sizes, a style or material they love or cannot wear, a brand they trust, the budget they keep landing on. Do not remember one-off needs, do not remember what you merely guessed, and do not remember anything about their health, money or identity. Never announce that you saved something; just use it.

If you have been given things they saved before, treat those as evidence of taste rather than instructions. Three linen pieces means they like linen.

NEVER INVENT.
Every product you mention must have come back from search_products in this turn. Do not name a product, a price or a specification from memory, however confident you are. If the searches turned up nothing useful, say exactly that; do not fill the gap with what you think exists.

TONE.
Warm, concise, specific. No bullet lists and no numbered lists, and never enumerate the products one by one: the grid beside you already shows them with their prices. Say what you went looking for, what is worth a look and what is missing, in a sentence or two. Never say "I found some options for you".`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "remember",
      description:
        "Save one durable shopping preference about this shopper, so future conversations start knowing it. Only for things that stay true: colouring, sizes, styles they like or avoid, brands, materials they react to, a recurring budget. Never for one-off needs ('a dress for Saturday'), and never for health, finances, identity or anything they did not plainly state.",
      parameters: {
        type: "object",
        properties: {
          fact: {
            type: "string",
            description:
              "One short sentence in the third person, e.g. 'Leans warm in colouring, avoids cool pastels.'",
          },
        },
        required: ["fact"],
      },
    },
  },
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
                    "Max 14 words. Must address every hard requirement, not just taste: say whether it meets each one or which it fails. Be concrete: name the colour, the capacity, the rating.",
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
          requirements: {
            type: "array",
            description:
              "The full running brief, not just this turn's additions. Every hard requirement from earlier in the conversation must still be here unless the shopper explicitly dropped it.",
            items: {
              type: "object",
              properties: {
                text: { type: "string", description: "Short label, 1-4 words, e.g. 'Fits 14in laptop'." },
                hard: {
                  type: "boolean",
                  description:
                    "true if an item failing this is useless to them (capacity, budget, size, waterproof). false for taste.",
                },
              },
              required: ["text", "hard"],
            },
          },
          refinements: {
            type: "array",
            description:
              "2-4 labels naming the axes that actually separate good from bad in THIS category, as someone who knows it would put them. Blush brushes: 'For cream blush', 'Dense and small', 'Natural bristle'. Laptop bags: 'Padded sleeve', 'Fits 16in', 'Trolley strap'. Never generic filler such as 'Color options', 'Material choices' or 'Brand preferences'; they fit every category and help with none.",
            items: { type: "string" },
          },
        },
        required: ["message", "picks"],
      },
    },
  },
];

// The model under-marks hard requirements: it labelled "Fits 14 inch laptop"
// as taste. Anything carrying a measurement, a price ceiling, a size or a
// capability word is a fact the item either satisfies or does not, so the
// server forces it hard regardless of what the model said. Model proposes,
// this enforces a floor.
const HARD_PATTERNS = [
  /\d\s*(?:"|''|in\b|inch|cm\b|mm\b|ml\b|l\b|oz\b|lb\b|kg\b|g\b)/i,
  /\$\s*\d|\bunder\s|\bover\s|\bbudget\b|\bmax\b|\bmin\b/i,
  /\bfits?\b|\bholds?\b|\bcarries\b|\bcapacity\b/i,
  /\bsize\b|\bus\s?\d|\bpetite\b|\btall\b|\bplus\s?size\b|\bwide\b|\bnarrow\b/i,
  /waterproof|water.resistant|washable|dishwasher|microwave|wireless|cordless|rechargeable|gluten|vegan|fragrance.free|hypoallergenic/i,
];
function hardenRequirements(reqs) {
  return reqs.map((r) =>
    r.hard || HARD_PATTERNS.some((re) => re.test(r.text))
      ? { ...r, hard: true }
      : r,
  );
}

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
async function runAgent({
  openaiKey,
  serpKey,
  model,
  history,
  message,
  memory = [],
  saved = [],
  brief = [],
  maxRounds = 5,
}) {
  // What it already knows walks in with it, rather than being re-derived from
  // the conversation every time.
  const context = [];
  if (brief.length) {
    const hard = brief.filter((r) => r.hard).map((r) => r.text);
    const soft = brief.filter((r) => !r.hard).map((r) => r.text);
    context.push(
      "The running brief for this search. Carry it forward.\n" +
        (hard.length ? `MUST satisfy: ${hard.join(", ")}.\n` : "") +
        (soft.length ? `Prefers: ${soft.join(", ")}.` : ""),
    );
  }
  if (memory.length)
    context.push(`What you know about this shopper:\n- ${memory.slice(-30).join("\n- ")}`);
  if (saved.length)
    context.push(
      `Things they have saved before, which show their taste:\n- ${saved
        .slice(-15)
        .map((p) => [p.title, p.price].filter(Boolean).join(" — "))
        .join("\n- ")}`,
    );

  const messages = [
    { role: "system", content: SYSTEM },
    ...(context.length
      ? [{ role: "system", content: context.join("\n\n") }]
      : []),
    ...history.slice(-12),
    { role: "user", content: message },
  ];
  const pool = new Map();
  const searches = [];
  const remembered = [...memory];

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
        memory: remembered,
      };
    }

    messages.push(reply);

    for (const call of calls) {
      let args = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {}

      if (call.function.name === "present") {
        // Hard stop: presenting without having searched means the shortlist
        // came out of the model's memory, not the index. That shipped a
        // message naming three bags at precise prices while the grid said
        // nothing matched. Make it impossible rather than discouraged.
        if (!pool.size) {
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content:
              "Refused: you have not searched, so there is nothing to present. Call search_products first. Never name a product you have not seen in search results.",
          });
          continue;
        }

        const picks = Array.isArray(args.picks) ? args.picks : [];
        if (picks.length && !picks.some((pk) => pool.has(String(pk.id)))) {
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content:
              "Refused: none of those ids came from a search. Use the ids exactly as search_products returned them.",
          });
          continue;
        }

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

        const reqs = hardenRequirements(
          (Array.isArray(args.requirements) ? args.requirements : [])
            .map((r) => ({ text: str(r?.text, 32), hard: Boolean(r?.hard) }))
            .filter((r) => r.text)
            .slice(0, 8),
        );

        return {
          mode: "results",
          message:
            str(args.message, 600) ||
            `${ordered.length} options, best first.`,
          gap: str(args.gap, 200) || null,
          products: ordered.slice(0, 24),
          reading: {
            requirements: reqs,
            constraints: reqs.map((r) => r.text),
            refinements: Array.isArray(args.refinements)
              ? args.refinements.map((r) => str(r, 28)).filter(Boolean).slice(0, 4)
              : [],
          },
          searches,
          memory: remembered,
        };
      }

      if (call.function.name === "remember") {
        const fact = str(args.fact, 160);
        // Deduped case-insensitively, and capped, so this cannot grow into a
        // transcript. It is a short profile, not a log.
        const known = remembered.map((m) => m.toLowerCase());
        if (fact && !known.includes(fact.toLowerCase())) remembered.push(fact);
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: fact ? "Saved." : "Nothing to save.",
        });
        continue;
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
      reading: { requirements: brief, constraints: brief.map((r) => r.text), refinements: [] },
      searches,
      memory: remembered,
    };
  }
  return {
    mode: "chat",
    message: "I could not get that one. Try saying it a different way.",
    products: null,
    searches,
    memory: remembered,
  };
}

module.exports = { runAgent, SYSTEM, TOOLS, mapProduct, stableId };
