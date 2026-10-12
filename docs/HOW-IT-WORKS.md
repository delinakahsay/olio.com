# How Olio works

Written so the two of us are looking at the same thing. If something behaves
oddly, the answer is almost always in here.

## The shape

```
your message
   ↓
api/search.js        auth, assemble context, call the agent, persist memory
   ↓
api/agent.js         the loop. this is where all the behaviour lives
   ↓  ↕ tools
   ↓     read_the_web     → Tavily, reviews and roundups
   ↓     search_products  → SerpAPI google_shopping
   ↓     remember         → users.memory in Supabase
   ↓     present          → the shortlist you see
   ↓
{ mode, summary, products, reading, searches, sources }
```

`agent.js` is not a pipeline. It is a loop, up to 7 rounds. Each round the
model decides what to do next: search again, remember something, present, or
just talk. Nothing else chooses for it.

## What the agent starts each turn holding

1. **The system prompt.** Rules, in priority order: answer first then narrow,
   the hard/soft brief, never invent, when not to search, tone.
2. **The brief.** Every requirement from this conversation, each hard or soft.
   Round-tripped through the browser so it survives turns.
3. **Your memory.** `users.memory`, up to 40 short durable facts.
4. **Your saved items**, as evidence of taste rather than instructions.
5. **The last 12 messages** with roles intact.

## The four tools

**`read_the_web(query)`** hits Tavily and returns six page titles with excerpts:
reviews, roundups, forum threads. This is the depth you were missing. The
product index knows what exists and what it costs and has no idea what is good,
and the only place that knowledge lives is in writing about products. The agent
is told to read first on any question about quality, pull out the specific
product names people who know the category keep naming, and then search the
index for those names. Capped at two reads a turn. Offered to the model only
when `TAVILY_API_KEY` is set, because a tool that always errors teaches it to
stop trying and the failure then looks like bad reasoning.

Page text arrives fenced and labelled untrusted, and the fence markers are
stripped out of the page content so a page cannot close the fence early and
have the rest of itself read as instructions. That is the soft defence. The
hard one is that nothing read can become a pick, because picks must carry ids
from a real product search.

**`search_products(query, min_price, max_price)`** hits SerpAPI's
`google_shopping` engine, maps ~13 fields per result (title, price, source,
link, thumbnail, rating, reviews, delivery, spec tags), applies price bounds,
and returns at most 10 with stable ids. Every result goes into a pool for the
turn. The model is encouraged to call this two to four times from different
angles rather than once broadly.

**`remember(fact)`** appends one durable preference to `users.memory`. Deduped,
capped at 40. Scoped to colouring, sizes, materials, brands, budgets. Never
health, money or identity.

**`present(message, picks, requirements, gap, refinements)`** ends the turn
with a shortlist. Picks cite pool ids. Anything searched but not picked is
appended after the picks, so a thin shortlist never looks like a failed search.

## The guards, and why each one exists

These are structural. The model cannot talk its way past them.

| Guard | The bug it was built for |
|---|---|
| `present` with an empty pool is refused | It described a tomtoc tote at $69.99 and a LOVEVOOK at $59.99 that never came from the index. Products invented from training data. |
| `present` with ids that are not in the pool is refused | Same failure, different shape. |
| A prose reply while holding results is refused | "Best blush brush" searched, found brushes, then answered in a paragraph and threw the pool away. You saw an empty grid under a confident answer. |
| Round exhaustion still returns the pool | Last line of defence: if a search returned products, you see products. |
| Hard requirements forced server side | It labelled "Fits 14 inch laptop" as taste, so a JW Pei crescent bag reached the shortlist. Anything with a measurement, price, size or capability word is forced hard regardless of what the model said. |
| A product named only in page text is refused | The web tool's version of inventing products. An article naming a $69 brush is a lead to search for, not a product to show. Covered by the same pool-id check, tested against a page that also tries to inject instructions. |
| A message that re-lists the grid is refused | Reading five roundups made it want to recite five brushes, so the answer became a paragraph naming every product already visible beside it with its price. Naming one standout is good; naming the list is duplicate text. Refused once, then it stands. |
| Resale and marketplace listings sort behind real retailers | Searching by exact product name, which is what reading the web makes it do, pushes the feed toward eBay, Mercari and the dropship clothing sites, because that is where exact-name listings live. Marked for the model, sorted last, never hidden: sometimes resale is the only source. |
| Directory and people-search pages cannot count as sources | "Best blush brush" read mapquest, yelp and rocketreach, because a general web search reads a product phrase as a local business. Excluded upstream, plus a relevance floor. |
| No `OPENAI_API_KEY` fails loudly | Degrading to keyword-only search silently is how you end up with a worse Google that nobody can diagnose. |

The repeated lesson: **a tool description is not a constraint.** Every one of
these started as an instruction the model ignored.

## What is still prompt-level, not guaranteed

Be suspicious of these; they are where the next bug will be.

- **Reading the web and then answering in prose with no grid.** This gets one
  nudge and then is allowed. A server cannot tell "best carry-on" (wants
  products) from "what should I look for in a carry-on" (wants an answer), and
  the second is a legitimate prose reply. One nudge, then it stands.
- Whether it reads the web at all on an open-ended request, rather than going
  straight to the feed.
- Asking a question *after* results rather than instead of them.
- Whether a `why` actually addresses the hard requirements.
- Whether refinements name real category axes or generic filler.
- Whether the search terms reflect what it knows you mean (warm colouring to
  peach and terracotta) rather than the words you used.
- Tone and length, below the three-product enumeration floor.
- Whether the read query is phrased for opinions ("best X reddit") rather than
  bare, which is what sent it to local business listings the first time.

## Known ceilings

- **One source for buying.** Everything purchasable is Google Shopping, which
  is paid-placement skewed and dominated in apparel by dropship formalwear.
  Reading the web changes which products get searched for, which helps a lot in
  categories people write about, and not at all for a dress nobody reviewed.
  It also surfaces a new gap: reviewers name things the feed does not carry, so
  expect "the Chikuhodo was not in the results" more often. That is the truth,
  not a bug, but it argues for a second buying source.
- **It cannot see.** Picks are judged from title, price, rating and spec tags.
  It cannot tell polyester prom satin from the thing you wanted. Vision on the
  thumbnails is the open fix.
- **No dimensions.** Google Shopping rarely publishes bag measurements, so
  "fits a 14 inch laptop" is inferred from the title, not verified.

## Settings worth knowing

- `TAVILY_API_KEY`, optional. Without it the web tool is not offered and Olio
  works off the product feed alone: worse, not broken. Free tier is 1,000
  searches a month, and a turn that reads uses one or two.
- `OLIO_MODEL`, default `gpt-4o`. Mini cannot hold the inference from "I lean
  warm" to "rule out lilac", which is the whole product.
- Max 7 rounds per turn. Read, two searches and a present is four on its own,
  and a nudge can cost another.
- `searches` and `sources` are returned on every response and shown under the
  result count, so you can always see what it typed into the index and which
  sites it read. An agent you cannot see is one you cannot debug.
