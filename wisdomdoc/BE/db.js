import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, 'uploads');

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});

export const query = (text, params) => pool.query(text, params);
export const queryOne = async (text, params) => {
  const res = await pool.query(text, params);
  return res.rows[0] || null;
};
export const queryAll = async (text, params) => {
  const res = await pool.query(text, params);
  return res.rows || [];
};

export const uploadsDirPath = uploadsDir;

export async function initDb() {
  fs.mkdirSync(uploadsDir, { recursive: true });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'student',
      approved INTEGER DEFAULT 0,
      major TEXT,
      majors TEXT,
      submitted_at TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`UPDATE users SET role = 'student' WHERE role IS NULL`);
  await pool.query(`UPDATE users SET role = 'expert' WHERE role = 'committee'`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS clarifications (
      id SERIAL PRIMARY KEY,
      student_id INTEGER NOT NULL REFERENCES users(id),
      from_user_id INTEGER NOT NULL REFERENCES users(id),
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      filename TEXT NOT NULL,
      path TEXT NOT NULL,
      size INTEGER,
      description TEXT,
      uploaded_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await seedSampleData();
}

async function seedSampleData() {
  const admin = await queryOne('SELECT id FROM users WHERE role = $1', ['admin']);
  if (!admin) {
    await query('INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)', [
      'hithamagadi@gmail.com', 'admin123', 'admin'
    ]);
  }

  const expert = await queryOne('SELECT id FROM users WHERE email = $1', ['expert@wisdom.edu']);
  if (!expert) {
    await query(
      'INSERT INTO users (email, password_hash, role, majors) VALUES ($1, $2, $3, $4)',
      ['expert@wisdom.edu', 'expert123', 'expert', JSON.stringify(['Civil Engineering'])]
    );
  }

  const student = await queryOne('SELECT id FROM users WHERE email = $1', ['student@wisdom.edu']);
  if (!student) {
    await query(
      'INSERT INTO users (email, password_hash, role, major) VALUES ($1, $2, $3, $4)',
      ['student@wisdom.edu', 'student123', 'student', 'Civil Engineering']
    );
  }
}
