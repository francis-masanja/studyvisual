import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const database = db;
    
    // Fetch a random flashcard material
    const result = await database.execute({
      sql: "SELECT content_json FROM materials WHERE type IN ('flashcards', 'mixed') ORDER BY RANDOM() LIMIT 1",
      args: []
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No questions available' });
    }

    const material = result.rows[0];
    const content = JSON.parse(material.content_json as string);
    const cards = content.cards || [];

    if (cards.length === 0) {
       return res.status(404).json({ error: 'No cards found in material' });
    }

    const randomCard = cards[Math.floor(Math.random() * cards.length)];

    return res.status(200).json({ question: randomCard });
  } catch (error: any) {
    console.error('Fetch daily challenge error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
}
