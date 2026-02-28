const crypto = require("crypto");
const { db } = require("./db");

function createSessionToken() {
  return crypto.randomBytes(24).toString("hex");
}

function createSession() {
  const token = createSessionToken();
  const now = new Date().toISOString();
  db.prepare("INSERT INTO admin_sessions (token, created_at) VALUES (?, ?)").run(token, now);
  return token;
}

function isValidSession(token) {
  if (!token) return false;
  const row = db.prepare("SELECT token FROM admin_sessions WHERE token = ?").get(token);
  return !!row;
}

function destroySession(token) {
  if (!token) return;
  db.prepare("DELETE FROM admin_sessions WHERE token = ?").run(token);
}

function requireAdmin(req, res, next) {
  const token = req.cookies?.admin_token;
  if (!isValidSession(token)) return res.redirect("/admin/login");
  next();
}

module.exports = { createSession, requireAdmin, destroySession };
