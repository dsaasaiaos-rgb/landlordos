import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, FileText, Search, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import StatusBadge from '@/components/shared/StatusBadge';
import PageHeader from '@/components/shared/PageHeader';

const emptyForm = {
  property_id: '', unit_id: '', tenant_id: '',
  lease_type: 'Fixed', start_date: '', end_date: '',
  base_rent: '', notice_period: 30, auto_renewal: false,
  renewal_status: 'Active', grace_period_days: 5,
  rent_escalation_clause: false, escalation_percentage_or_dollar: '',
  security_deposit_terms: '', late_fee_policy: '',
  pet_policy: '', utilities_included: false, parking_included: false,
  subletting_allowed: false, landlord_signed: false, tenant_signed: false,
  lead_paint_addendum: false, mold_disclosure: false,
  move_in_checklist_signed: false, rent_control_applicable: false,
  special_terms_addenda: '', guarantor_name: '', jurisdiction_state: ''
};

export default function Leases() {
  const [leases, setLeases] = useState([]);
  const [properties, setProperties] = useState([]);
  const [units, setUnits] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('Active');
  const [search, setSearch] = useState('');

  const load = async () => {
    const [ls, ps, us, ts] = await Promise.all([
      base44.entities.Lease.list('-created_date', 200),
      base44.entities.Property.list(),
      base44.entities.Unit.list(),
      base44.entities.Tenant.list(),
    ]);
    setLeases(ls || []);
    setProperties(ps || []);
    setUnits(us || []);
    setTenants(ts || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true);
    const data = { ...form, base_rent: parseFloat(form.base_rent) || 0 };
    if (editId) await base44.entities.Lease.update(editId, data);
    else await base44.entities.Lease.create(data);
    await load();
    setOpen(false);
    setForm(emptyForm);
    setEditId(null);
    setSaving(false);
  };

  const getPropName = (id) => properties.find(p => p.id === id)?.address || '—';
  const getUnitName = (id) => units.find(u => u.id === id)?.unit_number || '—';
  const getTenantName = (id) => { const t = tenants.find(t => t.id === id); return t ? `${t.first_name} ${t.last_name}` : '—'; };

  const filtered = leases.filter(l => {
    const tenant = getTenantName(l.tenant_id);
    const matchSearch = `${tenant} ${getPropName(l.property_id)}`.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || l.renewal_status === filter;
    return matchSearch && matchFilter;
  });

  // Expiring leases (next 90 days)
  const expiringLeases = leases.filter(l => {
    if (!l.end_date || l.renewal_status !== 'Active') return false;
    const d = new Date(l.end_date);
    const diff = (d - new Date()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 90;
  }).sort((a, b) => new Date(a.end_date) - new Date(b.end_date));

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      <PageHeader
        title="Leases"
        subtitle={`${leases.filter(l => l.renewal_status === 'Active').length} active leases`}
        actions={
          <Button onClick={() => { setForm(emptyForm); setEditId(null); setOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> New Lease
          </Button>
        }
      />

      {expiringLeases.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-yellow-700" />
            <span className="font-semibold text-yellow-800 text-sm">Leases Expiring in 90 Days</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {expiringLeases.map(l => {
              const days = Math.round((new Date(l.end_date) - new Date()) / (1000 * 60 * 60 * 24));
              return (
                <span key={l.id} className={`text-xs px-2.5 py-1 rounded-lg font-medium ${days < 30 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {getTenantName(l.tenant_id)} · {days}d
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leases..." className="pl-9" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Expired">Expired</SelectItem>
            <SelectItem value="Renewed">Renewed</SelectItem>
            <SelectItem value="Terminated">Terminated</SelectItem>
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
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Rent</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Start</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">End</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => {
                const daysLeft = l.end_date ? Math.round((new Date(l.end_date) - new Date()) / (1000 * 60 * 60 * 24)) : null;
                return (
                  <tr key={l.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-5 font-medium">{getTenantName(l.tenant_id)}</td>
                    <td className="py-3 px-4 text-xs">
                      <div>{getPropName(l.property_id)}</div>
                      <div className="text-muted-foreground">Unit {getUnitName(l.unit_id)}</div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{l.lease_type}</td>
                    <td className="py-3 px-4 font-semibold">${(l.base_rent || 0).toLocaleString()}/mo</td>
                    <td className="py-3 px-4 text-muted-foreground">{l.start_date || '—'}</td>
                    <td className="py-3 px-4">
                      {l.end_date ? (
                        <div>
                          <div>{l.end_date}</div>
                          {daysLeft !== null && (
                            <div className={`text-xs ${daysLeft < 30 ? 'text-red-500' : daysLeft < 60 ? 'text-yellow-600' : 'text-muted-foreground'}`}>
                              {daysLeft < 0 ? 'Expired' : `${daysLeft}d left`}
                            </div>
                          )}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="py-3 px-4"><StatusBadge status={l.renewal_status} /></td>
                    <td className="py-3 px-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => { setForm({...emptyForm, ...l}); setEditId(l.id); setOpen(true); }}>Edit</Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="py-16 text-center text-muted-foreground">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />No leases found
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Lease' : 'New Lease'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <Label>Property *</Label>
              <Select value={form.property_id} onValueChange={v => setForm(f => ({...f, property_id: v}))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Unit *</Label>
              <Select value={form.unit_id} onValueChange={v => setForm(f => ({...f, unit_id: v}))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{units.filter(u => !form.property_id || u.property_id === form.property_id).map(u => <SelectItem key={u.id} value={u.id}>{u.unit_number}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tenant *</Label>
              <Select value={form.tenant_id} onValueChange={v => setForm(f => ({...f, tenant_id: v}))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Lease Type *</Label>
              <Select value={form.lease_type} onValueChange={v => setForm(f => ({...f, lease_type: v}))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{['Fixed','MTM','NNN','Gross','Modified_Gross'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Start Date *</Label>
              <Input type="date" value={form.start_date} onChange={e => setForm(f => ({...f, start_date: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>End Date *</Label>
              <Input type="date" value={form.end_date} onChange={e => setForm(f => ({...f, end_date: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Base Rent ($) *</Label>
              <Input type="number" value={form.base_rent} onChange={e => setForm(f => ({...f, base_rent: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Grace Period (days)</Label>
              <Input type="number" value={form.grace_period_days} onChange={e => setForm(f => ({...f, grace_period_days: parseInt(e.target.value)}))} className="mt-1" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.renewal_status} onValueChange={v => setForm(f => ({...f, renewal_status: v}))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{['Active','Renewed','Expired','Non-Renewed','Terminated'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Jurisdiction/State</Label>
              <Input value={form.jurisdiction_state} onChange={e => setForm(f => ({...f, jurisdiction_state: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Late Fee Policy</Label>
              <Input value={form.late_fee_policy} onChange={e => setForm(f => ({...f, late_fee_policy: e.target.value}))} placeholder="e.g. 5% after 5 days" className="mt-1" />
            </div>
            <div>
              <Label>Escalation</Label>
              <Input value={form.escalation_percentage_or_dollar} onChange={e => setForm(f => ({...f, escalation_percentage_or_dollar: e.target.value}))} placeholder="e.g. 3% annually" className="mt-1" />
            </div>
            <div className="col-span-2">
              <Label>Special Terms</Label>
              <textarea value={form.special_terms_addenda} onChange={e => setForm(f => ({...f, special_terms_addenda: e.target.value}))} className="mt-1 w-full min-h-[70px] rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.property_id || !form.base_rent}>
              {saving ? 'Saving...' : editId ? 'Update' : 'Create Lease'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}