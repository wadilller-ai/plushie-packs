const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");

const { init, db } = require("./src/db");
const config = require("./src/config");
const { getUsdPrice, toCoinAmount } = require("./src/crypto");
const {
  createSession,
  requireAdmin,
  destroySession,
  createMember,
  memberLogin,
  destroyMemberSession,
  getMemberByToken,
  requireMember,
} = require("./src/auth");

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

init();

const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use("/public", express.static(path.join(__dirname, "public")));

function nowIso() {
  return new Date().toISOString();
}

function generateOrderCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < config.order.codeLength; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${config.order.prefix}-${code}`;
}

function findProduct(productId) {
  return config.products.find((p) => p.id === productId);
}
function findOption(product, optionId) {
  return product?.options?.find((o) => o.id === optionId);
}
function findPayment(methodKey) {
  return config.payments.methods.find((m) => m.key === methodKey);
}

function shippingFee() {
  return Number((config.shipping?.flatFeeUsd ?? 0).toFixed(2));
}

function getBulkUnitPrice(productId, basePrice, qty) {
  const tiers = config.bulkPricing?.[productId];
  if (!tiers) return basePrice;
  for (const t of tiers) {
    if (qty >= t.minQty) return Number(t.price);
  }
  return basePrice;
}

function readCart(req) {
  try {
    const raw = req.cookies.cart;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function writeCart(res, cart) {
  res.cookie("cart", JSON.stringify(cart), {
    httpOnly: false,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 14,
  });
}

function cartCount(cart) {
  return cart.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);
}

function cartToLines(cart) {
  const lines = [];
  for (const item of cart) {
    const product = findProduct(item.product_id);
    const option = findOption(product, item.option_id);
    if (!product || !option) continue;

    const minQty = Number(option.minQty || 1);
    const rawQty = parseInt(item.qty || "1", 10);
    const qty = Math.max(minQty, Math.min(9999, isNaN(rawQty) ? minQty : rawQty));

    const basePrice = Number(option.price);

    // If this is a bulk product option (has minQty), use its fixed option price (no auto-tiering)
    const unitPrice = option.minQty ? basePrice : getBulkUnitPrice(product.id, basePrice, qty);

    const lineTotal = Number((unitPrice * qty).toFixed(2));

    lines.push({
      product_id: product.id,
      option_id: option.id,
      product_name: product.name,
      option_name: option.name,
      base_price: basePrice,
      unit_price: unitPrice,
      qty,
      min_qty: minQty,
      line_total: lineTotal,
      bulk_applied: !option.minQty && unitPrice !== basePrice,
    });
  }

  const subtotalUsd = Number(lines.reduce((s, l) => s + l.line_total, 0).toFixed(2));
  const ship = lines.length ? shippingFee() : 0;
  const totalUsd = Number((subtotalUsd + ship).toFixed(2));

  return { lines, subtotalUsd, shippingUsd: ship, totalUsd };
}

// ✅ Telegram (built-in fetch, no node-fetch)
async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("Telegram error:", resp.status, t);
    }
  } catch (e) {
    console.error("Telegram send failed:", e);
  }
}

// Inject cart count into all views
app.use((req, res, next) => {
  const cart = readCart(req);
  res.locals.cartCount = cartCount(cart);
  res.locals.memberUser = getMemberByToken(req.cookies?.member_token);
  next();
});


const memberProtected = ["/shop", "/cart", "/shipping", "/shipping-cart", "/payment", "/bulk", "/vault"];
app.use((req, res, next) => {
  const pathName = req.path || "";
  if (!memberProtected.some((prefix) => pathName === prefix || pathName.startsWith(`${prefix}/`))) {
    return next();
  }
  return requireMember(req, res, next);
});

// Immersive entry + member access
app.get("/", (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.render("portal", { config, error: null, memberUser: res.locals.memberUser });
});

app.post("/auth/register", (req, res) => {
  const handle = String(req.body.handle || "");
  const pass = String(req.body.pass || "");

  const created = createMember(handle, pass);
  if (created.error) {
    return res.status(400).render("portal", { config, error: created.error, memberUser: res.locals.memberUser });
  }

  const login = memberLogin(handle, pass);
  if (!login) {
    return res.status(400).render("portal", { config, error: "Unable to create your access.", memberUser: null });
  }

  res.cookie("member_token", login.token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 14,
  });

  res.redirect("/vault");
});

app.post("/auth/login", (req, res) => {
  const handle = String(req.body.handle || "");
  const pass = String(req.body.pass || "");
  const login = memberLogin(handle, pass);

  if (!login) {
    return res.status(401).render("portal", { config, error: "Invalid handle or passcode.", memberUser: res.locals.memberUser });
  }

  res.cookie("member_token", login.token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 14,
  });

  res.redirect("/vault");
});

app.post("/auth/logout", (req, res) => {
  destroyMemberSession(req.cookies?.member_token);
  res.clearCookie("member_token");
  res.redirect("/");
});

app.get("/vault", requireMember, (req, res) => {
  res.render("vault", { config, member: req.member });
});

// Shop
app.get("/shop", (req, res) => res.render("products", { config }));

// Add to cart
app.post("/cart/add", (req, res) => {
  const product_id = String(req.body.product_id || "");
  const option_id = String(req.body.option_id || "");
  const qtyRaw = parseInt(req.body.qty || "1", 10);

  const product = findProduct(product_id);
  const option = findOption(product, option_id);
  if (!product || !option) return res.status(400).send("Invalid item.");

  const minQty = Number(option.minQty || 1);
  const qty = Math.max(minQty, Math.min(9999, isNaN(qtyRaw) ? minQty : qtyRaw));

  const cart = readCart(req);
  const existing = cart.find((i) => i.product_id === product_id && i.option_id === option_id);

  if (existing) {
    const newQty = (Number(existing.qty) || 0) + qty;
    existing.qty = Math.max(minQty, Math.min(9999, newQty));
  } else {
    cart.push({ product_id, option_id, qty });
  }

  writeCart(res, cart);
  const nextUrl = req.body.next || "/cart";
  res.redirect(nextUrl);
});

// Cart
app.get("/cart", (req, res) => {
  const cart = readCart(req);
  const { lines, subtotalUsd, shippingUsd, totalUsd } = cartToLines(cart);
  res.render("cart", { config, lines, subtotalUsd, shippingUsd, totalUsd });
});

app.post("/cart/update", (req, res) => {
  const cart = readCart(req);
  const key = String(req.body.key || "");
  const qtyRaw = parseInt(req.body.qty || "0", 10);

  const [product_id, option_id] = key.split("::");
  const product = findProduct(product_id);
  const option = findOption(product, option_id);
  const minQty = Number(option?.minQty || 1);

  const qty = Math.max(0, Math.min(9999, isNaN(qtyRaw) ? 0 : qtyRaw));

  const idx = cart.findIndex((i) => i.product_id === product_id && i.option_id === option_id);
  if (idx >= 0) {
    if (qty <= 0) cart.splice(idx, 1);
    else cart[idx].qty = Math.max(minQty, qty);
  }

  writeCart(res, cart);
  res.redirect("/cart");
});

app.post("/cart/clear", (req, res) => {
  writeCart(res, []);
  res.redirect("/cart");
});

// Checkout from cart -> shipping
app.get("/shipping-cart", (req, res) => {
  const cart = readCart(req);
  const { lines, subtotalUsd, shippingUsd, totalUsd } = cartToLines(cart);
  if (!lines.length) return res.redirect("/shop");
  res.render("shipping-cart", { config, lines, subtotalUsd, shippingUsd, totalUsd });
});

app.post("/shipping-cart", async (req, res) => {
  const cart = readCart(req);
  const { lines, subtotalUsd, shippingUsd, totalUsd } = cartToLines(cart);
  if (!lines.length) return res.status(400).send("Cart empty.");

  const { contact, ship_name, ship_line1, ship_line2, ship_city, ship_state, ship_zip, ship_country } = req.body;
  if (!ship_name || !ship_line1 || !ship_city || !ship_state || !ship_zip || !ship_country) {
    return res.status(400).send("Missing shipping fields.");
  }

  let orderCode = generateOrderCode();
  for (let i = 0; i < 8; i++) {
    const exists = db.prepare("SELECT 1 FROM orders WHERE order_code = ?").get(orderCode);
    if (!exists) break;
    orderCode = generateOrderCode();
  }

  const t = nowIso();
  db.prepare(`
    INSERT INTO orders (
      order_code,
      items_json, subtotal_usd, shipping_fee, total_usd,
      payment_method, contact,
      ship_name, ship_line1, ship_line2, ship_city, ship_state, ship_zip, ship_country,
      status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment', ?, ?)
  `).run(
    orderCode,
    JSON.stringify(lines),
    subtotalUsd,
    shippingUsd,
    totalUsd,
    (contact || "").trim() || null,
    ship_name.trim(),
    ship_line1.trim(),
    (ship_line2 || "").trim() || null,
    ship_city.trim(),
    ship_state.trim(),
    ship_zip.trim(),
    ship_country.trim(),
    t,
    t
  );

  writeCart(res, []); // clear cart

  await sendTelegram(
    `📦 New order: ${orderCode}\n` +
      `Items:\n` +
      `${lines
        .map((l) => `- ${l.product_name} — ${l.option_name} x${l.qty} ($${Number(l.line_total).toFixed(2)})`)
        .join("\n")}\n\n` +
      `Ship To:\n` +
      `${ship_name}\n` +
      `${ship_line1}${ship_line2 ? `, ${ship_line2}` : ""}\n` +
      `${ship_city}, ${ship_state} ${ship_zip}\n` +
      `${ship_country}\n` +
      `${contact ? `\nContact: ${contact}\n` : ""}` +
      `\nSubtotal: $${subtotalUsd}\nShipping: $${shippingUsd}\nTotal: $${totalUsd}`
  );

  // ✅ IMPORTANT: redirect to payment page
  res.redirect(`/payment/${encodeURIComponent(orderCode)}`);
});

// Single-item quick checkout
app.get("/shipping", (req, res) => {
  const product_id = String(req.query.product_id || "");
  const option_id = String(req.query.option_id || "");
  const product = findProduct(product_id);
  const option = findOption(product, option_id);
  if (!product || !option) return res.redirect("/shop");

  const minQty = Number(option.minQty || 1);
  const qtyRaw = parseInt(req.query.qty || String(minQty), 10);
  const qty = Math.max(minQty, Math.min(9999, isNaN(qtyRaw) ? minQty : qtyRaw));

  const basePrice = Number(option.price);
  const unitPrice = option.minQty ? basePrice : getBulkUnitPrice(product.id, basePrice, qty);

  const subtotalUsd = Number((unitPrice * qty).toFixed(2));
  const ship = shippingFee();
  const totalUsd = Number((subtotalUsd + ship).toFixed(2));

  res.render("shipping", { config, product, option, qty, unitPrice, subtotalUsd, shippingUsd: ship, totalUsd });
});

app.post("/shipping", async (req, res) => {
  const { product_id, option_id, qty, contact, ship_name, ship_line1, ship_line2, ship_city, ship_state, ship_zip, ship_country } =
    req.body;

  const product = findProduct(product_id);
  const option = findOption(product, option_id);
  if (!product || !option) return res.status(400).send("Invalid product/option.");

  const minQty = Number(option.minQty || 1);
  const qtyRaw = parseInt(qty || String(minQty), 10);
  const q = Math.max(minQty, Math.min(9999, isNaN(qtyRaw) ? minQty : qtyRaw));

  if (!ship_name || !ship_line1 || !ship_city || !ship_state || !ship_zip || !ship_country) {
    return res.status(400).send("Missing shipping fields.");
  }

  const basePrice = Number(option.price);
  const unitPrice = option.minQty ? basePrice : getBulkUnitPrice(product.id, basePrice, q);

  const subtotalUsd = Number((unitPrice * q).toFixed(2));
  const ship = shippingFee();
  const totalUsd = Number((subtotalUsd + ship).toFixed(2));

  const lines = [
    {
      product_id: product.id,
      option_id: option.id,
      product_name: product.name,
      option_name: option.name,
      base_price: basePrice,
      unit_price: unitPrice,
      qty: q,
      min_qty: minQty,
      line_total: subtotalUsd,
      bulk_applied: !option.minQty && unitPrice !== basePrice,
    },
  ];

  let orderCode = generateOrderCode();
  for (let i = 0; i < 8; i++) {
    const exists = db.prepare("SELECT 1 FROM orders WHERE order_code = ?").get(orderCode);
    if (!exists) break;
    orderCode = generateOrderCode();
  }

  const t = nowIso();
  db.prepare(`
    INSERT INTO orders (
      order_code,
      items_json, subtotal_usd, shipping_fee, total_usd,
      payment_method, contact,
      ship_name, ship_line1, ship_line2, ship_city, ship_state, ship_zip, ship_country,
      status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment', ?, ?)
  `).run(
    orderCode,
    JSON.stringify(lines),
    subtotalUsd,
    ship,
    totalUsd,
    (contact || "").trim() || null,
    ship_name.trim(),
    ship_line1.trim(),
    (ship_line2 || "").trim() || null,
    ship_city.trim(),
    ship_state.trim(),
    ship_zip.trim(),
    ship_country.trim(),
    t,
    t
  );

  // ✅ FIXED: include shipping details here too
  await sendTelegram(
    `📦 New order: ${orderCode}\n` +
      `Items:\n` +
      `${lines
        .map((l) => `- ${l.product_name} — ${l.option_name} x${l.qty} ($${Number(l.line_total).toFixed(2)})`)
        .join("\n")}\n\n` +
      `Ship To:\n` +
      `${ship_name}\n` +
      `${ship_line1}${ship_line2 ? `, ${ship_line2}` : ""}\n` +
      `${ship_city}, ${ship_state} ${ship_zip}\n` +
      `${ship_country}\n` +
      `${contact ? `\nContact: ${contact}\n` : ""}` +
      `\nSubtotal: $${subtotalUsd}\nShipping: $${ship}\nTotal: $${totalUsd}`
  );

  res.redirect(`/payment/${encodeURIComponent(orderCode)}`);
});

// Bulk info pages
app.get("/bulk/standard", (req, res) => res.render("bulk-standard", { config }));
app.get("/bulk/buddies", (req, res) => res.render("bulk-buddies", { config }));

// Payment
app.get("/payment/:code", async (req, res) => {
  const code = req.params.code;
  const order = db.prepare("SELECT * FROM orders WHERE order_code = ?").get(code);
  if (!order) return res.status(404).send("Order not found.");

  const items = (() => {
    try {
      return JSON.parse(order.items_json || "[]");
    } catch {
      return [];
    }
  })();

  const selected = findPayment(order.payment_method) || config.payments.methods[0];

  let cryptoQuote = null;
  if (selected?.isCrypto) {
    try {
      const usdPrice = await getUsdPrice(selected.coingeckoId);
      const coinAmount = toCoinAmount(order.total_usd, usdPrice);
      cryptoQuote = { usdPrice, coinAmount };
    } catch (e) {
      cryptoQuote = { error: "Price lookup failed" };
    }
  }

  const paymentDetails = selected?.isCrypto
    ? config.payments.wallets[selected.key]
    : config.payments.manualDetails[selected.key];

  const subtotalUsd = order.subtotal_usd == null ? null : Number(order.subtotal_usd);
  const shippingUsd = order.shipping_fee == null ? null : Number(order.shipping_fee);

  res.render("payment", {
    config,
    order,
    items,
    selected,
    paymentDetails,
    cryptoQuote,
    methods: config.payments.methods,
    subtotalUsd,
    shippingUsd,
  });
});

app.post("/payment/:code/select", (req, res) => {
  const code = req.params.code;
  const order = db.prepare("SELECT * FROM orders WHERE order_code = ?").get(code);
  if (!order) return res.status(404).send("Order not found.");

  const method = String(req.body.payment_method || "");
  const pm = findPayment(method);
  if (!pm) return res.status(400).send("Invalid payment method.");

  db.prepare("UPDATE orders SET payment_method = ?, updated_at = ? WHERE id = ?").run(pm.key, nowIso(), order.id);

  res.redirect(`/payment/${encodeURIComponent(code)}`);
});

app.get("/payment/:code/status", (req, res) => {
  const code = req.params.code;
  const order = db.prepare("SELECT * FROM orders WHERE order_code = ?").get(code);
  if (!order) return res.status(404).send("Order not found.");

  const selected = findPayment(order.payment_method) || config.payments.methods[0];
  res.render("payment-status", { config, order, selected });
});

app.post("/payment/:code/not-sent", (req, res) => {
  const code = req.params.code;
  const order = db.prepare("SELECT * FROM orders WHERE order_code = ?").get(code);
  if (!order) return res.status(404).send("Order not found.");

  db.prepare("UPDATE orders SET status = 'not_sent', updated_at = ? WHERE id = ?").run(nowIso(), order.id);
  res.redirect(`/payment/${encodeURIComponent(code)}/status`);
});

app.post("/payment/:code/confirm", async (req, res) => {
  const code = req.params.code;
  const order = db.prepare("SELECT * FROM orders WHERE order_code = ?").get(code);
  if (!order) return res.status(404).send("Order not found.");

  const selected = findPayment(order.payment_method) || config.payments.methods[0];
  const nextStatus = selected?.isCrypto ? "crypto_processing" : "payment_sent";
  db.prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?").run(nextStatus, nowIso(), order.id);

  await sendTelegram(
    `💸 Payment sent: ${order.order_code}
` +
      `Total: $${Number(order.total_usd).toFixed(2)}
` +
      `Method: ${order.payment_method || "not set"}
` +
      `Status: ${nextStatus}

` +
      `Ship To:
` +
      `${order.ship_name}
` +
      `${order.ship_line1}${order.ship_line2 ? `, ${order.ship_line2}` : ""}
` +
      `${order.ship_city}, ${order.ship_state} ${order.ship_zip}
` +
      `${order.ship_country}
` +
      `${order.contact ? `
Contact: ${order.contact}
` : ""}`
  );

  if (selected?.isCrypto) {
    return res.redirect(`/payment/${encodeURIComponent(code)}/status`);
  }

  const updated = db.prepare("SELECT * FROM orders WHERE id = ?").get(order.id);
  res.render("thanks", { config, order: updated });
});

// Admin
app.get("/admin", requireAdmin, (req, res) => res.redirect("/admin/orders"));
app.get("/admin/login", (req, res) => res.render("admin-login", { config, error: null }));

app.post("/admin/login", (req, res) => {
  const user = String(req.body.user || "");
  const pass = String(req.body.pass || "");

  if (user === (process.env.ADMIN_USER || "admin") && pass === (process.env.ADMIN_PASS || "")) {
    const token = createSession();
    res.cookie("admin_token", token, { httpOnly: true, sameSite: "lax" });
    return res.redirect("/admin/orders");
  }
  res.render("admin-login", { config, error: "Invalid login." });
});

app.post("/admin/logout", requireAdmin, (req, res) => {
  destroySession(req.cookies.admin_token);
  res.clearCookie("admin_token");
  res.redirect("/admin/login");
});

app.get("/admin/orders", requireAdmin, (req, res) => {
  const status = (req.query.status || "").trim();
  const q = (req.query.q || "").trim();

  let rows = [];
  if (status) rows = db.prepare(`SELECT * FROM orders WHERE status = ? ORDER BY id DESC LIMIT 500`).all(status);
  else if (q) rows = db.prepare(`SELECT * FROM orders WHERE order_code LIKE ? ORDER BY id DESC LIMIT 200`).all(`%${q}%`);
  else rows = db.prepare(`SELECT * FROM orders ORDER BY id DESC LIMIT 200`).all();

  res.render("admin-orders", { config, rows, status, q });
});

app.get("/admin/order/:code", requireAdmin, (req, res) => {
  const code = req.params.code;
  const order = db.prepare("SELECT * FROM orders WHERE order_code = ?").get(code);
  if (!order) return res.status(404).send("Order not found.");

  let items = [];
  try {
    items = JSON.parse(order.items_json || "[]");
  } catch (e) {}

  res.render("admin-order", { config, order, items });
});

app.post("/admin/order/:code/status", requireAdmin, async (req, res) => {
  const code = req.params.code;
  const status = String(req.body.status || "");
  const allowed = new Set(["pending_payment", "payment_sent", "crypto_processing", "not_sent", "paid", "rejected"]);
  if (!allowed.has(status)) return res.status(400).send("Bad status.");

  const order = db.prepare("SELECT * FROM orders WHERE order_code = ?").get(code);
  if (!order) return res.status(404).send("Order not found.");

  db.prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?").run(status, nowIso(), order.id);

  if (status === "paid") await sendTelegram(`✅ Marked PAID: ${order.order_code}\nTotal: $${order.total_usd}`);
  if (status === "rejected") await sendTelegram(`❌ Rejected: ${order.order_code}\nTotal: $${order.total_usd}`);

  res.redirect(`/admin/order/${encodeURIComponent(code)}`);
});

app.listen(PORT, () => console.log(`Running on ${BASE_URL}`));
