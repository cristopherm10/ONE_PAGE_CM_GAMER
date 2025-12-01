import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, dbReady } from './db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
const allowedOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(s=>s.trim()).filter(Boolean) : ['http://localhost:8080'];
app.use(cors({ origin: (origin, cb) => {
  if (!origin) return cb(null, true);
  if (allowedOrigins.includes(origin)) return cb(null, true);
  return cb(new Error('CORS not allowed'), false);
}, credentials: true }));
app.use(helmet());
app.use(rateLimit({ windowMs: 60_000, max: 120 }));
app.use(express.json());

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'dev-secret-change-me');
const JWT_EXPIRES = process.env.JWT_EXPIRES || '2h';
if (!JWT_SECRET) {
  console.warn('JWT_SECRET is not set. Set environment variable JWT_SECRET in production.');
}

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function authMiddleware(req, res, next) {
  const hdr = req.headers['authorization'];
  if (!hdr) return res.status(401).json({ error: 'missing_authorization' });
  const parts = hdr.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'invalid_authorization_format' });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

function healthHandler(req, res) {
  res.json({ status: 'ok' });
}
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// Serve static files (if any) from public
app.use('/public', express.static(path.join(__dirname, 'public')));

// Items endpoint reads from root items.json if present
async function itemsHandler(req, res) {
  try {
    if (pool) {
      const { rows } = await pool.query('SELECT id, title, description, price, seller, created_at, image, stock, specs FROM items ORDER BY id');
      return res.json({ value: rows, Count: rows.length });
    }
    const itemsPath = path.join(__dirname, '..', 'items.json');
    if (fs.existsSync(itemsPath)) {
      const data = JSON.parse(fs.readFileSync(itemsPath, 'utf-8'));
      return res.json(data);
    }
    return res.json({ value: [], Count: 0 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch items', message: String(err) });
  }
}
app.get('/items', itemsHandler);
app.get('/api/items', itemsHandler);

async function dbHealthHandler(req, res) {
  const ok = await dbReady();
  res.json({ db: ok ? 'ok' : 'down' });
}
app.get('/health/db', dbHealthHandler);
app.get('/api/health/db', dbHealthHandler);

// --- Auth Endpoints ---
// Schemas
const registerSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

// Register
app.post('/auth/register', async (req, res) => {
  const parse = registerSchema.safeParse(req.body || {});
  if (!parse.success) return res.status(400).json({ error: 'invalid_payload', details: parse.error.issues });
  const { email, password } = parse.data;
  try {
    const existing = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (existing.rows.length) return res.status(409).json({ error: 'email_exists' });
    const hash = await bcrypt.hash(password, 10);
    const inserted = await pool.query('INSERT INTO users (email, password_hash) VALUES ($1,$2) RETURNING id, email, created_at', [email, hash]);
    const user = inserted.rows[0];
    const token = signToken(user);
    res.status(201).json({ user, token });
  } catch (e) {
    res.status(500).json({ error: 'register_failed', message: String(e) });
  }
});

// Login
app.post('/auth/login', async (req, res) => {
  const parse = loginSchema.safeParse(req.body || {});
  if (!parse.success) return res.status(400).json({ error: 'invalid_payload', details: parse.error.issues });
  const { email, password } = parse.data;
  try {
    const found = await pool.query('SELECT id, email, password_hash, created_at FROM users WHERE email=$1', [email]);
    if (!found.rows.length) return res.status(401).json({ error: 'invalid_credentials' });
    const user = found.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });
    const token = signToken(user);
    res.json({ user: { id: user.id, email: user.email, created_at: user.created_at }, token });
  } catch (e) {
    res.status(500).json({ error: 'login_failed', message: String(e) });
  }
});

// Me
app.get('/auth/me', authMiddleware, async (req, res) => {
  try {
    const found = await pool.query('SELECT id, email, created_at FROM users WHERE id=$1', [req.user.id]);
    if (!found.rows.length) return res.status(404).json({ error: 'not_found' });
    res.json(found.rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'me_failed', message: String(e) });
  }
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Backend listening on port ${PORT}`);
  });
}
