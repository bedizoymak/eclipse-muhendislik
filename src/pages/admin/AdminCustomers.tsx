/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Edit, Eye, Plus, Search, Trash2, Users, Wallet } from "lucide-react";
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
import {
  arrayToTags,
  CUSTOMER_STATUSES,
  CUSTOMER_TYPES,
  customerName,
  DbRow,
  exportCSV,
  formatDate,
  formatTRY,
  labelOf,
  SOURCES,
  statusBadgeClass,
  tagsToArray,
} from "@/lib/crm";
import { adminPath } from "@/lib/adminRoutes";
import { cn } from "@/lib/utils";

type CustomerForm = {
  id?: string;
  customer_name: string;
  customer_type: string;
  sector: string;
  tax_office: string;
  tax_number: string;
  contact_person: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  notes: string;
  status: string;
  source: string;
  tags: string;
  last_contact_date: string;
};

const emptyForm: CustomerForm = {
  customer_name: "",
  customer_type: "company",
  sector: "",
  tax_office: "",
  tax_number: "",
  contact_person: "",
  phone: "",
  email: "",
  website: "",
  address: "",
  notes: "",
  status: "active",
  source: "other",
  tags: "",
  last_contact_date: "",
};

function toForm(row: DbRow): CustomerForm {
  return {
    id: row.id,
    customer_name: row.customer_name ?? "",
    customer_type: row.customer_type ?? "company",
    sector: row.sector ?? "",
    tax_office: row.tax_office ?? "",
    tax_number: row.tax_number ?? "",
    contact_person: row.contact_person ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    website: row.website ?? "",
    address: row.address ?? "",
    notes: row.notes ?? "",
    status: row.status ?? "active",
    source: row.source ?? "other",
    tags: arrayToTags(row.tags),
    last_contact_date: row.last_contact_date ?? "",
  };
}

