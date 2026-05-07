import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username } = req.query;

  if (!username) {
    return res.status(400).json({ error: 'Missing username' });
  }

  try {
    const result = await db.execute({
      sql: `
        SELECT m.id, m.title, m.type, p.completion_percentage 
        FROM materials m
        JOIN users u ON m.user_id = u.id
        LEFT JOIN progress p ON m.id = p.material_id AND u.id = p.user_id
        WHERE u.username = ?
      `,
      args: [username as string]
    });

    return res.status(200).json({ materials: result.rows });
  } catch (error) {
    console.error('Fetch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
