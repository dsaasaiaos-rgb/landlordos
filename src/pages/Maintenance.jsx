import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Wrench, Search, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import StatusBadge from '@/components/shared/StatusBadge';
import KpiCard from '@/components/shared/KpiCard';
import PageHeader from '@/components/shared/PageHeader';

const SLA_HOURS = { Emergency: 24, High: 48, Medium: 168, Low: 720 };

const emptyForm = {
  property_id: '', unit_id: '', tenant_id: '', vendor_id: '',
  category: 'General', priority: 'Medium', status: 'Open',
  ticket_scope: 'Unit-Specific', description: '',
  date_reported: new Date().toISOString().split('T')[0],
  preventive: false, tenant_caused: false, is_emergency_call: false,
  estimated_cost: '', actual_cost: '', resolution_notes: ''
};

export default function Maintenance() {
  const [tickets, setTickets] = useState([]);
  const [properties, setProperties] = useState([]);
  const [units, setUnits] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('open');
  const [search, setSearch] = useState('');

  const load = async () => {
    const [tix, props, us, vs, ts] = await Promise.all([
      base44.entities.MaintenanceTicket.list('-date_reported', 200),
      base44.entities.Property.list(),
      base44.entities.Unit.list(),
      base44.entities.Vendor.list(),
      base44.entities.Tenant.list(),
    ]);
    setTickets(tix || []);
    setProperties(props || []);
    setUnits(us || []);
    setVendors(vs || []);
    setTenants(ts || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true);
    const data = { ...form };
    ['estimated_cost', 'actual_cost'].forEach(k => { if (data[k] !== '') data[k] = parseFloat(data[k]) || 0; });
    // Auto-calculate SLA target
    if (data.date_reported && data.priority) {
      const d = new Date(data.date_reported);
      d.setHours(d.getHours() + (SLA_HOURS[data.priority] || 168));
      data.sla_target_date = d.toISOString().split('T')[0];
    }
    if (editId) await base44.entities.MaintenanceTicket.update(editId, data);
    else await base44.entities.MaintenanceTicket.create(data);
    await load();
    setOpen(false);
    setForm(emptyForm);
    setEditId(null);
    setSaving(false);
  };

  const getSLAStatus = (ticket) => {
    if (!ticket.sla_target_date || ticket.status === 'Completed' || ticket.status === 'Cancelled') return null;
    const target = new Date(ticket.sla_target_date);
    const now = new Date();
    const hours = (target - now) / (1000 * 60 * 60);
    if (hours < 0) return 'breached';
    if (hours < 4) return 'critical';
    if (hours < 24) return 'warning';
    return 'ok';
  };

  const openTickets = tickets.filter(t => ['Open', 'Assigned', 'In_Progress', 'Pending_Parts'].includes(t.status));
  const emergencyOpen = openTickets.filter(t => t.priority === 'Emergency');
  const completedTickets = tickets.filter(t => t.status === 'Completed');
  const slaTotal = completedTickets.length;
  const slaMet = completedTickets.filter(t => t.sla_met !== false).length;
  const slaRate = slaTotal ? Math.round((slaMet / slaTotal) * 100) : 0;
  const avgCost = completedTickets.filter(t => t.actual_cost).reduce((s, t, _, a) => s + t.actual_cost / a.length, 0);

  const filtered = tickets.filter(t => {
    const desc = `${t.description || ''} ${t.category || ''}`.toLowerCase();
    const matchSearch = desc.includes(search.toLowerCase());
    const matchFilter = filter === 'all' ||
      (filter === 'open' && ['Open', 'Assigned', 'In_Progress', 'Pending_Parts'].includes(t.status)) ||
      (filter === 'emergency' && t.priority === 'Emergency') ||
      (filter === 'completed' && t.status === 'Completed');
    return matchSearch && matchFilter;
  });

  const getPropName = (id) => properties.find(p => p.id === id)?.address || '—';
  const getUnitName = (id) => units.find(u => u.id === id)?.unit_number || '—';
  const getVendorName = (id) => vendors.find(v => v.id === id)?.company_name || '—';

  const priorityColor = { Emergency: 'text-red-600 bg-red-50', High: 'text-orange-600 bg-orange-50', Medium: 'text-yellow-600 bg-yellow-50', Low: 'text-gray-600 bg-gray-50' };

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      <PageHeader
        title="Maintenance"
        subtitle="Tickets, SLA tracking & vendor management"
        actions={
          <Button onClick={() => { setForm(emptyForm); setEditId(null); setOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> New Ticket
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Open Tickets" value={openTickets.length} subtitle={`${emergencyOpen.length} emergency`} icon={Wrench} color={emergencyOpen.length > 0 ? 'red' : 'orange'} />
        <KpiCard title="SLA Compliance" value={`${slaRate}%`} subtitle={`${slaMet}/${slaTotal} met`} icon={CheckCircle} color={slaRate >= 90 ? 'green' : slaRate >= 75 ? 'yellow' : 'red'} />
        <KpiCard title="Avg Repair Cost" value={avgCost ? `$${avgCost.toFixed(0)}` : '—'} icon={Wrench} color="blue" />
        <KpiCard title="Emergency Open" value={emergencyOpen.length} icon={AlertTriangle} color="red" />
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tickets..." className="pl-9" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="emergency">Emergency</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {filtered.map(t => {
          const slaStatus = getSLAStatus(t);
          return (
            <div key={t.id} className="bg-card rounded-xl border border-border p-4 hover:shadow-sm transition-all animate-fade-in">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`p-2 rounded-lg flex-shrink-0 ${priorityColor[t.priority] || 'text-gray-600 bg-gray-50'}`}>
                    <Wrench className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-foreground">{t.description}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {getPropName(t.property_id)} {t.unit_id && `· Unit ${getUnitName(t.unit_id)}`}
                      {t.vendor_id && ` · ${getVendorName(t.vendor_id)}`}
                    </div>
                    {t.sla_target_date && (
                      <div className={`text-xs mt-1 flex items-center gap-1 ${slaStatus === 'breached' ? 'text-red-500' : slaStatus === 'critical' ? 'text-orange-500' : 'text-muted-foreground'}`}>
                        <Clock className="w-3 h-3" />
                        SLA: {t.sla_target_date} {slaStatus === 'breached' ? '(BREACHED)' : ''}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs font-medium px-2 py-1 rounded-lg ${priorityColor[t.priority] || ''}`}>{t.priority}</span>
                  <StatusBadge status={t.status} />
                  <div className="text-right">
                    {t.actual_cost && <div className="text-sm font-semibold">${t.actual_cost.toLocaleString()}</div>}
                    <div className="text-xs text-muted-foreground">{t.date_reported}</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setForm({...emptyForm, ...t}); setEditId(t.id); setOpen(true); }}>
                    Edit
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="py-20 text-center bg-card rounded-xl border border-border">
            <Wrench className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No tickets found</p>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Ticket' : 'New Maintenance Ticket'}</DialogTitle>
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
              <Label>Unit</Label>
              <Select value={form.unit_id} onValueChange={v => setForm(f => ({...f, unit_id: v}))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{units.filter(u => !form.property_id || u.property_id === form.property_id).map(u => <SelectItem key={u.id} value={u.id}>{u.unit_number}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category *</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({...f, category: v}))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{['Plumbing','HVAC','Electrical','Structural','Appliance','General','Other'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority *</Label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({...f, priority: v}))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{['Emergency','High','Medium','Low'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({...f, status: v}))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{['Open','Assigned','In_Progress','Pending_Parts','Completed','Cancelled'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vendor</Label>
              <Select value={form.vendor_id} onValueChange={v => setForm(f => ({...f, vendor_id: v}))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Assign vendor" /></SelectTrigger>
                <SelectContent>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date Reported *</Label>
              <Input type="date" value={form.date_reported} onChange={e => setForm(f => ({...f, date_reported: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Date Resolved</Label>
              <Input type="date" value={form.date_resolved || ''} onChange={e => setForm(f => ({...f, date_resolved: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Estimated Cost ($)</Label>
              <Input type="number" value={form.estimated_cost} onChange={e => setForm(f => ({...f, estimated_cost: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Actual Cost ($)</Label>
              <Input type="number" value={form.actual_cost} onChange={e => setForm(f => ({...f, actual_cost: e.target.value}))} className="mt-1" />
            </div>
            <div className="col-span-2">
              <Label>Description *</Label>
              <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} className="mt-1 w-full min-h-[80px] rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            {form.status === 'Completed' && (
              <div className="col-span-2">
                <Label>Resolution Notes *</Label>
                <textarea value={form.resolution_notes} onChange={e => setForm(f => ({...f, resolution_notes: e.target.value}))} className="mt-1 w-full min-h-[80px] rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.property_id || !form.description}>
              {saving ? 'Saving...' : editId ? 'Update' : 'Create Ticket'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}