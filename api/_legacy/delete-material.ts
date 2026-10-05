import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, errorMessage } from './db.js';

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

    // 2. Delete the questions atomized from this material (and any attempts on them)
    const contentResult = await database.execute({
      sql: "SELECT content_json FROM materials WHERE id = ?",
      args: [id as string]
    });
    const questionIds: string[] = [id as string];
    try {
      const parsed = JSON.parse(String(contentResult.rows[0]?.content_json ?? '{}')) as { cards?: Array<{ id?: unknown }> };
      if (Array.isArray(parsed.cards)) {
        for (const card of parsed.cards) {
          if (card && typeof card.id === 'string' && card.id !== '') questionIds.push(card.id);
        }
      }
    } catch {
      // malformed content_json: fall back to material_id matching only
    }
    for (let i = 0; i < questionIds.length; i += 400) {
      const chunk = questionIds.slice(i, i + 400);
      const placeholders = chunk.map(() => '?').join(', ');
      await database.execute({
        sql: `DELETE FROM question_attempts WHERE question_id IN (${placeholders})`,
        args: chunk
      });
      await database.execute({
        sql: `DELETE FROM questions WHERE id IN (${placeholders}) OR material_id IN (${placeholders})`,
        args: [...chunk, ...chunk]
      });
    }

    // 3. Delete progress first (due to FK)
    await database.execute({
      sql: "DELETE FROM progress WHERE material_id = ?",
      args: [id as string]
    });

    // 4. Delete material
    await database.execute({
      sql: "DELETE FROM materials WHERE id = ?",
      args: [id as string]
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return res.status(500).json({ 
      error: 'Delete Failed', 
      message: errorMessage(error) 
    });
  }
}
