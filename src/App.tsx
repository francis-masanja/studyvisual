import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import Practice from './pages/Practice';
import Settings from './pages/Settings';
import StudyVisualizer from './features/StudyVisualizer';
import { UserProvider, useUser } from './hooks/useUser';

const AppRoutes = () => {
  const { user } = useUser();

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" /> : <LandingPage />} />
      <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/" />} />
      <Route path="/practice" element={user ? <Practice /> : <Navigate to="/" />} />
      <Route path="/settings" element={user ? <Settings /> : <Navigate to="/" />} />
      <Route path="/visualizer/:id" element={user ? <StudyVisualizer /> : <Navigate to="/" />} />
      <Route path="*" element={<Navigate to="/" />} />
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
