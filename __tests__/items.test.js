import request from 'supertest';
import { app } from '../index.js';
import { pool } from '../db.js';

// Seeds the items table before running tests to ensure deterministic data.
beforeAll(async () => {
  if (!pool) {
    throw new Error('Pool is not initialized; DATABASE_URL missing');
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS items (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      price NUMERIC(10,2) NOT NULL,
      seller TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      image TEXT,
      stock INT DEFAULT 0
    );
    ALTER TABLE items ADD COLUMN IF NOT EXISTS specs JSONB DEFAULT '{}'::jsonb;
    TRUNCATE items;
    INSERT INTO items (title, description, price, seller, image, stock, specs)
    VALUES
      ('Test Item 1','Desc 1', 10.00,'tester','',5,'{}'::jsonb),
      ('Test Item 2','Desc 2', 20.00,'tester','',3,'{"cpu":"i5"}'::jsonb);
  `);
});

afterAll(async () => {
  if (pool) await pool.end();
});

describe('/items endpoint', () => {
  it('returns seeded items from DB', async () => {
    const res = await request(app).get('/items');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('value');
    expect(Array.isArray(res.body.value)).toBe(true);
    expect(res.body.value.length).toBe(2);
    expect(res.body).toHaveProperty('Count');
    expect(res.body.Count).toBe(2);
    const titles = res.body.value.map(i => i.title);
    expect(titles).toEqual(expect.arrayContaining(['Test Item 1','Test Item 2']));
    const item = res.body.value[0];
    for (const field of ['id','title','description','price','seller','created_at','image','stock','specs']) {
      expect(item).toHaveProperty(field);
    }
    const second = res.body.value.find(i => i.title === 'Test Item 2');
    expect(second.specs).toHaveProperty('cpu','i5');
  });
});
