import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.warn('DATABASE_URL is not set. DB features will be disabled.');
}

export const pool = connectionString ? new Pool({ connectionString }) : null;

export async function dbReady() {
  if (!pool) return false;
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (e) {
    return false;
  }
}
