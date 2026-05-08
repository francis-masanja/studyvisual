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

  const qKeys = ['question', 'q', 'Prompt', 'prompt', 'term', 'front', 'header', 'title', 'query', 'problem', 'task'];
  const aKeys = ['answer', 'a', 'Response', 'response', 'definition', 'back', 'content', 'body', 'description', 'solution', 'explanation', 'result'];
  const optKeys = ['options', 'choices', 'answers', 'distractors'];

  // Recursive search for cards
  const searchCards = (obj: any) => {
    if (Array.isArray(obj)) {
      obj.forEach(item => searchCards(item));
    } else if (typeof obj === 'object' && obj !== null) {
      let foundQ: string | null = null;
      let foundA: string | null = null;
      let foundOpts: string[] | undefined = undefined;
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
          break;
        }
      }

      if (foundQ && foundA && foundQ !== foundA) {
        cards.push({ 
          id: Math.random().toString(36).substring(2) + Date.now().toString(36),
          question: foundQ, 
          answer: foundA, 
          options: foundOpts 
        });
      } 
      // 2. Fallback: If it's a simple key-value object where values are strings, 
      // and it's not a root object with specific keys, treat keys as Q and values as A
      else if (Object.keys(obj).length > 0 && Object.keys(obj).length < 20) {
        let isKVMap = true;
        const tempCards: StudyFlashcard[] = [];
        for (const [key, value] of Object.entries(obj)) {
          if (typeof value === 'string' && value.length > 0 && key.length > 1) {
            // Check if key is not a standard metadata key
            if (!['title', 'id', 'type', 'version', 'date', 'author'].includes(key.toLowerCase())) {
              tempCards.push({ 
                id: Math.random().toString(36).substring(2) + Date.now().toString(36),
                question: key, 
                answer: value 
              });
            } else {
              isKVMap = false;
              break;
            }
          } else {
            isKVMap = false;
            break;
          }
        }
        
        if (isKVMap && tempCards.length > 0) {
          cards.push(...tempCards);
          return; // Stop searching deeper if this was a map
        }

        // Otherwise search deeper
        Object.values(obj).forEach(val => {
          if (typeof val === 'object') searchCards(val);
        });
      }
      else {
        Object.values(obj).forEach(val => {
          if (typeof val === 'object') searchCards(val);
        });
      }
    }
  };

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

