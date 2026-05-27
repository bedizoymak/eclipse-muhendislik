/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Headphones, Mail, MessageCircle, Phone, Plus, Wallet } from "lucide-react";
import { Pie, PieChart, Cell, Legend, ResponsiveContainer, Tooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { AdminEmptyState, AdminMetricCard, AdminPageHeader, AdminSection } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCrmData } from "@/hooks/useCrmData";
import {
  ACCOUNT_STATUSES,
  customerName,
  formatDate,
  formatTRY,
  labelOf,
  LEAD_STAGES,
  OFFER_STATUSES,
  PROJECT_STATUSES,
  statusBadgeClass,
  TICKET_STATUSES,
} from "@/lib/crm";
import { adminPath } from "@/lib/adminRoutes";
import { cn } from "@/lib/utils";

const chartColors = ["#10b981", "#f59e0b", "#ef4444", "#0ea5e9"];

function RelatedTable({ rows, columns, empty }: { rows: any[]; columns: { label: string; render: (row: any) => React.ReactNode; className?: string }[]; empty: string }) {
  if (!rows.length) return <AdminEmptyState title={empty} description="Bu müşteri için henüz bağlantılı kayıt yok." />;
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-secondary/60 text-left text-xs uppercase text-muted-foreground">
          <tr>{columns.map((column) => <th key={column.label} className={cn("p-3", column.className)}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-border">
              {columns.map((column) => <td key={column.label} className={cn("p-3", column.className)}>{column.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminCustomerDetail() {
  const { id } = useParams();
  const { data, loading, reload } = useCrmData();
  const [note, setNote] = useState("");
  const { toast } = useToast();
  const customer = data.customers.find((item) => item.id === id);

  const related = useMemo(() => {
    const leads = data.leads.filter((item) => item.customer_id === id);
    const projects = data.projects.filter((item) => item.customer_id === id);
    const offers = data.offers.filter((item) => item.customer_id === id);
    const invoices = data.invoices.filter((item) => item.customer_id === id);
    const payments = data.payments.filter((item) => item.customer_id === id);
    const accountRecords = data.accountRecords.filter((item) => item.customer_id === id);
    const tickets = data.tickets.filter((item) => item.customer_id === id);
    const expenses = data.expenses.filter((item) => item.customer_id === id);
    const activities = data.activities.filter((item) => item.related_entity_type === "customer" && item.related_entity_id === id);
    const files = data.files.filter((item) => item.related_entity_type === "customer" && item.related_entity_id === id);
    const officialReceivable = invoices.filter((item) => item.status !== "paid" && item.status !== "cancelled").reduce((sum, item) => sum + Number(item.total || 0), 0);
    const internalReceivable = accountRecords
      .filter((item) => item.record_type === "receivable" && item.status !== "closed" && item.status !== "cancelled")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const paid = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const expenseTotal = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return { leads, projects, offers, invoices, payments, accountRecords, tickets, expenses, activities, files, officialReceivable, internalReceivable, paid, expenseTotal };
  }, [data, id]);

  async function addNote() {
    if (!supabase || !customer || !note.trim()) return;
    const { error } = await (supabase.from("activity_logs" as any).insert({
      related_entity_type: "customer",
      related_entity_id: customer.id,
      activity_type: "note",
      title: "Müşteri notu",
      content: note.trim(),
    }) as any);
    if (error) toast({ title: "Not eklenemedi", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Not eklendi" });
      setNote("");
      reload();
    }
  }

  if (loading) return <div className="rounded-lg border border-border bg-card p-8 text-muted-foreground">Yükleniyor...</div>;
  if (!customer) return <AdminEmptyState title="Müşteri bulunamadı" description="Kayıt silinmiş veya erişim yetkiniz olmayabilir." icon={FileText} action={<Button asChild><Link to={adminPath("/customers")}>Müşterilere Dön</Link></Button>} />;

  const financialChart = [
    { name: "Tahsilat", value: related.paid },
    { name: "Resmi Alacak", value: related.officialReceivable },
    { name: "İç Alacak", value: related.internalReceivable },
    { name: "Masraf", value: related.expenseTotal },
  ].filter((item) => item.value > 0);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Müşteri Detayı"
        title={customerName(customer)}
        description={`${customer.sector || "Sektör yok"} · ${customer.contact_person || "Yetkili girilmedi"} · müşteri ilişkileri, finans, projeler ve destek talepleri.`}
        actions={
          <>
            <Button asChild variant="outline"><Link to={adminPath("/customers")}><ArrowLeft className="h-4 w-4" /> Müşterilere Dön</Link></Button>
            {customer.phone && <Button asChild variant="outline"><a href={`tel:${customer.phone}`}><Phone className="h-4 w-4" /> Ara</a></Button>}
            {customer.email && <Button asChild variant="outline"><a href={`mailto:${customer.email}`}><Mail className="h-4 w-4" /> E-posta</a></Button>}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label="Tahsilat" value={formatTRY(related.paid)} icon={Wallet} tone="success" />
        <AdminMetricCard label="Resmi Alacak" value={formatTRY(related.officialReceivable)} icon={FileText} tone="warning" />
        <AdminMetricCard label="İç Alacak" value={formatTRY(related.internalReceivable)} description="Resmi faturadan ayrı tutulur" icon={Wallet} tone="warning" />
        <AdminMetricCard label="Açık Destek" value={related.tickets.filter((item) => !["resolved", "closed"].includes(item.status)).length} icon={Headphones} tone="accent" />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="overview">Genel</TabsTrigger>
          <TabsTrigger value="leads">Fırsatlar</TabsTrigger>
          <TabsTrigger value="projects">Projeler</TabsTrigger>
          <TabsTrigger value="offers">Teklifler</TabsTrigger>
          <TabsTrigger value="finance">Finans</TabsTrigger>
          <TabsTrigger value="tickets">Destek</TabsTrigger>
          <TabsTrigger value="timeline">Zaman Akışı</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 grid gap-6 xl:grid-cols-3">
          <AdminSection title="İletişim ve Profil" className="xl:col-span-2" contentClassName="grid gap-3 text-sm md:grid-cols-2">
            <div><span className="text-muted-foreground">Yetkili:</span> {customer.contact_person || "-"}</div>
            <div><span className="text-muted-foreground">Telefon:</span> {customer.phone || "-"}</div>
            <div><span className="text-muted-foreground">E-posta:</span> {customer.email || "-"}</div>
            <div><span className="text-muted-foreground">Web:</span> {customer.website || "-"}</div>
            <div><span className="text-muted-foreground">Vergi:</span> {[customer.tax_office, customer.tax_number].filter(Boolean).join(" / ") || "-"}</div>
            <div><span className="text-muted-foreground">Son temas:</span> {formatDate(customer.last_contact_date)}</div>
            <div className="md:col-span-2"><span className="text-muted-foreground">Adres:</span> {customer.address || "-"}</div>
            <div className="md:col-span-2 whitespace-pre-wrap"><span className="text-muted-foreground">Not:</span> {customer.notes || "-"}</div>
          </AdminSection>
          <AdminSection title="Finans Dağılımı">
            {financialChart.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={financialChart} dataKey="value" nameKey="name" innerRadius={56} outerRadius={92}>
                    {financialChart.map((_, index) => <Cell key={index} fill={chartColors[index % chartColors.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatTRY(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <AdminEmptyState title="Finans hareketi yok" icon={Wallet} />}
          </AdminSection>
        </TabsContent>

        <TabsContent value="leads" className="mt-4">
          <RelatedTable rows={related.leads} empty="Fırsat yok" columns={[
            { label: "Fırsat", render: (row) => row.prospect_name },
            { label: "Hizmet", render: (row) => row.interested_service || "-" },
            { label: "Tutar", render: (row) => formatTRY(row.estimated_value), className: "text-right" },
            { label: "Aşama", render: (row) => <span className={cn("rounded-md border px-2 py-1 text-xs", statusBadgeClass(row.stage))}>{labelOf(LEAD_STAGES, row.stage)}</span> },
          ]} />
        </TabsContent>
        <TabsContent value="projects" className="mt-4">
          <RelatedTable rows={related.projects} empty="Proje yok" columns={[
            { label: "Proje", render: (row) => <Link className="font-semibold hover:text-accent" to={adminPath(`/projects/${row.id}`)}>{row.title}</Link> },
            { label: "Kategori", render: (row) => row.service_category || row.category || "-" },
            { label: "Bütçe", render: (row) => formatTRY(row.budget), className: "text-right" },
            { label: "Durum", render: (row) => <span className={cn("rounded-md border px-2 py-1 text-xs", statusBadgeClass(row.project_status))}>{labelOf(PROJECT_STATUSES, row.project_status)}</span> },
          ]} />
        </TabsContent>
        <TabsContent value="offers" className="mt-4">
          <RelatedTable rows={related.offers} empty="Teklif yok" columns={[
            { label: "Teklif No", render: (row) => row.offer_number },
            { label: "Tarih", render: (row) => formatDate(row.offer_date) },
            { label: "Toplam", render: (row) => formatTRY(row.grand_total), className: "text-right" },
            { label: "Durum", render: (row) => <span className={cn("rounded-md border px-2 py-1 text-xs", statusBadgeClass(row.status))}>{labelOf(OFFER_STATUSES, row.status)}</span> },
          ]} />
        </TabsContent>
        <TabsContent value="finance" className="mt-4 space-y-6">
          <RelatedTable rows={related.invoices} empty="Fatura yok" columns={[
            { label: "Fatura", render: (row) => row.invoice_number },
            { label: "Vade", render: (row) => formatDate(row.due_date) },
            { label: "Toplam", render: (row) => formatTRY(row.total), className: "text-right" },
            { label: "Durum", render: (row) => row.status },
          ]} />
          <RelatedTable rows={related.accountRecords} empty="Cari kayıt yok" columns={[
            { label: "Açıklama", render: (row) => row.description },
            { label: "Tutar", render: (row) => formatTRY(row.amount), className: "text-right" },
            { label: "Resmi mi?", render: (row) => row.is_official ? "Resmi" : "İç kayıt" },
            { label: "Durum", render: (row) => labelOf(ACCOUNT_STATUSES, row.status) },
          ]} />
        </TabsContent>
        <TabsContent value="tickets" className="mt-4">
          <RelatedTable rows={related.tickets} empty="Destek talebi yok" columns={[
            { label: "Talep", render: (row) => row.title },
            { label: "Öncelik", render: (row) => row.priority },
            { label: "Açılış", render: (row) => formatDate(row.opened_date) },
            { label: "Durum", render: (row) => <span className={cn("rounded-md border px-2 py-1 text-xs", statusBadgeClass(row.status))}>{labelOf(TICKET_STATUSES, row.status)}</span> },
          ]} />
        </TabsContent>
        <TabsContent value="timeline" className="mt-4 space-y-4">
          <AdminSection title="Yeni Not" contentClassName="space-y-3">
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Görüşme, WhatsApp, toplantı veya takip notu..." rows={3} />
            <Button onClick={addNote} className="bg-gradient-electric text-white"><Plus className="h-4 w-4" /> Not Ekle</Button>
          </AdminSection>
          <div className="space-y-3">
            {related.activities.map((activity) => (
              <div key={activity.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{activity.title}</div>
                    <div className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{activity.content || "-"}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{formatDate(activity.created_at)}</div>
                </div>
              </div>
            ))}
            {!related.activities.length && <AdminEmptyState title="Zaman akışı boş" description="Notlar ve müşteri aktiviteleri burada görünecek." icon={MessageCircle} />}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
