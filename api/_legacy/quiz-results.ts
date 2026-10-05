import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, ensureUser, errorMessage } from './db.js';

const readResults = async (userId: string, materialId: string): Promise<Record<string, boolean>> => {
  const res = await db.execute({
    sql: 'SELECT results_json FROM quiz_results WHERE user_id = ? AND material_id = ?',
    args: [userId, materialId]
  });
  if (res.rows.length === 0) return {};
  const raw = res.rows[0].results_json;
  if (typeof raw !== 'string' || raw.trim() === '') return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const username = String(req.query.username || '');
    const materialId = String(req.query.materialId || '');
    if (!username || !materialId) {
      return res.status(400).json({ error: 'Missing username or materialId' });
    }
    try {
      const userId = await ensureUser(username);
      return res.status(200).json({ results: await readResults(userId, materialId) });
    } catch (error) {
      console.error('quiz-results GET error:', errorMessage(error));
      return res.status(500).json({ error: 'Internal server error', message: errorMessage(error) });
    }
  }

  if (req.method === 'POST') {
    const { username, materialId, results } = req.body || {};
    if (!username || !materialId || !results || typeof results !== 'object' || Array.isArray(results)) {
      return res.status(400).json({ error: 'Missing username, materialId or results object' });
    }
    try {
      const userId = await ensureUser(username);
      await db.execute({
        sql: `INSERT INTO quiz_results (user_id, material_id, results_json) VALUES (?, ?, ?)
              ON CONFLICT(user_id, material_id) DO UPDATE SET results_json = excluded.results_json`,
        args: [userId, materialId, JSON.stringify(results)]
      });
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('quiz-results POST error:', errorMessage(error));
      return res.status(500).json({ error: 'Internal server error', message: errorMessage(error) });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
