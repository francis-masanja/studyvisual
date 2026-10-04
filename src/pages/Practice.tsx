import { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { getQuestions, aiGenerateQuestions } from '../lib/api';
import { useUser } from '../hooks/useUser';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { PracticeQuestion } from '../lib/api';

// Placeholder Practice page – will be expanded in Phase E
const Practice = () => {
  const { user } = useUser();
    const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const resp = await getQuestions({});
      const all = resp.questions;
      // Simple client‑side pagination
      const start = (page - 1) * pageSize;
      const paged = all.slice(start, start + pageSize);
      setQuestions(paged);
      setLoading(false);
    };
    fetch();
  }, [page]);

  const fillWithAI = async () => {
    if (!user) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const generated: PracticeQuestion[] = await (aiGenerateQuestions as any)({ notes: '', count: pageSize });
    setQuestions(generated);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className={cn('text-3xl font-bold mb-4')}>Practice</h1>
      {loading ? (
        <div className="flex items-center space-x-2">
          <Loader2 className="animate-spin" /> Loading questions…
        </div>
      ) : (
        <div>
          {/* Simple list of question titles */}
          <ul className="space-y-2">
            {questions.map((q: PracticeQuestion, i: number) => (
              <li key={i} className="p-2 border rounded">
                {q.question_text || `Question ${i + 1}`}
              </li>
            ))}
          </ul>
          <div className="flex justify-between mt-4">
            <button
              onClick={() => setPage(p => Math.max(p - 1, 1))}
              disabled={page === 1}
              className={cn('p-2 bg-cozy-card rounded')}
            >
              <ChevronLeft size={20} /> Prev
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              className={cn('p-2 bg-cozy-card rounded')}
            >
              Next <ChevronRight size={20} />
            </button>
          </div>
          <button
            onClick={fillWithAI}
            className={cn('mt-4 p-2 bg-cozy-primary text-white rounded')}
          >
            Fill bank with AI
          </button>
        </div>
      )}
    </div>
  );
};

export default Practice;