export default function AdminCustomers() {
  const { data, loading, reload } = useCrmData();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const enriched = useMemo(() => {
    return data.customers.map((customer) => {
      const payments = data.payments.filter((item) => item.customer_id === customer.id);
      const invoices = data.invoices.filter((item) => item.customer_id === customer.id && item.status !== "cancelled");
      const records = data.accountRecords.filter((item) => item.customer_id === customer.id && item.status !== "cancelled");
      const paid = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const officialReceivable = invoices.filter((item) => item.status !== "paid").reduce((sum, item) => sum + Number(item.total || 0), 0);
      const internalReceivable = records
        .filter((item) => item.record_type === "receivable" && item.status !== "closed")
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);
      return { ...customer, paid, officialReceivable, internalReceivable, balance: officialReceivable + internalReceivable };
    });
  }, [data]);

  const filtered = useMemo(() => {
    const q = query.toLocaleLowerCase("tr-TR");
    return enriched.filter((customer) => {
      const haystack = `${customer.customer_name} ${customer.contact_person ?? ""} ${customer.phone ?? ""} ${customer.email ?? ""} ${customer.tags?.join(" ") ?? ""}`.toLocaleLowerCase("tr-TR");
      if (query && !haystack.includes(q)) return false;
      if (status !== "all" && customer.status !== status) return false;
      if (type !== "all" && customer.customer_type !== type) return false;
      return true;
    });
  }, [enriched, query, status, type]);

  const summary = {
    total: enriched.length,
    active: enriched.filter((item) => item.status === "active").length,
    prospects: enriched.filter((item) => item.status === "prospect").length,
    balance: enriched.reduce((sum, item) => sum + item.balance, 0),
  };

  function openNew() {
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(row: DbRow) {
    setForm(toForm(row));
    setOpen(true);
  }

  function update<K extends keyof CustomerForm>(key: K, value: CustomerForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    if (!supabase) return;
    if (!form.customer_name.trim()) {
      toast({ title: "Müşteri adı zorunludur", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      customer_name: form.customer_name.trim(),
      customer_type: form.customer_type,
      sector: form.sector.trim() || null,
      tax_office: form.tax_office.trim() || null,
      tax_number: form.tax_number.trim() || null,
      contact_person: form.contact_person.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      website: form.website.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
      status: form.status,
      source: form.source,
      tags: tagsToArray(form.tags),
      last_contact_date: form.last_contact_date || null,
    };
    const result = form.id ? await (supabase.from("customers" as any).update(payload).eq("id", form.id) as any) : await (supabase.from("customers" as any).insert(payload) as any);
    setSaving(false);
    if (result.error) {
      toast({ title: "Müşteri kaydedilemedi", description: result.error.message, variant: "destructive" });
      return;
    }
    toast({ title: form.id ? "Müşteri güncellendi" : "Müşteri eklendi" });
    setOpen(false);
    reload();
  }

  async function remove(row: DbRow) {
    if (!supabase || !confirm(`"${customerName(row)}" müşterisini silmek istediğinize emin misiniz?`)) return;
    const { error } = await (supabase.from("customers" as any).delete().eq("id", row.id) as any);
    if (error) toast({ title: "Silinemedi", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Müşteri silindi" });
      reload();
    }
  }

  function downloadCSV() {
    exportCSV(
      "eclipse-musteriler.csv",
      filtered.map((customer) => ({
        "Müşteri": customerName(customer),
        "Tür": labelOf(CUSTOMER_TYPES, customer.customer_type),
        "Sektör": customer.sector ?? "",
        "Yetkili": customer.contact_person ?? "",
        "Telefon": customer.phone ?? "",
        "E-posta": customer.email ?? "",
        "Durum": labelOf(CUSTOMER_STATUSES, customer.status),
        "Kaynak": labelOf(SOURCES, customer.source),
        "Resmi Alacak": customer.officialReceivable,
        "İç Alacak": customer.internalReceivable,
      })),
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Cari ve İlişki Yönetimi"
        title="Müşteriler"
        description="Firmalar, bireysel müşteriler, yetkililer, cari durum, etiketler ve son temas bilgilerini yönetin."
        actions={
          <>
            <Button variant="outline" onClick={downloadCSV}>
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <Button onClick={openNew} className="bg-gradient-electric text-white shadow-glow">
              <Plus className="h-4 w-4" />
              Müşteri Ekle
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label="Toplam Müşteri" value={summary.total} description="Kayıtlı cari ve potansiyel" icon={Users} tone="accent" />
        <AdminMetricCard label="Aktif" value={summary.active} description="Çalışılan müşteri" icon={Users} tone="success" />
        <AdminMetricCard label="Potansiyel" value={summary.prospects} description="Satışa aday kayıt" icon={Search} tone="warning" />
        <AdminMetricCard label="Açık Bakiye" value={formatTRY(summary.balance)} description="Resmi + iç alacaklar ayrı takip edilir" icon={Wallet} tone={summary.balance > 0 ? "warning" : "success"} />
      </div>

      <div className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[minmax(0,1fr)_180px_180px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Müşteri, yetkili, telefon, e-posta veya etiket ara..." className="pl-9" />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm türler</SelectItem>
            {CUSTOMER_TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm durumlar</SelectItem>
            {CUSTOMER_STATUSES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">Yükleniyor...</div>
      ) : filtered.length === 0 ? (
        <AdminEmptyState title="Müşteri bulunamadı" description="Filtreleri temizleyebilir veya yeni müşteri kaydı oluşturabilirsiniz." icon={Users} action={<Button onClick={openNew}>Müşteri Ekle</Button>} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-3">Müşteri</th>
                <th className="p-3">İletişim</th>
                <th className="p-3">Kaynak</th>
                <th className="p-3 text-right">Resmi Alacak</th>
                <th className="p-3 text-right">İç Alacak</th>
                <th className="p-3">Durum</th>
                <th className="p-3 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((customer) => (
                <tr key={customer.id} className="border-t border-border hover:bg-secondary/35">
                  <td className="p-3">
                    <div className="font-semibold">{customerName(customer)}</div>
                    <div className="text-xs text-muted-foreground">{labelOf(CUSTOMER_TYPES, customer.customer_type)} · {customer.sector || "Sektör yok"}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(customer.tags ?? []).slice(0, 3).map((tag: string) => <span key={tag} className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px]">{tag}</span>)}
                    </div>
                  </td>
                  <td className="p-3 text-xs">
                    <div>{customer.contact_person || "-"}</div>
                    <div className="text-muted-foreground">{customer.phone || customer.email || "-"}</div>
                    <div className="text-muted-foreground">Son temas: {formatDate(customer.last_contact_date)}</div>
                  </td>
                  <td className="p-3">{labelOf(SOURCES, customer.source)}</td>
                  <td className="p-3 text-right font-medium">{formatTRY(customer.officialReceivable)}</td>
                  <td className="p-3 text-right font-medium">{formatTRY(customer.internalReceivable)}</td>
                  <td className="p-3"><span className={cn("rounded-md border px-2 py-1 text-xs", statusBadgeClass(customer.status))}>{labelOf(CUSTOMER_STATUSES, customer.status)}</span></td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <Button asChild size="sm" variant="ghost"><Link to={adminPath(`/customers/${customer.id}`)}><Eye className="h-4 w-4" /></Link></Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(customer)}><Edit className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(customer)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Müşteriyi Düzenle" : "Yeni Müşteri"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div><Label>Müşteri / Firma Adı *</Label><Input value={form.customer_name} onChange={(event) => update("customer_name", event.target.value)} /></div>
            <div><Label>Tür</Label><Select value={form.customer_type} onValueChange={(value) => update("customer_type", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CUSTOMER_TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Sektör</Label><Input value={form.sector} onChange={(event) => update("sector", event.target.value)} placeholder="Lojistik, sağlık, üretim..." /></div>
            <div><Label>Yetkili Kişi</Label><Input value={form.contact_person} onChange={(event) => update("contact_person", event.target.value)} /></div>
            <div><Label>Telefon</Label><Input value={form.phone} onChange={(event) => update("phone", event.target.value)} /></div>
            <div><Label>E-posta</Label><Input value={form.email} onChange={(event) => update("email", event.target.value)} /></div>
            <div><Label>Web sitesi</Label><Input value={form.website} onChange={(event) => update("website", event.target.value)} /></div>
            <div><Label>Son temas tarihi</Label><Input type="date" value={form.last_contact_date} onChange={(event) => update("last_contact_date", event.target.value)} /></div>
            <div><Label>Vergi Dairesi</Label><Input value={form.tax_office} onChange={(event) => update("tax_office", event.target.value)} /></div>
            <div><Label>Vergi No / TCKN</Label><Input value={form.tax_number} onChange={(event) => update("tax_number", event.target.value)} /></div>
            <div><Label>Durum</Label><Select value={form.status} onValueChange={(value) => update("status", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CUSTOMER_STATUSES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Kaynak</Label><Select value={form.source} onValueChange={(value) => update("source", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SOURCES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="md:col-span-2"><Label>Etiketler</Label><Input value={form.tags} onChange={(event) => update("tags", event.target.value)} placeholder="network, bakım, m365" /></div>
            <div className="md:col-span-2"><Label>Adres</Label><Textarea value={form.address} onChange={(event) => update("address", event.target.value)} rows={2} /></div>
            <div className="md:col-span-2"><Label>Notlar</Label><Textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
            <Button onClick={save} disabled={saving} className="bg-gradient-electric text-white">{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
