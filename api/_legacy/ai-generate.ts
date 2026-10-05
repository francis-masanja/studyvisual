import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { InValue } from '@libsql/client';
import { db, ensureUser, errorMessage } from './db.js';
import { llmChat, parseJsonFromLlm } from './llm.js';

interface GeneratedCard {
  question: string;
  options: string[];
  answer: string;
  rationale?: string;
}

const asCard = (value: unknown): GeneratedCard | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const question = typeof raw.question === 'string' ? raw.question.trim() : '';
  const answer = typeof raw.answer === 'string' ? raw.answer.trim() : '';
  const options = Array.isArray(raw.options)
    ? raw.options.filter((opt): opt is string => typeof opt === 'string').map(opt => opt.trim()).filter(Boolean)
    : [];
  if (!question || !answer || options.length < 2) return null;
  if (!options.includes(answer)) return null;
  return {
    question,
    options,
    answer,
    rationale: typeof raw.rationale === 'string' ? raw.rationale.trim() : undefined
  };
};

const generatedQuestionsPrompt = (notes: string, count: number, category: string | null): string => [
  `Create exactly ${count} multiple-choice questions from the study material below.`,
  category ? `Topic/category: ${category}.` : '',
  'Each question must be answerable from the material and have 4 distinct options where exactly one is correct.',
  'Return ONLY a JSON object of the shape {"cards":[{"question":"...","options":["...","...","...","..."],"answer":"<one of the options>","rationale":"one short sentence"}]}.',
  'No markdown, no commentary.',
  '',
  'Study material:',
  notes
].filter(Boolean).join('\n');

const repairPrompt = (rawText: string, kind: string): string => {
  if (kind === 'json') {
    return [
      'The study-material JSON below is malformed or uses the wrong shape. Rewrite it as valid JSON with this exact shape:',
      '{"title":"...","sections":[{"subtitle":"...","content":"..."}],"cards":[{"question":"...","answer":"...","options":["..."]}]}',
      'Preserve as much original content as possible. Output ONLY the corrected JSON, nothing else.',
      '',
      'Broken JSON:',
      rawText
    ].join('\n');
  }
  return [
    'The Markdown study file below has broken formatting. Repair it so that:',
    '- "# Title" is the document title, "## Subtitle" starts a section',
    '- flashcards are "Q: question" followed by "A: answer" lines',
    '- stray artifacts, bad line endings and duplicated headers are fixed',
    'Preserve the original wording. Output ONLY the repaired Markdown, nothing else.',
    '',
    'Broken file:',
    rawText
  ].join('\n');
};

