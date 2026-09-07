import { useEffect, useMemo, useState } from "react";
import { Mail, Phone, Search, Trash2, Inbox, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ContactMessageRow } from "@/integrations/supabase/types";
import { AdminEmptyState, AdminPageHeader } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function AdminMessages() {
  const [items, setItems] = useState<ContactMessageRow[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const { toast } = useToast();

  async function load() {
    if (!supabase) return;
    const { data } = await supabase.from("contact_messages").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLocaleLowerCase("tr-TR");
    return items.filter((item) => {
      if (filter !== "all" && item.status !== filter) return false;
      return `${item.full_name} ${item.email ?? ""} ${item.phone ?? ""} ${item.subject ?? ""}`.toLocaleLowerCase("tr-TR").includes(q);
    });
  }, [items, query, filter]);

  async function mark(id: string, status: "new" | "read") {
    if (!supabase) return;
    await supabase.from("contact_messages").update({ status }).eq("id", id);
    toast({ title: status === "read" ? "Mesaj okundu olarak işaretlendi" : "Mesaj okunmadı olarak işaretlendi" });
    load();
  }

  async function remove(id: string) {
    if (!supabase || !confirm("Mesajı silmek istediğinize emin misiniz?")) return;
    await supabase.from("contact_messages").delete().eq("id", id);
    toast({ title: "Mesaj silindi" });
    load();
  }

  return (
    <div>
      <AdminPageHeader
        eyebrow="İletişim"
        title="Mesajlar"
        description="Web sitesinden gelen iletişim mesajlarını görüntüleyin, okundu durumunu yönetin ve gerekirse silin."
      />

      <div className="mb-4 grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ad, e-posta, telefon veya konu ara..." className="pl-9" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Mesajlar</SelectItem>
            <SelectItem value="new">Okunmadı</SelectItem>
            <SelectItem value="read">Okundu</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <AdminEmptyState title="Mesaj bulunamadı" description="Henüz iletişim mesajı yok veya filtreye uygun kayıt bulunamadı." icon={Inbox} />
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div key={item.id} className="rounded-lg border border-border bg-card shadow-soft">
              <button onClick={() => setOpenId(openId === item.id ? null : item.id)} className="flex w-full flex-col gap-3 p-4 text-left md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{item.full_name}</h2>
                    <span className={cn("rounded-md px-2 py-1 text-xs font-semibold", item.status === "new" ? "bg-electric-soft text-accent" : "bg-muted text-muted-foreground")}>
                      {item.status === "new" ? "Okunmadı" : "Okundu"}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">{item.subject || "Konu belirtilmemiş"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString("tr-TR")}</div>
                </div>
                <div className="text-sm text-muted-foreground">{item.email || item.phone || ""}</div>
              </button>

              {openId === item.id && (
                <div className="space-y-4 border-t border-border p-4">
                  <div className="rounded-lg bg-secondary/50 p-4 text-sm leading-relaxed text-foreground whitespace-pre-line">{item.message}</div>
                  <div className="flex flex-wrap gap-2">
                    {item.phone && (
                      <Button asChild variant="outline" size="sm">
                        <a href={`tel:${item.phone}`}>
                          <Phone className="h-4 w-4" />
                          Ara
                        </a>
                      </Button>
                    )}
                    {item.email && (
                      <Button asChild variant="outline" size="sm">
                        <a href={`mailto:${item.email}`}>
                          <Mail className="h-4 w-4" />
                          E-posta Gönder
                        </a>
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => mark(item.id, item.status === "new" ? "read" : "new")}>
                      {item.status === "new" ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      {item.status === "new" ? "Okundu Yap" : "Okunmadı Yap"}
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => remove(item.id)}>
                      <Trash2 className="h-4 w-4" />
                      Sil
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
