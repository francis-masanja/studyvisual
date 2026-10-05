import type { VercelRequest, VercelResponse } from '@vercel/node';
import { errorMessage } from './db.js';
import { llmChat, type ChatMessage } from './llm.js';

interface HistoryItem {
  role: string;
  content: string;
}

const truncate = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max)}\n...[truncated]` : text;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, history, context } = req.body || {};
  if (typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ error: 'Missing message' });
  }

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'You are the StudyVisual study assistant. Answer clearly and concisely about the material provided. Use short paragraphs; no markdown headers. If the answer is not in the material, say so.'
    }
  ];

  if (context && typeof context.content === 'string' && context.content.trim() !== '') {
    messages.push({
      role: 'system',
      content: `Material${typeof context.title === 'string' && context.title ? ` "${context.title}"` : ''}:\n${truncate(context.content, 8000)}`
    });
  }

  if (Array.isArray(history)) {
    const recent = (history as HistoryItem[])
      .filter(item => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
      .slice(-10);
    for (const item of recent) {
      messages.push({ role: item.role === 'assistant' ? 'assistant' : 'user', content: item.content });
    }
  }

  messages.push({ role: 'user', content: message.trim() });

  try {
    const reply = await llmChat(messages, { temperature: 0.6, timeoutMs: 60000 });
    return res.status(200).json({ reply: reply.trim() });
  } catch (error) {
    console.error('ai-chat error:', errorMessage(error));
    return res.status(502).json({ error: 'AI request failed', message: errorMessage(error) });
  }
}
