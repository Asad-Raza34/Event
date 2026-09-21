import { useState } from 'react';
import api from '../../lib/api';
import { useListQuery } from '../../hooks/useListQuery';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDate, titleCase } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, CardHeader, StatCard } from '../../components/ui';
import { EmptyState, ErrorState, LoadingState, Pagination } from '../../components/ui/data';
import PageHeader from '../../components/common/PageHeader';
import FilterBar from '../../components/common/FilterBar';

const AttendeePayments = () => {
  const toast = useToast();
  const list = useListQuery((query) => api.payments.mine(query), { limit: 10 });
  const [refunding, setRefunding] = useState(null);
  const [busy, setBusy] = useState(false);

  const payments = list.items;
  const totalPaid = payments
    .filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + (p.total || 0), 0);
  const totalRefunded = payments
    .filter((p) => p.status === 'refunded')
    .reduce((sum, p) => sum + (p.total || 0), 0);
  const pendingCount = payments.filter((p) => p.status === 'pending').length;

  const confirmRefund = async () => {
    if (!refunding) return;
    setBusy(true);
    try {
      await api.payments.refund(refunding._id, { reason: 'Requested by attendee' });
      toast.success('Refund requested');
      setRefunding(null);
      list.reload();
    } catch (error) {
      toast.error(error?.message || 'Refund could not be requested');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Payment history"
        subtitle="All your transactions, invoices and refund requests across every expo."
        icon="credit-card"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Paid" value={formatCurrency(totalPaid)} hint="Completed payments" icon="check" tone="success" />
        <StatCard label="Refunded" value={formatCurrency(totalRefunded)} hint="Returned amount" icon="refresh" tone="info" />
        <StatCard label="Pending" value={pendingCount} hint="Awaiting completion" icon="clock" tone="warning" />
        <StatCard label="Total transactions" value={list.meta?.total ?? payments.length} hint="All time" icon="credit-card" />
      </div>

      <div className="mt-5">
        <FilterBar
          search={list.search}
          onSearch={list.setSearch}
          searchPlaceholder="Search by description, expo or invoice…"
          onReset={list.reset}
          filters={[
            {
              name: 'status',
              label: 'Status',
              value: list.filters.status || '',
              options: [
                { value: 'pending', label: 'Pending' },
                { value: 'completed', label: 'Completed' },
                { value: 'failed', label: 'Failed' },
                { value: 'refunded', label: 'Refunded' },
                { value: 'cancelled', label: 'Cancelled' },
              ],
              onChange: (value) => list.setFilter('status', value),
            },
          ]}
        />

        {list.loading ? (
          <LoadingState rows={3} />
        ) : list.error ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : payments.length === 0 ? (
          <EmptyState
            icon="credit-card"
            title="No payments yet"
            message="Your transaction history will appear here once you register for a paid expo or purchase products."
          />
        ) : (
          <>
            <div className="space-y-3">
              {payments.map((payment) => (
                <Card key={payment._id} className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="font-semibold">{payment.description || titleCase(payment.purpose)}</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {payment.expo?.title || payment.exhibitor?.companyName || 'EventSpheres'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-lg">{formatCurrency(payment.total, payment.currency)}</p>
                          <Badge status={payment.status} />
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatDate(payment.createdAt)}</p>
                      {payment.invoiceNumber && <p className="text-xs text-slate-500 dark:text-slate-400">Invoice: {payment.invoiceNumber}</p>}
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {payment.status === 'completed' && payment.refundable && (
                        <Button size="sm" variant="ghost" icon="refresh" onClick={() => setRefunding(payment)}>
                          Request refund
                        </Button>
                      )}
                      {payment.status === 'completed' && (
                        <Button size="sm" variant="secondary" icon="file" onClick={() => window.open(api.payments.invoiceUrl(payment._id), '_blank')}>
                          Invoice
                        </Button>
                      )}
                      <Button size="sm" variant="secondary" icon="eye" onClick={() => {}}>
                        Details
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <Pagination meta={list.meta} onPageChange={list.setPage} />
          </>
        )}
      </div>

      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        style={{ display: refunding ? 'flex' : 'none' }}
      >
        <Card className="w-full max-w-md p-6">
          <h2 className="text-lg font-semibold">Request refund?</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            This will notify the organiser. Refunds are processed according to the expo's refund policy.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRefunding(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} onClick={confirmRefund}>
              Request refund
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AttendeePayments;