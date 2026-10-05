import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { InValue } from '@libsql/client';
import { db, ensureUser, errorMessage } from './db.js';

const VALID_STATUSES = new Set(['all', 'unattempted', 'wrong', 'correct']);
const VALID_VISIBILITY = new Set(['all', 'personal', 'community']);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const username = String(req.query.username || '');
  const category = String(req.query.category || '');
  const status = String(req.query.status || 'all');
  const visibility = String(req.query.visibility || 'all');
  const search = String(req.query.search || '').trim();
  const idsParam = String(req.query.ids || '').trim();
  const limit = Math.min(Math.max(Number(req.query.limit ?? 20) || 20, 1), 50);
  const offset = Math.max(Number(req.query.offset ?? 0) || 0, 0);

  if (!VALID_STATUSES.has(status)) {
    return res.status(400).json({ error: 'Invalid status filter' });
  }
  if (!VALID_VISIBILITY.has(visibility)) {
    return res.status(400).json({ error: 'Invalid visibility filter' });
  }
  if (visibility === 'personal' && !username) {
    return res.status(400).json({ error: 'Username required for personal questions' });
  }

  try {
    const userId = username ? await ensureUser(username) : '';

    const joins = `
      LEFT JOIN categories c ON q.category_id = c.id
      LEFT JOIN question_attempts a ON a.question_id = q.id AND a.user_id = ?`;
    const params: InValue[] = [userId];
    const where: string[] = [];

    if (visibility === 'personal') {
      where.push("q.visibility = 'personal' AND q.user_id = ?");
      params.push(userId);
    } else if (visibility === 'community') {
      where.push("(q.visibility = 'community' OR q.visibility IS NULL)");
    } else if (userId) {
      where.push("((q.visibility = 'community' OR q.visibility IS NULL) OR (q.visibility = 'personal' AND q.user_id = ?))");
      params.push(userId);
    } else {
      where.push("(q.visibility = 'community' OR q.visibility IS NULL)");
    }

    if (category) {
      where.push('q.category_id = ?');
      params.push(category);
    }
    const idList = idsParam
      ? idsParam.split(',').map(id => id.trim()).filter(id => id !== '').slice(0, 50)
      : [];
    if (idList.length > 0) {
      where.push(`q.id IN (${idList.map(() => '?').join(', ')})`);
      params.push(...idList);
    }
    if (search) {
      where.push('q.question_text LIKE ?');
      params.push(`%${search}%`);
    }
    if (status === 'unattempted') where.push('a.question_id IS NULL');
    if (status === 'wrong') where.push('a.is_correct = 0');
    if (status === 'correct') where.push('a.is_correct = 1');

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await db.execute({
      sql: `SELECT COUNT(*) AS total FROM questions q ${joins} ${whereSql}`,
      args: params
    });
    const total = Number(countResult.rows[0]?.total ?? 0);

    const pageResult = await db.execute({
      sql: `SELECT q.id, q.question_text, q.options_json, q.correct_answer, q.rationale, q.visibility,
                   c.id AS category_id, c.name AS category_name, a.is_correct AS attempt_correct
            FROM questions q
            ${joins}
            ${whereSql}
            ORDER BY q.rowid DESC
            LIMIT ? OFFSET ?`,
      args: [...params, limit, offset]
    });

    const questions = pageResult.rows.map(row => ({
      id: String(row.id),
      question_text: String(row.question_text ?? ''),
      options_json: row.options_json === null || row.options_json === undefined ? null : String(row.options_json),
      correct_answer: String(row.correct_answer ?? ''),
      rationale: row.rationale === null || row.rationale === undefined ? null : String(row.rationale),
      visibility: row.visibility === 'personal' ? 'personal' as const : 'community' as const,
      category_id: row.category_id === null || row.category_id === undefined ? null : String(row.category_id),
      category_name: row.category_name === null || row.category_name === undefined ? null : String(row.category_name),
      attempt_correct: row.attempt_correct === null || row.attempt_correct === undefined ? null : Number(row.attempt_correct) === 1
    }));

    return res.status(200).json({ questions, total, limit, offset });
  } catch (error) {
    console.error('questions GET error:', errorMessage(error));
    return res.status(500).json({ error: 'Internal server error', message: errorMessage(error) });
  }
}
