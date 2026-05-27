/* eslint-disable @typescript-eslint/no-explicit-any */

import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckSquare, FileText, FolderKanban, Receipt, Wallet } from "lucide-react";
import { AdminEmptyState, AdminMetricCard, AdminPageHeader } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCrmData } from "@/hooks/useCrmData";
import { adminPath } from "@/lib/adminRoutes";
import { customerName, formatDate, formatTRY, labelOf, PRIORITIES, PROJECT_STATUSES, TASK_STATUSES, statusBadgeClass } from "@/lib/crm";
import { cn } from "@/lib/utils";

function SimpleTable({ rows, columns, empty }: { rows: any[]; columns: { label: string; render: (row: any) => React.ReactNode; className?: string }[]; empty: string }) {
  if (!rows.length) return <AdminEmptyState title={empty} description="Bu proje için henüz bağlantılı kayıt yok." />;
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-secondary/60 text-left text-xs uppercase text-muted-foreground">
          <tr>{columns.map((column) => <th key={column.label} className={cn("p-3", column.className)}>{column.label}</th>)}</tr>
        </thead>
        <tbody>{rows.map((row) => <tr key={row.id} className="border-t border-border">{columns.map((column) => <td key={column.label} className={cn("p-3", column.className)}>{column.render(row)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export default function AdminProjectDetail() {
  const { id } = useParams();
  const { data, loading } = useCrmData();
  const project = data.projects.find((item) => item.id === id);

  if (loading) return <div className="rounded-lg border border-border bg-card p-8 text-muted-foreground">Yükleniyor...</div>;
  if (!project) return <AdminEmptyState title="Proje bulunamadı" icon={FolderKanban} action={<Button asChild><Link to={adminPath("/projects")}>Projeler</Link></Button>} />;

  const customer = data.customers.find((item) => item.id === project.customer_id);
  const tasks = data.tasks.filter((item) => item.project_id === project.id);
  const expenses = data.expenses.filter((item) => item.project_id === project.id);
  const payments = data.payments.filter((item) => item.project_id === project.id);
  const offers = data.offers.filter((item) => item.project_id === project.id || item.id === project.related_offer_id);
  const invoices = data.invoices.filter((item) => item.project_id === project.id);
  const tickets = data.tickets.filter((item) => item.project_id === project.id);
  const activities = data.activities.filter((item) => item.related_entity_type === "project" && item.related_entity_id === project.id);
  const files = data.files.filter((item) => item.related_entity_type === "project" && item.related_entity_id === project.id);
  const income = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expenseTotal = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const net = income - expenseTotal;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Proje Detayı"
        title={project.title}
        description={`${customerName(customer)} · ${project.service_category || "Kategori yok"} · ${labelOf(PROJECT_STATUSES, project.project_status)} · ${labelOf(PRIORITIES, project.priority)}`}
        actions={<Button asChild variant="outline"><Link to={adminPath("/projects")}><ArrowLeft className="h-4 w-4" /> Projelere Dön</Link></Button>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <AdminMetricCard label="Bütçe" value={formatTRY(project.budget)} icon={Wallet} tone="accent" />
        <AdminMetricCard label="Tahsilat" value={formatTRY(income)} icon={Wallet} tone="success" />
        <AdminMetricCard label="Masraf" value={formatTRY(expenseTotal)} icon={Receipt} tone="danger" />
        <AdminMetricCard label="Net" value={formatTRY(net)} icon={FileText} tone={net >= 0 ? "success" : "danger"} />
        <AdminMetricCard label="İlerleme" value={`%${project.progress_percentage || 0}`} icon={FolderKanban} tone="warning" />
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div><span className="text-sm text-muted-foreground">Başlangıç:</span> {formatDate(project.start_date)}</div>
          <div><span className="text-sm text-muted-foreground">Deadline:</span> {formatDate(project.deadline)}</div>
          <div><span className="text-sm text-muted-foreground">Tamamlanma:</span> {formatDate(project.completion_date)}</div>
          <div><span className="text-sm text-muted-foreground">Durum:</span> <span className={cn("rounded-md border px-2 py-1 text-xs", statusBadgeClass(project.project_status))}>{labelOf(PROJECT_STATUSES, project.project_status)}</span></div>
          <div className="md:col-span-2 whitespace-pre-wrap text-sm text-muted-foreground">{project.crm_description || project.detail_description || "Açıklama girilmedi."}</div>
        </div>
      </div>

      <Tabs defaultValue="tasks">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="tasks">Görevler</TabsTrigger>
          <TabsTrigger value="expenses">Masraflar</TabsTrigger>
          <TabsTrigger value="finance">Finans</TabsTrigger>
          <TabsTrigger value="tickets">Destek</TabsTrigger>
          <TabsTrigger value="files">Dosyalar / Linkler</TabsTrigger>
          <TabsTrigger value="timeline">Zaman Akışı</TabsTrigger>
        </TabsList>
        <TabsContent value="tasks" className="mt-4"><SimpleTable rows={tasks} empty="Görev yok" columns={[
          { label: "Görev", render: (row) => row.title },
          { label: "Vade", render: (row) => formatDate(row.due_date) },
          { label: "Öncelik", render: (row) => labelOf(PRIORITIES, row.priority) },
          { label: "Durum", render: (row) => <span className={cn("rounded-md border px-2 py-1 text-xs", statusBadgeClass(row.status))}>{labelOf(TASK_STATUSES, row.status)}</span> },
        ]} /></TabsContent>
        <TabsContent value="expenses" className="mt-4"><SimpleTable rows={expenses} empty="Masraf yok" columns={[
          { label: "Tarih", render: (row) => formatDate(row.expense_date) },
          { label: "Kategori", render: (row) => row.category },
          { label: "Tedarikçi", render: (row) => row.vendor || "-" },
          { label: "Tutar", render: (row) => formatTRY(row.amount), className: "text-right" },
          { label: "Resmi", render: (row) => row.is_official ? "Evet" : "Hayır" },
        ]} /></TabsContent>
        <TabsContent value="finance" className="mt-4 space-y-5">
          <SimpleTable rows={offers} empty="Teklif yok" columns={[{ label: "Teklif", render: (row) => row.offer_number }, { label: "Durum", render: (row) => row.status }, { label: "Toplam", render: (row) => formatTRY(row.grand_total), className: "text-right" }]} />
          <SimpleTable rows={invoices} empty="Fatura yok" columns={[{ label: "Fatura", render: (row) => row.invoice_number }, { label: "Vade", render: (row) => formatDate(row.due_date) }, { label: "Toplam", render: (row) => formatTRY(row.total), className: "text-right" }, { label: "Durum", render: (row) => row.status }]} />
        </TabsContent>
        <TabsContent value="tickets" className="mt-4"><SimpleTable rows={tickets} empty="Destek talebi yok" columns={[{ label: "Talep", render: (row) => row.title }, { label: "Öncelik", render: (row) => row.priority }, { label: "Durum", render: (row) => row.status }]} /></TabsContent>
        <TabsContent value="files" className="mt-4"><SimpleTable rows={files} empty="Dosya/link yok" columns={[{ label: "Başlık", render: (row) => row.title }, { label: "Tür", render: (row) => row.file_type || "-" }, { label: "Link", render: (row) => row.file_url ? <a href={row.file_url} className="text-accent hover:underline" target="_blank" rel="noreferrer">Aç</a> : "-" }]} /></TabsContent>
        <TabsContent value="timeline" className="mt-4">
          {activities.length ? activities.map((activity) => <div key={activity.id} className="mb-3 rounded-lg border border-border bg-card p-4"><div className="font-semibold">{activity.title}</div><div className="text-sm text-muted-foreground">{activity.content}</div><div className="mt-1 text-xs text-muted-foreground">{formatDate(activity.created_at)}</div></div>) : <AdminEmptyState title="Zaman akışı boş" icon={CheckSquare} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
