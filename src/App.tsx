import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/shared/ProtectedRoute';
import { AppLayout } from './components/shared/AppLayout';
import { Toaster } from 'react-hot-toast';

// Code-splitting com React.lazy para reduzir o bundle inicial e carregar instantaneamente
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const TrainerDashboard = lazy(() => import('./pages/trainer/TrainerDashboard'));
const ClientDashboard = lazy(() => import('./pages/client/ClientDashboard'));
const ActiveWorkout = lazy(() => import('./pages/client/ActiveWorkout'));
const CompletionScreen = lazy(() => import('./pages/client/CompletionScreen'));
const ProgressCharts = lazy(() => import('./pages/client/ProgressCharts'));
const CommunityFeed = lazy(() => import('./pages/client/CommunityFeed'));
const AIWorkoutGenerator = lazy(() => import('./pages/client/AIWorkoutGenerator'));
const AICoachDebrief = lazy(() => import('./pages/client/AICoachDebrief'));
const ClientManagement = lazy(() => import('./pages/trainer/ClientManagement'));
const ExerciseLibrary = lazy(() => import('./pages/trainer/ExerciseLibrary'));
const WorkoutBuilder = lazy(() => import('./pages/trainer/WorkoutBuilder'));

const PageLoader = () => (
  <div className="min-h-[50vh] flex items-center justify-center">
    <div className="w-8 h-8 border-3 border-[#D4A947] border-t-transparent rounded-full animate-spin" />
  </div>
);

const RootRedirect = () => {
  const { currentUser, userData, loading } = useAuth();
  if (loading) return null;
  if (!currentUser || !userData) return <Navigate to="/login" replace />;
  return <Navigate to={userData.userType === 'trainer' ? '/trainer' : '/client'} replace />;
};

function App() {

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
        <Suspense fallback={<PageLoader />}>
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
                    <Route path="/coach" element={<AICoachDebrief />} />
                    <Route path="/community" element={<CommunityFeed />} />
                    <Route path="/ai-workout" element={<AIWorkoutGenerator />} />
                  </Routes>
                </AppLayout>
              </ProtectedRoute>
            } />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
