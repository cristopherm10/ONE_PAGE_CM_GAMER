import request from 'supertest';
import { app } from '../index.js';

// Since index.js starts server, we instead test the handler logic by spinning a minimal app
// For simplicity, we import and run the server endpoints by requiring the module.

describe('health endpoint', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
