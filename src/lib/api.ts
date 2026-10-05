// Typed wrappers around the Vercel API endpoints (see docs/api.md).
// Kept outside components so effects can call them without tripping
// react-hooks/set-state-in-effect, and so Dashboard.tsx stays a view.

export interface Material {
  id: string;
  title: string;
  type: 'document' | 'flashcards' | 'quiz' | 'mixed';
  completion_percentage?: number | null;
  author?: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface DailyQuestion {
  id?: string;
  question_text: string;
  options_json?: string | null;
  correct_answer: string;
  category_name?: string | null;
  category_id?: string | null;
}

export interface UserStats {
  score: number;
  streak: number;
  lastPlayed: string | null;
}

export interface SessionAnswer {
  questionId: string;
  selected: string | null;
  correct: boolean;
}

export interface ChallengeSession {
  questionIds: string[];
  answers: SessionAnswer[];
  currentIndex: number;
  finished: boolean;
}

export type QuizResults = Record<string, boolean>;

export interface PracticeQuestion {
  id: string;
  question_text: string;
  options_json: string | null;
  correct_answer: string;
  rationale: string | null;
  visibility: 'personal' | 'community';
  category_id: string | null;
  category_name: string | null;
  attempt_correct: boolean | null;
}

export interface QuestionFilters {
  username?: string;
  category?: string;
  status?: 'all' | 'unattempted' | 'wrong' | 'correct';
  visibility?: 'all' | 'personal' | 'community';
  search?: string;
  limit?: number;
  offset?: number;
  ids?: string[];
}

export interface PingInfo {
  status: string;
  ai: { configured: boolean };
}

export interface GeneratedCard {
  question: string;
  options: string[];
  answer: string;
  rationale?: string;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Local calendar day key, e.g. "2026-10-05" (used for challenge sessions). */
export const todayKey = (date: Date = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

async function getJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`Request failed: ${init?.method ?? 'GET'} ${url} -> ${res.status}`);
  }
  return res.json();
}

