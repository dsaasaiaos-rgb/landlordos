import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Building2, MapPin, DollarSign, Edit, Eye, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import StatusBadge from '@/components/shared/StatusBadge';
import PageHeader from '@/components/shared/PageHeader';

const emptyForm = {
  property_type: '', address: '', city: '', state: '', zip: '', county: '', country: 'USA',
  current_market_value: '', purchase_price: '', purchase_date: '', annual_property_tax: '',
  rent_control_jurisdiction: false, status: 'Active',
  mortgage_lender: '', mortgage_monthly_payment: '', mortgage_outstanding_balance: '', mortgage_interest_rate: '',
  insurance_provider: '', insurance_annual_premium: '', insurance_policy_expiry_date: '', insurance_coverage_amount: '',
  notes: ''
};

export default function Properties() {
  const [properties, setProperties] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);

  const load = async () => {
    const [props, us] = await Promise.all([base44.entities.Property.list(), base44.entities.Unit.list()]);
    setProperties(props || []);
    setUnits(us || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true);
    const data = { ...form };
    ['current_market_value', 'purchase_price', 'annual_property_tax', 'mortgage_monthly_payment', 'mortgage_outstanding_balance', 'mortgage_interest_rate', 'insurance_annual_premium', 'insurance_coverage_amount'].forEach(k => {
      if (data[k] !== '') data[k] = parseFloat(data[k]) || 0;
    });
    if (editId) await base44.entities.Property.update(editId, data);
    else await base44.entities.Property.create(data);
    await load();
    setOpen(false);
    setForm(emptyForm);
    setEditId(null);
    setSaving(false);
  };

  const openEdit = (p) => {
    setForm({ ...emptyForm, ...p });
    setEditId(p.id);
    setOpen(true);
  };

  const filtered = properties.filter(p =>
    `${p.address} ${p.city} ${p.state} ${p.property_type}`.toLowerCase().includes(search.toLowerCase())
  );

  const getOccupancy = (propertyId) => {
    const eligible = units.filter(u => u.property_id === propertyId && u.include_in_occupancy_calc !== false);
    const occupied = eligible.filter(u => u.occupancy_status === 'Occupied');
    return { eligible: eligible.length, occupied: occupied.length };
  };

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      <PageHeader
        title="Properties"
        subtitle={`${properties.length} total properties`}
        actions={
          <Button onClick={() => { setForm(emptyForm); setEditId(null); setOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Add Property
          </Button>
        }
      />

      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search properties..." className="pl-9" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(p => {
          const occ = getOccupancy(p.id);
          const occRate = occ.eligible ? Math.round((occ.occupied / occ.eligible) * 100) : 0;
          return (
            <div key={p.id} className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-all animate-fade-in">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground text-sm leading-tight">{p.address}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />{p.city}, {p.state}
                    </div>
                  </div>
                </div>
                <StatusBadge status={p.status} />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-muted/40 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-0.5">Market Value</div>
                  <div className="font-semibold text-sm">{p.current_market_value ? `$${p.current_market_value.toLocaleString()}` : '—'}</div>
                </div>
                <div className="bg-muted/40 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-0.5">Occupancy</div>
                  <div className="font-semibold text-sm">{occ.eligible ? `${occ.occupied}/${occ.eligible} (${occRate}%)` : 'No units'}</div>
                </div>
              </div>

              <div className="text-xs text-muted-foreground mb-3">{p.property_type} · {p.county || 'No county'}</div>

              {occ.eligible > 0 && (
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-3">
                  <div className={`h-full rounded-full transition-all ${occRate >= 95 ? 'bg-green-500' : occRate >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${occRate}%` }} />
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => setSelectedProperty(p)}>
                  <Eye className="w-3 h-3" /> View
                </Button>
                <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => openEdit(p)}>
                  <Edit className="w-3 h-3" /> Edit
                </Button>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && !loading && (
          <div className="col-span-3 py-20 text-center">
            <Building2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No properties found</p>
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Property' : 'Add New Property'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="col-span-2">
              <Label>Address *</Label>
              <Input value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} placeholder="123 Main St" className="mt-1" />
            </div>
            <div>
              <Label>City *</Label>
              <Input value={form.city} onChange={e => setForm(f => ({...f, city: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>State *</Label>
              <Input value={form.state} onChange={e => setForm(f => ({...f, state: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>ZIP</Label>
              <Input value={form.zip} onChange={e => setForm(f => ({...f, zip: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>County</Label>
              <Input value={form.county} onChange={e => setForm(f => ({...f, county: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Property Type *</Label>
              <Select value={form.property_type} onValueChange={v => setForm(f => ({...f, property_type: v}))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {['SFR','Duplex','Triplex','Multi-family','Commercial','Mixed-Use','Land'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({...f, status: v}))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Active','Sold','Under Contract','Renovation','Offline'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Market Value ($)</Label>
              <Input type="number" value={form.current_market_value} onChange={e => setForm(f => ({...f, current_market_value: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Purchase Price ($)</Label>
              <Input type="number" value={form.purchase_price} onChange={e => setForm(f => ({...f, purchase_price: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Purchase Date</Label>
              <Input type="date" value={form.purchase_date} onChange={e => setForm(f => ({...f, purchase_date: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Annual Property Tax ($)</Label>
              <Input type="number" value={form.annual_property_tax} onChange={e => setForm(f => ({...f, annual_property_tax: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Mortgage Lender</Label>
              <Input value={form.mortgage_lender} onChange={e => setForm(f => ({...f, mortgage_lender: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Monthly Mortgage Payment ($)</Label>
              <Input type="number" value={form.mortgage_monthly_payment} onChange={e => setForm(f => ({...f, mortgage_monthly_payment: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Outstanding Balance ($)</Label>
              <Input type="number" value={form.mortgage_outstanding_balance} onChange={e => setForm(f => ({...f, mortgage_outstanding_balance: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Interest Rate (%)</Label>
              <Input type="number" value={form.mortgage_interest_rate} onChange={e => setForm(f => ({...f, mortgage_interest_rate: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Insurance Provider</Label>
              <Input value={form.insurance_provider} onChange={e => setForm(f => ({...f, insurance_provider: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Insurance Expiry Date</Label>
              <Input type="date" value={form.insurance_policy_expiry_date} onChange={e => setForm(f => ({...f, insurance_policy_expiry_date: e.target.value}))} className="mt-1" />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} className="mt-1 w-full min-h-[80px] rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.address || !form.property_type}>
              {saving ? 'Saving...' : editId ? 'Update' : 'Add Property'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Property Detail Modal */}
      {selectedProperty && (
        <Dialog open={!!selectedProperty} onOpenChange={() => setSelectedProperty(null)}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedProperty.address}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              {Object.entries({
                'Type': selectedProperty.property_type,
                'City': selectedProperty.city,
                'State': selectedProperty.state,
                'ZIP': selectedProperty.zip,
                'Status': selectedProperty.status,
                'Market Value': selectedProperty.current_market_value ? `$${selectedProperty.current_market_value.toLocaleString()}` : '—',
                'Purchase Price': selectedProperty.purchase_price ? `$${selectedProperty.purchase_price.toLocaleString()}` : '—',
                'Mortgage Balance': selectedProperty.mortgage_outstanding_balance ? `$${selectedProperty.mortgage_outstanding_balance.toLocaleString()}` : '—',
                'Monthly Payment': selectedProperty.mortgage_monthly_payment ? `$${selectedProperty.mortgage_monthly_payment.toLocaleString()}` : '—',
                'Insurance Expiry': selectedProperty.insurance_policy_expiry_date || '—',
                'Notes': selectedProperty.notes || '—',
              }).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}