import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log("Materials handler started");
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username } = req.query;

  if (!username) {
    return res.status(400).json({ error: 'Missing username' });
  }

  try {
    console.log("Fetching materials for:", username);
    const database = db; 
    
    const result = await database.execute({
      sql: "SELECT m.id, m.title, m.type FROM materials m JOIN users u ON m.user_id = u.id WHERE u.username = ?",
      args: [username as string]
    });

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
