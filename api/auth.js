const {
  getUserByEmail,
  createUser,
  createSession,
  deleteSession,
  normalizeEmail,
  hashPassword,
  verifyPassword,
  createSalt,
} = require('./db');
const crypto = require('crypto');

// Register and login do the same amount of work whether or not the account
// exists, so response time does not reveal which emails are registered.
const GENERIC_CREDENTIALS_ERROR = 'Invalid email or password';

function publicUser(user, token) {
  return {
    token,
    email: user.email,
    name: user.name || '',
    savedItems: user.savedItems || [],
    cart: user.cart || [],
    orders: user.orders || [],
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const action = body.action || req.query?.action;
  const userAgent = req.headers?.['user-agent'] || '';

  if (!action) {
    return res.status(400).json({ error: 'Action is required' });
  }

  try {
    // Signing out needs a token, not credentials, so it is handled first.
    if (action === 'logout') {
      const auth = req.headers.authorization || '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : body.token;
      await deleteSession(token);
      return res.status(200).json({ ok: true });
    }

    const { email, password, name } = body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 200) {
      return res.status(400).json({ error: 'Password must be between 8 and 200 characters' });
    }

    const normalizedEmail = normalizeEmail(email);
    const existingUser = await getUserByEmail(normalizedEmail);

    if (action === 'register') {
      if (existingUser) {
        return res.status(400).json({ error: 'Email is already registered' });
      }

      const salt = createSalt();
      const newUser = {
        id: crypto.randomUUID(),
        email: normalizedEmail,
        name: name ? String(name).trim().slice(0, 80) : '',
        passwordHash: hashPassword(password, salt),
        salt,
        savedItems: [],
        cart: [],
        orders: [],
        createdAt: new Date().toISOString(),
      };

      const createdUser = await createUser(newUser);
      if (!createdUser) {
        return res.status(500).json({ error: 'Could not create the account' });
      }
      const token = await createSession(createdUser.id, userAgent);
      return res.status(200).json(publicUser(createdUser, token));
    }

    if (action === 'login') {
      if (!existingUser || !verifyPassword(password, existingUser)) {
        return res.status(400).json({ error: GENERIC_CREDENTIALS_ERROR });
      }
      // A new session rather than a replaced token, so signing in here does
      // not sign you out on another device.
      const token = await createSession(existingUser.id, userAgent);
      return res.status(200).json(publicUser(existingUser, token));
    }

    return res.status(400).json({ error: 'Invalid auth action' });
  } catch (err) {
    console.error('Auth route error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
