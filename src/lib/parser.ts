import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';

export interface StudySection {
  subtitle: string;
  content: string;
}

export interface StudyFlashcard {
  id?: string;
  question: string;
  answer: string;
  options?: string[];
  rationale?: string;
}

export interface StudyMaterial {
  type: 'document' | 'flashcards' | 'quiz' | 'mixed';
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
  let hasOptions = false;

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
      const options: string[] = [];
      
      // Look ahead for options or answer
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j].trim();
        if (nextLine.toUpperCase().startsWith('A:')) {
          answer = nextLine.substring(2).trim();
          i = j;
          break;
        } else if (nextLine.startsWith('- ') || nextLine.startsWith('* ') || /^[a-dA-D][\)\.]\s/.test(nextLine)) {
          options.push(nextLine.replace(/^[-*]\s|^[a-dA-D][\)\.]\s/, '').trim());
          hasOptions = true;
          j++;
        } else if (nextLine === '') {
          j++;
        } else {
          break;
        }
      }
      
      cards.push({ 
        id: Math.random().toString(36).substring(2) + Date.now().toString(36),
        question, 
        answer, 
        options: options.length > 0 ? options : undefined 
      });
    } else {
      currentContent.push(lines[i]); // Keep original spacing for content
    }
  }

  await flushSection();

  // Determine type
  let type: 'document' | 'flashcards' | 'quiz' | 'mixed' = 'document';
  if (hasFlashcards) {
    if (sections.length > 0) type = 'mixed';
    else if (hasOptions) type = 'quiz';
    else type = 'flashcards';
  }

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

  const qKeys = ['question', 'q', 'Prompt', 'prompt', 'term', 'front', 'header', 'title', 'query', 'problem', 'task'];
  const aKeys = ['answer', 'a', 'Response', 'response', 'definition', 'back', 'content', 'body', 'description', 'solution', 'explanation', 'result', 'correct_answer'];
  const optKeys = ['options', 'choices', 'answers', 'distractors'];

  let hasOptions = false;

  // Recursive search for cards
  const searchCards = (obj: any) => {
    if (Array.isArray(obj)) {
      obj.forEach(item => searchCards(item));
    } else if (typeof obj === 'object' && obj !== null) {
      // Specialized handling for "questions" array in the provided format
      if (obj.questions && Array.isArray(obj.questions)) {
        obj.questions.forEach((q: any) => {
          let opts: string[] | undefined = undefined;
          if (q.options && typeof q.options === 'object' && !Array.isArray(q.options)) {
             opts = Object.values(q.options).map(String);
          } else if (Array.isArray(q.options)) {
             opts = q.options.map(String);
          }

          let ans = q.correct_answer || q.answer || q.a;
          // If the answer is a key (e.g. "B") and options is an object, map it
          if (ans && q.options && typeof q.options === 'object' && q.options[ans]) {
            ans = q.options[ans];
          }

          cards.push({
            id: Math.random().toString(36).substring(2) + Date.now().toString(36),
            question: q.question || q.q,
            answer: String(ans),
            options: opts,
            rationale: q.rationale || q.explanation
          });
          if (opts && opts.length > 0) hasOptions = true;
        });
        return; // Don't search deeper into this object
      }

      let foundQ: string | null = null;
      let foundA: string | null = null;
      let foundOpts: string[] | undefined = undefined;
      let foundRationale: string | undefined = undefined;
      let usedQKey: string | null = null;

      // 1. Try to find explicit Q&A keys
      for (const key of qKeys) {
        if (obj[key] !== undefined && typeof obj[key] !== 'object' && String(obj[key]).trim() !== '') {
          foundQ = String(obj[key]);
          usedQKey = key;
          break;
        }
      }

      for (const key of aKeys) {
        if (obj[key] !== undefined && typeof obj[key] !== 'object' && String(obj[key]).trim() !== '') {
          if (key !== usedQKey) {
            foundA = String(obj[key]);
            break;
          }
        }
      }

      for (const key of optKeys) {
        if (Array.isArray(obj[key])) {
          foundOpts = obj[key].map(String);
          if (foundOpts.length > 0) hasOptions = true;
          break;
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          // Handle { "A": "...", "B": "..." }
          foundOpts = Object.values(obj[key]).map(String);
          if (foundOpts.length > 0) hasOptions = true;
          break;
        }
      }
      
      foundRationale = obj.rationale || obj.explanation;

      if (foundQ && foundA && foundQ !== foundA) {
        // Special case: if A is just "A", "B", "C", "D" and we have options
        if (foundA.length === 1 && obj.options && typeof obj.options === 'object' && obj.options[foundA]) {
          foundA = obj.options[foundA];
        }

        cards.push({ 
          id: Math.random().toString(36).substring(2) + Date.now().toString(36),
          question: foundQ, 
          answer: foundA, 
          options: foundOpts,
          rationale: foundRationale
        });
      }} 
      // 2. Fallback: If it's a simple key-value object where values are strings...


  searchCards(json);

  // Section detection (avoiding overlap with cards if possible)
  const potentialSections = json.sections || json.chapters || json.data;
  if (Array.isArray(potentialSections)) {
    potentialSections.forEach((s: any) => {
      if (typeof s === 'object') {
        const sub = s.subtitle || s.title || s.name || s.header;
        const cont = s.content || s.text || s.body || s.description || s.info;
        if (sub || cont) {
          sections.push({
            subtitle: String(sub || 'Untitled Section'),
            content: String(cont || '')
          });
        }
      }
    });
  }

  // Determine type
  let type: 'document' | 'flashcards' | 'quiz' | 'mixed' = 'document';
  if (cards.length > 0) {
    if (sections.length > 0) type = 'mixed';
    else if (hasOptions) type = 'quiz';
    else type = 'flashcards';
  }

  return {
    type,
    title,
    sections: sections.length > 0 ? sections : undefined,
    cards: cards.length > 0 ? cards : undefined
  };
}
}
  
