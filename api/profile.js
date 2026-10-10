const {
  getUserByToken,
  updateUser,
  hashPassword,
  createSalt,
  deleteSessionsForUser,
} = require("./db");
const crypto = require("crypto");

module.exports = async function handler(req, res) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing auth token" });
  }

  try {
    const { user } = await getUserByToken(token);
    if (!user) {
      return res.status(401).json({ error: "Invalid auth token" });
    }

    if (req.method === "GET") {
      return res.status(200).json({
        email: user.email,
        name: user.name || "",
        savedItems: user.savedItems || [],
        cart: user.cart || [],
        orders: user.orders || [],
      });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      // Accept the action from the body, falling back to ?action= for older clients.
      const action = body.action || (req.query && req.query.action);
      const { item, itemId, items, cart } = body;

      if (action === "updateProfile") {
        if (typeof body.name !== "string" || body.name.trim().length > 80) {
          return res
            .status(400)
            .json({ error: "Name must be 80 characters or fewer." });
        }
        const updated = await updateUser(user.id, { name: body.name.trim() });
        return res.status(200).json({ name: updated.name });
      }

      if (action === "changePassword") {
        if (
          typeof body.currentPassword !== "string" ||
          body.currentPassword.length > 200 ||
          typeof body.newPassword !== "string" ||
          body.newPassword.length < 8 ||
          body.newPassword.length > 200
        ) {
          return res
            .status(400)
            .json({
              error: "Use a new password between 8 and 200 characters.",
            });
        }
        const actual = Buffer.from(
          hashPassword(body.currentPassword, user.salt),
          "hex",
        );
        const expected = Buffer.from(user.passwordHash || "", "hex");
        if (
          actual.length !== expected.length ||
          !crypto.timingSafeEqual(actual, expected)
        ) {
          return res
            .status(400)
            .json({ error: "Current password is incorrect." });
        }
        const salt = createSalt();
        await updateUser(user.id, {
          salt,
          passwordHash: hashPassword(body.newPassword, salt),
        });
        // Changing a password signs out every other device, keeping this one.
        await deleteSessionsForUser(user.id, token);
        return res.status(200).json({ ok: true });
      }

      if (action === "saveItem") {
        if (!item || !item.id) {
          return res.status(400).json({ error: "Item is required" });
        }
        const savedItems = user.savedItems || [];
        if (!savedItems.some((saved) => saved.id === item.id)) {
          savedItems.push(item);
        }
        const updated = await updateUser(user.id, { savedItems });
        return res.status(200).json({ savedItems: updated.savedItems || [] });
      }

      if (action === "removeItem") {
        const savedItems = (user.savedItems || []).filter(
          (saved) => saved.id !== itemId,
        );
        const updated = await updateUser(user.id, { savedItems });
        return res.status(200).json({ savedItems: updated.savedItems || [] });
      }

      if (action === "saveCart") {
        if (!Array.isArray(cart)) {
          return res.status(400).json({ error: "Cart must be an array" });
        }
        const updated = await updateUser(user.id, { cart });
        return res.status(200).json({ cart: updated.cart || [] });
      }

      if (action === "confirmPurchase") {
        if (!Array.isArray(items) || !items.length) {
          return res.status(400).json({ error: "Items are required" });
        }
        const orders = user.orders || [];
        const order = {
          purchasedAt: new Date().toISOString(),
          total: items.reduce((sum, it) => sum + (Number(it.priceNum) || 0), 0),
          items,
        };
        const updated = await updateUser(user.id, {
          orders: [...orders, order],
          cart: [],
        });
        return res.status(200).json({ orders: updated.orders || [] });
      }

      return res.status(400).json({ error: "Invalid profile action" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Profile route error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};
