import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log("Materials handler started");
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, community } = req.query;

  try {
    const database = db; 
    let result;

    if (community === 'true') {
      console.log("Fetching all community quizzes");
      result = await database.execute({
        sql: "SELECT m.id, m.title, m.type, u.username as author FROM materials m JOIN users u ON m.user_id = u.id WHERE m.type IN ('flashcards', 'mixed', 'quiz') ORDER BY m.id DESC LIMIT 50",
        args: []
      });
    } else {
      if (!username) {
        return res.status(400).json({ error: 'Missing username' });
      }
      console.log("Fetching materials for:", username);
      result = await database.execute({
        sql: `
          SELECT m.id, m.title, m.type, p.completion_percentage 
          FROM materials m 
          JOIN users u ON m.user_id = u.id 
          LEFT JOIN progress p ON m.id = p.material_id AND p.user_id = u.id
          WHERE u.username = ?
        `,
        args: [username as string]
      });
    }

    console.log("Query successful, rows:", result.rows.length);
    return res.status(200).json({ materials: result.rows });
  } catch (error: any) {
    console.error('Fetch error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    
    return res.status(500).json({ 
      error: 'Database Error', 
      message: error.message,
      tip: "Ensure your Turso database is initialized and credentials are correct in Vercel."
    });
  }
}
