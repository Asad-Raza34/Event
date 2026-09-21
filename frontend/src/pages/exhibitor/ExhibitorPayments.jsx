import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { formatCurrency, titleCase } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Card, CardHeader, StatCard } from '../../components/ui';
import { EmptyState } from '../../components/ui/data';
import PageHeader from '../../components/common/PageHeader';
import PaymentsTable from '../../features/payments/PaymentsTable';

const ExhibitorPayments = () => {
  const workspace = useApi(() => api.exhibitors.workspace(), []);
  const payments = useApi(() => api.payments.mine({ limit: 100 }), []);

  const booths = workspace.data?.booths || [];
  const outstanding = booths.reduce((sum, booth) => sum + (booth.status === 'reserved' ? booth.price || 0 : 0), 0);
  const committed = booths.reduce((sum, booth) => sum + (booth.price || 0), 0);
  const paid = (payments.data || []).filter((payment) => payment.status === 'paid').reduce((sum, payment) => sum + (payment.total || 0), 0);

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Booth booking fees, confirmations and printable invoices — all in one ledger."
        icon="credit-card"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total paid" value={formatCurrency(paid)} hint="All settled transactions" icon="check" tone="success" />
        <StatCard label="Committed booth spend" value={formatCurrency(committed)} hint={`${booths.length} booths`} icon="map" tone="brand" />
        <StatCard label="Awaiting payment" value={formatCurrency(outstanding)} hint="Reserved booths pending approval" icon="clock" tone="warning" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader title="Payment history" subtitle="Invoices are downloadable for accounting" icon="clipboard" />
          <div className="card-pad">
            <PaymentsTable />
          </div>
        </Card>

        <aside className="space-y-5">
          <Card>
            <CardHeader title="Booth fees" subtitle="What you owe per booth" icon="map" />
            <div className="card-pad">
              {booths.length === 0 ? (
                <EmptyState icon="map" title="No booths yet" className="border-0" />
              ) : (
                <ul className="space-y-3">
                  {booths.map((booth) => (
                    <li key={booth._id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                      <div>
                        <p className="text-sm font-semibold">
                          {booth.zone}-{booth.number}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{booth.expo?.title}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{formatCurrency(booth.price, booth.currency)}</p>
                        <Badge status={booth.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="How booth billing works" icon="info" />
            <div className="card-pad space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <p className="flex items-start gap-2">
                <Icon name="handshake" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                Requesting a booth places a soft reservation — no charge yet.
              </p>
              <p className="flex items-start gap-2">
                <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                When the organizer approves, an invoice is generated automatically.
              </p>
              <p className="flex items-start gap-2">
                <Icon name="lock" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                Card details are handled by the payment gateway; EventSphere never stores them.
              </p>
              <p className="flex items-start gap-2">
                <Icon name="download" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                Every payment has a printable invoice in the ledger.
              </p>
            </div>
          </Card>

          {payments.data?.length > 0 && (
            <Card>
              <CardHeader title="Latest receipt" icon="ticket" />
              <div className="card-pad text-sm">
                <p className="font-medium">{payments.data[0].description || titleCase(payments.data[0].purpose)}</p>
                <p className="mt-1 text-slate-500 dark:text-slate-400">
                  {formatCurrency(payments.data[0].total, payments.data[0].currency)} · <Badge status={payments.data[0].status} />
                </p>
              </div>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
};

export default ExhibitorPayments;
