import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { BarsChart, DonutChart } from '../../components/charts';
import { formatCurrency, formatNumber, titleCase } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Card, CardHeader, StatCard } from '../../components/ui';
import PageHeader from '../../components/common/PageHeader';
import PaymentsTable from '../../features/payments/PaymentsTable';

const AdminPayments = () => {
  const stats = useApi(() => api.payments.stats(), []);
  const analytics = useApi(() => api.analytics.admin({ days: 14 }), []);

  const rows = Array.isArray(stats.data) ? stats.data : [];
  const revenue = rows.reduce((sum, item) => sum + (item.revenue || 0), 0);
  const paidCount = rows.reduce((sum, item) => sum + (item.count || 0), 0);
  const byPurpose = rows.map((item) => ({ name: titleCase(item.purpose || 'other'), value: item.revenue || 0 }));
  const revenueTrend = (analytics.data?.trends?.revenue || []).map((row) => ({ label: row.label, revenue: Math.round(row.revenue || 0) }));

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Booth bookings, tickets and session fees — confirm, refund and download invoices."
        icon="credit-card"
        actions={
          <span className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <Icon name="lock" className="h-3.5 w-3.5" /> Card data never touches the platform
          </span>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue collected" value={formatCurrency(revenue)} icon="credit-card" tone="success" />
        <StatCard label="Paid transactions" value={formatNumber(paidCount)} icon="check" tone="brand" />
        <StatCard label="Average order" value={formatCurrency(paidCount ? revenue / paidCount : 0)} icon="chart" tone="info" />
        <StatCard label="Revenue streams" value={formatNumber(rows.length)} icon="box" tone="warning" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Revenue by purpose" subtitle="Where the money comes from" icon="credit-card" />
          <div className="card-pad">
            <DonutChart data={byPurpose} height={250} currency="USD" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Daily revenue" subtitle="Last 14 days" icon="chart" />
          <div className="card-pad">
            <BarsChart
              data={revenueTrend}
              series={[{ key: 'revenue', label: 'Revenue', color: '#10b981' }]}
              height={250}
              valueFormatter={(value) => formatCurrency(value)}
            />
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Payment ledger" subtitle="Every transaction with invoice access" icon="clipboard" />
        <div className="card-pad">
          <PaymentsTable admin />
        </div>
      </Card>
    </div>
  );
};

export default AdminPayments;
