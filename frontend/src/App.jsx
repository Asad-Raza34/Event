import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider, useToast } from './context/ToastContext';
import AppRoutes from './routes';

/**
 * Surfaces a friendly message when the refresh token finally expires and the
 * API answers 401 on a protected route.
 */
const SessionWatcher = () => {
  const { sessionExpired, isAuthenticated } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionExpired) return;
    toast.warning('Your session expired. Please sign in again.', { title: 'EventSphere' });
    navigate('/login', { replace: true });
  }, [sessionExpired, toast, navigate]);

  useEffect(() => {
    if (sessionExpired && !isAuthenticated) return;
  }, [sessionExpired, isAuthenticated]);

  return null;
};

const App = () => (
  <ThemeProvider>
    <ToastProvider>
      <AuthProvider>
        <SocketProvider>
          <NotificationProvider>
            <SessionWatcher />
            <AppRoutes />
          </NotificationProvider>
        </SocketProvider>
      </AuthProvider>
    </ToastProvider>
  </ThemeProvider>
);

export default App;
