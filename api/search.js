const crypto = require('crypto');

// Stable ID derived from the product's identity (link or title), NOT its position.
// This means the same product gets the same id across every search and every session,
// so saved items and cart entries keep matching after logout/login.
function stableId(seed) {
  return crypto.createHash('sha1').update(String(seed)).digest('hex').slice(0, 16);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  const SERP_KEY = process.env.SERP_API_KEY;
  const OPENAI_KEY = process.env.OPENAI_API_KEY;

  if (!SERP_KEY) {
    return res.status(500).json({ error: 'SERP_API_KEY not configured in Vercel environment variables' });
  }

  const isHttpUrl = (value) => {
    try {
      if (!value) return false;
      const url = new URL(String(value).trim());
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (e) {
      return false;
    }
  };

  const safeUrl = (value) => {
    const candidate = String(value || '').trim();
    return isHttpUrl(candidate) ? candidate : null;
  };

  const fallbackSearchLink = (title) =>
    'https://www.google.com/search?tbm=shop&q=' + encodeURIComponent(title || 'product');

  try {
    const serpUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(query + ' buy')}&tbm=shop&num=16&api_key=${SERP_KEY}`;
    const serpRes = await fetch(serpUrl);

    if (!serpRes.ok) {
      const errText = await serpRes.text();
      throw new Error(`SerpAPI error (${serpRes.status}): ${errText}`);
    }

    const serpData = await serpRes.json();
    const shopResults = serpData.shopping_results || [];

    if (!shopResults.length) {
      return res.status(200).json({ summary: 'No products found for that search. Try different words.', products: [] });
    }

    const products = shopResults.slice(0, 12).map((item) => {
      const title = item.title || 'Product';
      const priceRaw = item.extracted_price || item.price || '';
      const priceStr = String(priceRaw).replace(/[^0-9.]/g, '');
      const priceDisplay = item.price || (priceStr ? '$' + Number(priceStr).toFixed(2) : '');
      const link = safeUrl(item.link) || safeUrl(item.product_link) || fallbackSearchLink(title);
      const thumbnail = safeUrl(item.thumbnail) || safeUrl(item.image) || null;

      return {
        // Stable across searches: same product -> same id, always.
        id: stableId(link !== fallbackSearchLink(title) ? link : title),
        title,
        price: priceDisplay,
        priceNum: parseFloat(priceStr) || 0,
        source: item.source || 'Shop',
        link,
        snippet: item.snippet || item.description || '',
        thumbnail,
        imageQuery: title
      };
    });

    let summary = '';
    if (OPENAI_KEY) {
      try {
        const topProducts = products.slice(0, 5).map((p) => `${p.title} (${p.price})`).join(', ');
        const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENAI_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            max_tokens: 120,
            messages: [{
              role: 'user',
              content: `A shopper searched for: "${query}". Top results include: ${topProducts}. Write 2 short friendly sentences with a specific shopping tip. Be helpful and specific, not generic.`
            }]
          })
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          summary = aiData.choices?.[0]?.message?.content || '';
        }
      } catch (e) {
        console.error('AI summary error:', e.message);
      }
    }

    return res.status(200).json({ summary, products });
  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({ error: error.message || 'Something went wrong' });
  }
};