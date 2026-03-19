import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, User, Search, Edit, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import StatusBadge from '@/components/shared/StatusBadge';
import PageHeader from '@/components/shared/PageHeader';

const emptyForm = {
  first_name: '', last_name: '', email: '', primary_phone: '',
  unit_id: '', property_id: '', monthly_rent: '', monthly_income: '',
  lease_start_date: '', lease_end_date: '', security_deposit_amount: '',
  payment_status: 'Current', status: 'Active', risk_flag: 'Low',
  move_in_date: '', payment_method: 'ACH', auto_pay: false,
  outstanding_balance: 0, late_payment_count_ytd: 0,
  employer_name: '', emergency_contact_name: '', emergency_contact_phone: '',
  credit_score_at_signing: '', background_check_status: 'Pending',
  renewal_likelihood: 'Unknown', notes: ''
};

export default function Tenants() {
  const [tenants, setTenants] = useState([]);
  const [properties, setProperties] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [ts, ps, us] = await Promise.all([
      base44.entities.Tenant.list(),
      base44.entities.Property.list(),
      base44.entities.Unit.list(),
    ]);
    setTenants(ts || []);
    setProperties(ps || []);
    setUnits(us || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true);
    const data = { ...form };
    ['monthly_rent', 'monthly_income', 'security_deposit_amount', 'outstanding_balance', 'credit_score_at_signing'].forEach(k => {
      if (data[k] !== '' && data[k] !== undefined) data[k] = parseFloat(data[k]) || 0;
    });
    if (editId) await base44.entities.Tenant.update(editId, data);
    else await base44.entities.Tenant.create(data);
    await load();
    setOpen(false);
    setForm(emptyForm);
    setEditId(null);
    setSaving(false);
  };

  const openEdit = (t) => {
    setForm({ ...emptyForm, ...t });
    setEditId(t.id);
    setOpen(true);
  };

  const getPropertyName = (id) => {
    const p = properties.find(p => p.id === id);
    return p ? p.address : '—';
  };

  const getUnitName = (id) => {
    const u = units.find(u => u.id === id);
    return u ? u.unit_number : '—';
  };

  const filtered = tenants.filter(t => {
    const name = `${t.first_name} ${t.last_name} ${t.email}`.toLowerCase();
    const matchSearch = name.includes(search.toLowerCase());
    const matchFilter = filter === 'all' || 
      (filter === 'active' && t.status === 'Active') ||
      (filter === 'late' && t.payment_status !== 'Current') ||
      (filter === 'expiring' && t.lease_end_date && (() => {
        const d = new Date(t.lease_end_date);
        const diff = (d - new Date()) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 90;
      })());
    return matchSearch && matchFilter;
  });

  // Calculate risk score
  const getRiskScore = (t) => {
    const payScore = { 'Current': 100, '1-30 Late': 70, '30-60 Late': 40, '60-90 Late': 20, 'Collections': 0 };
    const pay = (payScore[t.payment_status] || 100) * 0.5;
    const bal = (t.outstanding_balance || 0) === 0 ? 100 * 0.25 : t.outstanding_balance < 500 ? 60 * 0.25 : 0;
    const complaints = t.complaint_count_ytd || 0;
    const comp = (complaints === 0 ? 100 : complaints <= 2 ? 70 : complaints <= 4 ? 40 : 0) * 0.1;
    return Math.round(pay + bal + comp);
  };

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      <PageHeader
        title="Tenants"
        subtitle={`${tenants.filter(t => t.status === 'Active').length} active tenants`}
        actions={
          <Button onClick={() => { setForm(emptyForm); setEditId(null); setOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Add Tenant
          </Button>
        }
      />

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tenants..." className="pl-9" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tenants</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="late">Late Payment</SelectItem>
            <SelectItem value="expiring">Lease Expiring</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-5 font-medium text-muted-foreground">Tenant</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Property / Unit</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Rent</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Payment</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Risk</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Lease End</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Balance</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const score = getRiskScore(t);
                const risk = score >= 80 ? 'Low' : score >= 60 ? 'Medium' : score >= 40 ? 'High' : 'Critical';
                const leaseEnd = t.lease_end_date ? new Date(t.lease_end_date) : null;
                const daysToEnd = leaseEnd ? Math.round((leaseEnd - new Date()) / (1000 * 60 * 60 * 24)) : null;
                return (
                  <tr key={t.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-xs font-bold text-primary">{t.first_name?.[0]}{t.last_name?.[0]}</span>
                        </div>
                        <div>
                          <div className="font-medium">{t.first_name} {t.last_name}</div>
                          <div className="text-xs text-muted-foreground">{t.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-xs">
                        <div className="font-medium text-foreground">{getPropertyName(t.property_id)}</div>
                        <div className="text-muted-foreground">Unit {getUnitName(t.unit_id)}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium">${(t.monthly_rent || 0).toLocaleString()}/mo</td>
                    <td className="py-3 px-4"><StatusBadge status={t.payment_status || 'Current'} /></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={risk} />
                        <span className="text-xs text-muted-foreground">{score}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {leaseEnd ? (
                        <div>
                          <div className="text-xs font-medium">{leaseEnd.toLocaleDateString()}</div>
                          <div className={`text-xs ${daysToEnd < 30 ? 'text-red-500' : daysToEnd < 60 ? 'text-yellow-600' : 'text-muted-foreground'}`}>
                            {daysToEnd < 0 ? 'Expired' : `${daysToEnd}d left`}
                          </div>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="py-3 px-4">
                      {(t.outstanding_balance || 0) > 0 ? (
                        <span className="text-red-600 font-medium">${t.outstanding_balance.toLocaleString()}</span>
                      ) : <span className="text-green-600">$0</span>}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-muted-foreground">
                    <User className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    No tenants found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Tenant' : 'Add New Tenant'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <Label>First Name *</Label>
              <Input value={form.first_name} onChange={e => setForm(f => ({...f, first_name: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Last Name *</Label>
              <Input value={form.last_name} onChange={e => setForm(f => ({...f, last_name: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Phone *</Label>
              <Input value={form.primary_phone} onChange={e => setForm(f => ({...f, primary_phone: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Property</Label>
              <Select value={form.property_id} onValueChange={v => setForm(f => ({...f, property_id: v}))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select property" /></SelectTrigger>
                <SelectContent>
                  {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Unit</Label>
              <Select value={form.unit_id} onValueChange={v => setForm(f => ({...f, unit_id: v}))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select unit" /></SelectTrigger>
                <SelectContent>
                  {units.filter(u => !form.property_id || u.property_id === form.property_id).map(u => <SelectItem key={u.id} value={u.id}>{u.unit_number}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Monthly Rent ($) *</Label>
              <Input type="number" value={form.monthly_rent} onChange={e => setForm(f => ({...f, monthly_rent: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Monthly Income ($)</Label>
              <Input type="number" value={form.monthly_income} onChange={e => setForm(f => ({...f, monthly_income: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Lease Start</Label>
              <Input type="date" value={form.lease_start_date} onChange={e => setForm(f => ({...f, lease_start_date: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Lease End</Label>
              <Input type="date" value={form.lease_end_date} onChange={e => setForm(f => ({...f, lease_end_date: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Security Deposit ($)</Label>
              <Input type="number" value={form.security_deposit_amount} onChange={e => setForm(f => ({...f, security_deposit_amount: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Move-In Date</Label>
              <Input type="date" value={form.move_in_date} onChange={e => setForm(f => ({...f, move_in_date: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Payment Status</Label>
              <Select value={form.payment_status} onValueChange={v => setForm(f => ({...f, payment_status: v}))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Current', '1-30 Late', '30-60 Late', '60-90 Late', 'Collections'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({...f, status: v}))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Active', 'Former', 'Applicant'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Outstanding Balance ($)</Label>
              <Input type="number" value={form.outstanding_balance} onChange={e => setForm(f => ({...f, outstanding_balance: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Renewal Likelihood</Label>
              <Select value={form.renewal_likelihood} onValueChange={v => setForm(f => ({...f, renewal_likelihood: v}))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['High', 'Medium', 'Low', 'Unknown'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Credit Score</Label>
              <Input type="number" value={form.credit_score_at_signing} onChange={e => setForm(f => ({...f, credit_score_at_signing: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Employer</Label>
              <Input value={form.employer_name} onChange={e => setForm(f => ({...f, employer_name: e.target.value}))} className="mt-1" />
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.first_name || !form.last_name || !form.email}>
              {saving ? 'Saving...' : editId ? 'Update' : 'Add Tenant'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}