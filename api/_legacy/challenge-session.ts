import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, ensureUser, errorMessage } from './db.js';

interface SessionAnswer {
  questionId: string;
  selected: string | null;
  correct: boolean;
}

interface Session {
  questionIds: string[];
  answers: SessionAnswer[];
  currentIndex: number;
  finished: boolean;
}

const parseJsonArray = <T>(raw: unknown, fallback: T[]): T[] => {
  if (typeof raw !== 'string' || raw.trim() === '') return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const username = String(req.query.username || '');
    const day = String(req.query.day || '');
    if (!username || !day) {
      return res.status(400).json({ error: 'Missing username or day' });
    }
    try {
      const userId = await ensureUser(username);
      const result = await db.execute({
        sql: 'SELECT question_ids, answers, current_index, finished FROM challenge_sessions WHERE user_id = ? AND day = ?',
        args: [userId, day]
      });
      if (result.rows.length === 0) {
        return res.status(200).json({ session: null });
      }
      const row = result.rows[0];
      const session: Session = {
        questionIds: parseJsonArray<string>(row.question_ids, []),
        answers: parseJsonArray<SessionAnswer>(row.answers, []),
        currentIndex: Number(row.current_index ?? 0),
        finished: Number(row.finished ?? 0) === 1
      };
      return res.status(200).json({ session });
    } catch (error) {
      console.error('challenge-session GET error:', errorMessage(error));
      return res.status(500).json({ error: 'Internal server error', message: errorMessage(error) });
    }
  }

  if (req.method === 'POST') {
    const { username, day, questionIds, answers, currentIndex, finished } = req.body || {};
    if (!username || !day || !Array.isArray(questionIds)) {
      return res.status(400).json({ error: 'Missing username, day or questionIds' });
    }
    try {
      const userId = await ensureUser(username);
      await db.execute({
        sql: `INSERT INTO challenge_sessions (user_id, day, question_ids, answers, current_index, finished)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(user_id, day) DO UPDATE SET
                question_ids = excluded.question_ids,
                answers = excluded.answers,
                current_index = excluded.current_index,
                finished = excluded.finished`,
        args: [
          userId,
          day,
          JSON.stringify(questionIds),
          JSON.stringify(Array.isArray(answers) ? answers : []),
          Number(currentIndex ?? 0),
          finished ? 1 : 0
        ]
      });
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('challenge-session POST error:', errorMessage(error));
      return res.status(500).json({ error: 'Internal server error', message: errorMessage(error) });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
