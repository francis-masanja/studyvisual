import { createClient } from '@libsql/client/web';

export const getDb = () => {
  const url = (process.env.VITE_TURSO_URL || process.env.TURSO_DATABASE_URL || '').trim();
  const authToken = (process.env.VITE_TURSOR_API_KEY || process.env.TURSO_AUTH_TOKEN || '').trim();

  if (!url) {
    throw new Error("Database URL is missing. Please set VITE_TURSO_URL in Vercel settings.");
  }

  return createClient({
    url,
    authToken,
  });
};

export const db = {
  execute: (args: any) => getDb().execute(args)
};
