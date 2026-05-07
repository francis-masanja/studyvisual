import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';

export interface StudySection {
  subtitle: string;
  content: string;
}

export interface StudyDocument {
  type: 'document';
  title: string;
  sections: StudySection[];
}

export interface StudyFlashcard {
  question: string;
  answer: string;
}

export interface StudyFlashcards {
  type: 'flashcards';
  title: string;
  cards: StudyFlashcard[];
}

export type StudyMaterial = StudyDocument | StudyFlashcards;

export async function parseMarkdown(text: string, filename: string): Promise<StudyMaterial> {
  // Simple heuristic: if it contains "Q:" and "A:", it might be flashcards
  const isFlashcardHeuristic = text.includes('Q:') && text.includes('A:');
  
  if (isFlashcardHeuristic) {
    const cards: StudyFlashcard[] = [];
    const lines = text.split('\n');
    let currentQ = '';
    
    for (const line of lines) {
      if (line.startsWith('Q:')) {
        currentQ = line.replace('Q:', '').trim();
      } else if (line.startsWith('A:') && currentQ) {
        cards.push({
          question: currentQ,
          answer: line.replace('A:', '').trim()
        });
        currentQ = '';
      }
    }
    
    return {
      type: 'flashcards',
      title: filename.replace('.md', ''),
      cards
    };
  }

  // Otherwise, treat as document
  const sections: StudySection[] = [];
  const lines = text.split('\n');
  let currentTitle = filename.replace('.md', '');
  let currentSubtitle = 'Introduction';
  let currentContent: string[] = [];

  for (const line of lines) {
    if (line.startsWith('# ')) {
      currentTitle = line.replace('# ', '').trim();
    } else if (line.startsWith('## ')) {
      if (currentContent.length > 0) {
        sections.push({
          subtitle: currentSubtitle,
          content: await mdToHtml(currentContent.join('\n'))
        });
      }
      currentSubtitle = line.replace('## ', '').trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  if (currentContent.length > 0 || sections.length === 0) {
    sections.push({
      subtitle: currentSubtitle,
      content: await mdToHtml(currentContent.join('\n'))
    });
  }

  return {
    type: 'document',
    title: currentTitle,
    sections
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
  console.log("Parsing JSON data:", json);
  
  // 1. Array-based flashcards
  if (Array.isArray(json)) {
    return {
      type: 'flashcards',
      title: filename.replace('.json', ''),
      cards: json.map((item, idx) => {
        const q = item.question || item.q || item.Prompt || item.prompt;
        const a = item.answer || item.a || item.Response || item.response;
        if (!q || !a) {
          console.warn(`Flashcard at index ${idx} is missing question or answer:`, item);
        }
        return {
          question: q || 'Empty Question',
          answer: a || 'Empty Answer'
        };
      })
    };
  }
  
  // 2. Document with sections
  if (json.sections && Array.isArray(json.sections)) {
    return {
      type: 'document',
      title: json.title || filename.replace('.json', ''),
      sections: json.sections.map((s: any) => ({
        subtitle: s.subtitle || s.title || 'Untitled Section',
        content: s.content || s.text || s.body || ''
      }))
    };
  }

  // 3. Single object that might be a flashcard
  if (json.question || json.q || json.prompt) {
     return {
      type: 'flashcards',
      title: filename.replace('.json', ''),
      cards: [{
        question: json.question || json.q || json.prompt,
        answer: json.answer || json.a || json.response || ''
      }]
    };
  }

  console.error("Failed to parse JSON structure:", json);
  throw new Error("Unsupported JSON format. Expected an array of flashcards or an object with a 'sections' array.");
}
