const { getUserByToken, updateUser } = require('./db');

module.exports = async function handler(req, res) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing auth token' });
  }

  try {
    const { user } = await getUserByToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid auth token' });
    }

    if (req.method === 'GET') {
      return res.status(200).json({
        email: user.email,
        savedItems: user.savedItems || [],
        orders: user.orders || [],
      });
    }

    if (req.method === 'POST') {
      const { action, item, itemId, items } = req.body || {};

      if (action === 'saveItem') {
        if (!item || !item.id) {
          return res.status(400).json({ error: 'Item is required' });
        }
        const savedItems = user.savedItems || [];
        if (!savedItems.some((saved) => saved.id === item.id)) {
          savedItems.push(item);
        }
        const updated = await updateUser(user.id, { savedItems });
        return res.status(200).json({ savedItems: updated.savedItems || [] });
      }

      if (action === 'removeItem') {
        const savedItems = (user.savedItems || []).filter((saved) => saved.id !== itemId);
        const updated = await updateUser(user.id, { savedItems });
        return res.status(200).json({ savedItems: updated.savedItems || [] });
      }

      if (action === 'confirmPurchase') {
        if (!Array.isArray(items) || !items.length) {
          return res.status(400).json({ error: 'Items are required' });
        }
        const orders = user.orders || [];
        const purchasedAt = new Date().toISOString();
        const purchasedItems = items.map((item) => ({ ...item, purchasedAt }));
        const updated = await updateUser(user.id, { orders: [...orders, ...purchasedItems] });
        return res.status(200).json({ orders: updated.orders || [] });
      }

      return res.status(400).json({ error: 'Invalid profile action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Profile route error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
