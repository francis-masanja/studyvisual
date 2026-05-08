import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './db.js';

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
    
    let args: any[] = [];
    if (userId) {
      query += ` AND q.id NOT IN (SELECT question_id FROM question_attempts WHERE user_id = ?) `;
      args.push(userId);
    }
    
    query += ` ORDER BY RANDOM() LIMIT 10 `;

    const result = await database.execute({ sql: query, args });

    if (result.rows.length === 0) {
      // Fallback: If everything was attempted, just pull 10 random ones with options anyway
       const fallback = await database.execute({
         sql: "SELECT q.*, c.name as category_name FROM questions q LEFT JOIN categories c ON q.category_id = c.id WHERE q.options_json IS NOT NULL AND q.options_json != '[]' AND q.options_json != '' ORDER BY RANDOM() LIMIT 10",
         args: []
       });
       return res.status(200).json({ questions: fallback.rows });
    }

    return res.status(200).json({ questions: result.rows });
  } catch (error: any) {
    console.error('Fetch daily challenge error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
}
