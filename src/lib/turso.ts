import { createClient } from '@libsql/client';

const url = import.meta.env.VITE_TURSO_URL || '';
const authToken = import.meta.env.VITE_TURSOR_API_KEY || '';

export const turso = createClient({
  url,
  authToken,
});
