import { useTheme } from '../../context/ThemeContext';
import Icon from '../ui/Icon';

const ThemeToggle = ({ className }) => {
  const { isDark, toggleTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`btn-icon ${className || ''}`}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      <Icon name={isDark ? 'sun' : 'moon'} className="h-5 w-5" />
    </button>
  );
};

export default ThemeToggle;
