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

  try {
    // Step 1: Get real products from SerpAPI Google Shopping
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

    // Map real SerpAPI data to our product format
    const products = shopResults.slice(0, 12).map((item, i) => {
      const priceStr = (item.extracted_price || item.price || '0').toString().replace(/[^0-9.]/g, '');
      return {
        id: i,
        title: item.title || 'Product',
        price: item.price || (priceStr ? '$' + Number(priceStr).toFixed(2) : ''),
        priceNum: parseFloat(priceStr) || 0,
        source: item.source || 'Shop',
        link: item.link || item.product_link || '#',
        snippet: item.snippet || '',
        thumbnail: item.thumbnail || null,
        imageQuery: item.title || 'product'
      };
    });

    // Step 2: Get AI summary (optional, don't fail if OpenAI is missing)
    let summary = '';
    if (OPENAI_KEY) {
      try {
        const topProducts = products.slice(0, 5).map(p => `${p.title} (${p.price})`).join(', ');
        const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_KEY}`
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
        // AI summary is optional, don't fail the whole request
        console.error('AI summary error:', e.message);
      }
    }

    return res.status(200).json({ summary, products });
  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({ error: error.message || 'Something went wrong' });
  }
};
