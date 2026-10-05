import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { InValue } from '@libsql/client';
import { db, errorMessage } from './db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username } = req.query;

  try {
    const database = db;
    
    let userId = null;
    if (username) {
      const userRes = await database.execute({
        sql: "SELECT id FROM users WHERE username = ?",
        args: [username as string]
      });
      if (userRes.rows.length > 0) {
        userId = userRes.rows[0].id;
      }
    }

    // Pull 10 random questions that the user has NOT attempted yet
    // Only include actual QUIZ questions (those with options)
    let query = `
      SELECT q.*, c.name as category_name 
      FROM questions q 
      LEFT JOIN categories c ON q.category_id = c.id
      WHERE q.options_json IS NOT NULL AND q.options_json != '[]' AND q.options_json != ''
    `;
    
    const args: InValue[] = [];
    if (userId) {
      query += " AND (q.visibility = 'community' OR q.visibility IS NULL OR q.user_id = ?) ";
      args.push(userId as string);
      query += ` AND q.id NOT IN (SELECT question_id FROM question_attempts WHERE user_id = ?) `;
      args.push(userId);
    } else {
      query += " AND (q.visibility = 'community' OR q.visibility IS NULL) ";
    }

    // Optional category filter: comma-separated category ids
    const categoriesParam = String(req.query.categories || '').trim();
    const categoryIds = categoriesParam
      ? categoriesParam.split(',').map(id => id.trim()).filter(id => id !== '')
      : [];
    if (categoryIds.length > 0) {
      query += ` AND q.category_id IN (${categoryIds.map(() => '?').join(', ')}) `;
      args.push(...categoryIds);
    }
    
    query += ` ORDER BY RANDOM() LIMIT 10 `;

    const result = await database.execute({ sql: query, args });

    if (result.rows.length === 0) {
      // Fallback: If everything was attempted, just pull 10 random ones with options anyway
      let fallbackQuery = "SELECT q.*, c.name as category_name FROM questions q LEFT JOIN categories c ON q.category_id = c.id WHERE q.options_json IS NOT NULL AND q.options_json != '[]' AND q.options_json != ''";
      const fallbackArgs: InValue[] = [];
      if (userId) {
        fallbackQuery += " AND (q.visibility = 'community' OR q.visibility IS NULL OR q.user_id = ?) ";
        fallbackArgs.push(userId as string);
      } else {
        fallbackQuery += " AND (q.visibility = 'community' OR q.visibility IS NULL) ";
      }
      if (categoryIds.length > 0) {
        fallbackQuery += ` AND q.category_id IN (${categoryIds.map(() => '?').join(', ')}) `;
        fallbackArgs.push(...categoryIds);
      }
      fallbackQuery += ' ORDER BY RANDOM() LIMIT 10';
      const fallback = await database.execute({ sql: fallbackQuery, args: fallbackArgs });
      return res.status(200).json({ questions: fallback.rows });
    }

    return res.status(200).json({ questions: result.rows });
  } catch (error) {
    console.error('Fetch daily challenge error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: errorMessage(error) 
    });
  }
}
