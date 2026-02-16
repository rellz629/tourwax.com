import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Use Neon's HTTP driver for better Vercel compatibility
const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });
