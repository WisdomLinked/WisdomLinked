import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { CaseStatus } from './constants/caseStatus.js';

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
  ['role', 'approved', 'major', 'majors', 'submitted_at', 'timezone', 'username', 'bio', 'title', 'image', 'phone', 'country', 'state', 'city'].forEach(col => {
    try { db.exec(`ALTER TABLE users ADD COLUMN ${col} TEXT`); } catch (_) {}
  });
  try { db.exec(`ALTER TABLE users ADD COLUMN approved INTEGER DEFAULT 0`); } catch (_) {}
  try { db.exec('ALTER TABLE users ADD COLUMN target_year INTEGER'); } catch (_) {}

  db.exec(`UPDATE users SET role = 'student' WHERE role IS NULL`);
  db.exec(`UPDATE users SET role = 'expert' WHERE role = 'committee'`);

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
    CREATE TABLE IF NOT EXISTS cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      case_id TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT '${CaseStatus.SUBMITTED}',
      assigned_expert_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      submitted_at TEXT DEFAULT (datetime('now')),
      due_at TEXT,
      assessed_at TEXT,
      approved_at TEXT,
      rejected_at TEXT,
      FOREIGN KEY (student_id) REFERENCES users(id),
      FOREIGN KEY (assigned_expert_id) REFERENCES users(id)
    );
  `);
  ['due_at', 'assessed_at', 'approved_at', 'rejected_at'].forEach(col => {
    try { db.exec(`ALTER TABLE cases ADD COLUMN ${col} TEXT`); } catch (_) {}
  });

  try {
    db.exec('PRAGMA foreign_keys = OFF');
    const info = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='cases'").get();
    if (info?.sql && info.sql.includes('CHECK')) {
      db.exec(`
        CREATE TABLE cases_migrate (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id INTEGER NOT NULL,
          case_id TEXT UNIQUE NOT NULL,
          status TEXT DEFAULT 'submitted',
          assigned_expert_id INTEGER,
          created_at TEXT DEFAULT (datetime('now')),
          submitted_at TEXT DEFAULT (datetime('now')),
          due_at TEXT,
          assessed_at TEXT,
          approved_at TEXT,
          rejected_at TEXT,
          FOREIGN KEY (student_id) REFERENCES users(id),
          FOREIGN KEY (assigned_expert_id) REFERENCES users(id)
        )
      `);
      db.exec(`
        INSERT INTO cases_migrate (id, student_id, case_id, status, assigned_expert_id, created_at, submitted_at, due_at, assessed_at, approved_at, rejected_at)
        SELECT id, student_id, case_id, status, assigned_expert_id, created_at, submitted_at, due_at, assessed_at, approved_at, rejected_at FROM cases
      `);
      db.exec('DROP TABLE cases');
      db.exec('ALTER TABLE cases_migrate RENAME TO cases');
    }
  } catch (_) {}
  try { db.exec('PRAGMA foreign_keys = ON'); } catch (_) {}

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
  `);
  try { db.exec(`ALTER TABLE documents ADD COLUMN description TEXT`); } catch (_) {}
  try { db.exec(`ALTER TABLE documents ADD COLUMN uploaded_by INTEGER`); } catch (_) {}
  try { db.exec(`ALTER TABLE documents ADD COLUMN case_id INTEGER`); } catch (_) {}
  try { db.exec(`ALTER TABLE documents ADD COLUMN version INTEGER DEFAULT 1`); } catch (_) {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS case_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (case_id) REFERENCES cases(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS case_additional_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL,
      field_key TEXT NOT NULL,
      field_value TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(case_id, field_key),
      FOREIGN KEY (case_id) REFERENCES cases(id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS case_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      changed_by INTEGER NOT NULL,
      changed_at TEXT DEFAULT (datetime('now')),
      note TEXT,
      FOREIGN KEY (case_id) REFERENCES cases(id),
      FOREIGN KEY (changed_by) REFERENCES users(id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS event_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      actor_id INTEGER,
      payload TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (actor_id) REFERENCES users(id)
    );
  `);

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

  const experts = [
    { email: 'expert@wisdom.edu', pass: 'expert123', majors: ['Civil Engineering'], username: 'Expert Professor', title: 'Professor of Civil Engineering', bio: 'Experienced in structural engineering, construction management, and materials science. Specializing in graduate admissions for Civil Engineering programs.' },
    { email: 'cs.prof@wisdom.edu', pass: 'expert123', majors: ['Computer Science', 'Data Science'], username: 'Dr. Sarah Chen', title: 'Professor of Computer Science', bio: 'Specializes in AI, machine learning, and software engineering. Active in CS graduate admissions.' },
    { email: 'mech.prof@wisdom.edu', pass: 'expert123', majors: ['Mechanical Engineering'], username: 'Prof. James Wilson', title: 'Professor of Mechanical Engineering', bio: 'Expert in thermodynamics, robotics, and aerospace. Graduate admissions committee member.' },
  ];
  for (const ex of experts) {
    const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(ex.email);
    if (!exists) {
      db.prepare(
        'INSERT INTO users (email, password_hash, role, majors, timezone, username, title, bio) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(ex.email, ex.pass, 'expert', JSON.stringify(ex.majors), SEED_TZ, ex.username, ex.title, ex.bio);
    }
  }

  const students = [
    { email: 'student@wisdom.edu', pass: 'student123', major: 'Civil Engineering' },
    { email: 'alice.cs@wisdom.edu', pass: 'student123', major: 'Computer Science' },
    { email: 'bob.mech@wisdom.edu', pass: 'student123', major: 'Mechanical Engineering' },
    { email: 'carol.ds@wisdom.edu', pass: 'student123', major: 'Data Science' },
  ];
  for (const s of students) {
    const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(s.email);
    if (!exists) {
      db.prepare(
        'INSERT INTO users (email, password_hash, role, major, timezone, approved) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(s.email, s.pass, 'student', s.major, SEED_TZ, 1);
    }
  }

  db.prepare("UPDATE users SET approved = 1, timezone = ? WHERE role = 'student'").run(SEED_TZ);
  db.prepare("UPDATE users SET username = 'Expert Professor', title = 'Professor of Civil Engineering', bio = 'Experienced in structural engineering, construction management, and materials science. Specializing in graduate admissions for Civil Engineering programs.' WHERE email = 'expert@wisdom.edu'").run();

  const caseCount = db.prepare('SELECT COUNT(*) as c FROM cases').get().c;
  if (caseCount === 0) {
    const year = new Date().getFullYear();
    const studentIds = db.prepare("SELECT id FROM users WHERE role = 'student'").all();
    const now = new Date().toISOString();
    const dueAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    studentIds.forEach((row, i) => {
      const caseId = `WL-${year}-${String(i + 1).padStart(5, '0')}`;
      db.prepare(
        'INSERT INTO cases (student_id, case_id, status, submitted_at, due_at) VALUES (?, ?, ?, ?, ?)'
      ).run(row.id, caseId, CaseStatus.SUBMITTED, now, dueAt);
    });
  } else {
    try {
      db.prepare(`UPDATE cases SET due_at = datetime(submitted_at, '+5 days') WHERE due_at IS NULL AND submitted_at IS NOT NULL`).run();
    } catch (_) {}
    try {
      db.prepare(`UPDATE cases SET status = ? WHERE status = ?`).run(CaseStatus.UNDER_REVIEW, 'in_review');
    } catch (_) {}
    try {
      db.prepare(`UPDATE cases SET status = ? WHERE status = ?`).run(CaseStatus.NEEDS_INFO, 'needs_info');
    } catch (_) {}
    try {
      db.prepare(`UPDATE cases SET status = ? WHERE status = ?`).run(CaseStatus.RESUBMITTED, 'resubmitted');
    } catch (_) {}
  }
}
