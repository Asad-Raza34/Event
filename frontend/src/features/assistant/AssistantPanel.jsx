import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { cn } from '../../lib/utils';
import { ASSISTANT_SUGGESTIONS } from '../../lib/constants';
import Icon from '../../components/ui/Icon';
import { Button, Spinner } from '../../components/ui';

const WELCOME = {
  role: 'assistant',
  content:
    "Hi! I'm the EventSphere assistant. Ask me about sessions, booths, exhibitors, products, venues, appointments or registration — I answer from live event data.",
  sources: [],
};

const AssistantPanel = () => {
  const { isAuthenticated, role } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [provider, setProvider] = useState('');
  const [loadedHistory, setLoadedHistory] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    api.assistant
      .capabilities()
      .then((response) => setProvider(response.data?.model || response.data?.provider || ''))
      .catch(() => setProvider(''));
  }, []);

  // Load the server-side transcript the first time the panel is opened.
  useEffect(() => {
    if (!open || loadedHistory || !isAuthenticated) return;
    setLoadedHistory(true);
    api.assistant
      .history({ limit: 20 })
      .then((response) => {
        const entries = response.data?.messages || [];
        if (!entries.length) return;
        setMessages([WELCOME, ...entries.map((entry) => ({ role: entry.role, content: entry.content, sources: entry.sources || [] }))]);
      })
      .catch(() => {});
  }, [open, loadedHistory, isAuthenticated]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending, open]);

  const send = useCallback(
    async (text) => {
      const question = (text ?? input).trim();
      if (!question || sending) return;
      setInput('');
      setMessages((current) => [...current, { role: 'user', content: question, sources: [] }]);
      setSending(true);
      try {
        const response = await api.assistant.chat({ message: question });
        const data = response.data;
        setMessages((current) => [...current, { role: 'assistant', content: data.answer, sources: data.sources || [], intent: data.intent }]);
        if (data.provider) setProvider(data.provider);
      } catch (error) {
        setMessages((current) => [
          ...current,
          { role: 'assistant', content: error?.message || 'I could not reach the assistant. Please try again.', sources: [] },
        ]);
      } finally {
        setSending(false);
      }
    },
    [input, sending],
  );

  const clear = async () => {
    setMessages([WELCOME]);
    if (isAuthenticated) {
      try {
        await api.assistant.clear();
      } catch {
        toast.error('Could not clear the assistant history');
      }
    }
  };

  const suggestions = ASSISTANT_SUGGESTIONS.slice(0, 3);

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-pop transition hover:bg-brand-700"
          aria-label="Open AI event assistant"
        >
          <Icon name="sparkles" className="h-5 w-5" />
          <span className="hidden sm:inline">Ask the AI assistant</span>
        </button>
      )}

      {open && (
        <section
          className="fixed inset-x-3 bottom-3 z-40 flex max-h-[80vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-pop sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[400px] dark:border-slate-800 dark:bg-slate-900"
          aria-label="AI event assistant"
        >
          <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
              <Icon name="sparkles" className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">AI Event Assistant</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {provider ? `Grounded in EventSphere data · ${provider}` : 'Grounded in EventSphere data'}
              </p>
            </div>
            <button type="button" className="btn-icon" onClick={clear} title="Clear conversation" aria-label="Clear conversation">
              <Icon name="refresh" className="h-4 w-4" />
            </button>
            <button type="button" className="btn-icon" onClick={() => setOpen(false)} title="Close" aria-label="Close assistant">
              <Icon name="x" className="h-4 w-4" />
            </button>
          </header>

          <div ref={scrollRef} className="scroll-area flex-1 space-y-4 px-4 py-4">
            {messages.map((message, index) => (
              <div key={index} className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[86%] rounded-2xl px-3.5 py-2.5 text-sm',
                    message.role === 'user'
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100',
                  )}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  {message.sources?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-200/60 pt-2 dark:border-slate-700">
                      {message.sources.map((source) => (
                        <Link
                          key={`${source.label}-${source.link}`}
                          to={source.link}
                          className="badge-info text-[11px] hover:underline"
                          onClick={() => setOpen(false)}
                        >
                          <Icon name="chevron-right" className="h-3 w-3" />
                          {source.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Spinner size="sm" /> Searching event data…
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => send(suggestion)}
                  className="badge-neutral text-[11px] transition hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-950 dark:hover:text-brand-300"
                >
                  {suggestion}
                </button>
              ))}
            </div>
            <form
              className="flex items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                send();
              }}
            >
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    send();
                  }
                }}
                placeholder="Ask about sessions, booths, exhibitors…"
                className="input max-h-28 resize-none"
                aria-label="Your question"
              />
              <Button type="submit" icon="send" loading={sending} disabled={!input.trim()} className="shrink-0">
                Send
              </Button>
            </form>
            {!isAuthenticated && (
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                Signed out? You can keep asking public questions, or{' '}
                <Link to="/login" className="link">
                  sign in
                </Link>{' '}
                for {role ? 'your' : 'personalised'} answers.
              </p>
            )}
          </div>
        </section>
      )}
    </>
  );
};

export default AssistantPanel;
