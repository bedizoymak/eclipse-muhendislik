/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
import { Edit, Plus, Search, Trash2, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminEmptyState, AdminMetricCard, AdminPageHeader } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCrmData } from "@/hooks/useCrmData";
import { customerName, DbRow, formatDate, formatTRY, labelOf, LEAD_STAGES, SOURCES, statusBadgeClass, todayISO } from "@/lib/crm";
import { cn } from "@/lib/utils";

type LeadForm = {
  id?: string;
  customer_id: string;
  prospect_name: string;
  contact_person: string;
  phone: string;
  email: string;
  source: string;
  interested_service: string;
  estimated_value: string;
  probability: string;
  stage: string;
  expected_close_date: string;
  notes: string;
  next_follow_up_date: string;
  lost_reason: string;
};

const emptyForm: LeadForm = {
  customer_id: "",
  prospect_name: "",
  contact_person: "",
  phone: "",
  email: "",
  source: "website",
  interested_service: "",
  estimated_value: "",
  probability: "10",
  stage: "new",
  expected_close_date: "",
  notes: "",
  next_follow_up_date: "",
  lost_reason: "",
};

function toForm(row: DbRow): LeadForm {
  return {
    id: row.id,
    customer_id: String(row.customer_id ?? ""),
    prospect_name: String(row.prospect_name ?? ""),
    contact_person: String(row.contact_person ?? ""),
    phone: String(row.phone ?? ""),
    email: String(row.email ?? ""),
    source: String(row.source ?? "website"),
    interested_service: String(row.interested_service ?? ""),
    estimated_value: String(row.estimated_value ?? ""),
    probability: String(row.probability ?? 10),
    stage: String(row.stage ?? "new"),
    expected_close_date: String(row.expected_close_date ?? ""),
    notes: String(row.notes ?? ""),
    next_follow_up_date: String(row.next_follow_up_date ?? ""),
    lost_reason: String(row.lost_reason ?? ""),
  };
}

