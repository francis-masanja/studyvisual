import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  try {
    const database = db;
    const id = Math.random().toString(36).substring(2, 10);
    
    await database.execute({
      sql: "INSERT INTO categories (id, name) VALUES (?, ?)",
      args: [id, name]
    });

    return res.status(200).json({ success: true, id, name });
  } catch (error: any) {
    if (error.message.includes('UNIQUE')) {
       return res.status(400).json({ error: 'Category already exists' });
    }
    console.error('Create category error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
