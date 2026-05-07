import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './db';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, title, type, content_json } = req.body;

  if (!username || !title || !type || !content_json) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 1. Get or create user
    let userResult = await db.execute({
      sql: "SELECT id FROM users WHERE username = ?",
      args: [username]
    });

    let userId;
    if (userResult.rows.length === 0) {
      userId = uuidv4();
      await db.execute({
        sql: "INSERT INTO users (id, username) VALUES (?, ?)",
        args: [userId, username]
      });
    } else {
      userId = userResult.rows[0].id;
    }

    // 2. Insert material
    const materialId = uuidv4();
    await db.execute({
      sql: "INSERT INTO materials (id, user_id, title, type, content_json) VALUES (?, ?, ?, ?, ?)",
      args: [materialId, userId, title, type, JSON.stringify(content_json)]
    });

    return res.status(200).json({ success: true, materialId });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
