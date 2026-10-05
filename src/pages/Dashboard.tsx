import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '../hooks/useUser';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, FileText, LayoutGrid, Settings, Upload as UploadIcon, X, Loader2, Users, BookOpen, Layers, Trash2, Flame, Trophy, Target, Sparkles, Search, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { parseMarkdown, parseJson, type StudyMaterial } from '../lib/parser';
import QuestionCard from '../components/QuestionCard';
import { getMyMaterials,
  getCommunityMaterials,
  getCategories,
  getDailyChallenge,
  getUserStats,
  saveUserStats,
  getChallengeSession,
  saveChallengeSession,
  getQuestions,
  searchLibrary,
  SEARCH_DEBOUNCE_MS,
  getPing,
  aiExplain,
  aiRepair,
  aiGenerateQuestions,
  aiChat,
  todayKey,
  type Material,
  type Category,
  type DailyQuestion,
  type SessionAnswer,
  type PracticeQuestion,
  type ChatTurn,
  type GeneratedCard,
} from '../lib/api';

type TabType = 'notes' | 'quizzes' | 'community';

const parseOptions = (json: string | null | undefined): string[] => {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

const toDailyQuestion = (q: PracticeQuestion): DailyQuestion => ({
  id: q.id,
  question_text: q.question_text,
  options_json: q.options_json,
  correct_answer: q.correct_answer,
  category_name: q.category_name,
  category_id: q.category_id
});

const Dashboard = () => {
  const { user, logout } = useUser();
  const navigate = useNavigate();
  
  // Data States
  const [myMaterials, setMyMaterials] = useState<Material[]>([]);
  const [communityMaterials, setCommunityMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('notes');

  // Library search (materials + questions by topic)
  const [searchQuery, setSearchQuery] = useState('');
  const [libQuery, setLibQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ materials: Material[]; questions: PracticeQuestion[] } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [openSearchQId, setOpenSearchQId] = useState<string | null>(null);
  
  // Gamification States
  const [streak, setStreak] = useState(() => parseInt(localStorage.getItem('studyvisual_streak') || '0', 10));
  const [score, setScore] = useState(() => parseInt(localStorage.getItem('studyvisual_score') || '0', 10));
  const [showDailyChallenge, setShowDailyChallenge] = useState(false);
  const [dailyQuestions, setDailyQuestions] = useState<DailyQuestion[]>([]);
  const [dailyAnswers, setDailyAnswers] = useState<SessionAnswer[]>([]);
  const [currentDailyIndex, setCurrentDailyIndex] = useState(0);
  const [dailyResults, setDailyResults] = useState<{correct: number, wrong: number, totalPoints: number}>({ correct: 0, wrong: 0, totalPoints: 0 });
  const [showDailySummary, setShowDailySummary] = useState(false);
  const [selectedDailyOption, setSelectedDailyOption] = useState<string | null>(null);
  const [isDailyAnswered, setIsDailyAnswered] = useState(false);
  const [challengeStep, setChallengeStep] = useState<'pick' | 'play'>('pick');
  const [challengeCategories, setChallengeCategories] = useState<string[]>([]);
  const [challengeNotice, setChallengeNotice] = useState<string | null>(null);
  const [dailyExplanation, setDailyExplanation] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);

  // AI (Ollama) availability — hidden when no provider is configured
  const [isAiConfigured, setIsAiConfigured] = useState(false);

  // AI actions: repair failed uploads, generate a quiz from notes, tutor chat
  const [failedFile, setFailedFile] = useState<{ name: string; text: string } | null>(null);
  const [isRepairingFile, setIsRepairingFile] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [showTutor, setShowTutor] = useState(false);
  const [tutorMessages, setTutorMessages] = useState<ChatTurn[]>([]);
  const [tutorInput, setTutorInput] = useState('');
  const [isTutorSending, setIsTutorSending] = useState(false);

  // Upload States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadTab, setUploadTab] = useState<'form' | 'file'>('form');
  const [isUploadingNotes, setIsUploadingNotes] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [bulkPaste, setBulkPaste] = useState('');
  const [isLoadingTemplate, setIsLoadingTemplate] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const notesFileInputRef = useRef<HTMLInputElement>(null);

  // Manual Form States
  const [manualQuestion, setManualQuestion] = useState('');
  const [manualOptions, setManualOptions] = useState(['', '', '', '']);
  const [manualCorrect, setManualCorrect] = useState(0);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);

  // --- Reload helpers (used by event handlers; effects call the api module directly) ---
  const reloadMyMaterials = () => {
    if (!user) return;
    getMyMaterials(user.username)
      .then(setMyMaterials)
      .catch(error => console.error("Error fetching my materials:", error))
      .finally(() => setIsLoading(false));
  };

  const reloadCommunityMaterials = () => {
    getCommunityMaterials()
      .then(setCommunityMaterials)
      .catch(error => console.error("Error fetching community materials:", error));
  };

  // Cancels in-flight searches so a slow response never overwrites a newer one.
  const searchSeqRef = useRef(0);
  const [searchFlush, setSearchFlush] = useState(0);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(prev => prev.trim());
    setSearchFlush(prev => prev + 1);
  };

  const clearLibrarySearch = () => {
    searchSeqRef.current++;
    setSearchQuery('');
    setLibQuery('');
    setSearchResults(null);
    setOpenSearchQId(null);
  };

  // --- Effects ---
  // Live library search: runs as the user types (debounced), not on submit.
  useEffect(() => {
    if (!user) return;
    const query = searchQuery.trim();
    const timer = window.setTimeout(() => {
      setLibQuery(query);
      if (query === '') {
        searchSeqRef.current++;
        setSearchResults(null);
        setOpenSearchQId(null);
        return;
      }
      const seq = ++searchSeqRef.current;
      setIsSearching(true);
      searchLibrary(query, user.username, myMaterials, communityMaterials)
        .then(results => {
          if (seq !== searchSeqRef.current) return;
          setSearchResults(results);
        })
        .catch(error => {
          console.error("Library search failed:", error);
          if (seq === searchSeqRef.current) setSearchResults({ materials: [], questions: [] });
        })
        .finally(() => {
          if (seq === searchSeqRef.current) setIsSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchQuery, searchFlush, user, myMaterials, communityMaterials]);

  useEffect(() => {
    if (user) {
      getMyMaterials(user.username)
        .then(setMyMaterials)
        .catch(error => console.error("Error fetching my materials:", error))
        .finally(() => setIsLoading(false));
    }
    getCommunityMaterials()
      .then(setCommunityMaterials)
      .catch(error => console.error("Error fetching community materials:", error));
    getCategories()
      .then(cats => {
        setCategories(cats);
        if (cats.length > 0) setSelectedCategoryId(cats[0].id);
      })
      .catch(error => console.error("Error fetching categories:", error));
  }, [user]);

  useEffect(() => {
    // Load account-synced stats, then restore today's challenge session (if any),
    // otherwise offer a fresh daily challenge (once per day).
    if (!user) return;
    const day = todayKey();
    const lastPlayedDate = new Date().toDateString();

    getUserStats(user.username)
      .then(stats => {
        setScore(stats.score);
        setStreak(stats.streak);
        localStorage.setItem('studyvisual_score', String(stats.score));
        localStorage.setItem('studyvisual_streak', String(stats.streak));
        if (stats.lastPlayed) localStorage.setItem('studyvisual_last_played', stats.lastPlayed);
        return getChallengeSession(user.username, day);
      })
      .then(session => {
        if (session && !session.finished && session.questionIds.length > 0) {
          return getQuestions({ ids: session.questionIds, limit: Math.max(session.questionIds.length, 1) })
            .then(({ questions }) => {
              const byId = new Map(questions.map(q => [q.id, q]));
              const ordered = session.questionIds
                .map(id => byId.get(id))
                .filter((q): q is PracticeQuestion => Boolean(q))
                .map(toDailyQuestion);
              if (ordered.length === 0) return;
              const correct = session.answers.filter(a => a.correct).length;
              setDailyQuestions(ordered);
              setDailyAnswers(session.answers);
              setCurrentDailyIndex(Math.min(session.currentIndex, ordered.length - 1));
              setDailyResults({ correct, wrong: session.answers.length - correct, totalPoints: correct * 10 });
              setChallengeStep('play');
              setShowDailyChallenge(true);
            });
        }

        const lastPlayed = localStorage.getItem('studyvisual_last_played');
        if (lastPlayed === lastPlayedDate) return undefined;
        // Not played yet today: open the category picker (questions load on Start)
        setChallengeStep('pick');
        setChallengeNotice(null);
        setShowDailyChallenge(true);
        return undefined;
      })
      .catch(error => console.error("Daily challenge init error:", error));
  }, [user]);

  useEffect(() => {
    getPing()
      .then(info => setIsAiConfigured(info.ai.configured))
      .catch(() => setIsAiConfigured(false));
  }, []);

  // --- Handlers ---
  const handleAddCategory = async () => {
    if (!newCategoryName) return;
    try {
      const res = await fetch('/api/create-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName })
      });
      if (res.ok) {
        const data = await res.json();
        setCategories([...categories, { id: data.id, name: data.name }]);
        setSelectedCategoryId(data.id);
        setNewCategoryName('');
        setShowAddCategory(false);
      }
    } catch(e) {
      console.error(e);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!user || !confirm("Are you sure you want to delete this material?")) return;

    try {
      const response = await fetch('/api/delete-material', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, username: user.username })
      });

      if (response.ok) {
        reloadMyMaterials();
        reloadCommunityMaterials();
      } else {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const data = await response.json();
          alert(data.error || "Failed to delete");
        } else {
          const errorText = await response.text();
          console.error("Delete error (non-JSON):", errorText);
          alert(`Server Error: ${response.status}. Please check your dev-server.`);
        }
      }
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Delete failed.");
    }
  };

  const parseStudyFile = async (text: string, filename: string): Promise<StudyMaterial> => {
    if (filename.endsWith('.md')) return parseMarkdown(text, filename);
    if (filename.endsWith('.json')) return parseJson(JSON.parse(text), filename);
    throw new Error('Unsupported file type');
  };

  type TemplateKind = 'md' | 'json' | 'quiz';

  const templatePath = (kind: TemplateKind) =>
    kind === 'md' ? '/template.md' : kind === 'quiz' ? '/template-quiz.json' : '/template.json';

  const loadTemplateText = (kind: TemplateKind): Promise<string> => {
    setIsLoadingTemplate(kind);
    return fetch(templatePath(kind))
      .then(res => {
        if (!res.ok) throw new Error(`Template fetch failed (${res.status})`);
        return res.text();
      })
      .finally(() => setIsLoadingTemplate(null));
  };

  const handleLoadNoteTemplate = (kind: 'md' | 'json') => {
    if (isLoadingTemplate) return;
    setAiNotice(null);
    setFailedFile(null);
    loadTemplateText(kind)
      .then(text => {
        setNoteContent(text);
        if (!noteTitle.trim()) {
          if (kind === 'json') {
            try {
              const parsed = JSON.parse(text) as { title?: string };
              if (parsed.title) setNoteTitle(String(parsed.title));
            } catch {
              setNoteTitle('Untitled notes');
            }
          } else {
            const heading = text.match(/^#\s+(.+)$/m);
            setNoteTitle(heading ? heading[1].trim() : 'Untitled notes');
          }
        }
      })
      .catch(error => {
        console.error('Template load failed:', error);
        setAiNotice('Could not load the template — try the download link instead.');
      });
  };

  const handleLoadBulkTemplate = (kind: TemplateKind) => {
    if (isLoadingTemplate) return;
    setAiNotice(null);
    setFailedFile(null);
    loadTemplateText(kind)
      .then(text => setBulkPaste(text))
      .catch(error => {
        console.error('Template load failed:', error);
        setAiNotice('Could not load the template — try the download link instead.');
      });
  };

  const handleBulkPasteSubmit = () => {
    if (!user || isUploadingFile || !bulkPaste.trim()) return;
    const text = bulkPaste.trim();
    const isJson = text.startsWith('{');
    const filename = isJson ? 'pasted-quiz.json' : 'pasted-notes.md';
    setFailedFile(null);
    setAiNotice(null);
    setIsUploadingFile(true);
    parseStudyFile(text, filename)
      .then(parsedData => postStudyMaterial(parsedData, selectedCategoryId))
      .then(() => {
        setIsUploading(false);
        setBulkPaste('');
      })
      .catch(error => {
        console.error('Paste upload failed:', error);
        setFailedFile({ name: filename, text });
        setAiNotice('Upload failed — check the format, or let the AI repair it.');
      })
      .finally(() => setIsUploadingFile(false));
  };

  const postStudyMaterial = async (parsedData: StudyMaterial, categoryId?: string): Promise<void> => {
    if (!user) throw new Error('Not signed in');
    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: user.username,
        title: parsedData.title,
        type: parsedData.type,
        content_json: parsedData,
        ...(categoryId ? { category_id: categoryId } : {})
      })
    });
    if (!response.ok) throw new Error(`Upload failed (${response.status})`);
    reloadMyMaterials();
    reloadCommunityMaterials();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setFailedFile(null);
    setIsUploadingFile(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      const text = (event.target?.result as string) ?? '';
      try {
        const parsedData = await parseStudyFile(text, file.name);
        await postStudyMaterial(parsedData, selectedCategoryId);
        setIsUploading(false);
      } catch (error) {
        console.error("Upload failed:", error);
        if (file.name.endsWith('.md') || file.name.endsWith('.json')) {
          setFailedFile({ name: file.name, text });
        }
        alert("Upload failed. Please check the file format.");
      } finally {
        setIsUploadingFile(false);
      }
    };

    reader.readAsText(file);
  };

  const handleNoteFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setFailedFile(null);
    setIsUploadingFile(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      const text = (event.target?.result as string) ?? '';
      try {
        const parsedData = await parseStudyFile(text, file.name);
        await postStudyMaterial(parsedData);
        setIsUploadingNotes(false);
      } catch (error) {
        console.error("Note upload failed:", error);
        if (file.name.endsWith('.md') || file.name.endsWith('.json')) {
          setFailedFile({ name: file.name, text });
        }
        alert("Upload failed. Please check the file format.");
      } finally {
        setIsUploadingFile(false);
      }
    };

    reader.readAsText(file);
  };

  const handleNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !noteTitle || !noteContent) {
      alert("Please provide a title and content.");
      return;
    }

    setIsUploadingFile(true);
    try {
      const trimmed = noteContent.trim();
      const parsedData = trimmed.startsWith('{')
        ? parseJson(JSON.parse(noteContent), noteTitle + '.json')
        : await parseMarkdown(noteContent, noteTitle + '.md');
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          title: noteTitle,
          type: parsedData.type,
          content_json: parsedData
        })
      });

      if (response.ok) {
        setIsUploadingNotes(false);
        setNoteTitle('');
        setNoteContent('');
        reloadMyMaterials();
        reloadCommunityMaterials();
      }
    } catch(err) {
      console.error(err);
      alert("Failed to save note.");
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleRepairFailedFile = () => {
    if (!failedFile || !user || isRepairingFile) return;
    const kind = failedFile.name.endsWith('.json') ? 'json' : 'markdown';
    setIsRepairingFile(true);
    setAiNotice(null);
    aiRepair({ rawText: failedFile.text, kind })
      .then(async fixed => {
        if (!fixed.trim()) throw new Error('Empty repair result');
        const parsedData = await parseStudyFile(fixed, failedFile.name);
        await postStudyMaterial(parsedData, isUploadingNotes ? undefined : selectedCategoryId);
        setFailedFile(null);
        if (isUploadingNotes) setIsUploadingNotes(false); else setIsUploading(false);
      })
      .catch(error => {
        console.error('AI repair failed:', error);
        setAiNotice('AI repair failed — check that the AI is configured in .env.');
      })
      .finally(() => setIsRepairingFile(false));
  };

  const handleGenerateQuizFromNotes = () => {
    if (!noteContent.trim() || !user || isGeneratingQuiz) return;
    setIsGeneratingQuiz(true);
    setAiNotice(null);
    aiGenerateQuestions({ notes: noteContent, title: noteTitle || undefined, count: 10 })
      .then(async (cards: GeneratedCard[]) => {
        if (cards.length === 0) {
          setAiNotice('The AI returned no usable questions — try again or add more detail to your notes.');
          return;
        }
        const quiz: StudyMaterial = {
          type: 'quiz',
          title: noteTitle ? `${noteTitle} — AI Quiz` : 'AI Generated Quiz',
          cards: cards.map(card => ({
            id: Math.random().toString(36).substring(2) + Date.now().toString(36),
            question: card.question,
            answer: card.answer,
            options: card.options,
            rationale: card.rationale
          }))
        };
        await postStudyMaterial(quiz, selectedCategoryId);
        setIsUploadingNotes(false);
        setNoteTitle('');
        setNoteContent('');
        alert(`Generated ${cards.length} questions and saved them to your library.`);
      })
      .catch(error => {
        console.error('AI quiz generation failed:', error);
        setAiNotice('AI generation failed — check that the AI is configured in .env.');
      })
      .finally(() => setIsGeneratingQuiz(false));
  };

  const sendTutorMessage = () => {
    const message = tutorInput.trim();
    if (!message || isTutorSending) return;
    const history = tutorMessages;
    const nextMessages: ChatTurn[] = [...history, { role: 'user', content: message }];
    setTutorMessages(nextMessages);
    setTutorInput('');
    setIsTutorSending(true);
    aiChat({ message, history })
      .then(reply => {
        setTutorMessages([...nextMessages, { role: 'assistant', content: reply }]);
      })
      .catch(error => {
        console.error('AI tutor failed:', error);
        setTutorMessages([...nextMessages, { role: 'assistant', content: 'Sorry — the tutor is unavailable right now. Check that the AI is configured in .env.' }]);
      })
      .finally(() => setIsTutorSending(false));
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !manualQuestion || manualOptions.some(o => !o)) {
      alert("Please fill in all options and the question.");
      return;
    }

    setIsUploadingFile(true);
    const card = {
      id: Math.random().toString(36).substring(2) + Date.now().toString(36),
      question: manualQuestion,
      answer: manualOptions[manualCorrect],
      options: manualOptions
    };

    const parsedData = {
      title: `Quick Question - ${new Date().toLocaleDateString()}`,
      type: 'quiz',
      cards: [card]
    };

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          title: parsedData.title,
          type: parsedData.type,
          content_json: parsedData,
          category_id: selectedCategoryId
        })
      });
      if (response.ok) {
        setIsUploading(false);
        reloadMyMaterials();
        reloadCommunityMaterials();
        setManualQuestion('');
        setManualOptions(['', '', '', '']);
        setManualCorrect(0);
      }
    } catch(err) {
      console.error(err);
      alert("Failed to submit question.");
    } finally {
      setIsUploadingFile(false);
    }
  };

  const persistSession = (answers: SessionAnswer[], currentIndex: number, finished: boolean) => {
    if (!user || dailyQuestions.length === 0) return;
    saveChallengeSession({
      username: user.username,
      day: todayKey(),
      questionIds: dailyQuestions.map(q => q.id ?? '').filter(id => id !== ''),
      answers,
      currentIndex,
      finished
    }).catch(error => console.error("Failed to save challenge session:", error));
  };

  const explainDailyAnswer = () => {
    const question = dailyQuestions[currentDailyIndex];
    if (!question || isExplaining) return;
    setIsExplaining(true);
    setDailyExplanation(null);
    aiExplain({
      question: question.question_text,
      options: parseOptions(question.options_json),
      selected: selectedDailyOption ?? undefined,
      correct: question.correct_answer,
      category: question.category_name ?? undefined
    })
      .then(text => setDailyExplanation(text))
      .catch(error => setDailyExplanation(`AI unavailable: ${error instanceof Error ? error.message : String(error)}`))
      .finally(() => setIsExplaining(false));
  };

  const startChallenge = (categoryIds: string[]) => {
    if (!user) return;
    setChallengeNotice(null);
    getDailyChallenge(user.username, categoryIds)
      .then(questions => {
        if (questions.length === 0) {
          setChallengeNotice('No questions in these categories yet. Try another category or generate some with AI on the Practice page.');
          return;
        }
        setDailyQuestions(questions);
        setDailyAnswers([]);
        setCurrentDailyIndex(0);
        setDailyResults({ correct: 0, wrong: 0, totalPoints: 0 });
        setSelectedDailyOption(null);
        setIsDailyAnswered(false);
        setShowDailySummary(false);
        setChallengeStep('play');
      })
      .catch(error => {
        console.error("Challenge fetch error:", error);
        setChallengeNotice('Could not load questions. Please try again.');
      });
  };

  const handleDailyAnswer = async (selectedAns: string) => {
    if (isDailyAnswered) return;

    const question = dailyQuestions[currentDailyIndex];
    const isCorrect = selectedAns === question.correct_answer;
    const isLast = currentDailyIndex >= dailyQuestions.length - 1;
    const nextIndex = isLast ? currentDailyIndex : currentDailyIndex + 1;

    setSelectedDailyOption(selectedAns);
    setIsDailyAnswered(true);
    setDailyExplanation(null);

    // Update session results
    const nextAnswers: SessionAnswer[] = [
      ...dailyAnswers,
      { questionId: question.id ?? '', selected: selectedAns, correct: isCorrect }
    ];
    setDailyAnswers(nextAnswers);
    setDailyResults(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      wrong: prev.wrong + (isCorrect ? 0 : 1),
      totalPoints: prev.totalPoints + (isCorrect ? 10 : 0)
    }));

    // Persist the session so a reload resumes exactly here
    persistSession(nextAnswers, nextIndex, isLast);

    // Record in DB
    if (user && question.id) {
      fetch('/api/record-attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          questionId: question.id,
          isCorrect
        })
      }).catch(error => console.error("Failed to record attempt:", error));
    }

    const finalScore = isCorrect ? score + 10 : score;
    if (isCorrect) {
      setScore(finalScore);
      localStorage.setItem('studyvisual_score', finalScore.toString());
    }

    // Auto-advance or show summary after delay
    setTimeout(() => {
      if (!isLast) {
        setCurrentDailyIndex(nextIndex);
        setSelectedDailyOption(null);
        setIsDailyAnswered(false);
      } else {
        // Finished all questions
        const today = new Date().toDateString();
        localStorage.setItem('studyvisual_last_played', today);

        const finalStreak = streak + 1;
        setStreak(finalStreak);
        localStorage.setItem('studyvisual_streak', finalStreak.toString());

        if (user) {
          saveUserStats(user.username, { score: finalScore, streak: finalStreak, lastPlayed: today })
            .then(stats => {
              setScore(stats.score);
              setStreak(stats.streak);
              localStorage.setItem('studyvisual_score', String(stats.score));
              localStorage.setItem('studyvisual_streak', String(stats.streak));
            })
            .catch(error => console.error("Failed to save stats:", error));
        }

        setShowDailySummary(true);
      }
    }, 1500);
  };

  const displayedMaterials = activeTab === 'notes' 
    ? myMaterials.filter(m => m.type === 'document' || m.type === 'flashcards' || m.type === 'mixed')
    : activeTab === 'quizzes'
      ? myMaterials.filter(m => m.type === 'quiz' || m.type === 'mixed')
      : communityMaterials;

  return (
    <div className="min-h-screen bg-cozy-bg text-cozy-text flex pb-20 md:pb-0 relative z-0">
      <div className="fixed inset-0 pointer-events-none opacity-[0.15] z-[-1]" style={{ backgroundImage: "url('/math-pattern.svg')", backgroundRepeat: 'repeat' }} />
      
      <aside className="hidden md:flex w-64 bg-cozy-card border-r border-cozy-secondary/20 flex-col fixed inset-y-0 z-10">
        <div className="p-6 border-b border-cozy-secondary/20">
          <h2 className="text-xl font-bold text-cozy-primary flex items-center gap-2">
            <img src="/logo.png" alt="Logo" className="w-6 h-6 object-contain" />
            StudyVisual
          </h2>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <SidebarItem icon={<LayoutGrid size={20} />} label="My Library" active />
          <SidebarItem icon={<Target size={20} />} label="Practice" onClick={() => navigate('/practice')} />
          <SidebarItem icon={<Settings size={20} />} label="Settings" onClick={() => navigate('/settings')} />
        </nav>

        <div className="p-4 border-t border-cozy-secondary/20">
          <div className="flex justify-between items-center bg-cozy-accent/50 p-3 rounded-xl mb-4">
            <div className="flex flex-col items-center flex-1 border-r border-cozy-secondary/20">
              <Flame className="w-5 h-5 text-orange-500 mb-1" />
              <span className="text-xs font-bold">{streak} Day</span>
            </div>
            <div className="flex flex-col items-center flex-1">
              <Trophy className="w-5 h-5 text-yellow-500 mb-1" />
              <span className="text-xs font-bold">{score} Pts</span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-cozy-accent rounded-xl mb-4">
            <div className="w-10 h-10 bg-cozy-primary rounded-full flex items-center justify-center text-white font-bold">
              {user?.username?.[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate text-cozy-text">{user?.username}</p>
              <p className="text-xs text-cozy-muted">Free Plan</p>
            </div>
          </div>
          <button onClick={logout} className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600 transition-colors w-full px-3">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto">
        <header className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 gap-4 pt-4 md:pt-0">
          <div>
            <h1 className="text-3xl font-bold text-cozy-text flex items-center gap-2">
              <img src="/logo.png" alt="Logo" className="w-8 h-8 md:hidden object-contain" />
              Library
            </h1>
            <p className="text-cozy-muted">Manage your study materials and explore community quizzes.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <button 
              onClick={() => { setIsUploading(true); setUploadTab('form'); setFailedFile(null); setAiNotice(null); }}
              className="bg-cozy-accent text-cozy-text border border-cozy-secondary/20 px-6 py-3 md:py-2 rounded-xl flex items-center justify-center gap-2 hover:bg-cozy-secondary/10 transition-all shadow-sm w-full md:w-auto"
            >
              <Plus size={20} /> Donate Question
            </button>
            <button 
              onClick={() => { setIsUploadingNotes(true); setFailedFile(null); setAiNotice(null); }}
              className="bg-cozy-primary text-white px-6 py-3 md:py-2 rounded-xl flex items-center justify-center gap-2 hover:bg-cozy-primary/90 transition-all shadow-lg w-full md:w-auto"
            >
              <UploadIcon size={20} /> Upload Notes
            </button>
          </div>
        </header>

        <form onSubmit={handleSearchSubmit} className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cozy-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search materials and questions by topic…"
              className="w-full p-3.5 pl-11 rounded-xl bg-cozy-card border border-cozy-secondary/20 text-cozy-text focus:outline-none focus:border-cozy-primary shadow-sm"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="px-5 rounded-xl bg-cozy-primary text-white font-bold text-sm flex items-center gap-2 hover:bg-cozy-primary/90 transition-all shadow-sm disabled:opacity-70"
          >
            {isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
            Search
          </button>
          {libQuery && (
            <button
              type="button"
              onClick={clearLibrarySearch}
              className="px-4 rounded-xl bg-cozy-card border border-cozy-secondary/20 text-cozy-muted hover:text-cozy-text font-bold text-sm"
            >
              Clear
            </button>
          )}
        </form>

        <div className="md:hidden flex justify-around items-center bg-cozy-card border border-cozy-secondary/20 p-4 rounded-2xl mb-6 shadow-sm">
           <div className="flex flex-col items-center">
              <Flame className="w-6 h-6 text-orange-500 mb-1" />
              <span className="text-sm font-bold">{streak} Day Streak</span>
            </div>
            <div className="h-10 w-px bg-cozy-secondary/20" />
            <div className="flex flex-col items-center">
              <Trophy className="w-6 h-6 text-yellow-500 mb-1" />
              <span className="text-sm font-bold">{score} Total Pts</span>
            </div>
        </div>

        {libQuery && (isSearching || searchResults) ? (
          <section className="pb-8 space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold">
                Results for <span className="text-cozy-primary">&ldquo;{libQuery}&rdquo;</span>
              </h2>
              <button
                onClick={() => navigate(`/practice?search=${encodeURIComponent(libQuery)}`)}
                className="flex items-center gap-2 text-sm font-bold text-cozy-primary hover:underline"
              >
                Open in Practice <ArrowRight size={16} />
              </button>
            </div>

            {isSearching || !searchResults ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="w-8 h-8 text-cozy-primary animate-spin" />
              </div>
            ) : (
              <>
                <div>
                  <h3 className="text-xs font-bold uppercase text-cozy-muted mb-3">
                    Materials ({searchResults.materials.length})
                  </h3>
                  {searchResults.materials.length === 0 ? (
                    <p className="text-sm text-cozy-muted bg-cozy-card border border-cozy-secondary/10 rounded-2xl p-4">
                      No materials match this search.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                      {searchResults.materials.map(m => (
                        <MaterialCard
                          key={m.id}
                          title={m.title}
                          type={m.type === 'document' ? 'Document' : m.type === 'quiz' ? 'Quiz' : m.type === 'flashcards' ? 'Notes' : 'Mixed'}
                          progress={m.completion_percentage || 0}
                          author={m.author}
                          onClick={() => navigate(`/visualizer/${m.id}`)}
                          onDelete={myMaterials.some(mine => mine.id === m.id) ? (e) => handleDelete(e, m.id) : undefined}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-xs font-bold uppercase text-cozy-muted mb-3">
                    Questions ({searchResults.questions.length})
                  </h3>
                  {searchResults.questions.length === 0 ? (
                    <p className="text-sm text-cozy-muted bg-cozy-card border border-cozy-secondary/10 rounded-2xl p-4">
                      No questions match this search.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {searchResults.questions.map(q => (
                        <li key={q.id}>
                          <QuestionCard
                            question={q}
                            isOpen={openSearchQId === q.id}
                            onToggle={() => setOpenSearchQId(openSearchQId === q.id ? null : q.id)}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </section>
        ) : (
          <>
        <div className="flex gap-2 overflow-x-auto pb-4 mb-4 hide-scrollbar">
          <TabButton active={activeTab === 'community'} onClick={() => setActiveTab('community')} icon={<Users size={18} />} label="Community Quizzes" />
          <TabButton active={activeTab === 'notes'} onClick={() => setActiveTab('notes')} icon={<BookOpen size={18} />} label="My Notes" />
          <TabButton active={activeTab === 'quizzes'} onClick={() => setActiveTab('quizzes')} icon={<Layers size={18} />} label="My Quizzes" />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-cozy-primary animate-spin" />
          </div>
        ) : displayedMaterials.length === 0 ? (
          <div className="bg-cozy-card rounded-3xl p-10 md:p-20 text-center border border-cozy-secondary/10 flex flex-col items-center">
            <div className="w-20 h-20 bg-cozy-accent rounded-full flex items-center justify-center mb-6">
              <FileText className="text-cozy-primary w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-cozy-text">Nothing here yet</h2>
            <p className="text-cozy-muted mb-8 max-w-sm">
              {activeTab === 'community' ? "No one has uploaded quizzes yet." : "Upload your first study material to see the magic happen."}
            </p>
            {activeTab !== 'community' && (
              <button 
                onClick={() => { setIsUploadingNotes(true); setFailedFile(null); setAiNotice(null); }}
                className="bg-cozy-primary text-white px-8 py-3 rounded-xl font-bold"
              >
                Get Started
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {displayedMaterials.map((m) => (
              <MaterialCard 
                key={m.id}
                title={m.title} 
                type={m.type === 'document' ? 'Document' : m.type === 'quiz' ? 'Quiz' : m.type === 'flashcards' ? 'Notes' : 'Mixed'} 
                progress={m.completion_percentage || 0} 
                author={m.author}
                onClick={() => navigate(`/visualizer/${m.id}`)}
                onDelete={activeTab !== 'community' ? (e) => handleDelete(e, m.id) : undefined}
              />
            ))}
          </div>
        )}
          </>
        )}

        {isUploadingNotes && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
            <div className="bg-cozy-card w-full max-w-xl rounded-3xl p-6 md:p-8 shadow-2xl relative animate-in zoom-in-95 duration-200 border border-cozy-secondary/20 max-h-[90vh] overflow-y-auto">
              <button 
                onClick={() => setIsUploadingNotes(false)}
                className="absolute top-4 right-4 md:top-6 md:right-6 p-2 hover:bg-cozy-accent rounded-full text-cozy-muted"
              >
                <X size={20} />
              </button>
              
              <h2 className="text-2xl font-bold mb-6 text-cozy-text">Upload Study Notes</h2>

              <div className="space-y-6">
                <div 
                  onClick={() => notesFileInputRef.current?.click()}
                  className="border-2 border-dashed border-cozy-secondary/30 rounded-2xl p-6 flex flex-col items-center justify-center text-center hover:border-cozy-primary transition-colors cursor-pointer group bg-cozy-accent/20"
                >
                  <div className="w-12 h-12 bg-cozy-accent rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    {isUploadingFile ? (
                      <Loader2 className="text-cozy-primary w-6 h-6 animate-spin" />
                    ) : (
                      <UploadIcon className="text-cozy-primary w-6 h-6" />
                    )}
                  </div>
                  <p className="font-semibold text-cozy-text">
                    {isUploadingFile ? "Processing..." : "Upload .md or .json file"}
                  </p>
                  <input 
                    type="file" 
                    ref={notesFileInputRef}
                    className="hidden" 
                    accept=".md,.json" 
                    onChange={handleNoteFileUpload}
                    disabled={isUploadingFile}
                  />
                </div>

                  <p className="text-xs text-cozy-muted text-center -mt-2">
                    Need the format?{' '}
                    <a href="/template.md" download className="text-cozy-primary font-semibold underline underline-offset-2 hover:opacity-80">Markdown template</a>
                    {' · '}
                    <a href="/template.json" download className="text-cozy-primary font-semibold underline underline-offset-2 hover:opacity-80">JSON template</a>
                  </p>

                  {failedFile && isAiConfigured && (
                    <div className="bg-cozy-accent/40 border border-cozy-secondary/20 rounded-2xl p-4 space-y-3">
                      <p className="text-sm font-semibold text-cozy-text">
                        Couldn't parse <span className="font-mono">{failedFile.name}</span>. Let the AI repair the format?
                      </p>
                      <button
                        onClick={handleRepairFailedFile}
                        disabled={isRepairingFile}
                        className="w-full py-2.5 rounded-xl bg-cozy-primary text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        {isRepairingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {isRepairingFile ? 'Repairing…' : 'Fix format with AI & upload'}
                      </button>
                      <button
                        onClick={() => setFailedFile(null)}
                        className="w-full text-xs text-cozy-muted hover:text-cozy-text"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}


                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-cozy-secondary/20"></span></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-cozy-card px-2 text-cozy-muted font-bold">Or paste content</span></div>
                </div>

                <form onSubmit={handleNoteSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-cozy-muted mb-1">Title</label>
                    <input 
                      required
                      type="text"
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      className="w-full p-3 rounded-xl border border-cozy-secondary/20 bg-cozy-bg text-cozy-text focus:outline-none focus:border-cozy-primary"
                      placeholder="e.g., Biology Chapter 1"
                    />
                  </div>
                  <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <label className="text-sm font-bold text-cozy-muted">Markdown / JSON Content</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleLoadNoteTemplate('md')}
                        disabled={isLoadingTemplate !== null}
                        className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-cozy-accent text-cozy-text border border-cozy-secondary/20 hover:bg-cozy-secondary/10 transition-all disabled:opacity-60"
                      >
                        {isLoadingTemplate === 'md' ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                        Use .md template
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLoadNoteTemplate('json')}
                        disabled={isLoadingTemplate !== null}
                        className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-cozy-accent text-cozy-text border border-cozy-secondary/20 hover:bg-cozy-secondary/10 transition-all disabled:opacity-60"
                      >
                        {isLoadingTemplate === 'json' ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                        Use .json template
                      </button>
                    </div>
                  </div>
                    <textarea 
                      required
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      className="w-full p-3 rounded-xl border border-cozy-secondary/20 bg-cozy-bg text-cozy-text resize-none focus:outline-none focus:border-cozy-primary font-mono text-sm"
                      placeholder="# Your Topic\n\nContent here..."
                      rows={8}
                    />
                  </div>
                  {aiNotice && (
                    <p className="text-xs font-semibold text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                      {aiNotice}
                    </p>
                  )}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button 
                      type="submit" 
                      disabled={isUploadingFile}
                      className="flex-1 bg-cozy-primary text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {isUploadingFile ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                      Save to My Library
                    </button>
                    {isAiConfigured && (
                      <button
                        type="button"
                        onClick={handleGenerateQuizFromNotes}
                        disabled={isGeneratingQuiz || isUploadingFile}
                        className="flex-1 bg-cozy-accent text-cozy-text border border-cozy-secondary/20 py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-cozy-secondary/10 transition-all"
                      >
                        {isGeneratingQuiz ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                        {isGeneratingQuiz ? 'Generating…' : 'Generate MCQs with AI'}
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {isUploading && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
            <div className="bg-cozy-card w-full max-w-xl rounded-3xl p-6 md:p-8 shadow-2xl relative animate-in zoom-in-95 duration-200 border border-cozy-secondary/20 max-h-[90vh] overflow-y-auto">
              <button 
                onClick={() => setIsUploading(false)}
                className="absolute top-4 right-4 md:top-6 md:right-6 p-2 hover:bg-cozy-accent rounded-full text-cozy-muted"
              >
                <X size={20} />
              </button>
              
              <h2 className="text-2xl font-bold mb-6 text-cozy-text">Donate Questions</h2>

              <div className="space-y-4 mb-8 bg-cozy-accent/30 p-4 rounded-2xl">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-cozy-muted">Select Category</label>
                  <button 
                    onClick={() => setShowAddCategory(!showAddCategory)}
                    className="text-xs text-cozy-primary font-bold hover:underline"
                  >
                    {showAddCategory ? "Cancel" : "+ Add New Category"}
                  </button>
                </div>
                
                {showAddCategory ? (
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Category Name"
                      className="flex-1 p-2 rounded-xl bg-cozy-bg border border-cozy-secondary/20 text-sm"
                    />
                    <button onClick={handleAddCategory} className="bg-cozy-primary text-white px-4 rounded-xl text-sm font-bold">Add</button>
                  </div>
                ) : (
                  <select 
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    className="w-full p-3 rounded-xl bg-cozy-bg border border-cozy-secondary/20 text-cozy-text font-medium"
                  >
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
              </div>

              <div className="flex gap-4 mb-6 border-b border-cozy-secondary/20 pb-2">
                <button 
                  onClick={() => setUploadTab('form')}
                  className={cn("pb-2 font-bold transition-colors", uploadTab === 'form' ? "text-cozy-primary border-b-2 border-cozy-primary" : "text-cozy-muted")}
                >
                  Single MCQ
                </button>
                <button 
                  onClick={() => setUploadTab('file')}
                  className={cn("pb-2 font-bold transition-colors", uploadTab === 'file' ? "text-cozy-primary border-b-2 border-cozy-primary" : "text-cozy-muted")}
                >
                  Bulk MCQ Upload
                </button>
              </div>

              {uploadTab === 'file' ? (
                <div>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-cozy-secondary/30 rounded-2xl p-8 md:p-12 flex flex-col items-center justify-center text-center hover:border-cozy-primary transition-colors cursor-pointer group bg-cozy-accent/20"
                  >
                    <div className="w-16 h-16 bg-cozy-accent rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      {isUploadingFile ? (
                        <Loader2 className="text-cozy-primary w-8 h-8 animate-spin" />
                      ) : (
                        <UploadIcon className="text-cozy-primary w-8 h-8" />
                      )}
                    </div>
                    <p className="font-semibold text-lg text-cozy-text">
                      {isUploadingFile ? "Processing..." : "Click to bulk upload"}
                    </p>
                    <p className="text-sm text-cozy-muted mt-2">Markdown (.md) or JSON (.json)</p>
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      className="hidden" 
                      accept=".md,.json" 
                      onChange={handleFileUpload}
                      disabled={isUploadingFile}
                    />
                  </div>
                  <p className="text-xs text-cozy-muted text-center mt-3">
                    Need the format?{' '}
                    <a href="/template-quiz.json" download className="text-cozy-primary font-semibold underline underline-offset-2 hover:opacity-80">Quiz JSON</a>
                    {' · '}
                    <a href="/template.json" download className="text-cozy-primary font-semibold underline underline-offset-2 hover:opacity-80">Notes JSON</a>
                    {' · '}
                    <a href="/template.md" download className="text-cozy-primary font-semibold underline underline-offset-2 hover:opacity-80">Markdown</a>
                  </p>

                  <div className="mt-4 border border-cozy-secondary/20 rounded-2xl p-4 space-y-3 bg-cozy-accent/20">
                    <p className="text-sm font-bold text-cozy-text">Or paste content directly</p>
                    <textarea
                      value={bulkPaste}
                      onChange={(e) => setBulkPaste(e.target.value)}
                      className="w-full p-3 rounded-xl border border-cozy-secondary/20 bg-cozy-bg text-cozy-text resize-none focus:outline-none focus:border-cozy-primary font-mono text-sm"
                      placeholder={'Paste quiz JSON or Markdown here…\n\n{\n  "title": "…",\n  "cards": [ … ]\n}'}
                      rows={5}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleLoadBulkTemplate('quiz')}
                        disabled={isLoadingTemplate !== null}
                        className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-cozy-card text-cozy-text border border-cozy-secondary/20 hover:bg-cozy-secondary/10 transition-all disabled:opacity-60"
                      >
                        {isLoadingTemplate === 'quiz' ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                        Use quiz template
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLoadBulkTemplate('md')}
                        disabled={isLoadingTemplate !== null}
                        className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-cozy-card text-cozy-text border border-cozy-secondary/20 hover:bg-cozy-secondary/10 transition-all disabled:opacity-60"
                      >
                        {isLoadingTemplate === 'md' ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                        Use MD template
                      </button>
                      <button
                        type="button"
                        onClick={handleBulkPasteSubmit}
                        disabled={isUploadingFile || !bulkPaste.trim()}
                        className="ml-auto flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl bg-cozy-primary text-white hover:bg-cozy-primary/90 transition-all disabled:opacity-50"
                      >
                        {isUploadingFile ? <Loader2 size={13} className="animate-spin" /> : <UploadIcon size={13} />}
                        Upload pasted content
                      </button>
                    </div>
                    {aiNotice && (
                      <p className="text-xs font-semibold text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                        {aiNotice}
                      </p>
                    )}
                  </div>

                  {failedFile && isAiConfigured && (
                    <div className="bg-cozy-accent/40 border border-cozy-secondary/20 rounded-2xl p-4 space-y-3 mt-3">
                      <p className="text-sm font-semibold text-cozy-text">
                        Couldn't parse <span className="font-mono">{failedFile.name}</span>. Let the AI repair the format?
                      </p>
                      <button
                        onClick={handleRepairFailedFile}
                        disabled={isRepairingFile}
                        className="w-full py-2.5 rounded-xl bg-cozy-primary text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        {isRepairingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {isRepairingFile ? 'Repairing…' : 'Fix format with AI & upload'}
                      </button>
                      <button
                        onClick={() => setFailedFile(null)}
                        className="w-full text-xs text-cozy-muted hover:text-cozy-text"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-cozy-muted mb-1">Question</label>
                    <textarea 
                      required
                      value={manualQuestion}
                      onChange={(e) => setManualQuestion(e.target.value)}
                      className="w-full p-3 rounded-xl border border-cozy-secondary/20 bg-cozy-bg text-cozy-text resize-none focus:outline-none focus:border-cozy-primary"
                      placeholder="What is the powerhouse of the cell?"
                      rows={3}
                    />
                  </div>
                  
                  <div className="space-y-3">
                    <label className="block text-sm font-bold text-cozy-muted mb-1">Options (Correct one is selected)</label>
                    {manualOptions.map((opt, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <input 
                          type="radio" 
                          name="correctOption" 
                          checked={manualCorrect === i}
                          onChange={() => setManualCorrect(i)}
                          className="w-5 h-5 accent-cozy-primary"
                        />
                        <input 
                          type="text" 
                          required
                          value={opt}
                          onChange={(e) => {
                            const newOpts = [...manualOptions];
                            newOpts[i] = e.target.value;
                            setManualOptions(newOpts);
                          }}
                          className={cn("flex-1 p-3 rounded-xl border focus:outline-none focus:border-cozy-primary text-cozy-text", manualCorrect === i ? "border-cozy-primary bg-cozy-accent/30 font-semibold" : "border-cozy-secondary/20 bg-cozy-bg")}
                          placeholder={`Option ${String.fromCharCode(65+i)}`}
                        />
                      </div>
                    ))}
                  </div>

                  <button 
                    type="submit" 
                    disabled={isUploadingFile}
                    className="w-full mt-6 bg-cozy-primary text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                  >
                    {isUploadingFile ? <Loader2 className="w-5 h-5 animate-spin" /> : <Target className="w-5 h-5" />}
                    Donate Question
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {showDailyChallenge && (challengeStep === 'pick' || dailyQuestions.length > 0) && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[70] animate-in fade-in duration-300">
            <div className="bg-cozy-card w-full max-w-lg rounded-3xl shadow-2xl relative border border-cozy-secondary/20 overflow-hidden animate-in zoom-in-90 duration-300 delay-100">
              {challengeStep === 'pick' ? (
                <div className="p-6 md:p-8 relative">
                  <button 
                    onClick={() => setShowDailyChallenge(false)}
                    className="absolute top-4 right-4 p-2 hover:bg-cozy-accent rounded-full text-cozy-muted"
                  >
                    <X size={20} />
                  </button>
                  <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-16 h-16 bg-cozy-primary rounded-full flex items-center justify-center shadow-lg shadow-cozy-primary/30 mb-4">
                      <Flame className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-extrabold text-cozy-text leading-tight">Daily Challenge</h2>
                    <p className="text-cozy-muted text-sm mt-1">Pick the categories you want to be quizzed on.</p>
                  </div>

                  <div className="flex flex-wrap gap-2 justify-center mb-4">
                    <button
                      onClick={() => setChallengeCategories([])}
                      className={cn(
                        "px-4 py-2 rounded-full text-xs font-bold border transition-all",
                        challengeCategories.length === 0
                          ? "bg-cozy-primary text-white border-cozy-primary"
                          : "bg-cozy-bg text-cozy-muted border-cozy-secondary/20 hover:border-cozy-primary"
                      )}
                    >
                      All categories
                    </button>
                    {categories.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setChallengeCategories(prev =>
                          prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                        )}
                        className={cn(
                          "px-4 py-2 rounded-full text-xs font-bold border transition-all",
                          challengeCategories.includes(cat.id)
                            ? "bg-cozy-primary text-white border-cozy-primary"
                            : "bg-cozy-bg text-cozy-muted border-cozy-secondary/20 hover:border-cozy-primary"
                        )}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>

                  {challengeNotice && (
                    <p className="text-center text-xs text-orange-600 bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 mb-4">
                      {challengeNotice}
                    </p>
                  )}

                  <button
                    onClick={() => startChallenge(challengeCategories)}
                    className="w-full bg-cozy-primary text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-cozy-primary/30 hover:scale-[1.02] transition-transform active:scale-[0.98]"
                  >
                    Start Challenge
                  </button>
                </div>
              ) : !showDailySummary ? (
                <>
                  <div className="bg-cozy-primary/10 p-6 md:p-8 flex flex-col items-center border-b border-cozy-secondary/10 relative">
                    <button 
                      onClick={() => setShowDailyChallenge(false)}
                      className="absolute top-4 right-4 p-2 hover:bg-cozy-accent rounded-full text-cozy-muted"
                    >
                      <X size={20} />
                    </button>
                    <div className="w-16 h-16 bg-cozy-primary rounded-full flex items-center justify-center shadow-lg shadow-cozy-primary/30 mb-4">
                      <Flame className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-extrabold text-cozy-text text-center leading-tight">Daily Challenge ({dailyQuestions.length} Qns)</h2>
                    <p className="text-cozy-primary font-bold mt-1 uppercase tracking-tighter text-xs">Question {currentDailyIndex + 1} of {dailyQuestions.length}</p>
                  </div>

                  <div className="p-6 md:p-8">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="bg-cozy-accent px-3 py-1 rounded-full text-[10px] font-bold text-cozy-primary uppercase">
                        {dailyQuestions[currentDailyIndex].category_name || 'General'}
                      </span>
                    </div>
                    <p className="text-lg md:text-xl font-bold text-cozy-text mb-6 text-center leading-relaxed">
                      {dailyQuestions[currentDailyIndex].question_text}
                    </p>

                    <div className="space-y-3">
                      {JSON.parse(dailyQuestions[currentDailyIndex].options_json || '[]').length > 0 ? (
                        JSON.parse(dailyQuestions[currentDailyIndex].options_json || '[]').map((opt: string, i: number) => {
                          const isCorrect = opt === dailyQuestions[currentDailyIndex].correct_answer;
                          const isSelected = opt === selectedDailyOption;
                          
                          return (
                            <button 
                              key={i}
                              disabled={isDailyAnswered}
                              onClick={() => handleDailyAnswer(opt)}
                              className={cn(
                                "w-full p-4 rounded-2xl border transition-all text-left font-medium flex items-center gap-3 group",
                                !isDailyAnswered ? "border-cozy-secondary/20 bg-cozy-bg hover:bg-cozy-accent hover:border-cozy-primary" : 
                                isCorrect ? "border-green-500 bg-green-500/10 text-green-700" :
                                isSelected ? "border-red-500 bg-red-500/10 text-red-700" : "border-cozy-secondary/10 bg-cozy-bg opacity-50"
                              )}
                            >
                              <span className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border",
                                !isDailyAnswered ? "bg-white dark:bg-black/20 text-cozy-muted border-cozy-secondary/10 group-hover:border-cozy-primary/30 group-hover:text-cozy-primary" :
                                isCorrect ? "bg-green-500 text-white border-green-500" :
                                isSelected ? "bg-red-500 text-white border-red-500" : "bg-cozy-accent text-cozy-muted border-cozy-secondary/10"
                              )}>
                                {String.fromCharCode(65 + i)}
                              </span>
                              {opt}
                            </button>
                          );
                        })
                      ) : (
                        <div className="flex flex-col items-center gap-4">
                          <p className="text-cozy-muted text-sm italic">This note doesn't have multiple-choice options.</p>
                          <button 
                            disabled={isDailyAnswered}
                            onClick={() => handleDailyAnswer(dailyQuestions[currentDailyIndex].correct_answer)}
                            className="w-full p-4 rounded-2xl bg-cozy-primary text-white font-bold"
                          >
                            {isDailyAnswered ? "Answered!" : "Check Answer"}
                          </button>
                        </div>
                      )}
                    </div>

                    {isDailyAnswered && isAiConfigured && (
                      <div className="mt-6">
                        {!dailyExplanation ? (
                          <button
                            onClick={explainDailyAnswer}
                            disabled={isExplaining}
                            className="w-full py-3 rounded-2xl border border-cozy-secondary/20 bg-cozy-bg hover:bg-cozy-accent text-sm font-bold text-cozy-primary flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                          >
                            {isExplaining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            {isExplaining ? 'Thinking…' : 'Explain with AI'}
                          </button>
                        ) : (
                          <div className="bg-cozy-bg border border-cozy-secondary/20 rounded-2xl p-4 text-sm text-cozy-text leading-relaxed">
                            <div className="flex items-center gap-2 mb-2 text-cozy-primary font-bold text-xs uppercase">
                              <Sparkles className="w-3.5 h-3.5" /> AI Tutor
                            </div>
                            {dailyExplanation}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-8 flex flex-col items-center text-center">
                   <div className="w-20 h-20 bg-orange-500 rounded-full flex items-center justify-center shadow-xl shadow-orange-500/30 mb-6 animate-bounce">
                    <Flame className="w-10 h-10 text-white fill-current" />
                  </div>
                  <h2 className="text-3xl font-black text-cozy-text mb-2">Challenge Complete!</h2>
                  <p className="text-cozy-muted mb-8 italic">"Consistency is the key to mastery."</p>

                  <div className="grid grid-cols-3 gap-4 w-full mb-8">
                    <div className="bg-green-500/10 p-4 rounded-2xl border border-green-500/20">
                      <p className="text-[10px] font-bold text-green-600 uppercase mb-1">Correct</p>
                      <p className="text-2xl font-black text-green-700">{dailyResults.correct}</p>
                    </div>
                    <div className="bg-red-500/10 p-4 rounded-2xl border border-red-500/20">
                      <p className="text-[10px] font-bold text-red-600 uppercase mb-1">Wrong</p>
                      <p className="text-2xl font-black text-red-700">{dailyResults.wrong}</p>
                    </div>
                    <div className="bg-cozy-primary/10 p-4 rounded-2xl border border-cozy-primary/20">
                      <p className="text-[10px] font-bold text-cozy-primary uppercase mb-1">Points</p>
                      <p className="text-2xl font-black text-cozy-primary">+{dailyResults.totalPoints}</p>
                    </div>
                  </div>

                  <div className="bg-cozy-accent/30 w-full p-6 rounded-3xl mb-8 flex flex-col items-center">
                    <span className="text-sm font-bold text-cozy-muted mb-1">New Streak</span>
                    <div className="flex items-center gap-2">
                      <span className="text-4xl font-black text-cozy-text">{streak}</span>
                      <Flame className="w-8 h-8 text-orange-500 fill-current" />
                    </div>
                  </div>

                  <button 
                    onClick={() => { setShowDailyChallenge(false); setShowDailySummary(false); setCurrentDailyIndex(0); setDailyResults({correct:0, wrong:0, totalPoints:0}); setSelectedDailyOption(null); setIsDailyAnswered(false); setDailyAnswers([]); setChallengeStep('pick'); setChallengeNotice(null); }}
                    className="w-full bg-cozy-primary text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-cozy-primary/30 hover:scale-[1.02] transition-transform active:scale-[0.98]"
                  >
                    Done for Today
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {isAiConfigured && (
        <>
          <button
            onClick={() => setShowTutor(v => !v)}
            aria-label="AI Tutor"
            className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 w-14 h-14 rounded-full bg-cozy-primary text-white shadow-lg shadow-cozy-primary/30 flex items-center justify-center hover:scale-105 transition-transform"
          >
            {showTutor ? <X size={24} /> : <Sparkles size={24} />}
          </button>

          {showTutor && (
            <div className="fixed bottom-36 right-4 md:bottom-24 md:right-6 z-40 w-[calc(100vw-2rem)] max-w-sm bg-cozy-card border border-cozy-secondary/20 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[60vh]">
              <div className="px-4 py-3 border-b border-cozy-secondary/20 flex items-center gap-2 bg-cozy-accent/40">
                <Sparkles size={16} className="text-cozy-primary" />
                <span className="font-bold text-sm">AI Tutor</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[180px]">
                {tutorMessages.length === 0 && (
                  <p className="text-sm text-cozy-muted">
                    Ask anything about your studies — definitions, explanations, practice hints.
                  </p>
                )}
                {tutorMessages.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      'text-sm p-3 rounded-2xl max-w-[85%] whitespace-pre-wrap',
                      m.role === 'user'
                        ? 'bg-cozy-primary text-white ml-auto'
                        : 'bg-cozy-bg border border-cozy-secondary/10'
                    )}
                  >
                    {m.content}
                  </div>
                ))}
                {isTutorSending && <Loader2 className="w-4 h-4 animate-spin text-cozy-muted" />}
              </div>
              <form
                onSubmit={e => { e.preventDefault(); sendTutorMessage(); }}
                className="p-3 border-t border-cozy-secondary/20 flex gap-2"
              >
                <input
                  value={tutorInput}
                  onChange={e => setTutorInput(e.target.value)}
                  placeholder="Ask the tutor…"
                  className="flex-1 p-2.5 rounded-xl bg-cozy-bg border border-cozy-secondary/20 text-sm focus:outline-none focus:border-cozy-primary"
                />
                <button
                  type="submit"
                  disabled={isTutorSending || !tutorInput.trim()}
                  className="px-4 rounded-xl bg-cozy-primary text-white text-sm font-bold disabled:opacity-50"
                >
                  Send
                </button>
              </form>
            </div>
          )}
        </>
      )}

      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-cozy-card border-t border-cozy-secondary/20 flex justify-around p-3 z-50 pb-safe">
        <MobileNavItem icon={<LayoutGrid size={24} />} label="Library" active onClick={() => {}} />
        <MobileNavItem icon={<Target size={24} />} label="Practice" onClick={() => navigate('/practice')} />
        <MobileNavItem icon={<Settings size={24} />} label="Settings" onClick={() => navigate('/settings')} />
      </nav>
    </div>
  );
};

const TabButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button 
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap",
      active ? "bg-cozy-primary text-white shadow-md" : "bg-cozy-card text-cozy-muted hover:bg-cozy-accent hover:text-cozy-text border border-cozy-secondary/10"
    )}
  >
    {icon} {label}
  </button>
);

const SidebarItem = ({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) => (
  <div 
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer",
      active ? "bg-cozy-primary text-white shadow-md" : "text-cozy-muted hover:bg-cozy-accent hover:text-cozy-text"
    )}
  >
    {icon}
    <span className="font-medium">{label}</span>
  </div>
);

const MobileNavItem = ({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) => (
  <button 
    onClick={onClick}
    className={cn(
      "flex flex-col items-center gap-1 p-2 flex-1 rounded-xl transition-all",
      active ? "text-cozy-primary" : "text-cozy-muted hover:bg-cozy-accent"
    )}
  >
    {icon}
    <span className="text-[10px] font-bold">{label}</span>
  </button>
);

const MaterialCard = ({ title, type, progress, author, onClick, onDelete }: { title: string, type: string, progress: number, author?: string, onClick?: () => void, onDelete?: (e: React.MouseEvent) => void }) => (
  <div 
    onClick={onClick}
    className="bg-cozy-card p-5 md:p-6 rounded-2xl border border-cozy-secondary/20 shadow-sm hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between h-40 md:h-48 relative overflow-hidden"
  >
    <div>
      <div className="flex justify-between items-start mb-3 md:mb-4">
        <div className={cn(
          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
          type === "Document" ? "bg-blue-100/20 text-blue-500" : 
          type === "Quiz" ? "bg-orange-100/20 text-orange-500" : 
          type === "Notes" ? "bg-green-100/20 text-green-500" : 
          "bg-purple-100/20 text-purple-500"
        )}>
          {type}
        </div>
        <div className="flex items-center gap-2">
          {author && <span className="text-[10px] text-cozy-muted bg-cozy-accent px-2 py-1 rounded-full">By {author}</span>}
          {onDelete && (
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(e); }}
              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete material"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
      <h3 className="text-lg md:text-xl font-bold group-hover:text-cozy-primary transition-colors line-clamp-2 text-cozy-text">{title}</h3>
    </div>
    
    {!author && (
      <div className="space-y-2">
        <div className="flex justify-between text-[10px] md:text-xs font-medium text-cozy-muted">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="w-full bg-cozy-accent h-1.5 md:h-2 rounded-full overflow-hidden">
          <div 
            className="bg-cozy-primary h-full rounded-full transition-all duration-500" 
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    )}
  </div>
);

export default Dashboard;
