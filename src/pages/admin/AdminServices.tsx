import { useEffect, useMemo, useState } from "react";
import { Edit, Eye, EyeOff, Plus, Save, Search, ServerCog, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ServiceRow, ServiceStatus } from "@/integrations/supabase/types";
import { defaultServices } from "@/lib/eclipseContent";
import { AdminEmptyState, AdminPageHeader } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type ServiceForm = {
  id?: string;
  title: string;
  short_description: string;
  detail_description: string;
  icon_name: string;
  image_url: string;
  sort_order: number;
  status: ServiceStatus;
};

const emptyForm: ServiceForm = {
  title: "",
  short_description: "",
  detail_description: "",
  icon_name: "",
  image_url: "",
  sort_order: 0,
  status: "published",
};

function toForm(row: ServiceRow): ServiceForm {
  return {
    id: row.id,
    title: row.title,
    short_description: row.short_description,
    detail_description: row.detail_description ?? "",
    icon_name: row.icon_name ?? "",
    image_url: row.image_url ?? "",
    sort_order: row.sort_order,
    status: row.status,
  };
}

export default function AdminServices() {
  const [items, setItems] = useState<ServiceRow[]>(defaultServices);
  const [form, setForm] = useState<ServiceForm>(emptyForm);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  async function load() {
    if (!supabase) return;
    const { data } = await supabase.from("services").select("*").order("sort_order").order("created_at", { ascending: false });
    setItems(data?.length ? data : []);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLocaleLowerCase("tr-TR");
    return items.filter((item) => `${item.title} ${item.short_description}`.toLocaleLowerCase("tr-TR").includes(q));
  }, [items, query]);

  function update<K extends keyof ServiceForm>(key: K, value: ServiceForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) {
      toast({ title: "Supabase bağlantısı yok", description: "Kayıt işlemleri için Supabase ortam değişkenleri gereklidir.", variant: "destructive" });
      return;
    }
    if (!form.title.trim() || !form.short_description.trim()) {
      toast({ title: "Eksik bilgi", description: "Başlık ve kısa açıklama zorunludur.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const payload = {
      title: form.title.trim(),
      short_description: form.short_description.trim(),
      detail_description: form.detail_description.trim() || null,
      icon_name: form.icon_name.trim() || null,
      image_url: form.image_url.trim() || null,
      sort_order: Number(form.sort_order) || 0,
      status: form.status,
    };
    const result = form.id ? await supabase.from("services").update(payload).eq("id", form.id) : await supabase.from("services").insert(payload);
    setSaving(false);

    if (result.error) {
      toast({ title: "Kaydedilemedi", description: result.error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Hizmet kaydedildi" });
    setForm(emptyForm);
    load();
  }

  async function toggle(row: ServiceRow) {
    if (!supabase) return;
    await supabase.from("services").update({ status: row.status === "published" ? "draft" : "published" }).eq("id", row.id);
    toast({ title: row.status === "published" ? "Hizmet yayından kaldırıldı" : "Hizmet yayınlandı" });
    load();
  }

  async function remove(row: ServiceRow) {
    if (!supabase || !confirm(`"${row.title}" hizmetini silmek istediğinize emin misiniz?`)) return;
    await supabase.from("services").delete().eq("id", row.id);
    toast({ title: "Hizmet silindi" });
    load();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div>
        <AdminPageHeader
          eyebrow="İçerik Yönetimi"
          title="Hizmetler"
          description="Eclipse Mühendislik hizmetlerini listeleyin, düzenleyin ve yayın durumlarını yönetin."
          actions={
            <Button onClick={() => setForm(emptyForm)} className="bg-gradient-electric text-white shadow-glow">
              <Plus className="h-4 w-4" />
              Yeni Hizmet Ekle
            </Button>
          }
        />

        <div className="mb-4 rounded-lg border border-border bg-card p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Hizmet ara..." className="pl-9" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <AdminEmptyState title="Hizmet bulunamadı" description="Henüz hizmet kaydı yok veya arama sonucunda eşleşme bulunamadı." icon={ServerCog} />
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <div key={item.id} className="rounded-lg border border-border bg-card p-4 shadow-soft">
                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-lg font-semibold">{item.title}</h2>
                      <span className={cn("rounded-md px-2 py-1 text-xs font-semibold", item.status === "published" ? "bg-electric-soft text-accent" : "bg-muted text-muted-foreground")}>
                        {item.status === "published" ? "Yayında" : "Taslak"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{item.short_description}</p>
                    <div className="mt-2 text-xs text-muted-foreground">Sıralama: {item.sort_order}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setForm(toForm(item))}>
                      <Edit className="h-4 w-4" />
                      Düzenle
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => toggle(item)}>
                      {item.status === "published" ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      {item.status === "published" ? "Yayından Kaldır" : "Yayınla"}
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => remove(item)}>
                      <Trash2 className="h-4 w-4" />
                      Sil
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={save} className="h-fit rounded-lg border border-border bg-card p-5 shadow-soft">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">{form.id ? "Hizmeti Düzenle" : "Yeni Hizmet"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Public sitede kullanılacak hizmet bilgileri.</p>
          </div>
          {form.id && (
            <Button type="button" variant="ghost" size="icon" onClick={() => setForm(emptyForm)} aria-label="Formu kapat">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <Label>Başlık</Label>
            <Input value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="Örn. Yönetilen BT Hizmetleri" />
          </div>
          <div>
            <Label>Kısa Açıklama</Label>
            <Textarea value={form.short_description} onChange={(event) => update("short_description", event.target.value)} rows={3} placeholder="Hizmet kartında görünecek kısa açıklama" />
          </div>
          <div>
            <Label>Detay Açıklama</Label>
            <Textarea value={form.detail_description} onChange={(event) => update("detail_description", event.target.value)} rows={5} placeholder="Detaylı hizmet açıklaması" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>İkon / Görsel</Label>
              <Input value={form.icon_name} onChange={(event) => update("icon_name", event.target.value)} placeholder="network" />
            </div>
            <div>
              <Label>Sıralama</Label>
              <Input type="number" value={form.sort_order} onChange={(event) => update("sort_order", Number(event.target.value))} />
            </div>
          </div>
          <div>
            <Label>Durum</Label>
            <Select value={form.status} onValueChange={(value: ServiceStatus) => update("status", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="published">Yayında</SelectItem>
                <SelectItem value="draft">Taslak</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={saving} className="w-full bg-gradient-electric text-white shadow-glow">
            <Save className="h-4 w-4" />
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </div>
      </form>
    </div>
  );
}
