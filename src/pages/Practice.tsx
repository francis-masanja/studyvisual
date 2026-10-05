import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Download, FileDown, Loader2, Search, Sparkles, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useUser } from '../hooks/useUser';
import QuestionCard from '../components/QuestionCard';
import {
  getQuestions,
  getCategories,
  getMyMaterials,
  getPing,
  aiFillBank,
  SEARCH_DEBOUNCE_MS,
  type PracticeQuestion,
  type Category,
  type Material
} from '../lib/api';
import {
  collectQuestions,
  exportQuestionsCsv,
  exportQuestionsJson,
  exportQuestionsMarkdown,
  exportQuestionsPdf,
  toExportItems,
  type ExportFormat,
  type ExportOptions
} from '../lib/export';

const EXPORT_FORMATS: Array<{ value: ExportFormat; label: string }> = [
  { value: 'pdf', label: 'PDF' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'json', label: 'JSON' },
  { value: 'csv', label: 'CSV' }
];

const EXPORT_INCLUDES: Array<{ key: keyof ExportOptions; label: string }> = [
  { key: 'answers', label: 'Answer key' },
  { key: 'options', label: 'Multiple-choice options' },
  { key: 'tags', label: 'Category & source tags' },
  { key: 'result', label: 'Your attempt result' },
  { key: 'rationale', label: 'Explanations' }
];

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'All questions',
  unattempted: 'Unattempted',
  wrong: 'Previously wrong',
  correct: 'Previously correct'
};

const PAGE_SIZE = 10;

type StatusFilter = 'all' | 'unattempted' | 'wrong' | 'correct';
type VisibilityFilter = 'all' | 'personal' | 'community';
type GenMode = 'topic' | 'paste' | 'notes';

const SCOPE_OPTIONS: Array<{ value: VisibilityFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'personal', label: 'My questions' },
  { value: 'community', label: 'Community' }
];

const GEN_MODES: Array<{ value: GenMode; label: string }> = [
  { value: 'topic', label: 'Topic' },
  { value: 'paste', label: 'Paste notes' },
  { value: 'notes', label: 'My notes' }
];

const readSearchParam = () => {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('search') || '';
};

