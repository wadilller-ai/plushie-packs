const crypto = require("crypto");
const { db } = require("./db");

function createToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString("hex");
}

function createSession() {
  const token = createToken();
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

function hashPassword(password) {
  return crypto.createHash("sha256").update(String(password)).digest("hex");
}

function createMember(userName, password) {
  const handle = String(userName || "").trim().toLowerCase();
  if (!handle || handle.length < 3) return { error: "Handle must be at least 3 characters." };
  if (!password || String(password).length < 6) return { error: "Passcode must be at least 6 characters." };

  const exists = db.prepare("SELECT id FROM users WHERE handle = ?").get(handle);
  if (exists) return { error: "Handle already exists." };

  const now = new Date().toISOString();
  const result = db
    .prepare("INSERT INTO users (handle, password_hash, created_at) VALUES (?, ?, ?)")
    .run(handle, hashPassword(password), now);

  return { userId: result.lastInsertRowid, handle };
}

function memberLogin(userName, password) {
  const handle = String(userName || "").trim().toLowerCase();
  const passwordHash = hashPassword(password || "");

  const user = db
    .prepare("SELECT id, handle FROM users WHERE handle = ? AND password_hash = ?")
    .get(handle, passwordHash);

  if (!user) return null;

  const token = createToken();
  const now = new Date().toISOString();
  db.prepare("INSERT INTO member_sessions (token, user_id, created_at) VALUES (?, ?, ?)").run(token, user.id, now);

  return { token, user };
}

function destroyMemberSession(token) {
  if (!token) return;
  db.prepare("DELETE FROM member_sessions WHERE token = ?").run(token);
}

function getMemberByToken(token) {
  if (!token) return null;
  return (
    db
      .prepare(
        `SELECT u.id, u.handle
         FROM member_sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token = ?`
      )
      .get(token) || null
  );
}

function requireMember(req, res, next) {
  const token = req.cookies?.member_token;
  const user = getMemberByToken(token);
  if (!user) return res.redirect("/");
  req.member = user;
  next();
}

module.exports = {
  createSession,
  requireAdmin,
  destroySession,
  createMember,
  memberLogin,
  destroyMemberSession,
  getMemberByToken,
  requireMember,
};
