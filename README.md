# Olio

A conversational shopping app. Describe a product, refine your request, explore live listings, and save your finds.

## Experience

- Chat and shortlist stay side by side on desktop and stack on mobile.
- Lora serif gives Olio's headings and replies their voice. DM Sans keeps controls and product details readable.
- Discover uses original generated editorial imagery to start real searches. Inspiration images are not purchasable product listings.
- Saved supports browser-local collections and a side-by-side comparison of selected products. Signed-in saved products retain the existing server synchronization.
- Account includes profile, appearance, preferences, history, feedback controls, privacy/data export, password changes, and help.
- Appearance includes wine, forest, midnight, and clay accents, light/dark/system modes, larger text, and reduced motion.
- Clicked history and explicitly marked purchases are separate. Opening a retailer does not create a purchase record. The legacy cart remains reachable from Account.

## Storage

| Data | Storage |
|---|---|
| Account name, email, password hash, signed-in saved products, legacy cart/orders | Existing Supabase user record |
| Guest saved products | This browser |
| Appearance, preferences, collections, clicked/bought history, conversation history | This browser, separated by signed-in email or guest |

No database migration is required. Existing legacy order records are retained and included in the account data export, but are not represented as verified purchases. Email changes, account deletion, price alerts, and cross-device history sync are not implemented. The interface does not advertise these capabilities.

History is capped at 200 products and 30 conversations. Clearing browser data does not delete your account or server-saved products. Signing out returns to the separate guest profile. Storage can be cleared by browser settings.

## Search

`api/search.js` interprets the latest request in the context of up to eight earlier user requests. The model extracts search terms and constraints, SerpAPI supplies product listings, and an optional model pass ranks the results. Model failures fall back independently. Explicit numeric budgets are never silently discarded to fill a grid. Products with unknown prices still require verification at the retailer.

The frontend sends follow-up context and retains the visible conversation. This is a shopping search conversation, not a general-purpose chatbot. Each message starts a search; the app does not fabricate clarifying model replies before a search.

## Development

```sh
npm ci
npm run dev -- --host 127.0.0.1
npm run build
npm test
```

Vite alone serves the frontend. Use `vercel dev` for frontend and serverless endpoints together. Configure these in `.env.local` or Vercel, never in browser code:

- `SERP_API_KEY`: required for product search
- `OPENAI_API_KEY`: optional for interpretation and ranking
- `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`: persistent account storage

Without Supabase, `api/db.js` uses local JSON for development. Its production `/tmp` fallback is ephemeral and is not durable account storage. Existing authentication uses a single bearer token per user without expiry. This redesign does not replace it with a managed authentication service.

## Verification

```sh
npm test
npx playwright install firefox
# In another terminal, run the frontend on port 5173 first.
npm run test:browser
```

API tests stub upstream services and cover contextual follow-ups, stable product IDs, budget filtering, model fallbacks, safe upstream errors, and authenticated profile/password changes. Browser tests stub search results and cover saved products, collections, comparison, history, appearance persistence, and responsive routes. Real provider credentials are needed to verify live search and Supabase on a deployment.

## Design assets

`public/images/discover-editorial.webp` is original generated editorial artwork, not a retailer product image. Result photography comes from actual search results. `public/favicon.svg` is the wine-and-ivory Olio lettermark.
