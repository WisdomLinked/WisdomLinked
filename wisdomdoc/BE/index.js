import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db.js';
import { runSlaJob } from './jobs/slaJob.js';
import authRoutes from './routes/auth.js';
import documentRoutes from './routes/documents.js';
import committeeRoutes from './routes/committee.js';
import casesRoutes from './routes/cases.js';

process.on('uncaughtException', (err) => { console.error('Uncaught:', err); process.exit(1); });
process.on('unhandledRejection', (err) => { console.error('Unhandled:', err); });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4001;

try {
  initDb();
  console.log('Database initialized');
} catch (err) {
  console.error('Database init failed:', err);
  process.exit(1);
}

const SLA_INTERVAL_MS = 60 * 60 * 1000;
setInterval(() => {
  try {
    const count = runSlaJob();
    if (count > 0) console.log(`SLA job: marked ${count} case(s) overdue`);
  } catch (e) { console.error('SLA job:', e); }
}, SLA_INTERVAL_MS);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/committee', committeeRoutes);
app.use('/api/cases', casesRoutes);

app.get('/api/health', (_, res) => res.json({ ok: true }));
app.get('/', (_, res) => res.redirect('/api/health'));

const server = app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nPort ${PORT} is already in use. Free it with:\n  lsof -i :${PORT}\n  kill <PID>\n`);
  }
  throw err;
});
