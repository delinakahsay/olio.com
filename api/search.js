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
  let user = null;
  try {
    user = (await db.getUserByToken(token)).user;
    if (!token || !user) {
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
  // Optional. Without it the agent keeps working off the product index alone,
  // which is worse but not broken, so this one degrades rather than failing.
  const TAVILY_KEY = process.env.TAVILY_API_KEY || "";
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
  // The running brief of hard requirements and soft preferences, round
  // tripped through the client so a follow-up about style cannot quietly
  // drop "fits a 14 inch laptop".
  const brief = Array.isArray(body.brief)
    ? body.brief
        .filter((r) => r && typeof r.text === "string")
        .map((r) => ({ text: str(r.text, 32), hard: Boolean(r.hard) }))
        .filter((r) => r.text)
        .slice(0, 8)
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
      tavilyKey: TAVILY_KEY,
      model: MODEL,
      history,
      message,
      memory: Array.isArray(user.memory) ? user.memory : [],
      saved: Array.isArray(user.savedItems) ? user.savedItems : [],
      brief,
    });

    // Persist only when the agent actually added something. Capped so a long
    // relationship cannot turn the column into a transcript.
    const before = Array.isArray(user.memory) ? user.memory : [];
    if (out.memory && out.memory.length > before.length) {
      try {
        await db.updateUser(user.id, { memory: out.memory.slice(-40) });
      } catch (err) {
        // Memory is a nicety. A failure here must not cost them the search.
        console.error("Could not save memory:", err.message);
      }
    }

    return res.status(200).json({
      mode: out.mode,
      // The UI shows this as the assistant's turn.
      summary: out.gap ? `${out.message} ${out.gap}` : out.message,
      // null means "this was conversation, keep whatever is on screen".
      products: out.products,
      reading: out.reading || null,
      searches: out.searches,
      // What it read, so a recommendation with a reason behind it can show
      // where the reason came from.
      sources: out.sources || [],
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
