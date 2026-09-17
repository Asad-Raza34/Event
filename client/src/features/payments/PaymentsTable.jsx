import { useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useListQuery } from '../../hooks/useListQuery';
import { formatCurrency, formatDateTime, titleCase } from '../../lib/utils';
import { Badge, Button, Select, Table } from '../../components/ui';
import { DataState, Pagination, TableSkeleton } from '../../components/ui/data';
import { ConfirmDialog } from '../../components/ui/overlay';

const STATUSES = ['pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded'];

/**
 * Payment ledger shared by the organizer, exhibitor and attendee dashboards.
 * `scope="admin"` shows the whole ledger, otherwise the signed-in user's own.
 */
const PaymentsTable = ({ admin = false, compact = false }) => {
  const { isAdmin } = useAuth();
  const canManage = admin && isAdmin;
  const toast = useToast();
  const list = useListQuery((query) => (admin ? api.payments.list(query) : api.payments.mine(query)), { limit: compact ? 6 : 15 });
  const [confirmAction, setConfirmAction] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!confirmAction) return;
    setBusy(true);
    try {
      const { payment, action } = confirmAction;
      if (action === 'confirm') await api.payments.confirm(payment._id, {});
      if (action === 'cancel') await api.payments.cancel(payment._id);
      if (action === 'refund') await api.payments.refund(payment._id, { reason: 'Refunded by organizer' });
      toast.success(`Payment ${action === 'confirm' ? 'confirmed' : action === 'cancel' ? 'cancelled' : 'refunded'}`);
      setConfirmAction(null);
      list.reload();
    } catch (error) {
      toast.error(error?.message || 'The payment could not be updated');
    } finally {
      setBusy(false);
    }
  };

  const openInvoice = async (payment) => {
    try {
      const html = await api.payments.invoiceHtml(payment._id);
      const win = window.open('', '_blank');
      if (!win) {
        toast.warning('Allow pop-ups to view the invoice');
        return;
      }
      win.document.write(html);
      win.document.close();
    } catch (error) {
      toast.error(error?.message || 'Invoice unavailable');
    }
  };

  const columns = [
    {
      key: 'reference',
      label: 'Reference',
      render: (row) => (
        <div>
          <p className="font-mono text-xs font-semibold">{row.reference || row.transactionId || row._id.slice(-8)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{row.description || titleCase(row.purpose)}</p>
        </div>
      ),
    },
    ...(canManage
      ? [
          {
            key: 'user',
            label: 'Payer',
            render: (row) => (
              <div>
                <p className="text-sm font-medium">{row.user?.name || '—'}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{row.user?.email}</p>
              </div>
            ),
          },
        ]
      : [
          {
            key: 'purpose',
            label: 'Purpose',
            render: (row) => titleCase(row.purpose),
          },
        ]),
    { key: 'total', label: 'Amount', render: (row) => <span className="font-semibold">{formatCurrency(row.total, row.currency)}</span> },
    { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} dot /> },
    { key: 'createdAt', label: 'Created', render: (row) => <span className="text-xs">{formatDateTime(row.createdAt)}</span> },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button size="xs" variant="secondary" icon="download" onClick={() => openInvoice(row)}>
            Invoice
          </Button>
          {['pending', 'processing'].includes(row.status) && (
            <Button size="xs" icon="check" onClick={() => setConfirmAction({ payment: row, action: 'confirm' })}>
              Pay
            </Button>
          )}
          {['pending', 'processing'].includes(row.status) && (
            <Button size="xs" variant="ghost" onClick={() => setConfirmAction({ payment: row, action: 'cancel' })}>
              Cancel
            </Button>
          )}
          {canManage && row.status === 'paid' && (
            <Button size="xs" variant="ghost" onClick={() => setConfirmAction({ payment: row, action: 'refund' })}>
              Refund
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      {!compact && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="w-[170px]">
            <Select
              value={list.filters.status || ''}
              placeholder="All statuses"
              options={STATUSES.map((status) => ({ value: status, label: titleCase(status) }))}
              onChange={(event) => list.setFilter('status', event.target.value)}
              aria-label="Filter by payment status"
            />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {list.meta?.revenue !== undefined ? `${formatCurrency(list.meta.revenue, list.meta.currency)} collected · ` : ''}
            {list.meta?.total ?? 0} transactions
          </p>
        </div>
      )}

      <DataState
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        skeleton={<TableSkeleton rows={compact ? 4 : 6} columns={4} />}
      >
        <Table
          columns={columns}
          rows={list.items}
          empty={
            <div className="card card-pad text-center text-sm text-slate-500 dark:text-slate-400">
              No payments yet. Booth bookings, tickets and session fees appear here.
            </div>
          }
        />
        {!compact && <Pagination meta={list.meta} onPageChange={list.setPage} />}
      </DataState>

      <ConfirmDialog
        open={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        onConfirm={run}
        loading={busy}
        title={
          confirmAction?.action === 'refund'
            ? 'Issue a refund?'
            : confirmAction?.action === 'cancel'
              ? 'Cancel this payment?'
              : 'Confirm payment'
        }
        confirmLabel={confirmAction?.action === 'refund' ? 'Refund' : confirmAction?.action === 'cancel' ? 'Cancel payment' : 'Confirm payment'}
        message={
          confirmAction?.action === 'refund'
            ? 'The payment will be marked as refunded and the payer notified. This cannot be undone.'
            : confirmAction?.action === 'cancel'
              ? 'The payment will be cancelled and any linked booking released.'
              : 'This marks the payment as settled and unlocks the linked booking or pass.'
        }
      />
    </div>
  );
};

export default PaymentsTable;
