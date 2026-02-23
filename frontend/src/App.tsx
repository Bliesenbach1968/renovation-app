import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import BuildingPage from './pages/BuildingPage';
import RoomDetailPage from './pages/RoomDetailPage';
import SummaryPage from './pages/SummaryPage';
import TimelinePage from './pages/TimelinePage';
import ContainerPage from './pages/ContainerPage';
import GeruestPage from './pages/GeruestPage';
import KranPage from './pages/KranPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminTemplatesPage from './pages/AdminTemplatesPage';
import NewProjectPage from './pages/NewProjectPage';
import EditProjectPage from './pages/EditProjectPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
    </div>
  );
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/"                             element={<DashboardPage />} />
        <Route path="/projects/new"                 element={<NewProjectPage />} />
        <Route path="/projects/:id/edit"            element={<EditProjectPage />} />
        <Route path="/projects/:id"                 element={<ProjectDetailPage />} />
        <Route path="/projects/:id/building"        element={<BuildingPage />} />
        <Route path="/projects/:id/rooms/:roomId"   element={<RoomDetailPage />} />
        <Route path="/projects/:id/summary"         element={<SummaryPage />} />
        <Route path="/projects/:id/timeline"        element={<TimelinePage />} />
        <Route path="/projects/:id/containers"      element={<ContainerPage />} />
        <Route path="/projects/:id/geruest"         element={<GeruestPage />} />
        <Route path="/projects/:id/kran"            element={<KranPage />} />
        <Route path="/admin/users"                  element={<AdminUsersPage />} />
        <Route path="/admin/templates"              element={<AdminTemplatesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
