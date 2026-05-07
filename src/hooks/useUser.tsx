import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  username: string;
}

interface UserContextType {
  user: User | null;
  login: (username: string) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('study_user');
    if (savedUser) {
      setUser({ username: savedUser });
    }
  }, []);

  const login = (username: string) => {
    localStorage.setItem('study_user', username);
    setUser({ username });
    // In a real app, we would call the /api/register route here too
  };

  const logout = () => {
    localStorage.removeItem('study_user');
    setUser(null);
  };

  return (
    <UserContext.Provider value={{ user, login, logout }}>
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
