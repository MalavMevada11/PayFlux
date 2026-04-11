import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle, Clock,
  CheckCircle2, CircleDollarSign, AlertCircle, FileText, Users,
  BarChart3, Zap, Timer, Percent
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

function inr(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function inrCompact(n) {
  const v = Number(n || 0);
  if (v >= 10000000) return '₹' + (v / 10000000).toFixed(1) + 'Cr';
  if (v >= 100000) return '₹' + (v / 100000).toFixed(1) + 'L';
  if (v >= 1000) return '₹' + (v / 1000).toFixed(1) + 'K';
  return '₹' + v.toFixed(0);
}

function pctChange(current, previous) {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return 100;
  return Math.round(((current - previous) / previous) * 100);
}

function TrendBadge({ current, previous, invert = false }) {
  const pct = pctChange(current, previous);
  if (pct === 0) return <span className="text-xs text-muted-foreground font-medium">— No change</span>;

  const isPositive = invert ? pct < 0 : pct > 0;
  const Icon = pct > 0 ? TrendingUp : TrendingDown;
  const color = isPositive ? 'text-emerald-600' : 'text-red-500';
  const bg = isPositive ? 'bg-emerald-50' : 'bg-red-50';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${color} ${bg}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(pct)}% vs last month
    </span>
  );
}