async function postJson(url: string, body: unknown): Promise<unknown> {
  return getJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

// --- Materials / categories -------------------------------------------------

export async function getMyMaterials(username: string): Promise<Material[]> {
  const data = await getJson(`/api/materials?username=${encodeURIComponent(username)}`);
  return (data as { materials?: Material[] }).materials ?? [];
}

export async function getCommunityMaterials(): Promise<Material[]> {
  const data = await getJson('/api/materials?community=true');
  return (data as { materials?: Material[] }).materials ?? [];
}

export async function getCategories(): Promise<Category[]> {
  const data = await getJson('/api/categories');
  return (data as { categories?: Category[] }).categories ?? [];
}

export async function getDailyChallenge(username: string, categoryIds: string[] = []): Promise<DailyQuestion[]> {
  const params = new URLSearchParams({ username });
  if (categoryIds.length > 0) params.set('categories', categoryIds.join(','));
  const data = await getJson(`/api/daily-challenge?${params.toString()}`);
  return (data as { questions?: DailyQuestion[] }).questions ?? [];
}

// --- Question bank ----------------------------------------------------------

export async function getQuestions(filters: QuestionFilters = {}): Promise<{ questions: PracticeQuestion[]; total: number }> {
  const params = new URLSearchParams();
  if (filters.username) params.set('username', filters.username);
  if (filters.category) params.set('category', filters.category);
  if (filters.status) params.set('status', filters.status);
  if (filters.visibility) params.set('visibility', filters.visibility);
  if (filters.search) params.set('search', filters.search);
  if (filters.limit !== undefined) params.set('limit', String(filters.limit));
  if (filters.offset !== undefined) params.set('offset', String(filters.offset));
  if (filters.ids && filters.ids.length > 0) params.set('ids', filters.ids.join(','));
  const data = await getJson(`/api/questions?${params.toString()}`);
  const typed = data as { questions?: PracticeQuestion[]; total?: number };
  return { questions: typed.questions ?? [], total: typed.total ?? 0 };
}

// --- Library search ---------------------------------------------------------

export const SEARCH_DEBOUNCE_MS = 300;

export interface LibrarySearchResults {
  materials: Material[];
  questions: PracticeQuestion[];
}

export async function searchLibrary(
  query: string,
  username: string,
  myMaterials: Material[],
  communityMaterials: Material[]
): Promise<LibrarySearchResults> {
  const lower = query.toLowerCase();
  const mineHits = myMaterials.filter(m => m.title.toLowerCase().includes(lower));
  const mineIds = new Set(mineHits.map(m => m.id));
  const materials = [
    ...mineHits,
    ...communityMaterials.filter(m => m.title.toLowerCase().includes(lower) && !mineIds.has(m.id))
  ];
  try {
    const { questions } = await getQuestions({ username, search: query, limit: 8 });
    return { materials, questions };
  } catch (error) {
    console.error('Library search failed:', error);
    return { materials, questions: [] };
  }
}

// --- Progress persistence ---------------------------------------------------

export async function getUserStats(username: string): Promise<UserStats> {
  const data = await getJson(`/api/user-stats?username=${encodeURIComponent(username)}`);
  const typed = data as Partial<UserStats>;
  return { score: typed.score ?? 0, streak: typed.streak ?? 0, lastPlayed: typed.lastPlayed ?? null };
}

export async function saveUserStats(username: string, stats: Partial<UserStats>): Promise<UserStats> {
  const data = await postJson('/api/user-stats', { username, ...stats });
  const typed = data as Partial<UserStats>;
  return { score: typed.score ?? 0, streak: typed.streak ?? 0, lastPlayed: typed.lastPlayed ?? null };
}

export async function getChallengeSession(username: string, day: string): Promise<ChallengeSession | null> {
  const params = new URLSearchParams({ username, day });
  const data = await getJson(`/api/challenge-session?${params.toString()}`);
  const session = (data as { session?: ChallengeSession | null }).session;
  return session ?? null;
}

export async function saveChallengeSession(payload: {
  username: string;
  day: string;
  questionIds: string[];
  answers: SessionAnswer[];
  currentIndex: number;
  finished: boolean;
}): Promise<void> {
  await postJson('/api/challenge-session', payload);
}

export async function getQuizResults(username: string, materialId: string): Promise<QuizResults> {
  const params = new URLSearchParams({ username, materialId });
  const data = await getJson(`/api/quiz-results?${params.toString()}`);
  return ((data as { results?: QuizResults }).results ?? {}) as QuizResults;
}

export async function saveQuizResults(username: string, materialId: string, results: QuizResults): Promise<void> {
  await postJson('/api/quiz-results', { username, materialId, results });
}

// --- Health / AI ------------------------------------------------------------

export async function getPing(): Promise<PingInfo> {
  const data = await getJson('/api/ping');
  const typed = data as Partial<PingInfo> & { ai?: { configured?: boolean } };
  return { status: typed.status ?? 'unknown', ai: { configured: typed.ai?.configured === true } };
}

export async function aiGenerateQuestions(payload: {
  title?: string;
  notes: string;
  count?: number;
}): Promise<GeneratedCard[]> {
  const data = await postJson('/api/ai-generate', { mode: 'questions', ...payload });
  return (data as { cards?: GeneratedCard[] }).cards ?? [];
}

export async function aiRepair(payload: { rawText: string; kind: 'markdown' | 'json' }): Promise<string> {
  const data = await postJson('/api/ai-generate', { mode: 'repair', ...payload });
  return (data as { fixedText?: string }).fixedText ?? '';
}

export async function aiFillBank(payload: {
  username: string;
  categoryId?: string;
  categoryName?: string;
  count?: number;
  topic?: string;
  notes?: string;
  materialId?: string;
}): Promise<{ inserted: number; cards: GeneratedCard[] }> {
  const data = await postJson('/api/ai-generate', { mode: 'fill', ...payload });
  const typed = data as { inserted?: number; cards?: GeneratedCard[] };
  return { inserted: typed.inserted ?? 0, cards: typed.cards ?? [] };
}

export async function aiExplain(payload: {
  question: string;
  options?: string[];
  selected?: string;
  correct?: string;
  rationale?: string;
  category?: string;
}): Promise<string> {
  const data = await postJson('/api/ai-explain', payload);
  return (data as { explanation?: string }).explanation ?? '';
}

export async function aiChat(payload: {
  message: string;
  history?: ChatTurn[];
  context?: { title?: string; content?: string };
}): Promise<string> {
  const data = await postJson('/api/ai-chat', payload);
  return (data as { reply?: string }).reply ?? '';
}
