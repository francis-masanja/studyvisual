import { createClient } from '@libsql/client/web';

export const getDb = () => {
  let url = (process.env.VITE_TURSO_URL || process.env.TURSO_DATABASE_URL || '').trim();
  const authToken = (process.env.VITE_TURSOR_API_KEY || process.env.TURSO_AUTH_TOKEN || '').trim();

  if (!url) {
    throw new Error("Database URL is missing.");
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

export const db = {
  execute: (args: any) => {
    try {
      return getDb().execute(args);
    } catch (e: any) {
      console.error("DB Execute Error:", e.message);
      throw e;
    }
  }
};
