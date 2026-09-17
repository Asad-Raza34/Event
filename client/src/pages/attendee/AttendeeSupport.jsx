import { useState } from 'react';
import api from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { formatDate, titleCase } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, CardHeader, Textarea, Tabs } from '../../components/ui';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/data';
import PageHeader from '../../components/common/PageHeader';

const CATEGORY_TABS = [
  { value: 'all', label: 'All', icon: 'grid' },
  { value: 'technical', label: 'Technical', icon: 'settings' },
  { value: 'billing', label: 'Billing', icon: 'credit-card' },
  { value: 'accessibility', label: 'Accessibility', icon: 'user-cog' },
  { value: 'other', label: 'Other', icon: 'chat' },
];

const AttendeeSupport = () => {
  const toast = useToast();
  const [category, setCategory] = useState('technical');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [ticketsError, setTicketsError] = useState(null);

  const loadTickets = async () => {
    setTicketsLoading(true);
    try {
      const response = await api.tickets.list({ limit: 20 });
      setTickets(response.data || []);
    } catch (error) {
      setTicketsError(error?.message || 'Could not load tickets');
    } finally {
      setTicketsLoading(false);
    }
  };

  const submitTicket = async () => {
    if (!subject.trim() || !body.trim()) return;
    setLoading(true);
    try {
      await api.tickets.create({ category, subject, body });
      toast.success('Support ticket submitted');
      setSubject('');
      setBody('');
      loadTickets();
    } catch (error) {
      toast.error(error?.message || 'Could not submit ticket');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="Help & support" subtitle="Create a ticket or browse our help articles. We typically respond within 24 hours." icon="lifebuoy" />

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader title="New ticket" icon="plus" />
          <div className="card-pad space-y-4">
            <div>
              <label className="label">Category</label>
              <Tabs active={category} onChange={setCategory} tabs={CATEGORY_TABS} size="sm" className="mt-2" />
            </div>
            <div>
              <label className="label">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1.5 input"
                placeholder="Brief summary of your issue"
                maxLength={100}
              />
            </div>
            <div>
              <label className="label">Description</label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder="Describe the issue in detail. Include steps to reproduce, browser/device info, screenshots if helpful…"
              />
            </div>
            <Button className="w-full" icon="send" loading={loading} onClick={submitTicket}>
              Submit ticket
            </Button>
          </div>
        </Card>

        <Card className="flex flex-col">
          <CardHeader title="Your tickets" subtitle="Recent support requests" icon="ticket" />
          <div className="card-pad flex-1">
            {ticketsLoading ? (
              <LoadingState rows={3} />
            ) : ticketsError ? (
              <ErrorState error={{ message: ticketsError }} onRetry={loadTickets} />
            ) : tickets.length === 0 ? (
              <EmptyState icon="ticket" title="No tickets yet" message="Your submitted tickets will appear here." />
            ) : (
              <ul className="space-y-3 overflow-y-auto max-h-[400px]">
                {tickets.map((ticket) => (
                  <li key={ticket._id} className="card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{ticket.subject}</h3>
                          <Badge tone="neutral">{titleCase(ticket.category)}</Badge>
                          <Badge status={ticket.status} />
                        </div>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 line-clamp-2">{ticket.body}</p>
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          {formatDate(ticket.createdAt)} · {ticket.replies?.length || 0} replies
                        </p>
                      </div>
                      <Button size="sm" variant="secondary" icon="eye" onClick={() => {}}>
                        View
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-5">
        <Card>
          <CardHeader title="Quick help" icon="info" />
          <div className="card-pad grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: 'chat', title: 'Live chat', desc: 'Talk to support during business hours', action: 'Start chat' },
              { icon: 'mail', title: 'Email us', desc: 'support@eventspheres.com', action: 'Send email' },
              { icon: 'file', title: 'Help centre', desc: 'Guides, FAQs and troubleshooting', action: 'Browse' },
              { icon: 'phone', title: 'Call us', desc: '+1 (555) 123-4567', action: 'Call now' },
            ].map((item) => (
              <div key={item.title} className="card flex flex-col p-4 hover:shadow-md">
                <span className="rounded-xl bg-brand-50 p-2 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
                  <Icon name={item.icon} className="h-5 w-5" />
                </span>
                <h4 className="mt-3 font-semibold">{item.title}</h4>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{item.desc}</p>
                <Button variant="ghost" size="sm" className="mt-auto" icon="chevron-right">
                  {item.action}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AttendeeSupport;