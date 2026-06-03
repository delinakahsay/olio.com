const { readDB, writeDB } = require('./db');

async function getUserByToken(token) {
  const db = await readDB();
  const user = db.users.find((u) => u.token === token);
  return { db, user };
}

module.exports = async function handler(req, res) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing auth token' });
  }

  const { db, user } = await getUserByToken(token);
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
      user.savedItems = user.savedItems || [];
      if (!user.savedItems.some((saved) => saved.id === item.id)) {
        user.savedItems.push(item);
      }
      await writeDB(db);
      return res.status(200).json({ savedItems: user.savedItems });
    }

    if (action === 'removeItem') {
      user.savedItems = (user.savedItems || []).filter((saved) => saved.id !== itemId);
      await writeDB(db);
      return res.status(200).json({ savedItems: user.savedItems });
    }

    if (action === 'confirmPurchase') {
      if (!Array.isArray(items) || !items.length) {
        return res.status(400).json({ error: 'Items are required' });
      }
      user.orders = user.orders || [];
      const purchasedAt = new Date().toISOString();
      const purchasedItems = items.map((item) => ({
        ...item,
        purchasedAt,
      }));
      user.orders.push(...purchasedItems);
      await writeDB(db);
      return res.status(200).json({ orders: user.orders });
    }

    return res.status(400).json({ error: 'Invalid profile action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
