export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 2000,
        response_format: { type: 'json_object' },
        messages: [{
          role: 'system',
          content: `You are Olio, an AI shopping assistant. The user describes what they want. Return a JSON object with:
- "summary": 2 friendly sentences with a specific shopping tip for this search
- "products": array of 8-12 product objects, each with:
  - "name": specific real product name (brand + model)
  - "price": realistic price as a number (USD)
  - "source": the store/retailer where this product is commonly sold (Amazon, Target, Nordstrom, etc.)
  - "description": 1-2 sentence description of why this product matches their needs
  - "productUrl": a direct URL to the product page or store page where this product can be purchased
  - "searchUrl": a Google Shopping search URL for this exact product (format: https://www.google.com/search?tbm=shop&q=PRODUCT+NAME+encoded)
  - "imageUrl": a direct public image URL for the product if available
  - "imageQuery": a concise search query to find an image of this product

Return ONLY real products that actually exist. Do not invent or use generic search pages as `productUrl`. If a direct product page is unavailable, return the next-best store listing or marketplace page for this exact product. Be specific with brand names and models. Vary the price range and retailers. Match the user's described needs closely.`
        }, {
          role: 'user',
          content: query
        }]
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || 'OpenAI API request failed');
    }

    const json = await response.json();
    const text = json.choices?.[0]?.message?.content || '';

    if (!text) {
      throw new Error('No response from OpenAI');
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new Error('Failed to parse OpenAI response');
    }

    if (!parsed.products || !Array.isArray(parsed.products)) {
      throw new Error('Invalid response format from OpenAI');
    }

    return res.status(200).json({
      summary: parsed.summary || '',
      products: parsed.products.map((p, i) => ({
        id: i,
        title: p.name || 'Product',
        price: '$' + Number(p.price || 0).toFixed(2),
        priceNum: Number(p.price || 0),
        source: p.source || 'Online',
                link: p.productUrl || p.searchUrl || p.url || p.link || 'https://www.google.com/search?tbm=shop&q=' + encodeURIComponent(p.name),
        snippet: p.description || '',
        imageQuery: p.imageQuery || p.name,
        thumbnail: p.imageUrl || null
      }))
    });
  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({ error: error.message || 'Something went wrong' });
  }
}