const Practice = () => {
  const { user } = useUser();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [visibility, setVisibility] = useState<VisibilityFilter>('all');
  const [searchInput, setSearchInput] = useState(readSearchParam);
  const [search, setSearch] = useState(readSearchParam);
  const [openId, setOpenId] = useState<string | null>(null);

  const [isAiConfigured, setIsAiConfigured] = useState(false);
  const [showGen, setShowGen] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [isExporting, setIsExporting] = useState<ExportFormat | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf');
  const [exportOpts, setExportOpts] = useState<ExportOptions>({
    answers: true,
    options: true,
    tags: true,
    result: false,
    rationale: true
  });
  const [genMode, setGenMode] = useState<GenMode>('topic');
  const [genTopic, setGenTopic] = useState('');
  const [genPaste, setGenPaste] = useState('');
  const [genMaterialId, setGenMaterialId] = useState('');
  const [genCategory, setGenCategory] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genNotice, setGenNotice] = useState<string | null>(null);

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(error => console.error('Error fetching categories:', error));
    getPing()
      .then(info => setIsAiConfigured(info.ai.configured))
      .catch(() => setIsAiConfigured(false));
    if (user) {
      getMyMaterials(user.username)
        .then(setMaterials)
        .catch(error => console.error('Error fetching materials:', error));
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getQuestions({
      username: user.username,
      category: category || undefined,
      status,
      visibility,
      search: search || undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE
    })
      .then(({ questions: list, total: count }) => {
        if (cancelled) return;
        setQuestions(list);
        setTotal(count);
      })
      .catch(error => console.error('Error fetching questions:', error))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, page, category, status, visibility, search, reloadKey]);

  const applyFilter = (update: { category?: string; status?: StatusFilter; visibility?: VisibilityFilter; search?: string }) => {
    if (update.category !== undefined) setCategory(update.category);
    if (update.status !== undefined) setStatus(update.status);
    if (update.visibility !== undefined) setVisibility(update.visibility);
    if (update.search !== undefined) setSearch(update.search);
    setPage(1);
    setLoading(true);
    setReloadKey(k => k + 1);
    setOpenId(null);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilter({ search: searchInput.trim() });
  };

  // Live search: filter as the user types (debounced); Enter/button still applies immediately.
  useEffect(() => {
    const query = searchInput.trim();
    if (query === search) return;
    const timer = window.setTimeout(() => {
      setSearch(query);
      setPage(1);
      setOpenId(null);
      setLoading(true);
      setReloadKey(k => k + 1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput, search]);

  const handleGenerate = () => {
    if (!user || isGenerating) return;
    if (genMode === 'topic' && genTopic.trim() === '') {
      setGenNotice('Type a topic first — e.g. "Photosynthesis" or "React hooks".');
      return;
    }
    if (genMode === 'paste' && genPaste.trim() === '') {
      setGenNotice('Paste the notes you want questions from first.');
      return;
    }
    if (genMode === 'notes' && genMaterialId === '') {
      setGenNotice('Pick one of your documents to generate from.');
      return;
    }
    const selected = categories.find(c => c.id === genCategory);
    setIsGenerating(true);
    setGenNotice(null);
    aiFillBank({
      username: user.username,
      categoryId: selected ? selected.id : undefined,
      categoryName: selected ? selected.name : undefined,
      count: PAGE_SIZE,
      topic: genMode === 'topic' ? genTopic.trim() : undefined,
      notes: genMode === 'paste' ? genPaste.trim() : undefined,
      materialId: genMode === 'notes' ? genMaterialId : undefined
    })
      .then(({ inserted }) => {
        setGenNotice(inserted > 0
          ? `Added ${inserted} question${inserted === 1 ? '' : 's'} to My questions${selected ? ` in ${selected.name}` : ''}.`
          : 'The AI did not return any usable questions — try again.');
        if (inserted > 0) {
          setShowGen(false);
          if (visibility === 'community') {
            applyFilter({ status: 'unattempted', visibility: 'personal' });
          } else {
            applyFilter({ status: 'unattempted' });
          }
        }
      })
      .catch(error => {
        console.error('AI generation failed:', error);
        setGenNotice('AI generation failed — is the AI configured in .env?');
      })
      .finally(() => setIsGenerating(false));
  };

  const scopeSummary = [
    SCOPE_OPTIONS.find(option => option.value === visibility)?.label ?? 'All',
    status === 'all' ? null : STATUS_LABELS[status],
    category ? categories.find(c => c.id === category)?.name ?? null : null,
    search ? `\u201C${search}\u201D` : null
  ]
    .filter(Boolean)
    .join(' · ');

  const toggleExportOpt = (key: keyof ExportOptions) =>
    setExportOpts(prev => ({ ...prev, [key]: !prev[key] }));

  const handleExport = () => {
    if (!user || isExporting) return;
    setShowExport(false);
    setIsExporting(exportFormat);
    collectQuestions({
      username: user.username,
      category: category || undefined,
      status,
      visibility,
      search: search || undefined
    })
      .then(async all => {
        const items = toExportItems(all);
        if (items.length === 0) {
          setGenNotice('Nothing to export with the current filters.');
          return;
        }
        if (exportFormat === 'json') exportQuestionsJson(items, exportOpts, scopeSummary);
        else if (exportFormat === 'markdown') exportQuestionsMarkdown(items, exportOpts, scopeSummary);
        else if (exportFormat === 'csv') exportQuestionsCsv(items, exportOpts);
        else await exportQuestionsPdf(items, exportOpts, scopeSummary);
        const label = EXPORT_FORMATS.find(f => f.value === exportFormat)?.label ?? exportFormat;
        const kind = exportOpts.answers ? 'answer key' : 'study sheet';
        setGenNotice(`Exported ${items.length} question${items.length === 1 ? '' : 's'} as ${label} (${kind}).`);
      })
      .catch(error => {
        console.error('Export failed:', error);
        setGenNotice('Export failed — please try again.');
      })
      .finally(() => setIsExporting(null));
  };

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div className="min-h-screen bg-cozy-bg text-cozy-text">
      <header className="border-b border-cozy-secondary/20 bg-cozy-card">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-5 flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-cozy-accent rounded-full transition-colors text-cozy-muted hover:text-cozy-text"
          >
            <ArrowLeft size={22} />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Practice</h1>
            <p className="text-sm text-cozy-muted">Drill your personal AI questions and the shared community bank.</p>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowExport(v => !v)}
              disabled={total === 0 || isExporting !== null}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-cozy-card border border-cozy-secondary/25 text-cozy-text hover:border-cozy-primary transition-all shadow-sm disabled:opacity-50"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {isExporting ? 'Exporting…' : 'Export'}
            </button>
            {showExport && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowExport(false)} />
                <div className="absolute right-0 top-full mt-2 w-72 bg-cozy-card border border-cozy-secondary/20 rounded-2xl shadow-xl p-3 z-30 space-y-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase text-cozy-muted">
                      Export · {total} matching
                    </p>
                    <p className="text-[11px] text-cozy-muted mt-0.5 break-words">{scopeSummary}</p>
                  </div>

                  <div>
                    <p className="text-[11px] font-bold uppercase text-cozy-muted mb-1.5">Format</p>
                    <div className="flex gap-1.5">
                      {EXPORT_FORMATS.map(fmt => (
                        <button
                          key={fmt.value}
                          onClick={() => setExportFormat(fmt.value)}
                          className={cn(
                            'flex-1 px-2 py-1.5 rounded-lg text-xs font-bold border transition-all',
                            exportFormat === fmt.value
                              ? 'bg-cozy-primary text-white border-cozy-primary'
                              : 'bg-cozy-bg border-cozy-secondary/20 text-cozy-muted hover:text-cozy-text'
                          )}
                        >
                          {fmt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-bold uppercase text-cozy-muted mb-1">Include</p>
                    <div className="space-y-0.5">
                      {EXPORT_INCLUDES.map(row => {
                        const checked = exportOpts[row.key];
                        return (
                          <button
                            key={row.key}
                            role="checkbox"
                            aria-checked={checked}
                            onClick={() => toggleExportOpt(row.key)}
                            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-cozy-accent text-left transition-colors"
                          >
                            <span
                              className={cn(
                                'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                                checked
                                  ? 'bg-cozy-primary border-cozy-primary text-white'
                                  : 'border-cozy-secondary/40'
                              )}
                            >
                              {checked && <Check size={11} strokeWidth={3} />}
                            </span>
                            <span className="text-sm font-medium">{row.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    onClick={handleExport}
                    disabled={isExporting !== null}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-cozy-primary text-white hover:bg-cozy-primary/90 transition-all shadow-sm disabled:opacity-60"
                  >
                    {isExporting ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <FileDown size={15} />
                    )}
                    Export {total} question{total === 1 ? '' : 's'}
                  </button>
                </div>
              </>
            )}
          </div>
          {isAiConfigured && (
            <button
              onClick={() => setShowGen(v => !v)}
              disabled={isGenerating}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all',
                showGen
                  ? 'bg-cozy-accent text-cozy-text border border-cozy-secondary/20'
                  : 'bg-cozy-primary text-white hover:bg-cozy-primary/90 shadow-sm'
              )}
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isGenerating ? 'Generating…' : 'Generate with AI'}
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-5">
        {genNotice && (
          <div className="bg-cozy-accent/40 border border-cozy-secondary/20 rounded-2xl px-4 py-3 text-sm font-medium flex items-center justify-between gap-3">
            <span>{genNotice}</span>
            <button onClick={() => setGenNotice(null)} className="text-cozy-muted hover:text-cozy-text">
              <X size={16} />
            </button>
          </div>
        )}

        {isAiConfigured && showGen && (
          <div className="bg-cozy-card rounded-3xl border border-cozy-primary/30 p-4 md:p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-bold flex items-center gap-2">
                <Sparkles size={16} className="text-cozy-primary" />
                Generate questions with AI
              </h2>
              <button
                onClick={() => setShowGen(false)}
                className="p-1.5 hover:bg-cozy-accent rounded-full text-cozy-muted"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex gap-2">
              {GEN_MODES.map(mode => (
                <button
                  key={mode.value}
                  onClick={() => setGenMode(mode.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-bold border transition-all',
                    genMode === mode.value
                      ? 'bg-cozy-primary text-white border-cozy-primary'
                      : 'bg-cozy-bg text-cozy-muted border-cozy-secondary/20 hover:border-cozy-primary'
                  )}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {genMode === 'topic' && (
              <input
                value={genTopic}
                onChange={e => setGenTopic(e.target.value)}
                placeholder="Topic, e.g. Photosynthesis, React hooks, WW2 causes…"
                className="w-full p-3 rounded-xl bg-cozy-bg border border-cozy-secondary/20 text-cozy-text focus:outline-none focus:border-cozy-primary"
              />
            )}
            {genMode === 'paste' && (
              <textarea
                value={genPaste}
                onChange={e => setGenPaste(e.target.value)}
                rows={5}
                placeholder="Paste the notes or textbook excerpt you want questions from…"
                className="w-full p-3 rounded-xl bg-cozy-bg border border-cozy-secondary/20 text-cozy-text focus:outline-none focus:border-cozy-primary resize-y"
              />
            )}
            {genMode === 'notes' && (
              materials.length === 0 ? (
                <p className="text-sm text-cozy-muted bg-cozy-bg border border-cozy-secondary/10 rounded-xl p-3">
                  You have no documents yet — upload notes first, or use Topic / Paste notes.
                </p>
              ) : (
                <select
                  value={genMaterialId}
                  onChange={e => setGenMaterialId(e.target.value)}
                  className="w-full p-3 rounded-xl bg-cozy-bg border border-cozy-secondary/20 text-cozy-text font-medium"
                >
                  <option value="">Choose a document…</option>
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>{m.title}</option>
                  ))}
                </select>
              )
            )}

            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <label className="space-y-1 flex-1">
                <span className="text-xs font-bold uppercase text-cozy-muted">Category</span>
                <select
                  value={genCategory}
                  onChange={e => setGenCategory(e.target.value)}
                  className="w-full p-3 rounded-xl bg-cozy-bg border border-cozy-secondary/20 text-cozy-text font-medium"
                >
                  <option value="">No category</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className={cn(
                  'flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all',
                  isGenerating
                    ? 'bg-cozy-accent text-cozy-muted opacity-70'
                    : 'bg-cozy-primary text-white hover:bg-cozy-primary/90 shadow-sm'
                )}
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isGenerating ? 'Generating…' : 'Generate 10 questions'}
              </button>
            </div>
          </div>
        )}

        <div className="bg-cozy-card rounded-3xl border border-cozy-secondary/10 p-4 md:p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase text-cozy-muted">Source</span>
            <div className="flex gap-1 bg-cozy-bg p-1 rounded-xl border border-cozy-secondary/20">
              {SCOPE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => applyFilter({ visibility: opt.value })}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                    visibility === opt.value
                      ? 'bg-cozy-primary text-white shadow-sm'
                      : 'text-cozy-muted hover:text-cozy-text'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-bold uppercase text-cozy-muted">Category</span>
              <select
                value={category}
                onChange={e => applyFilter({ category: e.target.value })}
                className="w-full p-3 rounded-xl bg-cozy-bg border border-cozy-secondary/20 text-cozy-text font-medium"
              >
                <option value="">All categories</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold uppercase text-cozy-muted">Status</span>
              <select
                value={status}
                onChange={e => applyFilter({ status: e.target.value as StatusFilter })}
                className="w-full p-3 rounded-xl bg-cozy-bg border border-cozy-secondary/20 text-cozy-text font-medium"
              >
                <option value="all">All questions</option>
                <option value="unattempted">Unattempted</option>
                <option value="wrong">Previously wrong</option>
                <option value="correct">Previously correct</option>
              </select>
            </label>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-cozy-muted" />
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search questions…"
                className="w-full p-3 pl-9 rounded-xl bg-cozy-bg border border-cozy-secondary/20 text-cozy-text focus:outline-none focus:border-cozy-primary"
              />
            </div>
            <button type="submit" className="px-4 py-3 rounded-xl bg-cozy-accent text-cozy-text font-bold text-sm border border-cozy-secondary/20">
              Search
            </button>
          </form>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 py-16 text-cozy-muted">
            <Loader2 className="w-6 h-6 animate-spin" /> Loading questions…
          </div>
        ) : questions.length === 0 ? (
          <div className="bg-cozy-card rounded-3xl border border-cozy-secondary/10 p-10 text-center">
            <h2 className="text-xl font-bold mb-2">No questions found</h2>
            <p className="text-cozy-muted text-sm">
              Try different filters{isAiConfigured ? ', or use ' : ''}{isAiConfigured && <span className="font-bold text-cozy-primary">Generate with AI</span>}{isAiConfigured ? ' to grow your bank.' : '.'}
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs text-cozy-muted font-semibold uppercase">
              {total} question{total === 1 ? '' : 's'} · Page {page} of {totalPages}
            </p>
            <ul className="space-y-3">
              {questions.map(q => (
                <li key={q.id}>
                  <QuestionCard
                    question={q}
                    isOpen={openId === q.id}
                    onToggle={() => setOpenId(openId === q.id ? null : q.id)}
                  />
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between pt-2 pb-6">
              <button
                onClick={() => { setPage(p => Math.max(p - 1, 1)); setLoading(true); setOpenId(null); }}
                disabled={page === 1}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-cozy-card border border-cozy-secondary/10',
                  page === 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-cozy-accent'
                )}
              >
                <ChevronLeft size={18} /> Prev
              </button>
              <button
                onClick={() => { setPage(p => p + 1); setLoading(true); setOpenId(null); }}
                disabled={page >= totalPages}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-cozy-card border border-cozy-secondary/10',
                  page >= totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-cozy-accent'
                )}
              >
                Next <ChevronRight size={18} />
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Practice;
