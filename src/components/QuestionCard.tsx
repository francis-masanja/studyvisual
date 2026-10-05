import { CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import type { PracticeQuestion } from '../lib/api';

const parseOptions = (json: string | null): string[] => {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

interface QuestionCardProps {
  question: PracticeQuestion;
  isOpen: boolean;
  onToggle: () => void;
}

const QuestionCard = ({ question, isOpen, onToggle }: QuestionCardProps) => {
  const q = question;
  const options = parseOptions(q.options_json);

  return (
    <button
      onClick={onToggle}
      className={cn(
        'w-full text-left bg-cozy-card rounded-2xl border p-4 md:p-5 transition-all',
        isOpen ? 'border-cozy-primary shadow-sm' : 'border-cozy-secondary/10 hover:border-cozy-secondary/30'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold leading-snug">{q.question_text}</p>
        {q.attempt_correct !== null ? (
          q.attempt_correct
            ? <CheckCircle2 size={18} className="text-green-500 shrink-0" />
            : <XCircle size={18} className="text-red-500 shrink-0" />
        ) : (
          <MinusCircle size={18} className="text-cozy-muted shrink-0" />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-3">
        {q.visibility === 'personal' && (
          <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-cozy-primary/15 text-cozy-primary">
            Personal
          </span>
        )}
        {q.category_name && (
          <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-cozy-accent text-cozy-text">
            {q.category_name}
          </span>
        )}
        <span className={cn(
          'text-[10px] font-bold uppercase px-2 py-1 rounded-full',
          q.attempt_correct === true && 'bg-green-500/15 text-green-600',
          q.attempt_correct === false && 'bg-red-500/15 text-red-600',
          q.attempt_correct === null && 'bg-cozy-secondary/10 text-cozy-muted'
        )}>
          {q.attempt_correct === true ? 'Correct' : q.attempt_correct === false ? 'Wrong' : 'Unattempted'}
        </span>
      </div>

      {isOpen && (
        <div className="mt-4 pt-4 border-t border-cozy-secondary/10 space-y-2">
          {options.length > 0 ? options.map((opt, i) => {
            const isCorrect = opt === q.correct_answer;
            return (
              <div
                key={i}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl text-sm border',
                  isCorrect
                    ? 'border-green-500/40 bg-green-500/10 font-semibold'
                    : 'border-cozy-secondary/10 bg-cozy-bg'
                )}
              >
                <span className="font-bold">{String.fromCharCode(65 + i)}</span>
                <span className="flex-1">{opt}</span>
                {isCorrect && <CheckCircle2 size={16} className="text-green-600" />}
              </div>
            );
          }) : (
            <div className="p-3 rounded-xl bg-cozy-bg border border-cozy-secondary/10 text-sm">
              <span className="font-bold">Answer:</span> {q.correct_answer}
            </div>
          )}
          {q.rationale && (
            <p className="text-sm text-cozy-muted leading-relaxed pt-1">
              <span className="font-bold text-cozy-primary">Why:</span> {q.rationale}
            </p>
          )}
        </div>
      )}
    </button>
  );
};

export default QuestionCard;
