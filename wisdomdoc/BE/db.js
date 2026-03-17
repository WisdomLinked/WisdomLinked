import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'data', 'app.db');
const uploadsDir = path.join(__dirname, 'uploads');

export let db;

export function initDb() {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });

  db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'student',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  try {
    db.exec(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'student'`);
  } catch (_) {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN approved INTEGER DEFAULT 0`);
  } catch (_) {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN major TEXT`);
  } catch (_) {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN majors TEXT`);
  } catch (_) {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN submitted_at TEXT`);
  } catch (_) {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN timezone TEXT`);
  } catch (_) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN username TEXT`); } catch (_) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN bio TEXT`); } catch (_) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN title TEXT`); } catch (_) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN image TEXT`); } catch (_) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN phone TEXT`); } catch (_) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN country TEXT`); } catch (_) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN state TEXT`); } catch (_) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN city TEXT`); } catch (_) {}
  db.exec(`
    CREATE TABLE IF NOT EXISTS clarifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      from_user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (student_id) REFERENCES users(id),
      FOREIGN KEY (from_user_id) REFERENCES users(id)
    );
  `);
  db.exec(`UPDATE users SET role = 'student' WHERE role IS NULL`);
  db.exec(`UPDATE users SET role = 'expert' WHERE role = 'committee'`);
  db.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      filename TEXT NOT NULL,
      path TEXT NOT NULL,
      size INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
  try {
    db.exec(`ALTER TABLE documents ADD COLUMN description TEXT`);
  } catch (_) {}
  try {
    db.exec(`ALTER TABLE documents ADD COLUMN uploaded_by INTEGER`);
  } catch (_) {}

  seedSampleData();

  return db;
}

const SEED_TZ = 'America/Chicago';

function seedSampleData() {
  const admin = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
  if (!admin) {
    db.prepare(
      'INSERT INTO users (email, password_hash, role, timezone) VALUES (?, ?, ?, ?)'
    ).run('hithamagadi@gmail.com', 'admin123', 'admin', SEED_TZ);
  }

  const expert = db.prepare('SELECT id FROM users WHERE email = ?').get('expert@wisdom.edu');
  if (!expert) {
    db.prepare(
      'INSERT INTO users (email, password_hash, role, majors, timezone, username, title, bio) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run('expert@wisdom.edu', 'expert123', 'expert', JSON.stringify(['Civil Engineering']), SEED_TZ, 'Expert Professor', 'Professor of Civil Engineering', 'Experienced in structural engineering, construction management, and materials science. Specializing in graduate admissions for Civil Engineering programs.');
  }

  const student = db.prepare('SELECT id FROM users WHERE email = ?').get('student@wisdom.edu');
  if (!student) {
    db.prepare(
      'INSERT INTO users (email, password_hash, role, major, timezone) VALUES (?, ?, ?, ?, ?)'
    ).run('student@wisdom.edu', 'student123', 'student', 'Civil Engineering', SEED_TZ);
  }

  // Ensure existing seeded users have CST and expert has bio
  db.prepare("UPDATE users SET timezone = ? WHERE email IN ('hithamagadi@gmail.com', 'expert@wisdom.edu', 'student@wisdom.edu')").run(SEED_TZ);
  db.prepare("UPDATE users SET username = 'Expert Professor', title = 'Professor of Civil Engineering', bio = 'Experienced in structural engineering, construction management, and materials science. Specializing in graduate admissions for Civil Engineering programs.' WHERE email = 'expert@wisdom.edu'").run();
}
