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

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

const isObject = (value: JsonValue): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asText = (value: JsonValue | undefined): string | undefined =>
  value === undefined || value === null || typeof value === 'object' ? undefined : String(value);

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
        } else if (nextLine.startsWith('- ') || nextLine.startsWith('* ') || /^[a-dA-D][).]\s/.test(nextLine)) {
          options.push(nextLine.replace(/^[-*]\s|^[a-dA-D][).]\s/, '').trim());
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

export function parseJson(json: unknown, filename: string): StudyMaterial {
  const cards: StudyFlashcard[] = [];
  const sections: StudySection[] = [];
  const root = json as JsonValue;

  const title = (isObject(root) ? asText(root.title) : undefined) || filename.replace('.json', '');

  const qKeys = ['question', 'q', 'topic', 'Prompt', 'prompt', 'term', 'front', 'header', 'title', 'query', 'problem', 'task'];
  const aKeys = ['answer', 'a', 'Response', 'response', 'definition', 'back', 'content', 'body', 'description', 'solution', 'explanation', 'result', 'correct_answer'];
  const optKeys = ['options', 'choices', 'answers', 'distractors'];

  let hasOptions = false;

  // Recursive search for cards
  const searchCards = (value: JsonValue) => {
    if (Array.isArray(value)) {
      value.forEach(item => searchCards(item));
    } else if (isObject(value)) {
      const obj = value;
      // Specialized handling for "questions" or "flashcards" array in common formats
      const listKey = obj.questions ? 'questions' : obj.flashcards ? 'flashcards' : null;
      if (listKey && Array.isArray(obj[listKey])) {
        (obj[listKey] as JsonValue[]).forEach(item => {
          if (!isObject(item)) return;
          const q = item;

          let opts: string[] | undefined = undefined;
          if (q.options && typeof q.options === 'object' && !Array.isArray(q.options)) {
            opts = Object.values(q.options).map(String);
          } else if (Array.isArray(q.options)) {
            opts = q.options.map(String);
          }

          let ans = asText(q.correct_answer) || asText(q.answer) || asText(q.a);
          // If the answer is a key (e.g. "B") and options is an object, map it
          if (ans && isObject(q.options) && q.options[ans]) {
            ans = String(q.options[ans]);
          }

          const question = asText(q.question) || asText(q.topic) || asText(q.q);
          if (question === undefined) return;

          cards.push({
            id: Math.random().toString(36).substring(2) + Date.now().toString(36),
            question,
            answer: String(ans || ''),
            options: opts,
            rationale: asText(q.rationale) || asText(q.explanation)
          });
          if (opts && opts.length > 0) hasOptions = true;
        });
        return;
      }

      let foundQ: string | undefined;
      let foundA: string | undefined;
      let foundOpts: string[] | undefined;
      let usedQKey: string | null = null;

      // 1. Try to find explicit Q&A keys
      for (const key of qKeys) {
        const value = obj[key];
        if (value !== undefined && typeof value !== 'object' && String(value).trim() !== '') {
          foundQ = String(value);
          usedQKey = key;
          break;
        }
      }

      for (const key of aKeys) {
        const value = obj[key];
        if (value !== undefined && typeof value !== 'object' && String(value).trim() !== '') {
          if (key !== usedQKey) {
            foundA = String(value);
            break;
          }
        }
      }

      for (const key of optKeys) {
        const value = obj[key];
        if (Array.isArray(value)) {
          foundOpts = value.map(String);
          if (foundOpts.length > 0) hasOptions = true;
          break;
        } else if (isObject(value)) {
          foundOpts = Object.values(value).map(String);
          if (foundOpts.length > 0) hasOptions = true;
          break;
        }
      }

      const foundRationale = asText(obj.rationale) || asText(obj.explanation);

      if (foundQ && foundA && foundQ !== foundA) {
        if (foundA.length === 1 && isObject(obj.options) && obj.options[foundA]) {
          foundA = String(obj.options[foundA]);
        }

        cards.push({ 
          id: Math.random().toString(36).substring(2) + Date.now().toString(36),
          question: foundQ, 
          answer: String(foundA), 
          options: foundOpts,
          rationale: foundRationale
        });
      } else {
        Object.values(obj).forEach(val => {
          if (typeof val === 'object' && val !== null) searchCards(val);
        });
      }
    }
  };

  searchCards(root);

  const potentialSections = isObject(root) ? root.sections || root.chapters || root.data : undefined;
  if (Array.isArray(potentialSections)) {
    potentialSections.forEach(section => {
      if (isObject(section)) {
        const sub = asText(section.subtitle) || asText(section.title) || asText(section.name) || asText(section.header);
        const cont = asText(section.content) || asText(section.text) || asText(section.body) || asText(section.description) || asText(section.info);
        if (sub || cont) {
          sections.push({
            subtitle: sub || 'Untitled Section',
            content: cont || ''
          });
        }
      }
    });
  }

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
