import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({ 
    status: 'ok', 
    time: new Date().toISOString(),
    env: {
      hasUrl: !!process.env.VITE_TURSO_URL,
      hasKey: !!process.env.VITE_TURSOR_API_KEY
    }
  });
}
