const db = require("./db");
const { runAgent } = require("./agent");

const str = (v, max) =>
  String(v == null ? "" : v)
    .trim()
    .slice(0, max);

// gpt-4o-mini could extract keywords, but it cannot reliably reason that warm
// colouring rules out lilac. Reasoning is the entire product here, and at this
// volume the difference is cents a month.
const MODEL = process.env.OLIO_MODEL || "gpt-4o";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authorization = req.headers?.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  try {
    if (!token || !(await db.getUserByToken(token)).user) {
      return res.status(401).json({ error: "Sign in to start shopping with Olio." });
    }
  } catch {
    return res
      .status(503)
      .json({ error: "We could not verify your account. Please try again." });
  }

  const body = req.body || {};
  const query = str(body.query, 500);
  if (!query) return res.status(400).json({ error: "Query is required" });

  const SERP_KEY = process.env.SERP_API_KEY;
  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!SERP_KEY) {
    return res
      .status(500)
      .json({ error: "SERP_API_KEY not configured in Vercel environment variables" });
  }
  if (!OPENAI_KEY) {
    return res.status(500).json({
      error: "OPENAI_API_KEY not configured. Olio cannot reason without it.",
    });
  }

  // The full exchange, so the agent can resolve "the blue one" and remember
  // what it has already been told. Roles are preserved; the old code sent only
  // the user's lines joined with semicolons.
  const history = Array.isArray(body.history)
    ? body.history
        .filter((m) => m && typeof m.text === "string")
        .slice(-12)
        .map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: str(m.text, 1200),
        }))
    : [];

  // Standing preferences and switched-on filters arrive as context rather than
  // as string surgery on the query.
  const pinned = Array.isArray(body.refinements)
    ? body.refinements.filter((r) => typeof r === "string").map((r) => str(r, 28)).slice(0, 6)
    : [];
  const notes = [];
  if (pinned.length) notes.push(`Filters they switched on: ${pinned.join(", ")}.`);
  if (str(body.category, 40)) notes.push(`Browsing category: ${str(body.category, 40)}.`);
  if (Number(body.priceMax) > 0) notes.push(`Budget ceiling: $${Number(body.priceMax)}.`);
  if (Number(body.priceMin) > 0) notes.push(`Minimum price: $${Number(body.priceMin)}.`);

  const message = notes.length ? `${query}\n\n[${notes.join(" ")}]` : query;

  try {
    const out = await runAgent({
      openaiKey: OPENAI_KEY,
      serpKey: SERP_KEY,
      model: MODEL,
      history,
      message,
    });

    return res.status(200).json({
      mode: out.mode,
      // The UI shows this as the assistant's turn.
      summary: out.gap ? `${out.message} ${out.gap}` : out.message,
      // null means "this was conversation, keep whatever is on screen".
      products: out.products,
      reading: out.reading || null,
      searches: out.searches,
    });
  } catch (error) {
    console.error("Search error:", error);
    const aborted = error.name === "AbortError";
    return res.status(aborted ? 504 : 500).json({
      error: aborted
        ? "That took too long. Try it again."
        : "We could not search right now. Please try again.",
    });
  }
};
