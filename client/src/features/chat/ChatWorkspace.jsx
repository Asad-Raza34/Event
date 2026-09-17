import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useDebounce } from '../../hooks/useDebounce';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../context/ToastContext';
import { SOCKET_EVENTS } from '../../lib/socket';
import { cn, formatDateTime, initials, mediaUrl, relativeTime, titleCase } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Avatar, Button, EmptyState, Input, Spinner } from '../../components/ui';
import { Modal } from '../../components/ui/overlay';

const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

const ChatWorkspace = () => {
  const { user } = useAuth();
  const { subscribe, emit, isOnline } = useSocket();
  const toast = useToast();
  const [term, setTerm] = useState('');
  const debounced = useDebounce(term, 300);
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const threadRef = useRef(null);
  const fileRef = useRef(null);

  const conversations = useApi(() => api.chat.conversations({ limit: 50, q: debounced || undefined }), [debounced]);
  const thread = useApi(() => api.chat.conversation(activeId, { limit: 60 }), [activeId], { enabled: Boolean(activeId) });
  const contacts = useApi(() => api.chat.contacts(), [], { enabled: contactsOpen });

  const items = conversations.data || [];
  const activeConversation = thread.data?.conversation || null;
  const messages = thread.data?.messages || [];

  // Select the newest thread by default once the list arrives.
  useEffect(() => {
    if (!activeId && items.length) setActiveId(items[0]._id);
  }, [items, activeId]);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages.length, activeId]);

  // Live messages: append when the open thread matches, otherwise refresh the list.
  useEffect(
    () =>
      subscribe(SOCKET_EVENTS.MESSAGE_NEW, (message) => {
        if (!message?.conversation) return;
        if (String(message.conversation) === String(activeId)) {
          thread.setData((current) => {
            if (!current) return current;
            if (current.messages.some((item) => item._id === message._id)) return current;
            return { ...current, messages: [...current.messages, message] };
          });
          api.chat.markRead(activeId).catch(() => {});
        } else {
          conversations.reload();
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subscribe, activeId],
  );

  useEffect(
    () =>
      subscribe(SOCKET_EVENTS.TYPING_START, (payload) => {
        if (String(payload.conversationId) === String(activeId)) setTypingUser(payload.name || 'Someone');
      }),
    [subscribe, activeId],
  );

  useEffect(
    () =>
      subscribe(SOCKET_EVENTS.TYPING_STOP, (payload) => {
        if (String(payload.conversationId) === String(activeId)) setTypingUser(null);
      }),
    [subscribe, activeId],
  );

  const openConversation = useCallback(
    (conversation) => {
      setActiveId(conversation._id);
      setTypingUser(null);
      emit('conversation:join', { conversationId: conversation._id });
      api.chat.markRead(conversation._id).then(() => conversations.reload()).catch(() => {});
    },
    [emit, conversations],
  );

  const send = useCallback(
    async (attachments = []) => {
      const body = draft.trim();
      if (!activeId || (!body && attachments.length === 0)) return;
      setSending(true);
      try {
        const response = await api.chat.send(activeId, { body, attachments });
        setDraft('');
        thread.setData((current) =>
          current
            ? { ...current, messages: [...current.messages, response.data] }
            : { conversation: activeConversation, messages: [response.data] },
        );
        conversations.reload();
      } catch (error) {
        toast.error(error?.message || 'Message could not be sent');
      } finally {
        setSending(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, activeId, activeConversation, toast],
  );

  const handleTyping = (value) => {
    setDraft(value);
    if (!activeId) return;
    emit('typing:start', { conversationId: activeId });
    clearTimeout(handleTyping.timer);
    handleTyping.timer = setTimeout(() => emit('typing:stop', { conversationId: activeId }), 1400);
  };

  const uploadAttachment = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAttaching(true);
    try {
      const response = await api.uploads.chat([file]);
      const uploaded = (response.data || []).map((item) => ({ name: item.name || file.name, url: item.url || item.publicPath, mimeType: item.mimeType, size: item.size }));
      await send(uploaded);
      toast.success('Attachment sent');
    } catch (error) {
      toast.error(error?.message || 'Upload failed');
    } finally {
      setAttaching(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const startWith = async (contact) => {
    try {
      const response = await api.chat.start({ participantId: contact._id });
      setContactsOpen(false);
      conversations.reload();
      setActiveId(response.data.conversation._id);
      toast.success(`Conversation with ${contact.name} opened`);
    } catch (error) {
      toast.error(error?.message || 'Could not start that conversation');
    }
  };

  const grouped = useMemo(() => items.reduce((acc, item) => (acc.some((entry) => entry._id === item._id) ? acc : [...acc, item]), []), [items]);

  return (
    <div className="grid h-[calc(100vh-13rem)] min-h-[540px] gap-4 lg:grid-cols-[320px_1fr]">
      {/* ------------------------------------------------------ thread list */}
      <aside className="card flex min-h-0 flex-col overflow-hidden">
        <div className="space-y-3 border-b border-slate-100 p-4 dark:border-slate-800">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Conversations</h2>
            <Button size="xs" icon="plus" onClick={() => setContactsOpen(true)}>
              New
            </Button>
          </div>
          <Input
            icon="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search messages"
            aria-label="Search conversations"
          />
        </div>

        <div className="scroll-area flex-1">
          {conversations.loading && !items.length ? (
            <div className="flex items-center justify-center py-10 text-slate-400">
              <Spinner />
            </div>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No conversations yet. Start one with an exhibitor, attendee or organizer.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {grouped.map((conversation) => {
                const other = conversation.participants?.find((participant) => participant._id !== user?._id) || {};
                const unread = conversation.unread || 0;
                return (
                  <li key={conversation._id}>
                    <button
                      type="button"
                      onClick={() => openConversation(conversation)}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60',
                        activeId === conversation._id && 'bg-brand-50/70 dark:bg-brand-950/40',
                      )}
                    >
                      <Avatar src={other.avatar || other.logo} name={other.name || other.companyName || 'User'} size="sm" online={isOnline(other._id)} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold">{other.companyName || other.name || 'Conversation'}</span>
                          <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-400">
                            {conversation.lastMessageAt ? relativeTime(conversation.lastMessageAt) : ''}
                          </span>
                        </span>
                        <span className="mt-0.5 flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-slate-500 dark:text-slate-400">{conversation.lastMessagePreview || 'No messages yet'}</span>
                          {unread > 0 && <span className="shrink-0 rounded-full bg-brand-600 px-1.5 text-[10px] font-bold leading-4 text-white">{unread}</span>}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* ---------------------------------------------------------- thread */}
      <section className="card flex min-h-0 flex-col overflow-hidden">
        {!activeId ? (
          <EmptyState icon="chat" title="Select a conversation" message="Pick a thread on the left or start a new chat." className="m-auto border-0" />
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <Avatar
                src={activeConversation?.otherParticipant?.avatar || activeConversation?.otherParticipant?.logo}
                name={activeConversation?.otherParticipant?.companyName || activeConversation?.otherParticipant?.name || 'User'}
                size="sm"
                online={isOnline(activeConversation?.otherParticipant?._id)}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {activeConversation?.otherParticipant?.companyName || activeConversation?.otherParticipant?.name || 'Conversation'}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {typingUser
                    ? `${typingUser} is typing…`
                    : isOnline(activeConversation?.otherParticipant?._id)
                      ? 'Online now'
                      : `Last seen ${activeConversation?.otherParticipant?.lastSeenAt ? relativeTime(activeConversation.otherParticipant.lastSeenAt) : 'recently'}`}
                </p>
              </div>
              <Link to={`/exhibitors/${activeConversation?.otherParticipant?.slug || ''}`} className="btn-icon" title="View profile" aria-label="View profile">
                <Icon name="eye" className="h-5 w-5" />
              </Link>
            </header>

            <div ref={threadRef} className="scroll-area flex-1 space-y-3 bg-slate-50/60 px-4 py-4 dark:bg-slate-950/40">
              {thread.loading && !messages.length ? (
                <div className="flex items-center justify-center py-10 text-slate-400">
                  <Spinner />
                </div>
              ) : (
                messages.map((message, index) => {
                  const mine = String(message.sender?._id || message.sender) === String(user?._id);
                  const showDate = index === 0 || !sameDay(messages[index - 1].createdAt, message.createdAt);
                  return (
                    <div key={message._id}>
                      {showDate && (
                        <p className="my-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          {new Date(message.createdAt).toDateString()}
                        </p>
                      )}
                      <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                        <div className={cn('max-w-[76%] space-y-1', mine && 'items-end text-right')}>
                          {!mine && <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{message.sender?.name}</p>}
                          <div
                            className={cn(
                              'rounded-2xl px-3.5 py-2.5 text-sm shadow-sm',
                              mine ? 'bg-brand-600 text-white' : 'bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100',
                            )}
                          >
                            {message.body && <p className="whitespace-pre-wrap">{message.body}</p>}
                            {message.attachments?.map((attachment) => (
                              <a
                                key={attachment.url}
                                href={attachment.url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1.5 flex items-center gap-2 text-xs underline"
                              >
                                <Icon name="paperclip" className="h-3.5 w-3.5" /> {attachment.name || 'Attachment'}
                              </a>
                            ))}
                          </div>
                          <p className="text-[10px] uppercase tracking-wide text-slate-400">
                            {formatDateTime(message.createdAt)}
                            {mine && message.readBy?.length > 1 ? ' · read' : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {typingUser && <p className="text-xs italic text-slate-500 dark:text-slate-400">{typingUser} is typing…</p>}
            </div>

            <form
              className="flex items-end gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800"
              onSubmit={(event) => {
                event.preventDefault();
                send();
              }}
            >
              <input ref={fileRef} type="file" className="hidden" onChange={uploadAttachment} />
              <button type="button" className="btn-icon" onClick={() => fileRef.current?.click()} disabled={attaching} title="Attach a file" aria-label="Attach a file">
                {attaching ? <Spinner size="sm" /> : <Icon name="paperclip" className="h-5 w-5" />}
              </button>
              <textarea
                rows={1}
                value={draft}
                onChange={(event) => handleTyping(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    send();
                  }
                }}
                placeholder="Write a message…"
                className="input max-h-32 resize-none"
                aria-label="Message"
              />
              <Button type="submit" icon="send" loading={sending} disabled={!draft.trim()}>
                Send
              </Button>
            </form>
          </>
        )}
      </section>

      <Modal open={contactsOpen} onClose={() => setContactsOpen(false)} title="Start a conversation" subtitle="Organizers, exhibitors and attendees you can message">
        {contacts.loading ? (
          <div className="flex items-center justify-center py-10 text-slate-400">
            <Spinner />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {(contacts.data || []).map((contact) => (
              <li key={contact._id} className="flex items-center gap-3 py-2.5">
                <Avatar src={contact.avatar || contact.logo} name={contact.companyName || contact.name} size="sm" online={contact.isOnline} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{contact.companyName || contact.name}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {titleCase(contact.role)} · {contact.email}
                  </p>
                </div>
                <Button size="xs" onClick={() => startWith(contact)} icon="chat">
                  Chat
                </Button>
              </li>
            ))}
            {(contacts.data || []).length === 0 && (
              <li className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">No contacts available yet.</li>
            )}
          </ul>
        )}
      </Modal>
    </div>
  );
};

export default ChatWorkspace;
