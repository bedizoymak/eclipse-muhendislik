import { useEffect, useState } from "react";
import { ExternalLink, Save, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { SiteSettingsRow } from "@/integrations/supabase/types";
import { defaultSettings } from "@/lib/eclipseContent";
import { AdminEmptyState, AdminPageHeader, AdminSection } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type SettingsForm = Omit<SiteSettingsRow, "updated_at">;

export default function AdminSettings() {
  const [form, setForm] = useState<SettingsForm>(defaultSettings);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("site_settings")
      .select("*")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const { updated_at: _updatedAt, ...rest } = { ...defaultSettings, ...data };
          setForm(rest);
        }
      });
  }, []);

  function update<K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    if (!supabase) {
      toast({ title: "Supabase bağlantısı yok", description: "Ayar kaydı için Supabase ortam değişkenleri gereklidir.", variant: "destructive" });
      return;
    }
    if (!form.company_name.trim() || !form.phone.trim() || !form.email.trim()) {
      toast({ title: "Eksik bilgi", description: "Firma adı, telefon ve e-posta alanları zorunludur.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const payload = { ...form };
    const { error } = form.id && form.id !== "fallback-settings"
      ? await supabase.from("site_settings").update(payload).eq("id", form.id)
      : await supabase.from("site_settings").insert(payload);
    setSaving(false);

    if (error) {
      toast({ title: "Kaydedilemedi", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Site ayarları kaydedildi", description: "Public site bilgileri güncellendi." });
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Site Kontrol Merkezi"
        title="Site Ayarları"
        description="Eclipse Mühendislik iletişim, sosyal medya ve SEO bilgilerini yönetin."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/">
                <ExternalLink className="h-4 w-4" />
                Siteyi Görüntüle
              </Link>
            </Button>
            <Button onClick={save} disabled={saving} className="bg-gradient-electric text-white shadow-glow">
              <Save className="h-4 w-4" />
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </>
        }
      />

      {!supabase && (
        <AdminEmptyState
          title="Supabase bağlantısı yok"
          description="Ayarlar şu anda varsayılan Eclipse bilgileriyle gösteriliyor. Kalıcı kayıt için ortam değişkenleri ve migration dosyaları uygulanmalıdır."
          icon={Settings}
        />
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <AdminSection title="Firma Bilgileri" description="Footer, iletişim ve site genelinde kullanılan temel bilgiler.">
          <div className="grid gap-4">
            <div>
              <Label>Firma Adı</Label>
              <Input value={form.company_name} onChange={(event) => update("company_name", event.target.value)} />
            </div>
            <div>
              <Label>Telefon</Label>
              <Input value={form.phone} onChange={(event) => update("phone", event.target.value)} />
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input value={form.whatsapp} onChange={(event) => update("whatsapp", event.target.value)} />
            </div>
            <div>
              <Label>E-posta</Label>
              <Input value={form.email} onChange={(event) => update("email", event.target.value)} />
            </div>
            <div>
              <Label>Adres</Label>
              <Textarea value={form.address} onChange={(event) => update("address", event.target.value)} rows={3} />
            </div>
            <div>
              <Label>Footer Açıklaması</Label>
              <Textarea value={form.footer_description} onChange={(event) => update("footer_description", event.target.value)} rows={3} />
            </div>
          </div>
        </AdminSection>

        <AdminSection title="Bağlantılar ve SEO" description="Harita, sosyal medya ve arama motoru alanları.">
          <div className="grid gap-4">
            <div>
              <Label>Harita Bağlantısı</Label>
              <Input value={form.map_url ?? ""} onChange={(event) => update("map_url", event.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label>Harita Embed Bağlantısı</Label>
              <Input value={form.map_embed_url ?? ""} onChange={(event) => update("map_embed_url", event.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label>LinkedIn</Label>
              <Input value={form.linkedin_url ?? ""} onChange={(event) => update("linkedin_url", event.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label>Instagram</Label>
              <Input value={form.instagram_url ?? ""} onChange={(event) => update("instagram_url", event.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label>SEO Title</Label>
              <Input value={form.seo_title} onChange={(event) => update("seo_title", event.target.value)} />
            </div>
            <div>
              <Label>SEO Description</Label>
              <Textarea value={form.seo_description} onChange={(event) => update("seo_description", event.target.value)} rows={3} />
            </div>
          </div>
        </AdminSection>
      </div>
    </div>
  );
}
