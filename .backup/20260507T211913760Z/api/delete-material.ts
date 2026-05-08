import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, username } = req.body;

  if (!id || !username) {
    return res.status(400).json({ error: 'Missing material ID or username' });
  }

  try {
    const database = db;

    // 1. Verify the material belongs to the user
    const checkResult = await database.execute({
      sql: "SELECT m.id FROM materials m JOIN users u ON m.user_id = u.id WHERE m.id = ? AND u.username = ?",
      args: [id as string, username as string]
    });

    if (checkResult.rows.length === 0) {
      return res.status(403).json({ error: 'You do not have permission to delete this material' });
    }

    // 2. Delete progress first (due to FK)
    await database.execute({
      sql: "DELETE FROM progress WHERE material_id = ?",
      args: [id as string]
    });

    // 3. Delete material
    await database.execute({
      sql: "DELETE FROM materials WHERE id = ?",
      args: [id as string]
    });

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Delete error:', error);
    return res.status(500).json({ 
      error: 'Delete Failed', 
      message: error.message 
    });
  }
}
