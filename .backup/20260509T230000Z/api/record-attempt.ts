import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, questionId, isCorrect } = req.body;

  if (!username || !questionId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const database = db;
    // 1. Get user id
    const userRes = await database.execute({
      sql: "SELECT id FROM users WHERE username = ?",
      args: [username]
    });

    if (userRes.rows.length === 0) {
       return res.status(404).json({ error: 'User not found' });
    }

    const userId = userRes.rows[0].id;

    // 2. Insert attempt record
    await database.execute({
      sql: "INSERT OR REPLACE INTO question_attempts (user_id, question_id, is_correct) VALUES (?, ?, ?)",
      args: [userId as string, questionId, isCorrect]
    });

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Record attempt error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
