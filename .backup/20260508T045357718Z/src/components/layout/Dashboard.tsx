import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '../../hooks/useUser';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, FileText, LayoutGrid, Settings, Upload as UploadIcon, X, Loader2, Users, BookOpen, Layers, Trash2, Flame, Trophy, Target } from 'lucide-react';
import { cn } from '../../lib/utils';
import { parseMarkdown, parseJson } from '../../lib/parser';

interface Material {
  id: string;
  title: string;
  type: 'document' | 'flashcards' | 'quiz' | 'mixed';
  completion_percentage?: number | null;
  author?: string;
}

type TabType = 'notes' | 'quizzes' | 'community';

const Dashboard = () => {
  const { user, logout } = useUser();
  const navigate = useNavigate();
  
  // Data States
  const [myMaterials, setMyMaterials] = useState<Material[]>([]);
  const [communityMaterials, setCommunityMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('notes');
  
  // Gamification States
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState(0);
  const [showDailyChallenge, setShowDailyChallenge] = useState(false);
  const [dailyQuestion, setDailyQuestion] = useState<any>(null);

  // Upload States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadTab, setUploadTab] = useState<'form' | 'file'>('form');
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual Form States
  const [manualQuestion, setManualQuestion] = useState('');
  const [manualOptions, setManualOptions] = useState(['', '', '', '']);
  const [manualCorrect, setManualCorrect] = useState(0);

  useEffect(() => {
    fetchMyMaterials();
    fetchCommunityMaterials();
  }, [user]);

  useEffect(() => {
    // Load gamification from cache
    const s = parseInt(localStorage.getItem('studyvisual_streak') || '0');
    const sc = parseInt(localStorage.getItem('studyvisual_score') || '0');
    setStreak(s);
    setScore(sc);

    // Check Daily Challenge
    const checkDaily = async () => {
      const lastPlayed = localStorage.getItem('studyvisual_last_played');
      const today = new Date().toDateString();
      if (lastPlayed !== today) {
        try {
          const res = await fetch('/api/daily-challenge');
          if (res.ok) {
            const data = await res.json();
            if (data.question) {
              setDailyQuestion(data.question);
              setShowDailyChallenge(true);
            }
          }
        } catch(e) {
          console.error("Daily challenge fetch error:", e);
        }
      }
    };
    checkDaily();
  }, []);

  const fetchMyMaterials = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/materials?username=${user.username}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.materials) {
        setMyMaterials(data.materials);
      }
    } catch (error) {
      console.error("Error fetching my materials:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCommunityMaterials = async () => {
    try {
      const res = await fetch(`/api/materials?community=true`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.materials) {
        setCommunityMaterials(data.materials);
      }
    } catch (error) {
      console.error("Error fetching community materials:", error);
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
        fetchMyMaterials();
        fetchCommunityMaterials();
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploadingFile(true);
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        let parsedData;

        if (file.name.endsWith('.md')) {
          parsedData = await parseMarkdown(text, file.name);
        } else if (file.name.endsWith('.json')) {
          parsedData = parseJson(JSON.parse(text), file.name);
        } else {
          throw new Error("Unsupported file type");
        }

        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: user.username,
            title: parsedData.title,
            type: parsedData.type,
            content_json: parsedData
          })
        });

        if (response.ok) {
          setIsUploading(false);
          fetchMyMaterials();
          fetchCommunityMaterials();
        }
      } catch (error) {
        console.error("Upload failed:", error);
        alert("Upload failed. Please check the file format.");
      } finally {
        setIsUploadingFile(false);
      }
    };

    reader.readAsText(file);
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
      title: `Quick Quiz - ${new Date().toLocaleDateString()}`,
      type: 'flashcards',
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
          content_json: parsedData
        })
      });
      if (response.ok) {
        setIsUploading(false);
        fetchMyMaterials();
        fetchCommunityMaterials();
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

  const handleDailyAnswer = (selectedAns: string) => {
    const isCorrect = selectedAns === dailyQuestion.answer;
    const today = new Date().toDateString();
    localStorage.setItem('studyvisual_last_played', today);
    
    if (isCorrect) {
      const newScore = score + 10;
      const newStreak = streak + 1;
      setScore(newScore);
      setStreak(newStreak);
      localStorage.setItem('studyvisual_score', newScore.toString());
      localStorage.setItem('studyvisual_streak', newStreak.toString());
      alert("Correct! +10 points. Streak continues! 🔥");
    } else {
      setStreak(0);
      localStorage.setItem('studyvisual_streak', '0');
      alert(`Incorrect! The right answer was: ${dailyQuestion.answer}. Streak lost. 😔`);
    }
    setShowDailyChallenge(false);
  };

  const displayedMaterials = activeTab === 'notes' 
    ? myMaterials.filter(m => m.type === 'document' || m.type === 'flashcards' || m.type === 'mixed')
    : activeTab === 'quizzes'
      ? myMaterials.filter(m => m.type === 'quiz' || m.type === 'mixed')
      : communityMaterials;

  return (
    <div className="min-h-screen bg-cozy-bg text-cozy-text flex pb-20 md:pb-0 relative z-0">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-cozy-card border-r border-cozy-secondary/20 flex-col fixed inset-y-0 z-10">
        <div className="p-6 border-b border-cozy-secondary/20">
          <h2 className="text-xl font-bold text-cozy-primary flex items-center gap-2">
            <img src="/logo.png" alt="Logo" className="w-6 h-6 object-contain" />
            StudyVisual
          </h2>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <SidebarItem icon={<LayoutGrid size={20} />} label="My Library" active />
          <SidebarItem icon={<Settings size={20} />} label="Settings" onClick={() => navigate('/settings')} />
        </nav>

        <div className="p-4 border-t border-cozy-secondary/20">
          {/* Gamification Stats */}
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
              {user?.username[0].toUpperCase()}
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

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto">
        <header className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 gap-4 pt-4 md:pt-0">
          <div>
            <h1 className="text-3xl font-bold text-cozy-text flex items-center gap-2">
              <img src="/logo.png" alt="Logo" className="w-8 h-8 md:hidden object-contain" />
              Global Quiz Platform
            </h1>
            <p className="text-cozy-muted">Donate questions, play quizzes, earn points!</p>
          </div>
          <button 
            onClick={() => setIsUploading(true)}
            className="bg-cozy-primary text-white px-6 py-3 md:py-2 rounded-xl flex items-center justify-center gap-2 hover:bg-cozy-primary/90 transition-all shadow-lg w-full md:w-auto"
          >
            <Plus size={20} /> Donate Question
          </button>
        </header>

        {/* Mobile Gamification Stats Header */}
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
                onClick={() => setIsUploading(true)}
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

        {/* Upload/Add Question Modal */}
        {isUploading && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
            <div className="bg-cozy-card w-full max-w-xl rounded-3xl p-6 md:p-8 shadow-2xl relative animate-in zoom-in-95 duration-200 border border-cozy-secondary/20 max-h-[90vh] overflow-y-auto">
              <button 
                onClick={() => setIsUploading(false)}
                className="absolute top-4 right-4 md:top-6 md:right-6 p-2 hover:bg-cozy-accent rounded-full text-cozy-muted"
              >
                <X size={20} />
              </button>
              
              <h2 className="text-2xl font-bold mb-6 text-cozy-text">Donate a Question</h2>

              <div className="flex gap-4 mb-6 border-b border-cozy-secondary/20 pb-2">
                <button 
                  onClick={() => setUploadTab('form')}
                  className={cn("pb-2 font-bold transition-colors", uploadTab === 'form' ? "text-cozy-primary border-b-2 border-cozy-primary" : "text-cozy-muted")}
                >
                  Quick Form
                </button>
                <button 
                  onClick={() => setUploadTab('file')}
                  className={cn("pb-2 font-bold transition-colors", uploadTab === 'file' ? "text-cozy-primary border-b-2 border-cozy-primary" : "text-cozy-muted")}
                >
                  Bulk Upload (.json/.md)
                </button>
              </div>

              {uploadTab === 'file' ? (
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
                  <div className="mt-4 text-xs text-cozy-muted italic">
                    Donated questions are available to the whole community!
                  </div>
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
                    <label className="block text-sm font-bold text-cozy-muted mb-1">Options</label>
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

        {/* Daily Challenge Modal */}
        {showDailyChallenge && dailyQuestion && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[70] animate-in fade-in duration-300">
            <div className="bg-cozy-card w-full max-w-lg rounded-3xl shadow-2xl relative border border-cozy-secondary/20 overflow-hidden animate-in zoom-in-90 duration-300 delay-100">
              <div className="bg-cozy-primary/10 p-8 flex flex-col items-center border-b border-cozy-secondary/10 relative">
                <button 
                  onClick={() => setShowDailyChallenge(false)}
                  className="absolute top-4 right-4 p-2 hover:bg-cozy-accent rounded-full text-cozy-muted"
                >
                  <X size={20} />
                </button>
                <div className="w-16 h-16 bg-cozy-primary rounded-full flex items-center justify-center shadow-lg shadow-cozy-primary/30 mb-4">
                  <Flame className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-extrabold text-cozy-text">Daily Challenge!</h2>
                <p className="text-cozy-primary font-medium mt-1">Keep your {streak} day streak alive</p>
              </div>

              <div className="p-8">
                <p className="text-lg md:text-xl font-bold text-cozy-text mb-6 text-center leading-relaxed">
                  {dailyQuestion.question}
                </p>

                <div className="space-y-3">
                  {dailyQuestion.options ? (
                    dailyQuestion.options.map((opt: string, i: number) => (
                      <button 
                        key={i}
                        onClick={() => handleDailyAnswer(opt)}
                        className="w-full p-4 rounded-2xl border border-cozy-secondary/20 bg-cozy-bg hover:bg-cozy-accent hover:border-cozy-primary transition-all text-left font-medium text-cozy-text flex items-center gap-3 group"
                      >
                        <span className="w-8 h-8 bg-white dark:bg-black/20 rounded-full flex items-center justify-center text-sm font-bold text-cozy-muted group-hover:text-cozy-primary border border-cozy-secondary/10 group-hover:border-cozy-primary/30">
                          {String.fromCharCode(65 + i)}
                        </span>
                        {opt}
                      </button>
                    ))
                  ) : (
                    // Fallback for non-MCQ random questions
                    <div>
                      <p className="text-sm text-cozy-muted italic text-center mb-4">Think of the answer, then click to check.</p>
                      <button 
                        onClick={() => handleDailyAnswer(dailyQuestion.answer)}
                        className="w-full p-4 rounded-xl bg-cozy-primary text-white font-bold"
                      >
                        I know it! (Reveal)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-cozy-card border-t border-cozy-secondary/20 flex justify-around p-3 z-50 pb-safe">
        <MobileNavItem icon={<LayoutGrid size={24} />} label="Library" active onClick={() => {}} />
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
