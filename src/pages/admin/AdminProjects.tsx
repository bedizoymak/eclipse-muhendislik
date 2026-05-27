/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Edit, Eye, FolderKanban, Plus, Search, Trash2 } from "lucide-react";
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
import { customerName, DbRow, formatDate, formatTRY, labelOf, PRIORITIES, PROJECT_STATUSES, statusBadgeClass } from "@/lib/crm";
import { cn } from "@/lib/utils";

type ProjectForm = {
  id?: string;
  title: string;
  customer_id: string;
  related_lead_id: string;
  related_offer_id: string;
  service_category: string;
  project_status: string;
  start_date: string;
  deadline: string;
  completion_date: string;
  budget: string;
  actual_cost: string;
  profit_estimate: string;
  priority: string;
  progress_percentage: string;
  crm_description: string;
  internal_notes: string;
};

const emptyForm: ProjectForm = {
  title: "",
  customer_id: "",
  related_lead_id: "",
  related_offer_id: "",
  service_category: "",
  project_status: "planning",
  start_date: "",
  deadline: "",
  completion_date: "",
  budget: "",
  actual_cost: "",
  profit_estimate: "",
  priority: "medium",
  progress_percentage: "0",
  crm_description: "",
  internal_notes: "",
};

function toForm(row: DbRow): ProjectForm {
  return {
    id: row.id,
    title: String(row.title ?? ""),
    customer_id: String(row.customer_id ?? ""),
    related_lead_id: String(row.related_lead_id ?? ""),
    related_offer_id: String(row.related_offer_id ?? ""),
    service_category: String(row.service_category ?? ""),
    project_status: String(row.project_status ?? "planning"),
    start_date: String(row.start_date ?? ""),
    deadline: String(row.deadline ?? ""),
    completion_date: String(row.completion_date ?? ""),
    budget: String(row.budget ?? ""),
    actual_cost: String(row.actual_cost ?? ""),
    profit_estimate: String(row.profit_estimate ?? ""),
    priority: String(row.priority ?? "medium"),
    progress_percentage: String(row.progress_percentage ?? 0),
    crm_description: String(row.crm_description ?? row.detail_description ?? ""),
    internal_notes: String(row.internal_notes ?? ""),
  };
}

