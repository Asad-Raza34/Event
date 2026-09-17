import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/ui';

const FullPageLoader = () => (
  <div className="flex min-h-screen items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
    <Spinner size="lg" /> <span className="text-sm font-medium">Loading EventSphere…</span>
  </div>
);

/** Requires a signed-in user; optionally restricts to specific roles. */
export const ProtectedRoute = ({ roles, children }) => {
  const { isAuthenticated, loading, user, homeRoute } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoader />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  if (roles?.length && !roles.includes(user.role)) {
    // Send each role to its own dashboard rather than showing a dead end.
    return <Navigate to={homeRoute || '/'} replace />;
  }

  return children || <Outlet />;
};

/** Requires an anonymous visitor (login/register pages). */
export const PublicOnlyRoute = ({ children }) => {
  const { isAuthenticated, loading, homeRoute } = useAuth();
  if (loading) return <FullPageLoader />;
  if (isAuthenticated) return <Navigate to={homeRoute} replace />;
  return children || <Outlet />;
};

export default ProtectedRoute;
