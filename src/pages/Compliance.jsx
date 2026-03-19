import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, ShieldCheck, AlertTriangle, FileText, Search, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import StatusBadge from '@/components/shared/StatusBadge';
import KpiCard from '@/components/shared/KpiCard';
import PageHeader from '@/components/shared/PageHeader';

const emptyEventForm = {
  property_id: '', unit_id: '', event_type: 'Inspection_Scheduled',
  description: '', event_date: new Date().toISOString().split('T')[0],
  due_date: '', status: 'Open', inspector_name: '', inspector_agency: '',
  findings: '', required_action: '', estimated_cost: '', actual_cost: ''
};

const emptyDocForm = {
  property_id: '', tenant_id: '', vendor_id: '',
  document_type: 'Insurance_Policy', document_date: '',
  expiry_date: '', file_name: '', storage_url: '',
  notes: '', visibility: 'All_Roles', renewal_reminder: true, reminder_days_before: 90
};

function getAlertStatus(expiryDate) {
  if (!expiryDate) return null;
  const days = Math.round((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
  if (days < 0) return 'expired';
  if (days <= 7) return 'red';
  if (days <= 30) return 'orange';
  if (days <= 90) return 'yellow';
  return 'green';
}

const alertColor = {
  green: 'bg-green-50 border-green-200 text-green-700',
  yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  orange: 'bg-orange-50 border-orange-200 text-orange-700',
  red: 'bg-red-50 border-red-200 text-red-700',
  expired: 'bg-red-100 border-red-300 text-red-800',
};

export default function Compliance() {
  const [events, setEvents] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [notices, setNotices] = useState([]);
  const [properties, setProperties] = useState([]);
  const [units, setUnits] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('events');
  const [openEvent, setOpenEvent] = useState(false);
  const [openDoc, setOpenDoc] = useState(false);
  const [eventForm, setEventForm] = useState(emptyEventForm);
  const [docForm, setDocForm] = useState(emptyDocForm);
  const [editEventId, setEditEventId] = useState(null);
  const [editDocId, setEditDocId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [ev, docs, ns, ps, us, ts, vs] = await Promise.all([
      base44.entities.ComplianceEvent.list('-event_date', 100),
      base44.entities.Document.list('-created_date', 100),
      base44.entities.Notice.list('-created_date', 100),
      base44.entities.Property.list(),
      base44.entities.Unit.list(),
      base44.entities.Tenant.list(),
      base44.entities.Vendor.list(),
    ]);
    setEvents(ev || []);
    setDocuments(docs || []);
    setNotices(ns || []);
    setProperties(ps || []);
    setUnits(us || []);
    setTenants(ts || []);
    setVendors(vs || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSaveEvent = async () => {
    setSaving(true);
    const data = { ...eventForm };
    ['estimated_cost', 'actual_cost'].forEach(k => { if (data[k] !== '') data[k] = parseFloat(data[k]) || 0; });
    if (editEventId) await base44.entities.ComplianceEvent.update(editEventId, data);
    else await base44.entities.ComplianceEvent.create(data);
    await load();
    setOpenEvent(false);
    setEventForm(emptyEventForm);
    setEditEventId(null);
    setSaving(false);
  };

  const handleSaveDoc = async () => {
    setSaving(true);
    if (editDocId) await base44.entities.Document.update(editDocId, docForm);
    else await base44.entities.Document.create(docForm);
    await load();
    setOpenDoc(false);
    setDocForm(emptyDocForm);
    setEditDocId(null);
    setSaving(false);
  };

  const getPropName = (id) => properties.find(p => p.id === id)?.address || '—';
  const getTenantName = (id) => { const t = tenants.find(t => t.id === id); return t ? `${t.first_name} ${t.last_name}` : null; };

  const openEvents = events.filter(e => e.status === 'Open' || e.status === 'In_Progress').length;
  const overdueEvents = events.filter(e => e.status === 'Overdue' || (e.due_date && new Date(e.due_date) < new Date() && e.status !== 'Completed' && e.status !== 'Waived')).length;
  const expiringDocs = documents.filter(d => d.expiry_date && getAlertStatus(d.expiry_date) !== 'green' && getAlertStatus(d.expiry_date) !== null).length;

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      <PageHeader title="Compliance & Documents" subtitle="Inspections, violations, permits, documents, and legal notices" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Open Events" value={openEvents} icon={ShieldCheck} color="blue" />
        <KpiCard title="Overdue" value={overdueEvents} icon={AlertTriangle} color="red" />
        <KpiCard title="Expiring Docs" value={expiringDocs} icon={FileText} color="orange" />
        <KpiCard title="Total Documents" value={documents.length} icon={FileText} color="green" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {[['events', 'Compliance Events'], ['documents', 'Documents'], ['notices', 'Notices']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'events' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setEventForm(emptyEventForm); setEditEventId(null); setOpenEvent(true); }} className="gap-2">
              <Plus className="w-4 h-4" /> Add Event
            </Button>
          </div>
          <div className="space-y-3">
            {events.map(e => {
              const isOverdue = e.due_date && new Date(e.due_date) < new Date() && e.status !== 'Completed' && e.status !== 'Waived';
              return (
                <div key={e.id} className={`bg-card rounded-xl border p-4 ${isOverdue ? 'border-red-300 bg-red-50/30' : 'border-border'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{e.event_type?.replace(/_/g, ' ')}</span>
                        <StatusBadge status={e.status} />
                        {isOverdue && <span className="text-xs text-red-600 font-medium">OVERDUE</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{getPropName(e.property_id)} · {e.event_date}</div>
                      {e.description && <div className="text-sm text-muted-foreground mt-1">{e.description}</div>}
                      {e.findings && <div className="text-xs text-orange-600 mt-1">Findings: {e.findings}</div>}
                      {e.required_action && <div className="text-xs text-red-600 mt-1">Action required: {e.required_action}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      {e.due_date && <div className="text-xs text-muted-foreground">Due: {e.due_date}</div>}
                      <Button variant="ghost" size="sm" onClick={() => { setEventForm({...emptyEventForm, ...e}); setEditEventId(e.id); setOpenEvent(true); }}>Edit</Button>
                    </div>
                  </div>
                </div>
              );
            })}
            {events.length === 0 && (
              <div className="py-16 text-center bg-card rounded-xl border border-border">
                <ShieldCheck className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No compliance events</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'documents' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setDocForm(emptyDocForm); setEditDocId(null); setOpenDoc(true); }} className="gap-2">
              <Plus className="w-4 h-4" /> Add Document
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {documents.map(d => {
              const alert = d.expiry_date ? getAlertStatus(d.expiry_date) : null;
              const days = d.expiry_date ? Math.round((new Date(d.expiry_date) - new Date()) / (1000 * 60 * 60 * 24)) : null;
              return (
                <div key={d.id} className="bg-card rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-medium text-sm">{d.document_type?.replace(/_/g, ' ')}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{getPropName(d.property_id)}</div>
                      {d.tenant_id && <div className="text-xs text-muted-foreground">{getTenantName(d.tenant_id)}</div>}
                    </div>
                    {alert && (
                      <span className={`text-xs px-2 py-0.5 rounded-lg border font-medium ${alertColor[alert]}`}>
                        {alert === 'expired' ? 'EXPIRED' : alert === 'green' ? 'Current' : `${days}d`}
                      </span>
                    )}
                  </div>
                  {d.expiry_date && <div className="text-xs text-muted-foreground">Expires: {d.expiry_date}</div>}
                  {d.file_name && <div className="text-xs text-muted-foreground truncate">{d.file_name}</div>}
                  {d.storage_url && <a href={d.storage_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">View Document</a>}
                  <div className="mt-2 pt-2 border-t border-border flex justify-end">
                    <Button variant="ghost" size="sm" onClick={() => { setDocForm({...emptyDocForm, ...d}); setEditDocId(d.id); setOpenDoc(true); }}>Edit</Button>
                  </div>
                </div>
              );
            })}
            {documents.length === 0 && (
              <div className="col-span-3 py-16 text-center bg-card rounded-xl border border-border">
                <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No documents yet</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'notices' && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-5 font-medium text-muted-foreground">Tenant</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Property</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Served</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {notices.map(n => (
                  <tr key={n.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="py-3 px-5 font-medium">{getTenantName(n.tenant_id) || '—'}</td>
                    <td className="py-3 px-4 text-xs">{n.notice_type?.replace(/_/g, ' ')}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{getPropName(n.property_id)}</td>
                    <td className="py-3 px-4"><StatusBadge status={n.status} /></td>
                    <td className="py-3 px-4 text-muted-foreground">{n.date_served || '—'}</td>
                    <td className="py-3 px-4 text-xs">{n.outcome?.replace(/_/g, ' ') || '—'}</td>
                  </tr>
                ))}
                {notices.length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">No notices issued</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Event Dialog */}
      <Dialog open={openEvent} onOpenChange={setOpenEvent}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editEventId ? 'Edit Event' : 'Add Compliance Event'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <Label>Property *</Label>
              <Select value={eventForm.property_id} onValueChange={v => setEventForm(f => ({...f, property_id: v}))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Event Type *</Label>
              <Select value={eventForm.event_type} onValueChange={v => setEventForm(f => ({...f, event_type: v}))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{['Inspection_Scheduled','Inspection_Completed','Inspection_Failed','Violation_Issued','Violation_Resolved','Permit_Applied','Permit_Approved','Permit_Expired','Rent_Control_Review','Insurance_Renewal','Certificate_Renewal','Other'].map(t => <SelectItem key={t} value={t}>{t.replace(/_/g,' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Event Date *</Label>
              <Input type="date" value={eventForm.event_date} onChange={e => setEventForm(f => ({...f, event_date: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Due Date</Label>
              <Input type="date" value={eventForm.due_date} onChange={e => setEventForm(f => ({...f, due_date: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={eventForm.status} onValueChange={v => setEventForm(f => ({...f, status: v}))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{['Open','In_Progress','Completed','Overdue','Waived'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Inspector Name</Label>
              <Input value={eventForm.inspector_name} onChange={e => setEventForm(f => ({...f, inspector_name: e.target.value}))} className="mt-1" />
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <textarea value={eventForm.description} onChange={e => setEventForm(f => ({...f, description: e.target.value}))} className="mt-1 w-full min-h-[70px] rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            {eventForm.event_type === 'Inspection_Failed' && (
              <div className="col-span-2">
                <Label>Required Action *</Label>
                <textarea value={eventForm.required_action} onChange={e => setEventForm(f => ({...f, required_action: e.target.value}))} className="mt-1 w-full min-h-[60px] rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setOpenEvent(false)}>Cancel</Button>
            <Button onClick={handleSaveEvent} disabled={saving || !eventForm.property_id}>
              {saving ? 'Saving...' : editEventId ? 'Update' : 'Add Event'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Document Dialog */}
      <Dialog open={openDoc} onOpenChange={setOpenDoc}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editDocId ? 'Edit Document' : 'Add Document'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <Label>Property *</Label>
              <Select value={docForm.property_id} onValueChange={v => setDocForm(f => ({...f, property_id: v}))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Document Type *</Label>
              <Select value={docForm.document_type} onValueChange={v => setDocForm(f => ({...f, document_type: v}))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{['Certificate_of_Occupancy','Insurance_Policy','Inspection_Report','Lease_Agreement','Lead_Paint_Disclosure','Deed','Permit','Warranty','Vendor_License','Vendor_Insurance','W9','Move_In_Checklist','Move_Out_Report','Eviction_Filing','Notice','Other'].map(t => <SelectItem key={t} value={t}>{t.replace(/_/g,' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Document Date</Label>
              <Input type="date" value={docForm.document_date} onChange={e => setDocForm(f => ({...f, document_date: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Expiry Date</Label>
              <Input type="date" value={docForm.expiry_date} onChange={e => setDocForm(f => ({...f, expiry_date: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>File Name</Label>
              <Input value={docForm.file_name} onChange={e => setDocForm(f => ({...f, file_name: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Document URL</Label>
              <Input value={docForm.storage_url} onChange={e => setDocForm(f => ({...f, storage_url: e.target.value}))} placeholder="https://..." className="mt-1" />
            </div>
            <div>
              <Label>Linked Tenant</Label>
              <Select value={docForm.tenant_id} onValueChange={v => setDocForm(f => ({...f, tenant_id: v}))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>{tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Visibility</Label>
              <Select value={docForm.visibility} onValueChange={v => setDocForm(f => ({...f, visibility: v}))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{['All_Roles','Owner_Only','Owner_Accountant'].map(v => <SelectItem key={v} value={v}>{v.replace(/_/g,' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <textarea value={docForm.notes} onChange={e => setDocForm(f => ({...f, notes: e.target.value}))} className="mt-1 w-full min-h-[60px] rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setOpenDoc(false)}>Cancel</Button>
            <Button onClick={handleSaveDoc} disabled={saving || !docForm.property_id}>
              {saving ? 'Saving...' : editDocId ? 'Update' : 'Add Document'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}