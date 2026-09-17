import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Icon from '../../components/ui/Icon';
import { Button } from '../../components/ui';
import { EmptyState } from '../../components/ui/data';

const NotFoundPage = () => {
  const { isAuthenticated, homeRoute } = useAuth();

  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <EmptyState
        icon="compass"
        title="404 — this page does not exist"
        message="The link may be broken, or the page may have been moved. Try browsing expos or heading back to the dashboard."
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link to={isAuthenticated ? homeRoute : '/'}>
              <Button icon={isAuthenticated ? 'grid' : 'chevron-right'}>{isAuthenticated ? 'Back to dashboard' : 'Back home'}</Button>
            </Link>
            <Link to="/expos">
              <Button variant="secondary" icon="compass">
                Browse expos
              </Button>
            </Link>
          </div>
        }
      />
      <p className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Icon name="info" className="h-3.5 w-3.5" /> Error 404 · Not Found
      </p>
    </div>
  );
};

export default NotFoundPage;
