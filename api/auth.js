const { getUserByEmail, createUser, updateUser, normalizeEmail, hashPassword, createSalt, createToken, USE_SUPABASE } = require('./db');
const crypto = require('crypto');
 
module.exports = async function handler(req, res) {
  // --- TEMPORARY DEBUG: tells us what the function actually sees at runtime ---
  console.log('OLIO_DEBUG USE_SUPABASE =', USE_SUPABASE);
  console.log('OLIO_DEBUG has SUPABASE_URL =', Boolean(process.env.SUPABASE_URL));
  console.log('OLIO_DEBUG has SUPABASE_SERVICE_KEY =', Boolean(process.env.SUPABASE_SERVICE_KEY));
  console.log('OLIO_DEBUG has SUPABASE_KEY =', Boolean(process.env.SUPABASE_KEY));
  // --- END DEBUG ---
 
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
 
  const body = req.body || {};
  const action = body.action || req.query?.action;
  const { email, password, name } = body;
 
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
 
  if (!action) {
    return res.status(400).json({ error: 'Action is required' });
  }
 
  try {
    const normalizedEmail = normalizeEmail(email);
    const existingUser = await getUserByEmail(normalizedEmail);
 
    if (action === 'register') {
      if (existingUser) {
        return res.status(400).json({ error: 'Email is already registered' });
      }
 
      const salt = createSalt();
      const passwordHash = hashPassword(password, salt);
      const token = createToken();
      const id = crypto.randomUUID ? crypto.randomUUID() : createToken();
 
      const newUser = {
        id,
        email: normalizedEmail,
        name: name ? String(name).trim() : '',
        passwordHash,
        salt,
        token,
        savedItems: [],
        cart: [],
        orders: [],
        createdAt: new Date().toISOString(),
      };
 
      const createdUser = await createUser(newUser);
      return res.status(200).json({
        token: createdUser.token,
        email: createdUser.email,
        name: createdUser.name || '',
        savedItems: createdUser.savedItems || [],
        cart: createdUser.cart || [],
        orders: createdUser.orders || []
      });
    }
 
    if (action === 'login') {
      if (!existingUser) {
        return res.status(400).json({ error: 'Invalid email or password' });
      }
 
      const passwordHash = hashPassword(password, existingUser.salt);
      if (passwordHash !== existingUser.passwordHash) {
        return res.status(400).json({ error: 'Invalid email or password' });
      }
 
      const token = createToken();
      const updatedUser = await updateUser(existingUser.id, { token });
      return res.status(200).json({
        token: updatedUser.token,
        email: updatedUser.email,
        name: updatedUser.name || '',
        savedItems: updatedUser.savedItems || [],
        cart: updatedUser.cart || [],
        orders: updatedUser.orders || []
      });
    }
 
    return res.status(400).json({ error: 'Invalid auth action' });
  } catch (err) {
    console.error('Auth route error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};