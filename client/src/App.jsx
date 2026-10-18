// Routes of the app. Every page except /login requires a signed-in user.
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';
import { Layout } from './components/Layout.jsx';
import { Spinner } from './components/ui.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { ProjectsPage } from './pages/ProjectsPage.jsx';
import { ProjectDetailPage } from './pages/ProjectDetailPage.jsx';
import { TasksPage } from './pages/TasksPage.jsx';
import { RisksPage } from './pages/RisksPage.jsx';
import { ChangeRequestsPage } from './pages/ChangeRequestsPage.jsx';
import { CostsPage } from './pages/CostsPage.jsx';
import { NotificationsPage } from './pages/NotificationsPage.jsx';
import { AuditPage } from './pages/AuditPage.jsx';

// Sends signed-out users to the login page (and back here after signing in).
// Note: this only controls what the UI shows - the API checks permissions on every request.
function RequireAuth({ children, adminOnly = false }) {
  const { user, checking, isAdmin } = useAuth();
  const location = useLocation();
  if (checking) return <Spinner label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/risks" element={<RisksPage />} />
        <Route path="/change-requests" element={<ChangeRequestsPage />} />
        <Route path="/costs" element={<CostsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/audit" element={<RequireAuth adminOnly><AuditPage /></RequireAuth>} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
