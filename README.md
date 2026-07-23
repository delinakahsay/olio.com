# Olio

**AI shopping assistant — describe what you want in plain language, get real products back.** Olio turns a natural-language request into live Google Shopping results, with an AI-written shopping tip, saved items, and a demo checkout.

![Olio screenshot](docs/screenshot.png)
*(Screenshot coming soon.)*

## How it works

1. **Search** — the browser posts your query to a serverless function ([api/search.js](api/search.js)), which queries **SerpAPI** (Google Shopping) and normalizes the top results into product cards: title, price, seller, link, thumbnail.
2. **Stable product IDs** — each product's ID is a hash of its link, not its position in the results, so saved items and cart entries still match after new searches or logging back in.
3. **AI summary** — if an OpenAI key is configured, **GPT-4o-mini** writes a two-sentence shopping tip specific to your query and the top results. The search still works without it.
4. **Accounts** — register/login ([api/auth.js](api/auth.js)) with scrypt-hashed, salted passwords and bearer-token sessions. Signed-in users can save items and run a simulated checkout that records orders to their profile ([api/profile.js](api/profile.js)).
5. **Storage** — [api/db.js](api/db.js) uses **Supabase** (via its REST API) when `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` are set, and falls back to a local JSON file for development. The schema is in [docs/supabase.sql](docs/supabase.sql).

## Tech stack

- **Frontend:** React 19 + Vite ([src/](src/)) — component-based UI with hooks for search, cart, saved items, and auth state
- **Backend:** Node.js serverless functions (Vercel-style `api/` directory)
- **APIs:** SerpAPI (product search), OpenAI `gpt-4o-mini` (summaries, optional)
- **Storage:** Supabase (production) or local JSON (development)

## Run it locally

Requires the [Vercel CLI](https://vercel.com/docs/cli) to serve the React app and `api/` functions together.

```bash
npm install
npm install -g vercel
vercel dev
```

Set environment variables (in a `.env.local` or the Vercel dashboard):

| Variable | Required | Purpose |
|---|---|---|
| `SERP_API_KEY` | Yes | Product search via SerpAPI |
| `OPENAI_API_KEY` | No | AI shopping-tip summaries |
| `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` | No | Persistent user storage; falls back to local JSON without them |

## Limitations / future improvements

- **Checkout is simulated** — "purchases" are recorded to the user's profile; no payment processing.
- **Sessions are simple** — one token per user, no expiry or refresh; fine for a demo, not production auth.
- **Search quality depends on SerpAPI** — results mirror Google Shopping, including its occasional odd matches.
- **Next steps** — price tracking on saved items, comparison view across sellers, and moving auth to a managed provider.
