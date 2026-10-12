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
   ↓     search_products  → SerpAPI google_shopping
   ↓     remember         → users.memory in Supabase
   ↓     present          → the shortlist you see
   ↓
{ mode, summary, products, reading, searches }
```

`agent.js` is not a pipeline. It is a loop, up to 5 rounds. Each round the
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

## The three tools

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
| No `OPENAI_API_KEY` fails loudly | Degrading to keyword-only search silently is how you end up with a worse Google that nobody can diagnose. |

The repeated lesson: **a tool description is not a constraint.** Every one of
these started as an instruction the model ignored.

## What is still prompt-level, not guaranteed

Be suspicious of these; they are where the next bug will be.

- Asking a question *after* results rather than instead of them.
- Whether a `why` actually addresses the hard requirements.
- Whether refinements name real category axes or generic filler.
- Whether the search terms reflect what it knows you mean (warm colouring to
  peach and terracotta) rather than the words you used.
- Tone, list formatting, length.

## Known ceilings

- **One source.** Everything is Google Shopping, which is paid-placement
  skewed and dominated in apparel by dropship formalwear. No amount of
  reasoning finds a good dress in a feed that has none.
- **It cannot see.** Picks are judged from title, price, rating and spec tags.
  It cannot tell polyester prom satin from the thing you wanted. Vision on the
  thumbnails is the open fix.
- **No dimensions.** Google Shopping rarely publishes bag measurements, so
  "fits a 14 inch laptop" is inferred from the title, not verified.

## Settings worth knowing

- `OLIO_MODEL`, default `gpt-4o`. Mini cannot hold the inference from "I lean
  warm" to "rule out lilac", which is the whole product.
- Max 5 rounds per turn. Raise it in `runAgent` if searches get truncated.
- `searches` is returned on every response and shown under the result count,
  so you can always see what it actually typed into the index.