const truncate = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max)}\n...[truncated]` : text;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { mode, title, notes, rawText, kind, username, categoryId, categoryName, count, topic, materialId } = req.body || {};
  const wanted = Math.min(Math.max(Number(count) || 5, 1), 15);

  try {
    if (mode === 'questions') {
      if (typeof notes !== 'string' || notes.trim() === '') {
        return res.status(400).json({ error: 'Missing notes' });
      }
      const content = await llmChat(
        [
          { role: 'system', content: 'You are a quiz generator that replies with strict JSON only.' },
          { role: 'user', content: generatedQuestionsPrompt(truncate(notes, 16000), wanted, typeof title === 'string' && title ? title : null) }
        ],
        { json: true, temperature: 0.6 }
      );
      const parsed = parseJsonFromLlm<{ cards?: unknown[] }>(content);
      const cards = (Array.isArray(parsed.cards) ? parsed.cards : [])
        .map(asCard)
        .filter((card): card is GeneratedCard => card !== null)
        .slice(0, wanted);
      return res.status(200).json({ cards });
    }

    if (mode === 'repair') {
      if (typeof rawText !== 'string' || rawText.trim() === '') {
        return res.status(400).json({ error: 'Missing rawText' });
      }
      const fixedText = await llmChat(
        [
          { role: 'system', content: 'You repair malformed study-material files and output only the corrected file content.' },
          { role: 'user', content: repairPrompt(truncate(rawText, 16000), kind === 'json' ? 'json' : 'markdown') }
        ],
        { temperature: 0.2, timeoutMs: 90000 }
      );
      return res.status(200).json({ fixedText: fixedText.trim() });
    }

    if (mode === 'fill') {
      if (typeof username !== 'string' || username.trim() === '') {
        return res.status(400).json({ error: 'Missing username' });
      }
      const userId = await ensureUser(username);

      let resolvedCategoryId: string | null = null;
      if (typeof categoryId === 'string' && categoryId.trim() !== '') {
        resolvedCategoryId = categoryId.trim();
      } else if (typeof categoryName === 'string' && categoryName.trim() !== '') {
        const existing = await db.execute({
          sql: 'SELECT id FROM categories WHERE name = ?',
          args: [categoryName.trim()]
        });
        resolvedCategoryId = existing.rows.length > 0 ? String(existing.rows[0].id) : null;
      }

      const categoryLabel =
        typeof categoryName === 'string' && categoryName.trim() !== '' ? categoryName.trim() : 'General knowledge';

      const inventFromTopic = (label: string): string =>
        `Topic: ${label}. Invent accurate, self-contained questions on this topic; do not mention that no source material was provided.`;

      let source: string;
      if (typeof materialId === 'string' && materialId.trim() !== '') {
        const material = await db.execute({
          sql: 'SELECT title, content_json FROM materials WHERE id = ? AND user_id = ?',
          args: [materialId.trim(), userId]
        });
        if (material.rows.length === 0) {
          return res.status(404).json({ error: 'Material not found' });
        }
        let parsedContent: { sections?: Array<{ subtitle?: unknown; content?: unknown }>; cards?: Array<{ question?: unknown; answer?: unknown }> } = {};
        try {
          parsedContent = JSON.parse(String(material.rows[0].content_json ?? '{}'));
        } catch {
          parsedContent = {};
        }
        const parts: string[] = [];
        for (const section of Array.isArray(parsedContent.sections) ? parsedContent.sections : []) {
          const body = typeof section.content === 'string' ? section.content.replace(/<[^>]*>/g, ' ') : '';
          if (body.trim() !== '') {
            parts.push(`${typeof section.subtitle === 'string' ? section.subtitle : ''}\n${body}`);
          }
        }
        for (const card of Array.isArray(parsedContent.cards) ? parsedContent.cards : []) {
          if (typeof card.question === 'string' && card.question.trim() !== '') {
            parts.push(`Q: ${card.question}\nA: ${typeof card.answer === 'string' ? card.answer : ''}`);
          }
        }
        const materialTitle = String(material.rows[0].title ?? '');
        if (parts.length === 0) {
          return res.status(400).json({ error: 'Material has no readable content' });
        }
        source = `Study material: "${materialTitle}"\n\n${truncate(parts.join('\n\n'), 16000)}`;
      } else if (typeof notes === 'string' && notes.trim() !== '') {
        source = truncate(notes.trim(), 16000);
      } else {
        const label = typeof topic === 'string' && topic.trim() !== '' ? topic.trim() : categoryLabel;
        source = inventFromTopic(label);
      }

      const content = await llmChat(
        [
          { role: 'system', content: 'You are a quiz generator that replies with strict JSON only.' },
          {
            role: 'user',
            content: generatedQuestionsPrompt(source, wanted, categoryLabel)
          }
        ],
        { json: true, temperature: 0.8 }
      );
      const parsed = parseJsonFromLlm<{ cards?: unknown[] }>(content);
      const cards = (Array.isArray(parsed.cards) ? parsed.cards : [])
        .map(asCard)
        .filter((card): card is GeneratedCard => card !== null)
        .slice(0, wanted);

      let inserted = 0;
      for (const card of cards) {
        const questionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        const args: InValue[] = [
          questionId,
          resolvedCategoryId,
          userId,
          card.question,
          JSON.stringify(card.options),
          card.answer,
          card.rationale ?? null
        ];
        try {
          const result = await db.execute({
            sql: "INSERT INTO questions (id, category_id, user_id, question_text, options_json, correct_answer, rationale, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, 'personal')",
            args
          });
          inserted += result.rowsAffected;
        } catch (insertError) {
          console.error('fill insert failed:', errorMessage(insertError));
        }
      }

      return res.status(200).json({ inserted, cards, visibility: 'personal' });
    }

    return res.status(400).json({ error: 'Invalid mode (use questions, repair or fill)' });
  } catch (error) {
    console.error('ai-generate error:', errorMessage(error));
    return res.status(502).json({ error: 'AI request failed', message: errorMessage(error) });
  }
}
