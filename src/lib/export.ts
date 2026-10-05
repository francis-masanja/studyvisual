import { getQuestions, todayKey, type PracticeQuestion, type QuestionFilters } from './api';

const PAGE_SIZE = 50;
const MAX_QUESTIONS = 2000;

export type ExportFormat = 'pdf' | 'markdown' | 'json' | 'csv';

export interface ExportOptions {
  answers: boolean;
  options: boolean;
  tags: boolean;
  result: boolean;
  rationale: boolean;
}

export interface ExportItem {
  question: string;
  options: string[];
  answer: string;
  rationale?: string;
  category?: string;
  visibility: 'personal' | 'community';
  attempt: boolean | null;
}

const parseOptions = (json: string | null): string[] => {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

export const attemptLabel = (attempt: boolean | null): string =>
  attempt === true ? 'Correct' : attempt === false ? 'Incorrect' : 'Not attempted';

export const toExportItems = (questions: PracticeQuestion[]): ExportItem[] =>
  questions.map(q => {
    const options = parseOptions(q.options_json);
    const rationale = (q.rationale ?? '').trim();
    return {
      question: q.question_text,
      options,
      answer: q.correct_answer,
      ...(rationale ? { rationale } : {}),
      ...(q.category_name ? { category: q.category_name } : {}),
      visibility: q.visibility,
      attempt: q.attempt_correct
    };
  });

/** Page through the questions API until every match is collected (or MAX_QUESTIONS). */
export async function collectQuestions(filters: QuestionFilters): Promise<PracticeQuestion[]> {
  const collected: PracticeQuestion[] = [];
  let offset = 0;
  for (;;) {
    const { questions, total } = await getQuestions({ ...filters, limit: PAGE_SIZE, offset });
    collected.push(...questions);
    offset += PAGE_SIZE;
    if (questions.length === 0 || offset >= total || collected.length >= MAX_QUESTIONS) break;
  }
  return collected.slice(0, MAX_QUESTIONS);
}

const stamp = () => todayKey();

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const fileBase = (opts: ExportOptions) =>
  `${opts.answers ? 'studyvisual-questions' : 'studyvisual-study-sheet'}-${stamp()}`;

const sourceLabel = (visibility: ExportItem['visibility']) =>
  visibility === 'personal' ? 'Personal' : 'Community';

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const exportQuestionsJson = (items: ExportItem[], opts: ExportOptions, scope?: string) => {
  const questions = items.map((item, index) => ({
    n: index + 1,
    question: item.question,
    ...(opts.options ? { options: item.options } : {}),
    ...(opts.answers ? { answer: item.answer } : {}),
    ...(opts.tags && item.category ? { category: item.category } : {}),
    ...(opts.tags ? { source: sourceLabel(item.visibility) } : {}),
    ...(opts.result ? { result: attemptLabel(item.attempt) } : {}),
    ...(opts.rationale && item.rationale ? { explanation: item.rationale } : {})
  }));
  const payload = {
    app: 'StudyVisual',
    exportedAt: new Date().toISOString(),
    scope: scope ?? 'All',
    includes: { ...opts },
    count: items.length,
    questions
  };
  downloadBlob(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    `${fileBase(opts)}.json`
  );
};

export const exportQuestionsMarkdown = (items: ExportItem[], opts: ExportOptions, scope?: string) => {
  const title = opts.answers ? 'StudyVisual — Questions & Answers' : 'StudyVisual — Study Sheet';
  const lines: string[] = [
    `# ${title}`,
    '',
    `_Exported ${stamp()} · ${items.length} question${items.length === 1 ? '' : 's'} · ${scope ?? 'All'}_`,
    ''
  ];
  items.forEach((item, index) => {
    lines.push(`## ${index + 1}. ${item.question}`, '');
    if (opts.options && item.options.length > 0) {
      item.options.forEach((opt, i) => lines.push(`- ${ALPHA[i] ?? i + 1}. ${opt}`));
      lines.push('');
    }
    if (opts.answers) lines.push(`**Answer:** ${item.answer}`, '');
    else lines.push('**Answer:** ____________', '');
    if (opts.rationale && item.rationale) lines.push(`**Why:** ${item.rationale}`, '');
    const tags = [opts.tags ? item.category : null, opts.tags ? sourceLabel(item.visibility) : null].filter(Boolean).join(' · ');
    if (tags) lines.push(`_${tags}_`, '');
    if (opts.result) lines.push(`**Your result:** ${attemptLabel(item.attempt)}`, '');
    lines.push('---', '');
  });
  downloadBlob(
    new Blob([lines.join('\n')], { type: 'text/markdown' }),
    `${fileBase(opts)}.md`
  );
};

const csvCell = (value: string): string => `"${value.replace(/"/g, '""')}"`;

export const exportQuestionsCsv = (items: ExportItem[], opts: ExportOptions) => {
  const maxOptions = opts.options ? Math.max(0, ...items.map(i => i.options.length)) : 0;
  const header = ['#', 'Question'];
  for (let i = 0; i < maxOptions; i++) header.push(`Option ${ALPHA[i] ?? i + 1}`);
  if (opts.answers) header.push('Answer');
  if (opts.tags) header.push('Category', 'Source');
  if (opts.result) header.push('Result');
  if (opts.rationale) header.push('Explanation');

  const rows = items.map((item, index) => {
    const row: string[] = [String(index + 1), item.question];
    if (opts.options) {
      for (let i = 0; i < maxOptions; i++) row.push(item.options[i] ?? '');
      if (maxOptions === 0) row.push('');
    }
    if (opts.answers) row.push(item.answer);
    if (opts.tags) row.push(item.category ?? '', sourceLabel(item.visibility));
    if (opts.result) row.push(attemptLabel(item.attempt));
    if (opts.rationale) row.push(item.rationale ?? '');
    return row;
  });

  const csv = [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
  downloadBlob(
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    `${fileBase(opts)}.csv`
  );
};

/** jsPDF core fonts are Latin-1; transliterate the common punctuation first. */
const pdfSafe = (text: string): string => {
  const normalized = text
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013|\u2014|\u2212/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u2022|\u25CF|\u2713|\u2714/g, '-')
    .replace(/\u00A0/g, ' ');
  let out = '';
  for (const ch of normalized) {
    const code = ch.codePointAt(0) ?? 63;
    out += code <= 255 ? ch : '?';
  }
  return out;
};

export const exportQuestionsPdf = async (items: ExportItem[], opts: ExportOptions, scope?: string) => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 56;
  const width = pageWidth - margin * 2;
  let y = margin;

  const newPageIfNeeded = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeBlock = (
    text: string,
    opts: { size?: number; style?: 'normal' | 'bold' | 'italic'; color?: number[]; gap?: number } = {}
  ) => {
    const size = opts.size ?? 10;
    const style = opts.style ?? 'normal';
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    if (opts.color) doc.setTextColor(...(opts.color as [number, number, number]));
    else doc.setTextColor(30, 30, 30);
    const lines: string[] = doc.splitTextToSize(pdfSafe(text), width);
    lines.forEach(line => {
      newPageIfNeeded(size * 1.4);
      doc.text(line, margin, y);
      y += size * 1.35;
    });
    y += opts.gap ?? 4;
  };

  const title = opts.answers ? 'StudyVisual — Questions & Answers' : 'StudyVisual — Study Sheet';
  writeBlock(title, { size: 16, style: 'bold', gap: 2 });
  writeBlock(
    `Exported ${stamp()} · ${items.length} question${items.length === 1 ? '' : 's'} · ${scope ?? 'All'}`,
    { size: 9, color: [110, 110, 110], gap: 10 }
  );

  items.forEach((item, index) => {
    newPageIfNeeded(60);
    writeBlock(`${index + 1}. ${item.question}`, { size: 11, style: 'bold', gap: 3 });
    if (opts.options && item.options.length > 0) {
      item.options.forEach((opt, i) => {
        const marker = opts.answers && opt === item.answer ? '* ' : '  ';
        writeBlock(`${marker}${ALPHA[i] ?? i + 1}. ${opt}`, { size: 10, color: [60, 60, 60], gap: 1 });
      });
    }
    if (opts.answers) {
      writeBlock(`Answer: ${item.answer}`, { size: 10, style: 'bold', color: [70, 120, 70], gap: 3 });
    } else {
      writeBlock('Answer: ______________________________', { size: 10, color: [130, 130, 130], gap: 3 });
    }
    if (opts.rationale && item.rationale) {
      writeBlock(`Why: ${item.rationale}`, { size: 9, style: 'italic', color: [110, 110, 110], gap: 3 });
    }
    const tags = [
      opts.tags ? item.category : null,
      opts.tags ? sourceLabel(item.visibility) : null
    ].filter(Boolean).join(' · ');
    if (tags) writeBlock(tags, { size: 8, color: [150, 150, 150], gap: 3 });
    if (opts.result) {
      writeBlock(`Your result: ${attemptLabel(item.attempt)}`, { size: 8, color: [150, 150, 150], gap: 6 });
    }
    y += 6;
    if (index < items.length - 1 && y < pageHeight - margin) {
      doc.setDrawColor(220, 215, 210);
      doc.line(margin, y, pageWidth - margin, y);
      y += 14;
    }
  });

  doc.save(`${fileBase(opts)}.pdf`);
};
