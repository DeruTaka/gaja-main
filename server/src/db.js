import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set — point it at your Neon connection string (see .env.example).');
}

// Neon connection strings already carry ?sslmode=require; pg reads that from
// the URL itself, no separate ssl option needed.
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
