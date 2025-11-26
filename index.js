import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, dbReady } from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

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

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Backend listening on port ${PORT}`);
  });
}
