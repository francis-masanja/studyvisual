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
}

async function getJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`Request failed: ${init?.method ?? 'GET'} ${url} -> ${res.status}`);
  }
  return res.json();
}

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

export async function getDailyChallenge(username: string): Promise<DailyQuestion[]> {
  const data = await getJson(`/api/daily-challenge?username=${encodeURIComponent(username)}`);
  return (data as { questions?: DailyQuestion[] }).questions ?? [];
}