const GRANULARITY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const PERIOD_OPTIONS = [
  { value: 'current', label: 'Current Month' },
  { value: 'previous', label: 'Previous Month' },
];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border rounded-lg shadow-xl p-3 text-xs">
      <p className="font-semibold text-foreground mb-1.5">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <div className="h-2.5 w-2.5 rounded-full" style={{ background: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-semibold text-foreground">{inr(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [granularity, setGranularity] = useState('monthly');
  const [kpiPeriod, setKpiPeriod] = useState('current');

  const fetchAnalytics = useCallback(async (gran) => {
    try {
      setLoading(true);
      const result = await api(`/analytics/dashboard?granularity=${gran}`);
      setData(result);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics(granularity);
  }, [granularity, fetchAnalytics]);

  if (loading && !data) {
    return (
      <div className="flex justify-center items-center p-20 text-muted-foreground text-sm gap-2">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Loading analytics…
      </div>
    );
  }

  if (error && !data) {
    return <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">{error}</div>;
  }

  const kpis = data?.kpis;
  const activeKpis = kpiPeriod === 'current' ? kpis?.currentMonth : kpis?.previousMonth;
  const compareKpis = kpiPeriod === 'current' ? kpis?.previousMonth : null;
  const timeline = data?.revenueTimeline || [];
  const insights = data?.paymentInsights || {};

  const periodLabel = kpiPeriod === 'current'
    ? `${kpis?.period?.current?.start} to ${kpis?.period?.current?.end}`
    : `${kpis?.period?.previous?.start} to ${kpis?.period?.previous?.end}`;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Business analytics & insights</p>
        </div>
        {/* Period Toggle */}
        <div className="flex items-center bg-secondary/50 rounded-lg p-1 border border-border/50">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setKpiPeriod(opt.value)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                kpiPeriod === opt.value
                  ? 'bg-background shadow-sm text-foreground border border-border/50'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Period info */}
      <p className="text-xs text-muted-foreground -mt-4 font-medium">
        Showing data for: {periodLabel}
      </p>

      {/* ─── Section 1: KPI Cards ─────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Revenue */}
        <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <div className="h-9 w-9 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
              <DollarSign className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">{inr(activeKpis?.totalRevenue)}</div>
            {compareKpis && (
              <div className="mt-2">
                <TrendBadge current={activeKpis?.totalRevenue} previous={compareKpis?.totalRevenue} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Paid Amount */}
        <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Paid Amount</CardTitle>
            <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-emerald-600">{inr(activeKpis?.paidAmount)}</div>
            {compareKpis && (
              <div className="mt-2">
                <TrendBadge current={activeKpis?.paidAmount} previous={compareKpis?.paidAmount} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Outstanding */}
        <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
            <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-amber-600">{inr(activeKpis?.outstandingAmount)}</div>
            {compareKpis && (
              <div className="mt-2">
                <TrendBadge current={activeKpis?.outstandingAmount} previous={compareKpis?.outstandingAmount} invert />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overdue */}
        <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-rose-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overdue</CardTitle>
            <div className="h-9 w-9 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-red-600">{inr(activeKpis?.overdueAmount)}</div>
            {compareKpis && (
              <div className="mt-2">
                <TrendBadge current={activeKpis?.overdueAmount} previous={compareKpis?.overdueAmount} invert />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoice Count Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-all duration-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <div className="h-3 w-3 rounded-full bg-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeKpis?.counts?.paid || 0}</p>
              <p className="text-xs text-muted-foreground font-medium">Paid</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all duration-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
              <div className="h-3 w-3 rounded-full bg-slate-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeKpis?.counts?.unpaid || 0}</p>
              <p className="text-xs text-muted-foreground font-medium">Unpaid</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all duration-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
              <div className="h-3 w-3 rounded-full bg-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeKpis?.counts?.partial || 0}</p>
              <p className="text-xs text-muted-foreground font-medium">Partial</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all duration-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
              <div className="h-3 w-3 rounded-full bg-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeKpis?.counts?.overdue || 0}</p>
              <p className="text-xs text-muted-foreground font-medium">Overdue</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Section 2: Revenue Charts ────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Revenue Analytics</h2>
          <div className="flex items-center bg-secondary/50 rounded-lg p-1 border border-border/50">
            {GRANULARITY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setGranularity(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                  granularity === opt.value
                    ? 'bg-background shadow-sm text-foreground border border-border/50'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Revenue Over Time */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-indigo-500" />
                Revenue Over Time
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              {timeline.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No revenue data yet</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={timeline} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" tickFormatter={inrCompact} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      name="Revenue"
                      stroke="#6366F1"
                      strokeWidth={2.5}
                      fill="url(#revenueGrad)"
                      dot={{ r: 3, fill: '#6366F1' }}
                      activeDot={{ r: 5, strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Paid vs Unpaid Trend */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-emerald-500" />
                Paid vs Unpaid Trend
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              {timeline.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No data to display</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={timeline} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" tickFormatter={inrCompact} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="paid" name="Paid" stackId="stack" fill="#10B981" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="unpaid" name="Unpaid" stackId="stack" fill="#94A3B8" />
                    <Bar dataKey="partial" name="Partial" stackId="stack" fill="#F59E0B" />
                    <Bar dataKey="overdue" name="Overdue" stackId="stack" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ─── Section 3: Payment Behavior Insights ─────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Payment Behavior</h2>

        {/* Stats Summary Row */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="hover:shadow-md transition-all duration-200">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                <Timer className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{insights.avgPaymentDays || 0} <span className="text-sm font-normal text-muted-foreground">days</span></p>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">Avg Payment Time</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-all duration-200">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                <Percent className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{insights.latePaymentPercent || 0}<span className="text-sm font-normal text-muted-foreground">%</span></p>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">Late Payments</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-all duration-200">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <CircleDollarSign className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{insights.partialPaymentFrequency || 0}<span className="text-sm font-normal text-muted-foreground">%</span></p>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">Partial Payment Freq</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Payers Tables */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Fastest Payers */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-500" />
                Fastest Payers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(!insights.fastestPayers || insights.fastestPayers.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Users className="h-7 w-7 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No payment data yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {insights.fastestPayers.map((p, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-emerald-50/50 hover:bg-emerald-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">{i + 1}</span>
                        <span className="text-sm font-medium truncate max-w-[180px]">{p.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-emerald-600">{p.avgDays} days</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Slowest Payers */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                Slowest Payers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(!insights.slowestPayers || insights.slowestPayers.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Users className="h-7 w-7 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No payment data yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {insights.slowestPayers.map((p, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-red-50/50 hover:bg-red-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100 text-red-700 text-xs font-bold">{i + 1}</span>
                        <span className="text-sm font-medium truncate max-w-[180px]">{p.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-red-600">{p.avgDays} days</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
