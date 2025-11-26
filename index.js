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

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve static files (if any) from public
app.use('/public', express.static(path.join(__dirname, 'public')));

// Items endpoint reads from root items.json if present
app.get('/items', async (req, res) => {
  try {
    if (pool) {
      const { rows } = await pool.query('SELECT id, title, description, price, seller, created_at, image, stock, specs FROM items ORDER BY id');
      return res.json({ value: rows, Count: rows.length });
    }
    // Fallback to items.json if DB not configured
    const itemsPath = path.join(__dirname, '..', 'items.json');
    if (fs.existsSync(itemsPath)) {
      const data = JSON.parse(fs.readFileSync(itemsPath, 'utf-8'));
      return res.json(data);
    }
    return res.json({ value: [], Count: 0 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch items', message: String(err) });
  }
});

app.get('/health/db', async (req, res) => {
  const ok = await dbReady();
  res.json({ db: ok ? 'ok' : 'down' });
});

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
