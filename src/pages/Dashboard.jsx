import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { 
  Building2, Users, DollarSign, Wrench, TrendingUp, 
  AlertTriangle, CheckCircle, Clock, ArrowRight, Home
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import KpiCard from '@/components/shared/KpiCard';
import StatusBadge from '@/components/shared/StatusBadge';
import PageHeader from '@/components/shared/PageHeader';

export default function Dashboard() {
  const [properties, setProperties] = useState([]);
  const [units, setUnits] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.Property.list(),
      base44.entities.Unit.list(),
      base44.entities.Tenant.list(),
      base44.entities.Transaction.list(),
      base44.entities.MaintenanceTicket.list(),
    ]).then(([props, units, tenants, txns, tix]) => {
      setProperties(props || []);
      setUnits(units || []);
      setTenants(tenants || []);
      setTransactions(txns || []);
      setTickets(tix || []);
      setLoading(false);
    });
  }, []);

  // KPI Calculations
  const activeProperties = properties.filter(p => p.status === 'Active');
  const eligibleUnits = units.filter(u => u.include_in_occupancy_calc !== false);
  const occupiedUnits = eligibleUnits.filter(u => u.occupancy_status === 'Occupied');
  const occupancyRate = eligibleUnits.length ? ((occupiedUnits.length / eligibleUnits.length) * 100).toFixed(1) : 0;
  const activeTenants = tenants.filter(t => t.status === 'Active');

  const nonVoidTxns = transactions.filter(t => !t.void_flag && t.reconciliation_status !== 'Disputed');
  const incomeThisMonth = nonVoidTxns.filter(t => {
    const d = new Date(t.date_entered);
    const now = new Date();
    return t.transaction_type === 'Income' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((sum, t) => sum + (t.amount || 0), 0);

  const expensesThisMonth = nonVoidTxns.filter(t => {
    const d = new Date(t.date_entered);
    const now = new Date();
    return t.transaction_type === 'Expense' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

  const noi = incomeThisMonth - expensesThisMonth;
  const totalPortfolioValue = activeProperties.reduce((sum, p) => sum + (p.current_market_value || 0), 0);
  const totalMortgageBalance = activeProperties.reduce((sum, p) => sum + (p.mortgage_outstanding_balance || 0), 0);
  const totalEquity = totalPortfolioValue - totalMortgageBalance;

  const openTickets = tickets.filter(t => ['Open', 'Assigned', 'In_Progress'].includes(t.status));
  const emergencyTickets = openTickets.filter(t => t.priority === 'Emergency');

  const latePayTenants = activeTenants.filter(t => t.payment_status !== 'Current' && t.payment_status);
  const totalOutstandingBalance = activeTenants.reduce((sum, t) => sum + (t.outstanding_balance || 0), 0);

  // Monthly revenue chart data (last 6 months)
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const m = d.getMonth(), y = d.getFullYear();
    const income = nonVoidTxns.filter(t => {
      const td = new Date(t.date_entered);
      return t.transaction_type === 'Income' && td.getMonth() === m && td.getFullYear() === y;
    }).reduce((s, t) => s + (t.amount || 0), 0);
    const expenses = nonVoidTxns.filter(t => {
      const td = new Date(t.date_entered);
      return t.transaction_type === 'Expense' && td.getMonth() === m && td.getFullYear() === y;
    }).reduce((s, t) => s + Math.abs(t.amount || 0), 0);
    return {
      month: d.toLocaleString('default', { month: 'short' }),
      income: Math.round(income),
      expenses: Math.round(expenses),
      noi: Math.round(income - expenses)
    };
  });

  const fmt = (n) => n >= 1000000 ? `$${(n/1000000).toFixed(1)}M` : n >= 1000 ? `$${(n/1000).toFixed(0)}K` : `$${n.toFixed(0)}`;

  const alerts = [
    ...emergencyTickets.map(t => ({ type: 'critical', msg: `Emergency ticket: ${t.description?.substring(0, 50)}` })),
    ...latePayTenants.slice(0, 3).map(t => ({ type: 'warning', msg: `Late payment: ${t.first_name} ${t.last_name} — ${t.payment_status}` })),
    ...activeTenants.filter(t => {
      if (!t.lease_end_date) return false;
      const d = new Date(t.lease_end_date);
      const diff = (d - new Date()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 60;
    }).slice(0, 3).map(t => ({ type: 'info', msg: `Lease expiring: ${t.first_name} ${t.last_name}` })),
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      <PageHeader 
        title="Portfolio Overview"
        subtitle={`${activeProperties.length} active properties · ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`}
        actions={
          <Link to="/Properties" className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Building2 className="w-4 h-4" /> Add Property
          </Link>
        }
      />

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard title="Portfolio Value" value={fmt(totalPortfolioValue)} icon={Building2} color="blue" />
        <KpiCard title="Total Equity" value={fmt(totalEquity)} icon={TrendingUp} color="green" />
        <KpiCard title="Monthly NOI" value={fmt(noi)} icon={DollarSign} color={noi >= 0 ? 'green' : 'red'} />
        <KpiCard title="Occupancy Rate" value={`${occupancyRate}%`} subtitle={`${occupiedUnits.length}/${eligibleUnits.length} units`} icon={Home} color={occupancyRate >= 95 ? 'green' : occupancyRate >= 85 ? 'yellow' : 'red'} />
        <KpiCard title="Active Tenants" value={activeTenants.length} subtitle={`${latePayTenants.length} late`} icon={Users} color="purple" />
        <KpiCard title="Open Tickets" value={openTickets.length} subtitle={`${emergencyTickets.length} emergency`} icon={Wrench} color={emergencyTickets.length > 0 ? 'red' : 'orange'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="xl:col-span-2 bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-4">Revenue vs Expenses (6 Months)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="income" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(221 83% 53%)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(221 83% 53%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0 84% 60%)" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="hsl(0 84% 60%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 90%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${v/1000}k`} />
              <Tooltip formatter={(v) => `$${v.toLocaleString()}`} />
              <Area type="monotone" dataKey="income" stroke="hsl(221 83% 53%)" strokeWidth={2} fill="url(#income)" name="Income" />
              <Area type="monotone" dataKey="expenses" stroke="hsl(0 84% 60%)" strokeWidth={2} fill="url(#expenses)" name="Expenses" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Alerts Feed */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Active Alerts</h3>
            <span className="text-xs text-muted-foreground">{alerts.length} items</span>
          </div>
          <div className="space-y-2">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
                <p className="text-sm text-muted-foreground">All clear! No alerts.</p>
              </div>
            ) : alerts.map((a, i) => (
              <div key={i} className={`flex items-start gap-2.5 p-3 rounded-lg ${
                a.type === 'critical' ? 'bg-red-50 border border-red-200' :
                a.type === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
                'bg-blue-50 border border-blue-200'
              }`}>
                {a.type === 'critical' ? <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" /> :
                 a.type === 'warning' ? <Clock className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" /> :
                 <Clock className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />}
                <p className="text-xs font-medium text-foreground">{a.msg}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Properties table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="font-semibold text-foreground">Properties at a Glance</h3>
          <Link to="/Properties" className="text-sm text-primary hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {activeProperties.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No properties yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add your first property to get started</p>
            <Link to="/Properties" className="inline-flex items-center gap-2 mt-4 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
              <Building2 className="w-4 h-4" /> Add Property
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-5 font-medium text-muted-foreground">Property</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Market Value</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Occupancy</th>
                </tr>
              </thead>
              <tbody>
                {activeProperties.slice(0, 8).map(p => {
                  const propUnits = eligibleUnits.filter(u => u.property_id === p.id);
                  const propOccupied = propUnits.filter(u => u.occupancy_status === 'Occupied');
                  const occ = propUnits.length ? Math.round((propOccupied.length / propUnits.length) * 100) : 0;
                  return (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-5">
                        <div className="font-medium text-foreground">{p.address}</div>
                        <div className="text-xs text-muted-foreground">{p.city}, {p.state}</div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{p.property_type}</td>
                      <td className="py-3 px-4"><StatusBadge status={p.status} /></td>
                      <td className="py-3 px-4 text-right font-medium">{p.current_market_value ? `$${p.current_market_value.toLocaleString()}` : '—'}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${occ >= 95 ? 'bg-green-500' : occ >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${occ}%` }} />
                          </div>
                          <span className="text-sm font-medium">{occ}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}