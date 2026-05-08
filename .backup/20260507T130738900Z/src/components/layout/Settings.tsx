import React from 'react';
import { useUser, type Theme } from '../../hooks/useUser';
import { useNavigate } from 'react-router-dom';
import { LogOut, LayoutGrid, Settings as SettingsIcon, Moon, Sun, Cloud, Heart, ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/utils';

const Settings = () => {
  const { user, logout, theme, setTheme } = useUser();
  const navigate = useNavigate();

  const themes: { id: Theme; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'default', label: 'Cozy Warm', icon: <Sun size={20} />, color: 'bg-[#faf7f2]' },
    { id: 'dark', label: 'Cozy Dark', icon: <Moon size={20} />, color: 'bg-[#1a1a1a]' },
    { id: 'blue', label: 'Cozy Blue', icon: <Cloud size={20} />, color: 'bg-[#f0f4f8]' },
    { id: 'red', label: 'Cozy Red', icon: <Heart size={20} />, color: 'bg-[#fdf2f2]' },
  ];

  return (
    <div className="min-h-screen bg-cozy-bg flex text-cozy-text">
      {/* Sidebar */}
      <aside className="w-64 bg-cozy-card border-r border-cozy-secondary/20 flex flex-col fixed inset-y-0 z-10">
        <div className="p-6 border-b border-cozy-secondary/20">
          <h2 className="text-xl font-bold text-cozy-primary">StudyVisual</h2>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <SidebarItem 
            icon={<LayoutGrid size={20} />} 
            label="My Library" 
            onClick={() => navigate('/dashboard')}
          />
          <SidebarItem 
            icon={<SettingsIcon size={20} />} 
            label="Settings" 
            active 
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
        <header className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-cozy-accent rounded-full transition-colors text-cozy-muted hover:text-cozy-text"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-cozy-text">Settings</h1>
            <p className="text-cozy-muted">Customize your cozy study environment</p>
          </div>
        </header>

        <section className="bg-cozy-card rounded-3xl p-8 border border-cozy-secondary/10 shadow-sm max-w-2xl">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-cozy-text">
            Appearance
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left",
                  theme === t.id 
                    ? "border-cozy-primary bg-cozy-accent" 
                    : "border-cozy-secondary/10 hover:border-cozy-secondary/30 bg-cozy-card"
                )}
              >
                <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shadow-inner", t.color)}>
                  {t.icon}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-cozy-text">{t.label}</p>
                  <p className="text-xs text-cozy-muted">Click to select</p>
                </div>
                {theme === t.id && (
                  <div className="w-2 h-2 bg-cozy-primary rounded-full" />
                )}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-8 bg-cozy-card rounded-3xl p-8 border border-cozy-secondary/10 shadow-sm max-w-2xl">
          <h2 className="text-xl font-bold mb-6 text-cozy-text">Profile</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2 text-cozy-muted">Username</label>
              <div className="px-4 py-3 bg-cozy-accent rounded-xl font-medium text-cozy-text border border-cozy-secondary/10">
                {user?.username}
              </div>
            </div>
            <p className="text-xs text-cozy-muted">
              Note: Progress is stored locally and in the Turso database under this username.
            </p>
          </div>
        </section>
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

export default Settings;
