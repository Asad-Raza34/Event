import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { compactNumber, formatCurrency, formatNumber } from '../../lib/utils';
import { EmptyState } from '../ui';

export const CHART_COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#0ea5e9', '#84cc16'];

const axisProps = {
  stroke: 'currentColor',
  tick: { fontSize: 11, fill: 'currentColor' },
  tickLine: false,
  axisLine: false,
};

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid rgba(148,163,184,0.25)',
  background: 'rgba(15,23,42,0.92)',
  color: '#f8fafc',
  fontSize: 12,
  padding: '8px 12px',
};

const ChartFrame = ({ height = 260, children, empty }) =>
  empty ? (
    <EmptyState icon="chart" title="No data yet" message="Data appears here as soon as activity is recorded." className="border-0 py-8" />
  ) : (
    <div style={{ width: '100%', height }} className="text-slate-400">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );

export const AreaTrend = ({ data = [], xKey = 'label', series = [], height, valueFormatter = compactNumber, stacked = false }) => (
  <ChartFrame height={height} empty={!data.length}>
    <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
      <defs>
        {series.map((item, index) => (
          <linearGradient key={item.key} id={`grad-${item.key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={item.color || CHART_COLORS[index % CHART_COLORS.length]} stopOpacity={0.35} />
            <stop offset="95%" stopColor={item.color || CHART_COLORS[index % CHART_COLORS.length]} stopOpacity={0.02} />
          </linearGradient>
        ))}
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" vertical={false} />
      <XAxis dataKey={xKey} {...axisProps} />
      <YAxis {...axisProps} width={48} tickFormatter={valueFormatter} />
      <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [valueFormatter(value), name]} />
      {series.map((item, index) => (
        <Area
          key={item.key}
          type="monotone"
          dataKey={item.key}
          name={item.label || item.key}
          stroke={item.color || CHART_COLORS[index % CHART_COLORS.length]}
          strokeWidth={2}
          fill={`url(#grad-${item.key})`}
          stackId={stacked ? '1' : undefined}
        />
      ))}
    </AreaChart>
  </ChartFrame>
);

export const BarsChart = ({ data = [], xKey = 'label', series = [], height, horizontal = false, valueFormatter = formatNumber }) => (
  <ChartFrame height={height} empty={!data.length}>
    <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 16, left: horizontal ? 36 : -12, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" vertical={!horizontal} horizontal={horizontal} />
      {horizontal ? <YAxis dataKey={xKey} type="category" {...axisProps} width={110} /> : <XAxis dataKey={xKey} {...axisProps} />}
      {horizontal ? <XAxis type="number" {...axisProps} tickFormatter={valueFormatter} /> : <YAxis {...axisProps} width={48} tickFormatter={valueFormatter} />}
      <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [valueFormatter(value), name]} />
      {series.map((item, index) => (
        <Bar
          key={item.key}
          dataKey={item.key}
          name={item.label || item.key}
          fill={item.color || CHART_COLORS[index % CHART_COLORS.length]}
          radius={[6, 6, 0, 0]}
          maxBarSize={38}
        />
      ))}
    </BarChart>
  </ChartFrame>
);

export const LineTrend = ({ data = [], xKey = 'label', series = [], height }) => (
  <ChartFrame height={height} empty={!data.length}>
    <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" vertical={false} />
      <XAxis dataKey={xKey} {...axisProps} />
      <YAxis {...axisProps} width={48} tickFormatter={compactNumber} />
      <Tooltip contentStyle={tooltipStyle} />
      {series.map((item, index) => (
        <Line
          key={item.key}
          type="monotone"
          dataKey={item.key}
          name={item.label || item.key}
          stroke={item.color || CHART_COLORS[index % CHART_COLORS.length]}
          strokeWidth={2}
          dot={false}
        />
      ))}
    </LineChart>
  </ChartFrame>
);

export const DonutChart = ({ data = [], nameKey = 'name', valueKey = 'value', height = 240, currency }) => (
  <ChartFrame height={height} empty={!data.length}>
    <PieChart>
      <Pie data={data} dataKey={valueKey} nameKey={nameKey} innerRadius="58%" outerRadius="82%" paddingAngle={3}>
        {data.map((entry, index) => (
          <Cell key={entry[nameKey]} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} stroke="transparent" />
        ))}
      </Pie>
      <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
      <Tooltip contentStyle={tooltipStyle} formatter={(value) => (currency ? formatCurrency(value, currency) : formatNumber(value))} />
    </PieChart>
  </ChartFrame>
);

/** Alias for DonutChart – used by the attendee dashboard. */
export const ActivityPie = DonutChart;

/** Horizontal bars for ranked lists such as popular sessions. */
export const RankedBars = ({ items = [], valueKey = 'value', labelKey = 'label', height = 280, valueFormatter = formatNumber }) => (
  <ChartFrame height={height} empty={!items.length}>
    <BarChart data={items} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" horizontal={false} />
      <XAxis type="number" {...axisProps} tickFormatter={valueFormatter} />
      <YAxis type="category" dataKey={labelKey} {...axisProps} width={140} />
      <Tooltip contentStyle={tooltipStyle} formatter={(value) => valueFormatter(value)} />
      <Bar dataKey={valueKey} radius={[0, 6, 6, 0]} maxBarSize={22}>
        {items.map((entry, index) => (
          <Cell key={entry[labelKey]} fill={CHART_COLORS[index % CHART_COLORS.length]} />
        ))}
      </Bar>
    </BarChart>
  </ChartFrame>
);

export default { AreaTrend, BarsChart, LineTrend, DonutChart, RankedBars, ActivityPie };
