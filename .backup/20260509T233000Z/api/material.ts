import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, username } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Missing material ID' });
  }

  try {
    const database = db;
    
    // 1. Fetch material
    const result = await database.execute({
      sql: "SELECT * FROM materials WHERE id = ?",
      args: [id as string]
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Material not found' });
    }

    const material = result.rows[0];
    material.content_json = JSON.parse(material.content_json as string);

    // 2. Fetch progress if username is provided
    if (username) {
      const progressRes = await database.execute({
        sql: `
          SELECT completion_percentage 
          FROM progress p 
          JOIN users u ON p.user_id = u.id 
          WHERE u.username = ? AND p.material_id = ?
        `,
        args: [username as string, id as string]
      });
      if (progressRes.rows.length > 0) {
        material.completion_percentage = progressRes.rows[0].completion_percentage;
      }
    }

    return res.status(200).json({ material });
  } catch (error: any) {
    console.error('Fetch error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    });
  }
}
