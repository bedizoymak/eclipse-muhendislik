/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
import { Edit, Plus, Search, ServerCog, Trash2 } from "lucide-react";
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
import { DbRow, formatTRY, labelOf, PRICING_TYPES, statusBadgeClass } from "@/lib/crm";
import { cn } from "@/lib/utils";

type ServiceForm = {
  id?: string;
  title: string;
  category: string;
  short_description: string;
  detail_description: string;
  base_price: string;
  pricing_type: string;
  is_active: string;
  internal_notes: string;
  sort_order: string;
  status: string;
};

const emptyForm: ServiceForm = {
  title: "",
  category: "Danışmanlık",
  short_description: "",
  detail_description: "",
  base_price: "",
  pricing_type: "custom",
  is_active: "true",
  internal_notes: "",
  sort_order: "0",
  status: "draft",
};

function toForm(row: DbRow): ServiceForm {
  return {
    id: row.id,
    title: String(row.title ?? ""),
    category: String(row.category ?? ""),
    short_description: String(row.short_description ?? ""),
    detail_description: String(row.detail_description ?? ""),
    base_price: String(row.base_price ?? ""),
    pricing_type: String(row.pricing_type ?? "custom"),
    is_active: String(row.is_active ?? true),
    internal_notes: String(row.internal_notes ?? ""),
    sort_order: String(row.sort_order ?? 0),
    status: String(row.status ?? "draft"),
  };
}

export default function AdminServices() {
  const { data, loading, reload } = useCrmData();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ServiceForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const filtered = useMemo(() => {
    const q = query.toLocaleLowerCase("tr-TR");
    return data.services.filter((item) => `${item.title} ${item.category ?? ""} ${item.short_description ?? ""}`.toLocaleLowerCase("tr-TR").includes(q));
  }, [data.services, query]);

  const summary = {
    total: data.services.length,
    active: data.services.filter((item) => item.is_active).length,
    monthly: data.services.filter((item) => item.pricing_type === "monthly").length,
    avg: data.services.length ? data.services.reduce((sum, item) => sum + Number(item.base_price || 0), 0) / data.services.length : 0,
  };

  function update<K extends keyof ServiceForm>(key: K, value: ServiceForm[K]) {
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
    if (!form.title.trim() || !form.short_description.trim()) {
      toast({ title: "Hizmet adı ve kısa açıklama zorunludur", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      category: form.category.trim() || null,
      short_description: form.short_description.trim(),
      detail_description: form.detail_description.trim() || null,
      base_price: Number(form.base_price || 0),
      pricing_type: form.pricing_type,
      is_active: form.is_active === "true",
      internal_notes: form.internal_notes.trim() || null,
      sort_order: Number(form.sort_order || 0),
      status: form.status,
    };
    const result = form.id ? await (supabase.from("services" as any).update(payload).eq("id", form.id) as any) : await (supabase.from("services" as any).insert(payload) as any);
    setSaving(false);
    if (result.error) toast({ title: "Hizmet kaydedilemedi", description: result.error.message, variant: "destructive" });
    else {
      toast({ title: "Hizmet kaydedildi" });
      setOpen(false);
      reload();
    }
  }

  async function remove(row: DbRow) {
    if (!supabase || !confirm(`"${row.title}" hizmetini silmek istediğinize emin misiniz?`)) return;
    await (supabase.from("services" as any).delete().eq("id", row.id) as any);
    toast({ title: "Hizmet silindi" });
    reload();
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Hizmet Kataloğu"
        title="Hizmetler"
        description="BT danışmanlık, network, sunucu, güvenlik, bulut, yazılım ve bakım hizmetlerinin satış kataloğunu yönetin."
        actions={<Button onClick={openNew} className="bg-gradient-electric text-white shadow-glow"><Plus className="h-4 w-4" /> Hizmet Ekle</Button>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label="Toplam Hizmet" value={summary.total} icon={ServerCog} />
        <AdminMetricCard label="Aktif Hizmet" value={summary.active} icon={ServerCog} tone="success" />
        <AdminMetricCard label="Aylık Model" value={summary.monthly} icon={ServerCog} tone="warning" />
        <AdminMetricCard label="Ortalama Fiyat" value={formatTRY(summary.avg)} icon={ServerCog} tone="accent" />
      </div>

      <div className="relative rounded-lg border border-border bg-card p-4">
        <Search className="absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Hizmet ara..." className="max-w-xl pl-9" />
      </div>

      {loading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">Yükleniyor...</div>
      ) : filtered.length === 0 ? (
        <AdminEmptyState title="Hizmet bulunamadı" description="İlk hizmet kataloğu kaydını ekleyerek teklif ve proje akışını hızlandırabilirsiniz." icon={ServerCog} action={<Button onClick={openNew}>Hizmet Ekle</Button>} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((item) => (
            <div key={item.id} className="rounded-lg border border-border bg-card p-4 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-lg font-semibold">{item.title}</h2>
                    <span className={cn("rounded-md border px-2 py-1 text-xs", statusBadgeClass(item.is_active ? "active" : "passive"))}>{item.is_active ? "Aktif" : "Pasif"}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.short_description}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-md bg-secondary px-2 py-1">{item.category || "Kategori yok"}</span>
                    <span className="rounded-md bg-secondary px-2 py-1">{labelOf(PRICING_TYPES, item.pricing_type)}</span>
                    <span className="rounded-md bg-secondary px-2 py-1">{formatTRY(item.base_price)}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(item)}><Edit className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(item)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Hizmeti Düzenle" : "Yeni Hizmet"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div><Label>Hizmet Adı *</Label><Input value={form.title} onChange={(event) => update("title", event.target.value)} /></div>
            <div><Label>Kategori</Label><Input value={form.category} onChange={(event) => update("category", event.target.value)} /></div>
            <div><Label>Fiyatlandırma</Label><Select value={form.pricing_type} onValueChange={(value) => update("pricing_type", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRICING_TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Başlangıç Fiyatı</Label><Input type="number" value={form.base_price} onChange={(event) => update("base_price", event.target.value)} /></div>
            <div><Label>Aktiflik</Label><Select value={form.is_active} onValueChange={(value) => update("is_active", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="true">Aktif</SelectItem><SelectItem value="false">Pasif</SelectItem></SelectContent></Select></div>
            <div><Label>Public Durum</Label><Select value={form.status} onValueChange={(value) => update("status", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Taslak</SelectItem><SelectItem value="published">Yayında</SelectItem></SelectContent></Select></div>
            <div><Label>Sıralama</Label><Input type="number" value={form.sort_order} onChange={(event) => update("sort_order", event.target.value)} /></div>
            <div className="md:col-span-2"><Label>Kısa Açıklama *</Label><Textarea value={form.short_description} onChange={(event) => update("short_description", event.target.value)} rows={2} /></div>
            <div className="md:col-span-2"><Label>Detay Açıklama</Label><Textarea value={form.detail_description} onChange={(event) => update("detail_description", event.target.value)} rows={4} /></div>
            <div className="md:col-span-2"><Label>İç Notlar</Label><Textarea value={form.internal_notes} onChange={(event) => update("internal_notes", event.target.value)} rows={3} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>İptal</Button><Button onClick={save} disabled={saving} className="bg-gradient-electric text-white">{saving ? "Kaydediliyor..." : "Kaydet"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
