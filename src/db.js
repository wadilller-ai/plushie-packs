const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "app.sqlite");
const db = new Database(dbPath);

function init() {
  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_code TEXT UNIQUE NOT NULL,

      items_json TEXT NOT NULL,
      subtotal_usd REAL,
      shipping_fee REAL,
      total_usd REAL NOT NULL,

      payment_method TEXT,
      contact TEXT,

      ship_name TEXT NOT NULL,
      ship_line1 TEXT NOT NULL,
      ship_line2 TEXT,
      ship_city TEXT NOT NULL,
      ship_state TEXT NOT NULL,
      ship_zip TEXT NOT NULL,
      ship_country TEXT NOT NULL,

      status TEXT NOT NULL DEFAULT 'pending_payment',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Migrate older schemas
  try {
    const cols = db.prepare("PRAGMA table_info(orders)").all().map(c => c.name);

    if (!cols.includes("items_json")) {
      db.exec("ALTER TABLE orders ADD COLUMN items_json TEXT;");
      db.prepare("UPDATE orders SET items_json = COALESCE(items_json,'[]')").run();
    }
    if (!cols.includes("subtotal_usd")) db.exec("ALTER TABLE orders ADD COLUMN subtotal_usd REAL;");
    if (!cols.includes("shipping_fee")) db.exec("ALTER TABLE orders ADD COLUMN shipping_fee REAL;");
  } catch (e) {}
}

module.exports = { db, init };
