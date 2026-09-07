import { useEffect, useMemo, useState } from "react";
import { Edit, Eye, EyeOff, FolderKanban, Plus, Save, Search, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ProjectRow, ProjectStatus } from "@/integrations/supabase/types";
import { defaultProjects } from "@/lib/eclipseContent";
import { AdminEmptyState, AdminPageHeader } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type ProjectForm = {
  id?: string;
  title: string;
  category: string;
  location: string;
  project_year: string;
  short_description: string;
  detail_description: string;
  cover_image_url: string;
  gallery_images: string;
  sort_order: number;
  status: ProjectStatus;
};

const emptyForm: ProjectForm = {
  title: "",
  category: "",
  location: "",
  project_year: "",
  short_description: "",
  detail_description: "",
  cover_image_url: "",
  gallery_images: "",
  sort_order: 0,
  status: "published",
};

function toForm(row: ProjectRow): ProjectForm {
  return {
    id: row.id,
    title: row.title,
    category: row.category ?? "",
    location: row.location ?? "",
    project_year: row.project_year ?? "",
    short_description: row.short_description,
    detail_description: row.detail_description ?? "",
    cover_image_url: row.cover_image_url ?? "",
    gallery_images: (row.gallery_images ?? []).join("\n"),
    sort_order: row.sort_order,
    status: row.status,
  };
}

export default function AdminProjects() {
  const [items, setItems] = useState<ProjectRow[]>(defaultProjects);
  const [form, setForm] = useState<ProjectForm>(emptyForm);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  async function load() {
    if (!supabase) return;
    const { data } = await supabase.from("projects").select("*").order("sort_order").order("created_at", { ascending: false });
    setItems(data?.length ? data : []);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLocaleLowerCase("tr-TR");
    return items.filter((item) => `${item.title} ${item.category ?? ""} ${item.location ?? ""}`.toLocaleLowerCase("tr-TR").includes(q));
  }, [items, query]);

  function update<K extends keyof ProjectForm>(key: K, value: ProjectForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) {
      toast({ title: "Supabase bağlantısı yok", description: "Kayıt işlemleri için Supabase ortam değişkenleri gereklidir.", variant: "destructive" });
      return;
    }
    if (!form.title.trim() || !form.short_description.trim()) {
      toast({ title: "Eksik bilgi", description: "Proje adı ve kısa açıklama zorunludur.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const payload = {
      title: form.title.trim(),
      category: form.category.trim() || null,
      location: form.location.trim() || null,
      project_year: form.project_year.trim() || null,
      short_description: form.short_description.trim(),
      detail_description: form.detail_description.trim() || null,
      cover_image_url: form.cover_image_url.trim() || null,
      gallery_images: form.gallery_images
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      sort_order: Number(form.sort_order) || 0,
      status: form.status,
    };
    const result = form.id ? await supabase.from("projects").update(payload).eq("id", form.id) : await supabase.from("projects").insert(payload);
    setSaving(false);

    if (result.error) {
      toast({ title: "Kaydedilemedi", description: result.error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Proje / referans kaydedildi" });
    setForm(emptyForm);
    load();
  }

  async function toggle(row: ProjectRow) {
    if (!supabase) return;
    await supabase.from("projects").update({ status: row.status === "published" ? "draft" : "published" }).eq("id", row.id);
    toast({ title: row.status === "published" ? "Proje yayından kaldırıldı" : "Proje yayınlandı" });
    load();
  }

  async function remove(row: ProjectRow) {
    if (!supabase || !confirm(`"${row.title}" kaydını silmek istediğinize emin misiniz?`)) return;
    await supabase.from("projects").delete().eq("id", row.id);
    toast({ title: "Proje / referans silindi" });
    load();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div>
        <AdminPageHeader
          eyebrow="Referans Yönetimi"
          title="Projeler / Referanslar"
          description="Eclipse Mühendislik referanslarını, kategorilerini ve yayın durumlarını yönetin."
          actions={
            <Button onClick={() => setForm(emptyForm)} className="bg-gradient-electric text-white shadow-glow">
              <Plus className="h-4 w-4" />
              Yeni Proje Ekle
            </Button>
          }
        />

        <div className="mb-4 rounded-lg border border-border bg-card p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Proje veya referans ara..." className="pl-9" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <AdminEmptyState title="Proje bulunamadı" description="Henüz proje / referans kaydı yok veya arama sonucunda eşleşme bulunamadı." icon={FolderKanban} />
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
                    <div className="mt-2 text-xs text-muted-foreground">
                      {[item.category, item.location, item.project_year].filter(Boolean).join(" · ") || "Ek bilgi girilmemiş"}
                    </div>
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
            <h2 className="font-display text-xl font-semibold">{form.id ? "Kaydı Düzenle" : "Yeni Proje / Referans"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Public sitede kullanılacak referans bilgileri.</p>
          </div>
          {form.id && (
            <Button type="button" variant="ghost" size="icon" onClick={() => setForm(emptyForm)} aria-label="Formu kapat">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <Label>Proje Adı</Label>
            <Input value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="Örn. Kurumsal Ağ Yenileme" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Kategori</Label>
              <Input value={form.category} onChange={(event) => update("category", event.target.value)} placeholder="Kurumsal Ofis" />
            </div>
            <div>
              <Label>Tarih / Yıl</Label>
              <Input value={form.project_year} onChange={(event) => update("project_year", event.target.value)} placeholder="2026" />
            </div>
          </div>
          <div>
            <Label>Konum</Label>
            <Input value={form.location} onChange={(event) => update("location", event.target.value)} placeholder="İstanbul" />
          </div>
          <div>
            <Label>Kısa Açıklama</Label>
            <Textarea value={form.short_description} onChange={(event) => update("short_description", event.target.value)} rows={3} />
          </div>
          <div>
            <Label>Detay Açıklama</Label>
            <Textarea value={form.detail_description} onChange={(event) => update("detail_description", event.target.value)} rows={5} />
          </div>
          <div>
            <Label>Kapak Görseli</Label>
            <Input value={form.cover_image_url} onChange={(event) => update("cover_image_url", event.target.value)} placeholder="https://..." />
          </div>
          <div>
            <Label>Galeri Görselleri</Label>
            <Textarea value={form.gallery_images} onChange={(event) => update("gallery_images", event.target.value)} rows={3} placeholder="Her satıra bir görsel bağlantısı" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Sıralama</Label>
              <Input type="number" value={form.sort_order} onChange={(event) => update("sort_order", Number(event.target.value))} />
            </div>
            <div>
              <Label>Durum</Label>
              <Select value={form.status} onValueChange={(value: ProjectStatus) => update("status", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="published">Yayında</SelectItem>
                  <SelectItem value="draft">Taslak</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
