import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';

export interface StudySection {
  subtitle: string;
  content: string;
}

export interface StudyFlashcard {
  question: string;
  answer: string;
}

export interface StudyMaterial {
  type: 'document' | 'flashcards' | 'mixed';
  title: string;
  sections?: StudySection[];
  cards?: StudyFlashcard[];
}

export async function parseMarkdown(text: string, filename: string): Promise<StudyMaterial> {
  const cards: StudyFlashcard[] = [];
  const sections: StudySection[] = [];
  const lines = text.split('\n');
  
  let currentTitle = filename.replace('.md', '');
  let currentSubtitle = 'Introduction';
  let currentContent: string[] = [];
  let hasFlashcards = false;

  const flushSection = async () => {
    if (currentContent.length > 0) {
      const contentText = currentContent.join('\n').trim();
      if (contentText) {
        sections.push({
          subtitle: currentSubtitle,
          content: await mdToHtml(contentText)
        });
      }
      currentContent = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('# ')) {
      await flushSection();
      currentTitle = line.replace('# ', '').trim();
    } else if (line.startsWith('## ')) {
      await flushSection();
      currentSubtitle = line.replace('## ', '').trim();
    } else if (line.toUpperCase().startsWith('Q:')) {
      hasFlashcards = true;
      const question = line.substring(2).trim();
      let answer = '';
      if (i + 1 < lines.length && lines[i + 1].trim().toUpperCase().startsWith('A:')) {
        answer = lines[i + 1].trim().substring(2).trim();
        i++; // skip next line
      }
      cards.push({ question, answer });
    } else {
      currentContent.push(lines[i]); // Keep original spacing for content
    }
  }

  await flushSection();

  // Determine type
  let type: 'document' | 'flashcards' | 'mixed' = 'document';
  if (hasFlashcards && sections.length > 0) type = 'mixed';
  else if (hasFlashcards) type = 'flashcards';

  return {
    type,
    title: currentTitle,
    sections,
    cards
  };
}

async function mdToHtml(md: string): Promise<string> {
  const result = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(md);
  return result.toString();
}

export function parseJson(json: any, filename: string): StudyMaterial {
  const cards: StudyFlashcard[] = [];
  const sections: StudySection[] = [];
  
  // Title detection
  const title = json.title || filename.replace('.json', '');

  // Recursive search for cards
  const searchCards = (obj: any) => {
    if (Array.isArray(obj)) {
      obj.forEach(item => searchCards(item));
    } else if (typeof obj === 'object' && obj !== null) {
      const q = obj.question || obj.q || obj.Prompt || obj.prompt;
      const a = obj.answer || obj.a || obj.Response || obj.response;
      if (q && a) {
        cards.push({ question: String(q), answer: String(a) });
      } else {
        Object.values(obj).forEach(val => searchCards(val));
      }
    }
  };

  searchCards(json);

  // Section detection
  const potentialSections = json.sections || json.chapters || json.data;
  if (Array.isArray(potentialSections)) {
    potentialSections.forEach((s: any) => {
      if (typeof s === 'object') {
        sections.push({
          subtitle: s.subtitle || s.title || s.name || 'Untitled Section',
          content: s.content || s.text || s.body || s.description || ''
        });
      }
    });
  }

  // Determine type
  let type: 'document' | 'flashcards' | 'mixed' = 'document';
  if (cards.length > 0 && sections.length > 0) type = 'mixed';
  else if (cards.length > 0) type = 'flashcards';

  return {
    type,
    title,
    sections: sections.length > 0 ? sections : undefined,
    cards: cards.length > 0 ? cards : undefined
  };
}
