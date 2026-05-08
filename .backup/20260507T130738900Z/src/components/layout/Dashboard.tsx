import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '../../hooks/useUser';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, FileText, LayoutGrid, Settings, Upload as UploadIcon, X, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { parseMarkdown, parseJson } from '../../lib/parser';

interface Material {
  id: string;
  title: string;
  type: 'document' | 'flashcards';
  completion_percentage: number | null;
}

const Dashboard = () => {
  const { user, logout } = useUser();
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMaterials();
  }, [user]);

  const fetchMaterials = async () => {
    if (!user) return;
    try {
      console.log("Fetching materials for user:", user.username);
      const res = await fetch(`/api/materials?username=${user.username}`);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`API Error (${res.status}):`, errorText);
        return;
      }

      const text = await res.text();
      console.log("Raw API response:", text);

      if (!text) {
        console.warn("API returned empty response");
        setMaterials([]);
        return;
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("Failed to parse JSON response:", text);
        alert("The server returned an invalid response. This usually means a configuration error on Vercel.");
        return;
      }

      if (data.materials) {
        setMaterials(data.materials);
      } else if (data.error) {
        console.error("API returned error:", data.error, data.message);
        alert(`API Error: ${data.message || data.error}`);
      }
    } catch (error) {
      console.error("Error fetching materials:", error);
    } finally {
      setIsLoading(false);
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
          fetchMaterials();
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

  return (
    <div className="min-h-screen bg-cozy-bg text-cozy-text flex">
      {/* Sidebar */}
      <aside className="w-64 bg-cozy-card border-r border-cozy-secondary/20 flex flex-col fixed inset-y-0 z-10">
        <div className="p-6 border-b border-cozy-secondary/20">
          <h2 className="text-xl font-bold text-cozy-primary">StudyVisual</h2>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <SidebarItem 
            icon={<LayoutGrid size={20} />} 
            label="My Library" 
            active 
          />
          <SidebarItem 
            icon={<Settings size={20} />} 
            label="Settings" 
            onClick={() => navigate('/settings')}
          />
        </nav>

        <div className="p-4 border-t border-cozy-secondary/20">
          <div className="flex items-center gap-3 p-3 bg-cozy-accent rounded-xl mb-4">
            <div className="w-10 h-10 bg-cozy-primary rounded-full flex items-center justify-center text-white font-bold">
              {user?.username[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate text-cozy-text">{user?.username}</p>
              <p className="text-xs text-cozy-muted">Free Plan</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600 transition-colors w-full px-3"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-cozy-text">My Library</h1>
            <p className="text-cozy-muted">Welcome back, time to study!</p>
          </div>
          <button 
            onClick={() => setIsUploading(true)}
            className="bg-cozy-primary text-white px-6 py-2 rounded-xl flex items-center gap-2 hover:bg-cozy-primary/90 transition-all shadow-lg"
          >
            <Plus size={20} /> New Material
          </button>
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-cozy-primary animate-spin" />
          </div>
        ) : materials.length === 0 ? (
          <div className="bg-cozy-card rounded-3xl p-20 text-center border border-cozy-secondary/10 flex flex-col items-center">
            <div className="w-20 h-20 bg-cozy-accent rounded-full flex items-center justify-center mb-6">
              <FileText className="text-cozy-primary w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-cozy-text">Your library is empty</h2>
            <p className="text-cozy-muted mb-8 max-w-sm">Upload your first study material to see the magic happen.</p>
            <button 
              onClick={() => setIsUploading(true)}
              className="bg-cozy-primary text-white px-8 py-3 rounded-xl font-bold"
            >
              Get Started
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {materials.map((m) => (
              <MaterialCard 
                key={m.id}
                title={m.title} 
                type={m.type === 'document' ? 'Document' : 'Flashcards'} 
                progress={m.completion_percentage || 0} 
                date="Just now" 
                onClick={() => navigate(`/visualizer/${m.id}`)}
              />
            ))}
          </div>
        )}

        {/* Upload Modal Overlay */}
        {isUploading && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-cozy-card w-full max-w-xl rounded-3xl p-8 shadow-2xl relative animate-in zoom-in-95 duration-200 border border-cozy-secondary/20">
              <button 
                onClick={() => setIsUploading(false)}
                className="absolute top-6 right-6 p-2 hover:bg-cozy-accent rounded-full text-cozy-muted"
              >
                <X size={20} />
              </button>
              <h2 className="text-2xl font-bold mb-2 text-cozy-text">Upload Material</h2>
              <p className="text-cozy-muted mb-8">Upload a .md or .json file to visualize it.</p>
              
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-cozy-secondary/30 rounded-2xl p-12 flex flex-col items-center justify-center text-center hover:border-cozy-primary transition-colors cursor-pointer group bg-cozy-accent/20"
              >
                <div className="w-16 h-16 bg-cozy-accent rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  {isUploadingFile ? (
                    <Loader2 className="text-cozy-primary w-8 h-8 animate-spin" />
                  ) : (
                    <UploadIcon className="text-cozy-primary w-8 h-8" />
                  )}
                </div>
                <p className="font-semibold text-lg text-cozy-text">
                  {isUploadingFile ? "Processing..." : "Click to upload or drag and drop"}
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

              <div className="mt-8 text-sm text-center text-cozy-muted">
                Tip: Markdown files with Q: and A: will be converted to flashcards.
              </div>
            </div>
          </div>
        )}
      </main>
    </div>

  );
};

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

const MaterialCard = ({ title, type, progress, date, onClick }: { title: string, type: string, progress: number, date: string, onClick?: () => void }) => (
  <div 
    onClick={onClick}
    className="bg-cozy-card p-6 rounded-2xl border border-cozy-secondary/20 shadow-sm hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between h-48"
  >
    <div>
      <div className="flex justify-between items-start mb-4">
        <div className={cn(
          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
          type === "Document" ? "bg-blue-100/20 text-blue-500" : "bg-orange-100/20 text-orange-500"
        )}>
          {type}
        </div>
      </div>
      <h3 className="text-xl font-bold group-hover:text-cozy-primary transition-colors line-clamp-2 text-cozy-text">{title}</h3>
    </div>
    
    <div className="space-y-2">
      <div className="flex justify-between text-xs font-medium text-cozy-muted">
        <span>Progress</span>
        <span>{progress}%</span>
      </div>
      <div className="w-full bg-cozy-accent h-2 rounded-full overflow-hidden">
        <div 
          className="bg-cozy-primary h-full rounded-full transition-all duration-500" 
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  </div>
);

export default Dashboard;
