import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { TrendingUp, DollarSign, BarChart3, Building2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import KpiCard from '@/components/shared/KpiCard';
import PageHeader from '@/components/shared/PageHeader';

export default function ROI() {
  const [properties, setProperties] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([base44.entities.Property.list(), base44.entities.Transaction.list()]).then(([ps, ts]) => {
      setProperties(ps || []);
      setTransactions(ts || []);
      setLoading(false);
    });
  }, []);

  const activeProps = properties.filter(p => p.status === 'Active');
  const validTxns = transactions.filter(t => !t.void_flag && t.reconciliation_status !== 'Disputed');
  const totalValue = activeProps.reduce((s, p) => s + (p.current_market_value || 0), 0);
  const totalMortgage = activeProps.reduce((s, p) => s + (p.mortgage_outstanding_balance || 0), 0);
  const totalEquity = totalValue - totalMortgage;
  const annualIncome = validTxns.filter(t => t.transaction_type === 'Income').reduce((s, t) => s + (t.amount || 0), 0);
  const annualExpenses = validTxns.filter(t => t.transaction_type === 'Expense').reduce((s, t) => s + Math.abs(t.amount || 0), 0);
  const annualNOI = annualIncome - annualExpenses;
  const annualDebtService = activeProps.reduce((s, p) => s + ((p.mortgage_monthly_payment || 0) * 12), 0);
  const dscr = annualDebtService ? (annualNOI / annualDebtService).toFixed(2) : 'N/A';
  const capRate = totalValue ? ((annualNOI / totalValue) * 100).toFixed(2) : 'N/A';

  // Property-level metrics
  const propMetrics = activeProps.map(p => {
    const propTxns = validTxns.filter(t => t.property_id === p.id);
    const propIncome = propTxns.filter(t => t.transaction_type === 'Income').reduce((s, t) => s + (t.amount || 0), 0);
    const propExpenses = propTxns.filter(t => t.transaction_type === 'Expense').reduce((s, t) => s + Math.abs(t.amount || 0), 0);
    const propNOI = propIncome - propExpenses;
    const propCapRate = p.current_market_value ? ((propNOI / p.current_market_value) * 100).toFixed(1) : null;
    return {
      address: p.address?.substring(0, 20) + (p.address?.length > 20 ? '...' : ''),
      income: Math.round(propIncome),
      expenses: Math.round(propExpenses),
      noi: Math.round(propNOI),
      capRate: propCapRate,
      value: p.current_market_value || 0,
      equity: (p.current_market_value || 0) - (p.mortgage_outstanding_balance || 0),
    };
  });

  // Trailing 12 months NOI
  const noiTrend = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (11 - i));
    const m = d.getMonth(), y = d.getFullYear();
    const income = validTxns.filter(t => {
      const td = new Date(t.date_entered);
      return t.transaction_type === 'Income' && td.getMonth() === m && td.getFullYear() === y;
    }).reduce((s, t) => s + (t.amount || 0), 0);
    const expenses = validTxns.filter(t => {
      const td = new Date(t.date_entered);
      return t.transaction_type === 'Expense' && td.getMonth() === m && td.getFullYear() === y;
    }).reduce((s, t) => s + Math.abs(t.amount || 0), 0);
    return {
      month: d.toLocaleString('default', { month: 'short' }),
      noi: Math.round(income - expenses),
      income: Math.round(income),
    };
  });

  const fmt = (n) => n >= 1000000 ? `$${(n/1000000).toFixed(1)}M` : n >= 1000 ? `$${(n/1000).toFixed(0)}K` : `$${n.toFixed(0)}`;

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      <PageHeader title="ROI & Growth" subtitle="Investment returns, cap rates & portfolio growth" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Portfolio Value" value={fmt(totalValue)} icon={Building2} color="blue" />
        <KpiCard title="Total Equity" value={fmt(totalEquity)} icon={TrendingUp} color="green" />
        <KpiCard title="Cap Rate" value={capRate !== 'N/A' ? `${capRate}%` : 'N/A'} subtitle="Annual NOI / Value" icon={BarChart3} color={parseFloat(capRate) >= 6 ? 'green' : 'yellow'} />
        <KpiCard title="DSCR" value={dscr} subtitle={`Target ≥ 1.25`} icon={DollarSign} color={parseFloat(dscr) >= 1.25 ? 'green' : 'red'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold mb-4">NOI Trend (12 Months)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={noiTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="noi" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(221,83%,53%)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(221,83%,53%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 90%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${v/1000}k`} />
              <Tooltip formatter={(v, n) => [`$${v.toLocaleString()}`, n.toUpperCase()]} />
              <Area type="monotone" dataKey="noi" stroke="hsl(221,83%,53%)" strokeWidth={2} fill="url(#noi)" name="NOI" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold mb-4">Income by Property</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={propMetrics} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 90%)" />
              <XAxis dataKey="address" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${v/1000}k`} />
              <Tooltip formatter={(v) => `$${v.toLocaleString()}`} />
              <Bar dataKey="income" fill="hsl(142,71%,45%)" name="Income" radius={[4,4,0,0]} />
              <Bar dataKey="expenses" fill="hsl(0,84%,60%)" name="Expenses" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Property KPI Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="font-semibold">Property Returns</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-5 font-medium text-muted-foreground">Property</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Market Value</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Equity</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Income</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Expenses</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">NOI</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Cap Rate</th>
              </tr>
            </thead>
            <tbody>
              {propMetrics.map((p, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="py-3 px-5 font-medium">{p.address}</td>
                  <td className="py-3 px-4 text-right">{fmt(p.value)}</td>
                  <td className="py-3 px-4 text-right text-green-600 font-medium">{fmt(p.equity)}</td>
                  <td className="py-3 px-4 text-right text-green-600">{fmt(p.income)}</td>
                  <td className="py-3 px-4 text-right text-red-600">{fmt(p.expenses)}</td>
                  <td className={`py-3 px-4 text-right font-semibold ${p.noi >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(p.noi)}</td>
                  <td className="py-3 px-4 text-right">
                    {p.capRate ? (
                      <span className={`font-medium ${parseFloat(p.capRate) >= 6 ? 'text-green-600' : 'text-yellow-600'}`}>{p.capRate}%</span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
              {propMetrics.length === 0 && (
                <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">Add properties and transactions to see ROI metrics</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}