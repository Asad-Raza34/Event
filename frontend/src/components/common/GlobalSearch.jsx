import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { useDebounce } from '../../hooks/useDebounce';
import { cn, mediaUrl, titleCase } from '../../lib/utils';
import Icon from '../ui/Icon';
import { Modal, Spinner } from '../ui';

const GROUP_ICONS = {
  expos: 'calendar',
  exhibitors: 'building',
  products: 'box',
  sessions: 'mic',
  speakers: 'users2',
  booths: 'map',
};

const GlobalSearch = ({ open, onClose }) => {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const debounced = useDebounce(term, 300);
  const navigate = useNavigate();
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTerm('');
      setResults(null);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    if (debounced.trim().length < 2) {
      setResults(null);
      return undefined;
    }
    setLoading(true);
    api.search
      .global({ q: debounced.trim(), limit: 5 })
      .then((response) => {
        if (!cancelled) setResults(response.data);
      })
      .catch(() => {
        if (!cancelled) setResults(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const flat = useMemo(() => {
    if (!results?.results) return [];
    return Object.entries(results.results).flatMap(([group, items]) => items.map((item) => ({ ...item, group })));
  }, [results]);

  const go = useCallback(
    (link) => {
      onClose?.();
      navigate(link);
    },
    [navigate, onClose],
  );

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((current) => Math.min(current + 1, flat.length - 1));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current) => Math.max(current - 1, 0));
    }
    if (event.key === 'Enter' && flat[active]) {
      event.preventDefault();
      go(flat[active].link);
    }
  };

  const grouped = useMemo(() => {
    if (!results?.results) return [];
    return Object.entries(results.results)
      .filter(([, items]) => items.length)
      .map(([group, items]) => ({ group, items }));
  }, [results]);

  let flatIndex = -1;

  return (
    <Modal open={open} onClose={onClose} size="lg" title="Search EventSphere" subtitle="Expos, exhibitors, products, sessions, speakers and booths">
      <div className="relative">
        <Icon name="search" className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
        <input
          ref={inputRef}
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type at least two characters…"
          className="input pl-10"
          aria-label="Search query"
        />
        {loading && <Spinner size="sm" className="absolute right-3.5 top-3.5 text-slate-400" />}
      </div>

      {term.trim().length < 2 && (
        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Try “robotics”, “Green Energy Summit”, “workshop” or “booth A-01”.
        </p>
      )}

      {results && results.totalResults === 0 && !loading && (
        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">No matches for “{results.term}”.</p>
      )}

      <div className="mt-4 space-y-4">
        {grouped.map(({ group, items }) => (
          <div key={group}>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <Icon name={GROUP_ICONS[group] || 'search'} className="h-3.5 w-3.5" />
              {titleCase(group)}
            </p>
            <ul className="space-y-1">
              {items.map((item) => {
                flatIndex += 1;
                const index = flatIndex;
                return (
                  <li key={`${group}-${item.id}`}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(index)}
                      onClick={() => go(item.link)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition',
                        active === index ? 'bg-brand-50 dark:bg-brand-950/50' : 'hover:bg-slate-100 dark:hover:bg-slate-800',
                      )}
                    >
                      {item.image ? (
                        <img src={mediaUrl(item.image)} alt="" className="h-9 w-9 rounded-lg object-cover" />
                      ) : (
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          <Icon name={GROUP_ICONS[group] || 'search'} className="h-4 w-4" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">{item.title}</span>
                        {item.subtitle && <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{item.subtitle}</span>}
                      </span>
                      {item.badge && <span className="badge-neutral shrink-0">{item.badge}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </Modal>
  );
};

export default GlobalSearch;