export default function AdminProjects() {
  const { data, loading, reload } = useCrmData();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProjectForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const filtered = useMemo(() => {
    const q = query.toLocaleLowerCase("tr-TR");
    return data.projects.filter((project) => {
      const customer = data.customers.find((item) => item.id === project.customer_id);
      const haystack = `${project.title} ${project.service_category ?? ""} ${customerName(customer)}`.toLocaleLowerCase("tr-TR");
      if (query && !haystack.includes(q)) return false;
      if (status !== "all" && project.project_status !== status) return false;
      return true;
    });
  }, [data.customers, data.projects, query, status]);

  const summary = {
    open: data.projects.filter((item) => !["completed", "cancelled"].includes(item.project_status)).length,
    completed: data.projects.filter((item) => item.project_status === "completed").length,
    budget: data.projects.reduce((sum, item) => sum + Number(item.budget || 0), 0),
    profit: data.projects.reduce((sum, item) => sum + Number(item.profit_estimate || 0), 0),
  };

  function update<K extends keyof ProjectForm>(key: K, value: ProjectForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openNew() {
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(row: DbRow) {
    setForm(toForm(row));
    setOpen(true);
  }

  async function save() {
    if (!supabase) return;
    if (!form.title.trim()) {
      toast({ title: "Proje adı zorunludur", variant: "destructive" });
      return;
    }
    setSaving(true);
    const description = form.crm_description.trim() || "CRM projesi.";
    const payload = {
      title: form.title.trim(),
      customer_id: form.customer_id || null,
      related_lead_id: form.related_lead_id || null,
      related_offer_id: form.related_offer_id || null,
      service_category: form.service_category.trim() || null,
      project_status: form.project_status,
      start_date: form.start_date || null,
      deadline: form.deadline || null,
      completion_date: form.completion_date || null,
      budget: Number(form.budget || 0),
      actual_cost: Number(form.actual_cost || 0),
      profit_estimate: Number(form.profit_estimate || 0),
      priority: form.priority,
      progress_percentage: Number(form.progress_percentage || 0),
      crm_description: description,
      internal_notes: form.internal_notes.trim() || null,
      short_description: description.slice(0, 180),
      detail_description: description,
      status: "draft",
    };
    const result = form.id ? await (supabase.from("projects" as any).update(payload).eq("id", form.id) as any) : await (supabase.from("projects" as any).insert(payload) as any);
    setSaving(false);
    if (result.error) toast({ title: "Proje kaydedilemedi", description: result.error.message, variant: "destructive" });
    else {
      toast({ title: "Proje kaydedildi" });
      setOpen(false);
      reload();
    }
  }

  async function remove(row: DbRow) {
    if (!supabase || !confirm(`"${row.title}" projesini silmek istediğinize emin misiniz?`)) return;
    await (supabase.from("projects" as any).delete().eq("id", row.id) as any);
    toast({ title: "Proje silindi" });
    reload();
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Proje Yönetimi"
        title="Projeler"
        description="BT projeleri, servis işleri, bakım kurulumları, bütçe, maliyet, kârlılık ve ilerleme takibini yönetin."
        actions={<Button onClick={openNew} className="bg-gradient-electric text-white shadow-glow"><Plus className="h-4 w-4" /> Proje Ekle</Button>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label="Açık Proje" value={summary.open} icon={FolderKanban} tone="accent" />
        <AdminMetricCard label="Tamamlanan" value={summary.completed} icon={FolderKanban} tone="success" />
        <AdminMetricCard label="Toplam Bütçe" value={formatTRY(summary.budget)} icon={FolderKanban} tone="warning" />
        <AdminMetricCard label="Kâr Tahmini" value={formatTRY(summary.profit)} icon={FolderKanban} tone={summary.profit >= 0 ? "success" : "danger"} />
      </div>

      <div className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Proje, müşteri veya hizmet kategorisi ara..." className="pl-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm durumlar</SelectItem>
            {PROJECT_STATUSES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">Yükleniyor...</div>
      ) : filtered.length === 0 ? (
        <AdminEmptyState title="Proje bulunamadı" description="İlk CRM projesini oluşturun veya filtreleri temizleyin." icon={FolderKanban} action={<Button onClick={openNew}>Proje Ekle</Button>} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase text-muted-foreground">
              <tr><th className="p-3">Proje</th><th className="p-3">Müşteri</th><th className="p-3">Durum</th><th className="p-3">Öncelik</th><th className="p-3">Deadline</th><th className="p-3 text-right">Bütçe</th><th className="p-3">İlerleme</th><th className="p-3 text-right">İşlem</th></tr>
            </thead>
            <tbody>
              {filtered.map((project) => {
                const customer = data.customers.find((item) => item.id === project.customer_id);
                return (
                  <tr key={project.id} className="border-t border-border hover:bg-secondary/35">
                    <td className="p-3"><div className="font-semibold">{project.title}</div><div className="text-xs text-muted-foreground">{project.service_category || "Kategori yok"}</div></td>
                    <td className="p-3">{customerName(customer)}</td>
                    <td className="p-3"><span className={cn("rounded-md border px-2 py-1 text-xs", statusBadgeClass(project.project_status))}>{labelOf(PROJECT_STATUSES, project.project_status)}</span></td>
                    <td className="p-3">{labelOf(PRIORITIES, project.priority)}</td>
                    <td className="p-3">{formatDate(project.deadline)}</td>
                    <td className="p-3 text-right font-medium">{formatTRY(project.budget)}</td>
                    <td className="p-3"><div className="h-2 w-28 rounded-full bg-secondary"><div className="h-2 rounded-full bg-accent" style={{ width: `${project.progress_percentage || 0}%` }} /></div><div className="mt-1 text-xs">{project.progress_percentage || 0}%</div></td>
                    <td className="p-3"><div className="flex justify-end gap-1"><Button asChild size="sm" variant="ghost"><Link to={`/admin/projects/${project.id}`}><Eye className="h-4 w-4" /></Link></Button><Button size="sm" variant="ghost" onClick={() => openEdit(project)}><Edit className="h-4 w-4" /></Button><Button size="sm" variant="ghost" onClick={() => remove(project)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Projeyi Düzenle" : "Yeni Proje"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div><Label>Proje Adı *</Label><Input value={form.title} onChange={(event) => update("title", event.target.value)} /></div>
            <div><Label>Müşteri</Label><Select value={form.customer_id || "none"} onValueChange={(value) => update("customer_id", value === "none" ? "" : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Seçilmedi</SelectItem>{data.customers.map((customer) => <SelectItem key={customer.id} value={customer.id}>{customerName(customer)}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>İlgili Fırsat</Label><Select value={form.related_lead_id || "none"} onValueChange={(value) => update("related_lead_id", value === "none" ? "" : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Seçilmedi</SelectItem>{data.leads.map((lead) => <SelectItem key={lead.id} value={lead.id}>{lead.prospect_name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>İlgili Teklif</Label><Select value={form.related_offer_id || "none"} onValueChange={(value) => update("related_offer_id", value === "none" ? "" : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Seçilmedi</SelectItem>{data.offers.map((offer) => <SelectItem key={offer.id} value={offer.id}>{offer.offer_number}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Hizmet Kategorisi</Label><Input value={form.service_category} onChange={(event) => update("service_category", event.target.value)} /></div>
            <div><Label>Durum</Label><Select value={form.project_status} onValueChange={(value) => update("project_status", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PROJECT_STATUSES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Başlangıç</Label><Input type="date" value={form.start_date} onChange={(event) => update("start_date", event.target.value)} /></div>
            <div><Label>Deadline</Label><Input type="date" value={form.deadline} onChange={(event) => update("deadline", event.target.value)} /></div>
            <div><Label>Tamamlanma</Label><Input type="date" value={form.completion_date} onChange={(event) => update("completion_date", event.target.value)} /></div>
            <div><Label>Öncelik</Label><Select value={form.priority} onValueChange={(value) => update("priority", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Bütçe</Label><Input type="number" value={form.budget} onChange={(event) => update("budget", event.target.value)} /></div>
            <div><Label>Gerçek Maliyet</Label><Input type="number" value={form.actual_cost} onChange={(event) => update("actual_cost", event.target.value)} /></div>
            <div><Label>Kâr Tahmini</Label><Input type="number" value={form.profit_estimate} onChange={(event) => update("profit_estimate", event.target.value)} /></div>
            <div><Label>İlerleme (%)</Label><Input type="number" min={0} max={100} value={form.progress_percentage} onChange={(event) => update("progress_percentage", event.target.value)} /></div>
            <div className="md:col-span-2"><Label>Açıklama</Label><Textarea value={form.crm_description} onChange={(event) => update("crm_description", event.target.value)} rows={3} /></div>
            <div className="md:col-span-2"><Label>İç Notlar</Label><Textarea value={form.internal_notes} onChange={(event) => update("internal_notes", event.target.value)} rows={3} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>İptal</Button><Button onClick={save} disabled={saving} className="bg-gradient-electric text-white">{saving ? "Kaydediliyor..." : "Kaydet"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
