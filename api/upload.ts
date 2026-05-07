import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, title, type, content_json } = req.body;

  if (!username || !title || !type || !content_json) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const database = db;
    // 1. Get or create user
    let userResult = await database.execute({
      sql: "SELECT id FROM users WHERE username = ?",
      args: [username]
    });

    let userId;
    if (userResult.rows.length === 0) {
      userId = Math.random().toString(36).substring(2) + Date.now().toString(36);
      await database.execute({
        sql: "INSERT INTO users (id, username) VALUES (?, ?)",
        args: [userId, username]
      });
    } else {
      userId = userResult.rows[0].id;
    }

    // 2. Insert material
    const materialId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    await database.execute({
      sql: "INSERT INTO materials (id, user_id, title, type, content_json) VALUES (?, ?, ?, ?, ?)",
      args: [materialId, userId as string, title, type, JSON.stringify(content_json)]
    });

    return res.status(200).json({ success: true, materialId });
  } catch (error: any) {
    console.error('Upload error:', error);
    return res.status(500).json({ 
      error: 'Upload Failed', 
      message: error.message 
    });
  }
}
