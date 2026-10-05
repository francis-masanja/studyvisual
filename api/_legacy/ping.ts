import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './db.js';
import { isLlmConfigured } from './llm.js';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const rawUrl = process.env.VITE_TURSO_URL || process.env.TURSO_DATABASE_URL || '';
  let dbStatus: 'connected' | 'failed';
  let dbError: string | null = null;

  try {
    // Try a tiny "heartbeat" query to Turso
    await db.execute("SELECT 1");
    dbStatus = 'connected';
  } catch (e) {
    dbStatus = 'failed';
    dbError = e instanceof Error ? e.message : String(e);
  }
  
  return res.status(200).json({ 
    status: 'ok', 
    time: new Date().toISOString(),
    database: {
      connection: dbStatus,
      error: dbError
    },
    ai: {
      configured: isLlmConfigured()
    },
    debug: {
      hasUrl: !!rawUrl,
      hasKey: !!(process.env.VITE_TURSO_AUTH_TOKEN || process.env.VITE_TURSOR_API_KEY || process.env.TURSO_AUTH_TOKEN),
      protocol: rawUrl.split(':')[0],
      isLibsql: rawUrl.startsWith('libsql://'),
      willBeHttps: rawUrl.replace('libsql://', 'https://').startsWith('https://')
    }
  });
}
