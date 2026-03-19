import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Store, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import PageHeader from '@/components/shared/PageHeader';

const STAGES = ['Prospect', 'Under_Offer', 'Under_Contract', 'Financing', 'Closing', 'Closed', 'Abandoned'];

const stageColors = {
  Prospect: 'bg-gray-100 border-gray-200',
  Under_Offer: 'bg-blue-50 border-blue-200',
  Under_Contract: 'bg-purple-50 border-purple-200',
  Financing: 'bg-yellow-50 border-yellow-200',
  Closing: 'bg-orange-50 border-orange-200',
  Closed: 'bg-green-50 border-green-200',
  Abandoned: 'bg-red-50 border-red-200',
};

const stageDotColor = {
  Prospect: 'bg-gray-400',
  Under_Offer: 'bg-blue-500',
  Under_Contract: 'bg-purple-500',
  Financing: 'bg-yellow-500',
  Closing: 'bg-orange-500',
  Closed: 'bg-green-500',
  Abandoned: 'bg-red-400',
};

const emptyForm = {
  property_address: '', stage: 'Prospect', probability_of_close: 50,
  target_close_date: '', purchase_price: '', expected_down_payment: '',
  expected_cap_rate: '', expected_cash_flow_monthly: '',
  property_type: 'SFR', units: '', notes: ''
};

export default function Pipeline() {
  const [pipeline, setPipeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const ps = await base44.entities.Pipeline.list();
    setPipeline(ps || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true);
    const data = { ...form };
    ['purchase_price', 'expected_down_payment', 'expected_cap_rate', 'expected_cash_flow_monthly', 'probability_of_close', 'units'].forEach(k => {
      if (data[k] !== '' && data[k] !== undefined) data[k] = parseFloat(data[k]) || 0;
    });
    if (editId) await base44.entities.Pipeline.update(editId, data);
    else await base44.entities.Pipeline.create(data);
    await load();
    setOpen(false);
    setForm(emptyForm);
    setEditId(null);
    setSaving(false);
  };

  const pipelineByStage = STAGES.reduce((acc, stage) => {
    acc[stage] = pipeline.filter(p => p.stage === stage);
    return acc;
  }, {});

  const totalPipelineValue = pipeline.filter(p => p.stage !== 'Abandoned').reduce((s, p) => s + ((p.purchase_price || 0) * ((p.probability_of_close || 0) / 100)), 0);

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      <PageHeader
        title="Acquisition Pipeline"
        subtitle={`${pipeline.filter(p => !['Closed', 'Abandoned'].includes(p.stage)).length} active deals`}
        actions={
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Weighted Pipeline</div>
              <div className="font-bold text-primary">${totalPipelineValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            </div>
            <Button onClick={() => { setForm(emptyForm); setEditId(null); setOpen(true); }} className="gap-2">
              <Plus className="w-4 h-4" /> Add Deal
            </Button>
          </div>
        }
      />

      {/* Kanban board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.filter(s => s !== 'Abandoned').map(stage => (
          <div key={stage} className="flex-shrink-0 w-64">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-2 h-2 rounded-full ${stageDotColor[stage]}`} />
              <span className="text-sm font-medium text-foreground">{stage.replace(/_/g, ' ')}</span>
              <span className="text-xs text-muted-foreground ml-auto">{pipelineByStage[stage].length}</span>
            </div>
            <div className="space-y-2.5">
              {pipelineByStage[stage].map(deal => (
                <div key={deal.id} className={`rounded-xl border p-3.5 cursor-pointer hover:shadow-sm transition-all ${stageColors[stage]}`}
                  onClick={() => { setForm({...emptyForm, ...deal}); setEditId(deal.id); setOpen(true); }}>
                  <div className="font-medium text-sm mb-1">{deal.property_address}</div>
                  <div className="text-xs text-muted-foreground">{deal.property_type}</div>
                  {deal.purchase_price && (
                    <div className="mt-2 text-sm font-semibold">${deal.purchase_price.toLocaleString()}</div>
                  )}
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-white/60 rounded-full overflow-hidden">
                      <div className="h-full bg-primary/60 rounded-full" style={{ width: `${deal.probability_of_close || 0}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">{deal.probability_of_close || 0}%</span>
                  </div>
                  {deal.target_close_date && (
                    <div className="text-xs text-muted-foreground mt-1">Close: {deal.target_close_date}</div>
                  )}
                  {deal.expected_cap_rate && (
                    <div className="text-xs text-green-700 mt-0.5">Cap Rate: {deal.expected_cap_rate}%</div>
                  )}
                </div>
              ))}
              {pipelineByStage[stage].length === 0 && (
                <div className="rounded-xl border-2 border-dashed border-border p-4 text-center">
                  <p className="text-xs text-muted-foreground">No deals</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Abandoned */}
      {pipelineByStage['Abandoned'].length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Abandoned Deals</h3>
          <div className="flex flex-wrap gap-2">
            {pipelineByStage['Abandoned'].map(d => (
              <button key={d.id} onClick={() => { setForm({...emptyForm, ...d}); setEditId(d.id); setOpen(true); }}
                className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-lg hover:bg-muted/80">
                {d.property_address} {d.purchase_price ? `· $${d.purchase_price.toLocaleString()}` : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Deal' : 'Add New Deal'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="col-span-2">
              <Label>Property Address *</Label>
              <Input value={form.property_address} onChange={e => setForm(f => ({...f, property_address: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Stage</Label>
              <Select value={form.stage} onValueChange={v => setForm(f => ({...f, stage: v}))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{STAGES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g,' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Property Type</Label>
              <Select value={form.property_type} onValueChange={v => setForm(f => ({...f, property_type: v}))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{['SFR','Duplex','Triplex','Multi-family','Commercial','Mixed-Use','Land'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Purchase Price ($)</Label>
              <Input type="number" value={form.purchase_price} onChange={e => setForm(f => ({...f, purchase_price: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Down Payment ($)</Label>
              <Input type="number" value={form.expected_down_payment} onChange={e => setForm(f => ({...f, expected_down_payment: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Probability (%)</Label>
              <Input type="number" min="0" max="100" value={form.probability_of_close} onChange={e => setForm(f => ({...f, probability_of_close: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Target Close Date</Label>
              <Input type="date" value={form.target_close_date} onChange={e => setForm(f => ({...f, target_close_date: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Expected Cap Rate (%)</Label>
              <Input type="number" value={form.expected_cap_rate} onChange={e => setForm(f => ({...f, expected_cap_rate: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Est. Monthly Cash Flow ($)</Label>
              <Input type="number" value={form.expected_cash_flow_monthly} onChange={e => setForm(f => ({...f, expected_cash_flow_monthly: e.target.value}))} className="mt-1" />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} className="mt-1 w-full min-h-[80px] rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.property_address}>
              {saving ? 'Saving...' : editId ? 'Update' : 'Add Deal'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}