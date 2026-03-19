import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, DollarSign, Search, Filter, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import StatusBadge from '@/components/shared/StatusBadge';
import KpiCard from '@/components/shared/KpiCard';
import PageHeader from '@/components/shared/PageHeader';

const emptyForm = {
  property_id: '', unit_id: '', tenant_id: '',
  transaction_type: 'Income', category: 'Rent', schedule_e_line: 'N/A',
  amount: '', date_entered: new Date().toISOString().split('T')[0],
  payment_method: 'ACH', description: '', reconciliation_status: 'Unreconciled',
  transaction_scope: 'Unit-Specific', tax_deductible: false, void_flag: false
};

const COLORS = ['hsl(221,83%,53%)', 'hsl(142,71%,45%)', 'hsl(38,92%,50%)', 'hsl(291,64%,42%)', 'hsl(0,84%,60%)', 'hsl(197,71%,52%)'];

export default function Finances() {
  const [transactions, setTransactions] = useState([]);
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const load = async () => {
    const [txns, props, ts, us] = await Promise.all([
      base44.entities.Transaction.list('-date_entered', 200),
      base44.entities.Property.list(),
      base44.entities.Tenant.list(),
      base44.entities.Unit.list(),
    ]);
    setTransactions(txns || []);
    setProperties(props || []);
    setTenants(ts || []);
    setUnits(us || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true);
    const data = { ...form, amount: parseFloat(form.amount) || 0 };
    if (editId) await base44.entities.Transaction.update(editId, data);
    else await base44.entities.Transaction.create(data);
    await load();
    setOpen(false);
    setForm(emptyForm);
    setEditId(null);
    setSaving(false);
  };

  const validTxns = transactions.filter(t => !t.void_flag && t.reconciliation_status !== 'Disputed');
  const income = validTxns.filter(t => t.transaction_type === 'Income').reduce((s, t) => s + (t.amount || 0), 0);
  const expenses = validTxns.filter(t => t.transaction_type === 'Expense').reduce((s, t) => s + Math.abs(t.amount || 0), 0);
  const noi = income - expenses;
  const unreconciled = transactions.filter(t => t.reconciliation_status === 'Unreconciled' && !t.void_flag).length;

  // Category breakdown
  const expByCategory = validTxns.filter(t => t.transaction_type === 'Expense').reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount || 0);
    return acc;
  }, {});
  const pieData = Object.entries(expByCategory).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value).slice(0, 6);

  const filtered = transactions.filter(t => {
    const desc = `${t.description || ''} ${t.category || ''}`.toLowerCase();
    const matchSearch = desc.includes(search.toLowerCase());
    const matchFilter = filter === 'all' || t.transaction_type === filter || t.reconciliation_status === filter;
    return matchSearch && matchFilter;
  });

  const getPropName = (id) => properties.find(p => p.id === id)?.address || '—';
  const getTenantName = (id) => { const t = tenants.find(t => t.id === id); return t ? `${t.first_name} ${t.last_name}` : '—'; };

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      <PageHeader
        title="Finances"
        subtitle="Income, expenses & reconciliation"
        actions={
          <Button onClick={() => { setForm(emptyForm); setEditId(null); setOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Add Transaction
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Total Income" value={`$${income.toLocaleString()}`} icon={DollarSign} color="green" />
        <KpiCard title="Total Expenses" value={`$${expenses.toLocaleString()}`} icon={DollarSign} color="red" />
        <KpiCard title="Net Operating Income" value={`$${noi.toLocaleString()}`} icon={DollarSign} color={noi >= 0 ? 'blue' : 'red'} />
        <KpiCard title="Unreconciled" value={unreconciled} subtitle="transactions" icon={AlertCircle} color="orange" />
      </div>

      {pieData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-semibold mb-4">Expense Breakdown</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({name, percent}) => `${name} ${(percent*100).toFixed(0)}%`}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => `$${v.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-semibold mb-4">Schedule E Categories (YTD)</h3>
            <div className="space-y-2 overflow-y-auto max-h-48">
              {Object.entries(validTxns.filter(t => t.transaction_type === 'Expense' && t.schedule_e_line && t.schedule_e_line !== 'N/A').reduce((acc, t) => {
                acc[t.schedule_e_line] = (acc[t.schedule_e_line] || 0) + Math.abs(t.amount || 0);
                return acc;
              }, {})).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm py-1 border-b border-border/50">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium">${v.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search transactions..." className="pl-9" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="Income">Income</SelectItem>
            <SelectItem value="Expense">Expenses</SelectItem>
            <SelectItem value="Unreconciled">Unreconciled</SelectItem>
            <SelectItem value="Reconciled">Reconciled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-5 font-medium text-muted-foreground">Date</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Description</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Property</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Category</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Amount</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Reconciled</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map(t => (
                <tr key={t.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${t.void_flag ? 'opacity-40' : ''}`}>
                  <td className="py-3 px-5 text-muted-foreground">{t.date_entered}</td>
                  <td className="py-3 px-4">
                    <div className="font-medium max-w-[200px] truncate">{t.description || '—'}</div>
                    {t.void_flag && <span className="text-xs text-red-500">VOIDED</span>}
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground max-w-[120px] truncate">{getPropName(t.property_id)}</td>
                  <td className="py-3 px-4 text-xs">{t.category}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${t.transaction_type === 'Income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {t.transaction_type}
                    </span>
                  </td>
                  <td className={`py-3 px-4 text-right font-semibold ${t.transaction_type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                    {t.transaction_type === 'Income' ? '+' : '-'}${Math.abs(t.amount || 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-4"><StatusBadge status={t.reconciliation_status} /></td>
                  <td className="py-3 px-4 text-right">
                    <Button variant="ghost" size="sm" onClick={() => { setForm({...emptyForm, ...t}); setEditId(t.id); setOpen(true); }}>
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-muted-foreground">
                    <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    No transactions found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Transaction' : 'Add Transaction'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <Label>Type *</Label>
              <Select value={form.transaction_type} onValueChange={v => setForm(f => ({...f, transaction_type: v}))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Income', 'Expense', 'Transfer', 'Adjustment'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category *</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({...f, category: v}))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Rent','Late_Fee','Deposit','Repair','Insurance','Tax','Mortgage','Utility','Management','Legal','Other'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount ($) *</Label>
              <Input type="number" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Date *</Label>
              <Input type="date" value={form.date_entered} onChange={e => setForm(f => ({...f, date_entered: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Property *</Label>
              <Select value={form.property_id} onValueChange={v => setForm(f => ({...f, property_id: v}))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select property" /></SelectTrigger>
                <SelectContent>
                  {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Scope</Label>
              <Select value={form.transaction_scope} onValueChange={v => setForm(f => ({...f, transaction_scope: v}))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Unit-Specific', 'Property-Wide', 'Shared-Allocation'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.transaction_type === 'Expense' && (
              <div>
                <Label>Schedule E Line</Label>
                <Select value={form.schedule_e_line} onValueChange={v => setForm(f => ({...f, schedule_e_line: v}))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Advertising','Auto','Cleaning','Commissions','Insurance','Legal','Management','Mortgage_Interest','Repairs','Supplies','Taxes','Utilities','Depreciation','Other','N/A'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Payment Method</Label>
              <Select value={form.payment_method} onValueChange={v => setForm(f => ({...f, payment_method: v}))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Check','ACH','Credit_Card','Cash','Wire','Other'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reconciliation</Label>
              <Select value={form.reconciliation_status} onValueChange={v => setForm(f => ({...f, reconciliation_status: v}))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Unreconciled','Pending','Reconciled','Disputed'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} className="mt-1" />
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.amount || !form.property_id}>
              {saving ? 'Saving...' : editId ? 'Update' : 'Add Transaction'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}