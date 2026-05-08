import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './components/layout/LandingPage';
import Dashboard from './components/layout/Dashboard';
import Settings from './components/layout/Settings';
import StudyVisualizer from './components/visualizer/StudyVisualizer';
import { UserProvider, useUser } from './hooks/useUser';
import './App.css';

const AppRoutes = () => {
  const { user } = useUser();

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" /> : <LandingPage />} />
      <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/" />} />
      <Route path="/settings" element={user ? <Settings /> : <Navigate to="/" />} />
      <Route path="/visualizer/:id" element={user ? <StudyVisualizer /> : <Navigate to="/" />} />
    </Routes>
  );
};

function App() {
  return (
    <UserProvider>
      <Router>
        <AppRoutes />
      </Router>
    </UserProvider>
  );
}

export default App;
