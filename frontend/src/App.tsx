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
import ProjectLayout from './components/ProjectLayout';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import FinancePage from './pages/FinancePage';
import DatevExportPage from './pages/DatevExportPage';
import GaebPage from './pages/GaebPage';
import ZusatzkostenPage from './pages/ZusatzkostenPage';
import VertriebMaterialPage from './pages/VertriebMaterialPage';
import MaterialbedarfPage from './pages/MaterialbedarfPage';
import AbrisskotenPage from './pages/AbrisskotenPage';
import BaukostenPage from './pages/BaukostenPage';
import GebaeudePage from './pages/GebaeudePage';

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
      <Route path="/forgot-password" element={user ? <Navigate to="/" replace /> : <ForgotPasswordPage />} />
      <Route path="/reset-password" element={user ? <Navigate to="/" replace /> : <ResetPasswordPage />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/"                             element={<DashboardPage />} />
        <Route path="/projects/new"                 element={<NewProjectPage />} />
        <Route path="/projects/:id"                 element={<ProjectLayout />}>
          <Route index                              element={<ProjectDetailPage />} />
          <Route path="edit"                        element={<EditProjectPage />} />
          <Route path="building"                    element={<BuildingPage />} />
          <Route path="gebaeude"                    element={<GebaeudePage />} />
          <Route path="rooms/:roomId"               element={<RoomDetailPage />} />
          <Route path="summary"                     element={<SummaryPage />} />
          <Route path="timeline"                    element={<TimelinePage />} />
          <Route path="containers"                  element={<ContainerPage />} />
          <Route path="geruest"                     element={<GeruestPage />} />
          <Route path="kran"                        element={<KranPage />} />
          <Route path="finance"                     element={<FinancePage />} />
          <Route path="abrisskosten"                element={<AbrisskotenPage />} />
          <Route path="baukosten"                   element={<BaukostenPage />} />
          <Route path="module/:module"              element={<ZusatzkostenPage />} />
          <Route path="vertrieb-material"           element={<VertriebMaterialPage />} />
          <Route path="materialbedarf"              element={<MaterialbedarfPage />} />
          <Route path="datev"                       element={<DatevExportPage />} />
          <Route path="gaeb"                        element={<GaebPage />} />
        </Route>
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