export default function AdminLeads() {
  const { data, loading, reload } = useCrmData();
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<LeadForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const filtered = useMemo(() => {
    const q = query.toLocaleLowerCase("tr-TR");
    return data.leads.filter((lead) => {
      const haystack = `${lead.prospect_name} ${lead.contact_person ?? ""} ${lead.phone ?? ""} ${lead.email ?? ""} ${lead.interested_service ?? ""}`.toLocaleLowerCase("tr-TR");
      if (query && !haystack.includes(q)) return false;
      if (stage !== "all" && lead.stage !== stage) return false;
      return true;
    });
  }, [data.leads, query, stage]);

  const summary = {
    active: data.leads.filter((item) => !["won", "lost"].includes(item.stage)).length,
    value: data.leads.filter((item) => !["lost"].includes(item.stage)).reduce((sum, item) => sum + Number(item.estimated_value || 0), 0),
    followUps: data.leads.filter((item) => item.next_follow_up_date && item.next_follow_up_date <= todayISO() && !["won", "lost"].includes(item.stage)).length,
    won: data.leads.filter((item) => item.stage === "won").length,
  };

  function openNew() {
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(row: DbRow) {
    setForm(toForm(row));
    setOpen(true);
  }

  function update<K extends keyof LeadForm>(key: K, value: LeadForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    if (!supabase) return;
    if (!form.prospect_name.trim()) {
      toast({ title: "Fırsat adı zorunludur", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      customer_id: form.customer_id || null,
      prospect_name: form.prospect_name.trim(),
      contact_person: form.contact_person.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      source: form.source,
      interested_service: form.interested_service.trim() || null,
      estimated_value: Number(form.estimated_value || 0),
      probability: Number(form.probability || 0),
      stage: form.stage,
      expected_close_date: form.expected_close_date || null,
      notes: form.notes.trim() || null,
      next_follow_up_date: form.next_follow_up_date || null,
      lost_reason: form.lost_reason.trim() || null,
    };
    const result = form.id ? await (supabase.from("leads" as any).update(payload).eq("id", form.id) as any) : await (supabase.from("leads" as any).insert(payload) as any);
    setSaving(false);
    if (result.error) toast({ title: "Fırsat kaydedilemedi", description: result.error.message, variant: "destructive" });
    else {
      toast({ title: form.id ? "Fırsat güncellendi" : "Fırsat eklendi" });
      setOpen(false);
      reload();
    }
  }

  async function remove(row: DbRow) {
    if (!supabase || !confirm(`"${row.prospect_name}" fırsatını silmek istediğinize emin misiniz?`)) return;
    await (supabase.from("leads" as any).delete().eq("id", row.id) as any);
    toast({ title: "Fırsat silindi" });
    reload();
  }

  async function convertToCustomer(row: DbRow) {
    if (!supabase) return;
    const { data: customer, error } = await (supabase.from("customers" as any).insert({
      customer_name: row.prospect_name,
      customer_type: "company",
      contact_person: row.contact_person,
      phone: row.phone,
      email: row.email,
      source: row.source,
      status: "active",
      notes: row.notes,
    }).select("id").single() as any);
    if (error) {
      toast({ title: "Müşteriye dönüştürülemedi", description: error.message, variant: "destructive" });
      return;
    }
    await (supabase.from("leads" as any).update({ customer_id: customer.id, stage: "won" }).eq("id", row.id) as any);
    toast({ title: "Fırsat müşteriye dönüştürüldü" });
    reload();
  }

  async function convertToProject(row: DbRow) {
    if (!supabase) return;
    const customerId = row.customer_id || null;
    const { error } = await (supabase.from("projects" as any).insert({
      title: row.interested_service ? `${row.prospect_name} - ${row.interested_service}` : row.prospect_name,
      short_description: row.notes || "CRM fırsatından oluşturulan proje.",
      detail_description: row.notes,
      status: "draft",
      customer_id: customerId,
      related_lead_id: row.id,
      service_category: row.interested_service,
      project_status: "planning",
      budget: Number(row.estimated_value || 0),
      progress_percentage: 0,
    }) as any);
    if (error) toast({ title: "Projeye dönüştürülemedi", description: error.message, variant: "destructive" });
    else {
      await (supabase.from("leads" as any).update({ stage: "won" }).eq("id", row.id) as any);
      toast({ title: "Fırsattan proje oluşturuldu" });
      reload();
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Satış Pipeline"
        title="Fırsatlar"
        description="Yeni talepleri, görüşmeleri, teklif sürecini ve kazanılan/kaybedilen fırsatları takip edin."
        actions={<Button onClick={openNew} className="bg-gradient-electric text-white shadow-glow"><Plus className="h-4 w-4" /> Fırsat Ekle</Button>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label="Aktif Fırsat" value={summary.active} icon={TrendingUp} tone="accent" />
        <AdminMetricCard label="Pipeline Değeri" value={formatTRY(summary.value)} icon={TrendingUp} tone="success" />
        <AdminMetricCard label="Takip Gerekli" value={summary.followUps} icon={Search} tone={summary.followUps ? "warning" : "success"} />
        <AdminMetricCard label="Kazanılan" value={summary.won} icon={TrendingUp} tone="success" />
      </div>

      <div className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Fırsat, yetkili, hizmet veya iletişim ara..." className="pl-9" />
        </div>
        <Select value={stage} onValueChange={setStage}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm aşamalar</SelectItem>
            {LEAD_STAGES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 xl:grid-cols-7">
        {LEAD_STAGES.map((stageItem) => {
          const rows = filtered.filter((lead) => lead.stage === stageItem.value);
          return (
            <div key={stageItem.value} className="min-h-48 rounded-lg border border-border bg-card p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">{stageItem.label}</div>
                <span className="rounded-md bg-secondary px-2 py-0.5 text-xs">{rows.length}</span>
              </div>
              <div className="space-y-3">
                {rows.map((lead) => (
                  <div key={lead.id} className="rounded-lg border border-border bg-background p-3 shadow-soft">
                    <div className="font-semibold">{lead.prospect_name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{lead.interested_service || "Hizmet seçilmedi"}</div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span>{formatTRY(lead.estimated_value)}</span>
                      <span>%{lead.probability}</span>
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground">Takip: {formatDate(lead.next_follow_up_date)}</div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(lead)}><Edit className="h-4 w-4" /></Button>
                      <Button size="sm" variant="outline" onClick={() => convertToCustomer(lead)}>Müşteri</Button>
                      <Button size="sm" variant="outline" onClick={() => convertToProject(lead)}>Proje</Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(lead)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {!loading && filtered.length === 0 && <AdminEmptyState title="Fırsat bulunamadı" description="Filtreleri temizleyebilir veya yeni fırsat ekleyebilirsiniz." icon={TrendingUp} />}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Fırsatı Düzenle" : "Yeni Fırsat"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div><Label>Müşteri</Label><Select value={form.customer_id || "none"} onValueChange={(value) => update("customer_id", value === "none" ? "" : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Potansiyel / kayıtlı değil</SelectItem>{data.customers.map((customer) => <SelectItem key={customer.id} value={customer.id}>{customerName(customer)}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Fırsat / Firma Adı *</Label><Input value={form.prospect_name} onChange={(event) => update("prospect_name", event.target.value)} /></div>
            <div><Label>Yetkili</Label><Input value={form.contact_person} onChange={(event) => update("contact_person", event.target.value)} /></div>
            <div><Label>Telefon</Label><Input value={form.phone} onChange={(event) => update("phone", event.target.value)} /></div>
            <div><Label>E-posta</Label><Input value={form.email} onChange={(event) => update("email", event.target.value)} /></div>
            <div><Label>Kaynak</Label><Select value={form.source} onValueChange={(value) => update("source", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SOURCES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>İlgilendiği Hizmet</Label><Input value={form.interested_service} onChange={(event) => update("interested_service", event.target.value)} placeholder="Firewall, M365, bakım anlaşması..." /></div>
            <div><Label>Tahmini Değer</Label><Input type="number" value={form.estimated_value} onChange={(event) => update("estimated_value", event.target.value)} /></div>
            <div><Label>Olasılık (%)</Label><Input type="number" min={0} max={100} value={form.probability} onChange={(event) => update("probability", event.target.value)} /></div>
            <div><Label>Aşama</Label><Select value={form.stage} onValueChange={(value) => update("stage", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{LEAD_STAGES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Beklenen Kapanış</Label><Input type="date" value={form.expected_close_date} onChange={(event) => update("expected_close_date", event.target.value)} /></div>
            <div><Label>Sonraki Takip</Label><Input type="date" value={form.next_follow_up_date} onChange={(event) => update("next_follow_up_date", event.target.value)} /></div>
            <div className="md:col-span-2"><Label>Kaybedilme Nedeni</Label><Input value={form.lost_reason} onChange={(event) => update("lost_reason", event.target.value)} /></div>
            <div className="md:col-span-2"><Label>Notlar</Label><Textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} rows={3} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>İptal</Button><Button onClick={save} disabled={saving} className="bg-gradient-electric text-white">{saving ? "Kaydediliyor..." : "Kaydet"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
