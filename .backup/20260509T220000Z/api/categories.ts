import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const database = db;
    const result = await database.execute({
      sql: "SELECT id, name FROM categories ORDER BY name ASC",
      args: []
    });

    return res.status(200).json({ categories: result.rows });
  } catch (error: any) {
    console.error('Fetch categories error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
