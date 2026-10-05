import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, ensureUser, errorMessage } from './db.js';

interface Stats {
  score: number;
  streak: number;
  lastPlayed: string | null;
}

const readStats = async (userId: string): Promise<Stats> => {
  const res = await db.execute({
    sql: 'SELECT score, streak, last_played FROM user_stats WHERE user_id = ?',
    args: [userId]
  });
  if (res.rows.length === 0) {
    await db.execute({
      sql: 'INSERT OR IGNORE INTO user_stats (user_id, score, streak) VALUES (?, 0, 0)',
      args: [userId]
    });
    return { score: 0, streak: 0, lastPlayed: null };
  }
  const row = res.rows[0];
  return {
    score: Number(row.score ?? 0),
    streak: Number(row.streak ?? 0),
    lastPlayed: row.last_played === null || row.last_played === undefined ? null : String(row.last_played)
  };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const username = String(req.query.username || '');
    if (!username) {
      return res.status(400).json({ error: 'Missing username' });
    }
    try {
      const userId = await ensureUser(username);
      return res.status(200).json(await readStats(userId));
    } catch (error) {
      console.error('user-stats GET error:', errorMessage(error));
      return res.status(500).json({ error: 'Internal server error', message: errorMessage(error) });
    }
  }

  if (req.method === 'POST') {
    const { username, score, streak, lastPlayed } = req.body || {};
    if (!username) {
      return res.status(400).json({ error: 'Missing username' });
    }
    try {
      const userId = await ensureUser(username);
      const current = await readStats(userId);
      const next: Stats = {
        score: typeof score === 'number' && Number.isFinite(score) ? Math.max(0, Math.floor(score)) : current.score,
        streak: typeof streak === 'number' && Number.isFinite(streak) ? Math.max(0, Math.floor(streak)) : current.streak,
        lastPlayed: typeof lastPlayed === 'string' ? lastPlayed : current.lastPlayed
      };
      await db.execute({
        sql: `INSERT INTO user_stats (user_id, score, streak, last_played) VALUES (?, ?, ?, ?)
              ON CONFLICT(user_id) DO UPDATE SET score = excluded.score, streak = excluded.streak, last_played = excluded.last_played`,
        args: [userId, next.score, next.streak, next.lastPlayed]
      });
      return res.status(200).json({ success: true, ...next });
    } catch (error) {
      console.error('user-stats POST error:', errorMessage(error));
      return res.status(500).json({ error: 'Internal server error', message: errorMessage(error) });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
