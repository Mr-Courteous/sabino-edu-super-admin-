import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth';
import type { Role } from './lib/types';
import { Shell } from './components/Shell';
import { Spinner } from './components/ui';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Schools from './pages/Schools';
import SchoolDetail from './pages/SchoolDetail';
import Students from './pages/Students';
import AuditLog from './pages/AuditLog';
import Admins from './pages/Admins';
import Notifications from './pages/Notifications';
import Account from './pages/Account';

function RequireAuth({ children }: { children: ReactNode }) {
  const { admin, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="center-screen"><Spinner /></div>;
  if (!admin) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  if (admin.must_change_password && loc.pathname !== '/account') return <Navigate to="/account" replace />;
  return <>{children}</>;
}

const RequireRole = ({ roles, children }: { roles: Role[]; children: ReactNode }) => {
  const { can } = useAuth();
  return can(...roles) ? <>{children}</> : <Navigate to="/" replace />;
};

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth><Shell /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="schools" element={<Schools />} />
        <Route path="schools/:id" element={<SchoolDetail />} />
        <Route path="students" element={<Students />} />
        <Route path="notifications" element={<RequireRole roles={['owner', 'admin']}><Notifications /></RequireRole>} />
        <Route path="audit" element={<RequireRole roles={['owner', 'admin']}><AuditLog /></RequireRole>} />
        <Route path="admins" element={<RequireRole roles={['owner']}><Admins /></RequireRole>} />
        <Route path="account" element={<Account />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
