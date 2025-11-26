import request from 'supertest';
import { app } from '../index.js';
import { pool } from '../db.js';

// Ensure users table exists; isolate with TRUNCATE for deterministic tests.
beforeAll(async () => {
  if (!pool) throw new Error('Pool not initialized; DATABASE_URL missing');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
    TRUNCATE users;
  `);
});

afterAll(async () => {
  if (pool) await pool.end();
});

describe('Auth endpoints', () => {
  const email = `jest_user_${Date.now()}@example.com`;
  const password = 'P@ssw0rd!';
  let token;

  it('registers a user and returns token', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email, password });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.email).toBe(email);
    expect(res.body).toHaveProperty('token');
    token = res.body.token;
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);
  });

  it('fails registering duplicate email', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email, password });
    expect([409,400]).toContain(res.statusCode); // 409 expected
  });

  it('logs in existing user', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email, password });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.email).toBe(email);
    expect(res.body).toHaveProperty('token');
    expect(res.body.token.length).toBeGreaterThan(20);
  });

  it('rejects invalid credentials', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email, password: 'wrong' });
    expect(res.statusCode).toBe(401);
  });

  it('retrieves /auth/me with token', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('email', email);
    expect(res.body).toHaveProperty('id');
  });

  it('rejects /auth/me without token', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.statusCode).toBe(401);
  });
});
