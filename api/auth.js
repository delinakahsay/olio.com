const { readDB, writeDB, normalizeEmail, hashPassword, createSalt, createToken } = require('./db');
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const db = await readDB();
  const normalizedEmail = normalizeEmail(email);
  const user = db.users.find((u) => u.email === normalizedEmail);

  if (action === 'register') {
    if (user) {
      return res.status(400).json({ error: 'Email is already registered' });
    }

    const salt = createSalt();
    const passwordHash = hashPassword(password, salt);
    const token = createToken();
    const id = crypto.randomUUID ? crypto.randomUUID() : createToken();

    const newUser = {
      id,
      email: normalizedEmail,
      passwordHash,
      salt,
      token,
      savedItems: [],
      orders: [],
      createdAt: new Date().toISOString(),
    };

    db.users.push(newUser);
    await writeDB(db);

    return res.status(200).json({
      token,
      email: normalizedEmail,
      savedItems: newUser.savedItems,
      orders: newUser.orders,
    });
  }

  if (action === 'login') {
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const passwordHash = hashPassword(password, user.salt);
    if (passwordHash !== user.passwordHash) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    user.token = createToken();
    await writeDB(db);

    return res.status(200).json({
      token: user.token,
      email: user.email,
      savedItems: user.savedItems,
      orders: user.orders,
    });
  }

  return res.status(400).json({ error: 'Invalid auth action' });
};
