import { createClient } from '@libsql/client/web';
import type { InStatement } from '@libsql/client';

export const getDb = () => {
  let url = (process.env.VITE_TURSO_URL || process.env.TURSO_DATABASE_URL || '').trim();
  const authToken = (process.env.VITE_TURSO_AUTH_TOKEN || process.env.VITE_TURSOR_API_KEY || process.env.TURSO_AUTH_TOKEN || '').trim();

  if (!url) {
    throw new Error("Database URL is missing. Please set VITE_TURSO_URL or TURSO_DATABASE_URL.");
  }

  // Vercel/Web driver requires https:// instead of libsql://
  if (url.startsWith('libsql://')) {
    url = url.replace('libsql://', 'https://');
  }

  return createClient({
    url,
    authToken,
  });
};

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const db = {
  execute: (stmt: InStatement) => {
    try {
      return getDb().execute(stmt);
    } catch (e) {
      console.error("DB Execute Error:", e instanceof Error ? e.message : String(e));
      throw e;
    }
  }
};
