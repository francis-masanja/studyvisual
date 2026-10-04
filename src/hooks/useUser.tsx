import React, { createContext, useContext, useState, useEffect } from 'react';

export type Theme = 'default' | 'dark' | 'blue' | 'red';

interface User {
  username: string;
}

interface UserContextType {
  user: User | null;
  theme: Theme;
  login: (username: string) => void;
  logout: () => void;
  setTheme: (theme: Theme) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('study_user');
    return savedUser ? { username: savedUser } : null;
  });
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('study_theme');
    return saved === 'dark' || saved === 'blue' || saved === 'red' ? saved : 'default';
  });

  // Sync the persisted theme onto <html> (external system)
  useEffect(() => {
    if (theme === 'default') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);

  const login = (username: string) => {
    localStorage.setItem('study_user', username);
    setUser({ username });
  };

  const logout = () => {
    localStorage.removeItem('study_user');
    setUser(null);
  };

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem('study_theme', newTheme);
    setThemeState(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  return (
    <UserContext.Provider value={{ user, theme, login, logout, setTheme }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
