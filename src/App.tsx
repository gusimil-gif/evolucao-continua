import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/shared/ProtectedRoute';
import { AppLayout } from './components/shared/AppLayout';
import { Toaster } from 'react-hot-toast';

import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import TrainerDashboard from './pages/trainer/TrainerDashboard';
import ClientDashboard from './pages/client/ClientDashboard';
import ActiveWorkout from './pages/client/ActiveWorkout';
import CompletionScreen from './pages/client/CompletionScreen';
import ProgressCharts from './pages/client/ProgressCharts';
import CommunityFeed from './pages/client/CommunityFeed';
import ClientManagement from './pages/trainer/ClientManagement';
import ExerciseLibrary from './pages/trainer/ExerciseLibrary';
import WorkoutBuilder from './pages/trainer/WorkoutBuilder';
import { runSeed } from './utils/seed';

const RootRedirect = () => {
  const { currentUser, userData, loading } = useAuth();
  if (loading) return null;
  if (!currentUser || !userData) return <Navigate to="/login" replace />;
  return <Navigate to={userData.userType === 'trainer' ? '/trainer' : '/client'} replace />;
};

function App() {
  // Opcional: Rodar o seed (Apenas 1 vez, pode comentar depois)
  useEffect(() => {
    runSeed().catch(console.error);
  }, []);

  return (
    <AuthProvider>
      <Toaster 
        position="top-center"
        toastOptions={{
          style: {
            background: '#1A1A1A',
            color: '#F0EDE6',
            border: '1px solid #333333',
          },
          success: {
            iconTheme: {
              primary: '#D4A947',
              secondary: '#0D0D0D',
            },
          },
        }} 
      />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          
          <Route path="/trainer/*" element={
            <ProtectedRoute allowedType="trainer">
              <AppLayout>
                <Routes>
                  <Route path="/" element={<TrainerDashboard />} />
                  <Route path="/clients" element={<ClientManagement />} />
                  <Route path="/workouts" element={<WorkoutBuilder />} />
                  <Route path="/exercises" element={<ExerciseLibrary />} />
                </Routes>
              </AppLayout>
            </ProtectedRoute>
          } />
          
          <Route path="/client/*" element={
            <ProtectedRoute allowedType="client">
              <AppLayout>
                <Routes>
                  <Route path="/" element={<ClientDashboard />} />
                  <Route path="/workout/:planId/:dayId" element={<ActiveWorkout />} />
                  <Route path="/completion/:logId" element={<CompletionScreen />} />
                  <Route path="/progress" element={<ProgressCharts />} />
                  <Route path="/community" element={<CommunityFeed />} />
                </Routes>
              </AppLayout>
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
