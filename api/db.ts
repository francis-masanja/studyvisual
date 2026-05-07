import { createClient } from '@libsql/client';

const url = process.env.VITE_TURSO_URL || process.env.TURSO_DATABASE_URL || '';
const authToken = process.env.VITE_TURSOR_API_KEY || process.env.TURSO_AUTH_TOKEN || '';

export const db = createClient({
  url,
  authToken,
});
