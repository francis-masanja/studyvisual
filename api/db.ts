import { createClient, type Client } from '@libsql/client';

let _db: Client | null = null;

export const getDb = () => {
  if (!_db) {
    const url = process.env.VITE_TURSO_URL || process.env.TURSO_DATABASE_URL || '';
    const authToken = process.env.VITE_TURSOR_API_KEY || process.env.TURSO_AUTH_TOKEN || '';

    if (!url) {
      console.error("❌ ERROR: VITE_TURSO_URL is missing. DB operations will fail.");
      // Return a dummy client that logs errors instead of crashing the process
      return {
        execute: async () => { throw new Error("Database URL is missing. Check your .env file."); }
      } as any;
    }

    _db = createClient({
      url,
      authToken,
    });
  }
  return _db;
};

// For compatibility with existing imports
export const db = {
  execute: (args: any) => getDb().execute(args)
};
