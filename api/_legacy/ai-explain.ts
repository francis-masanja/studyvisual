import type { VercelRequest, VercelResponse } from '@vercel/node';
import { errorMessage } from './db.js';
import { llmChat } from './llm.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { question, options, selected, correct, rationale, category } = req.body || {};
  if (typeof question !== 'string' || question.trim() === '') {
    return res.status(400).json({ error: 'Missing question' });
  }

  const lines = [
    `Question: ${question}`,
    Array.isArray(options) && options.length > 0 ? `Options: ${options.map(String).join(' | ')}` : null,
    typeof selected === 'string' ? `Learner answered: ${selected}` : null,
    typeof correct === 'string' ? `Correct answer: ${correct}` : null,
    typeof rationale === 'string' && rationale.trim() !== '' ? `Stored rationale: ${rationale}` : null,
    typeof category === 'string' && category.trim() !== '' ? `Category: ${category}` : null
  ].filter((line): line is string => line !== null);

  try {
    const explanation = await llmChat(
      [
        {
          role: 'system',
          content:
            'You are a friendly study tutor. Explain the correct answer in 2-4 short plain-text sentences. Never use markdown headers or bullet lists. If the learner was wrong, say why their choice is wrong without being harsh.'
        },
        { role: 'user', content: lines.join('\n') }
      ],
      { temperature: 0.5, timeoutMs: 45000 }
    );
    return res.status(200).json({ explanation: explanation.trim() });
  } catch (error) {
    console.error('ai-explain error:', errorMessage(error));
    return res.status(502).json({ error: 'AI request failed', message: errorMessage(error) });
  }
}
