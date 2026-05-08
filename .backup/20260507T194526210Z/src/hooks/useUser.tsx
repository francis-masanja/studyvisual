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
  const [user, setUser] = useState<User | null>(null);
  const [theme, setThemeState] = useState<Theme>('default');

  useEffect(() => {
    const savedUser = localStorage.getItem('study_user');
    if (savedUser) {
      setUser({ username: savedUser });
    }
    
    const savedTheme = localStorage.getItem('study_theme') as Theme;
    if (savedTheme) {
      setThemeState(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }, []);

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
