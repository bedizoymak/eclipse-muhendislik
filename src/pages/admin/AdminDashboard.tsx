import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  CheckSquare,
  ClipboardList,
  FileText,
  Headphones,
  Plus,
  Receipt,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AdminEmptyState, AdminMetricCard, AdminPageHeader, AdminSection } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCrmData } from "@/hooks/useCrmData";
import {
  customerName,
  formatDate,
  formatTRY,
  labelOf,
  LEAD_STAGES,
  monthKey,
  PROJECT_STATUSES,
  statusBadgeClass,
  sumBy,
  TICKET_STATUSES,
  todayISO,
} from "@/lib/crm";
import { adminPath } from "@/lib/adminRoutes";
import { cn } from "@/lib/utils";

const colors = ["#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#6366f1", "#14b8a6", "#64748b"];

function lastSixMonths() {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    return {
      key: date.toISOString().slice(0, 7),
      label: date.toLocaleDateString("tr-TR", { month: "short" }).replace(".", ""),
    };
  });
}

function chartMoney(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} mn`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} bin`;
  return value.toLocaleString("tr-TR");
}

export default function AdminDashboard() {
  const { data, loading, error } = useCrmData();

  const dashboard = useMemo(() => {
    const today = todayISO();
    const thisMonth = monthKey(today);
    const monthlyRevenue = sumBy(
      data.payments.filter((item) => monthKey(item.payment_date) === thisMonth),
      "amount",
    );
    const monthlyExpenses = sumBy(
      data.expenses.filter((item) => monthKey(item.expense_date) === thisMonth),
      "amount",
    );
    const pendingInvoices = data.invoices.filter((item) => !["paid", "cancelled"].includes(item.status));
    const openReceivables = data.accountRecords.filter((item) => item.record_type === "receivable" && item.status !== "closed" && item.status !== "cancelled");
    const activeLeads = data.leads.filter((item) => !["won", "lost"].includes(item.stage));
    const openProjects = data.projects.filter((item) => !["completed", "cancelled"].includes(item.project_status));
    const openTickets = data.tickets.filter((item) => !["resolved", "closed"].includes(item.status));
    const overdueTasks = data.tasks.filter((item) => item.due_date && item.due_date < today && !["done", "cancelled"].includes(item.status));

    const months = lastSixMonths();
    const revenueExpense = months.map((month) => {
      const revenue = sumBy(data.payments.filter((item) => monthKey(item.payment_date) === month.key), "amount");
      const expenses = sumBy(data.expenses.filter((item) => monthKey(item.expense_date) === month.key), "amount");
      return { month: month.label, revenue, expenses, profit: revenue - expenses };
    });

    const leadPipeline = LEAD_STAGES.map((stage) => ({
      name: stage.label,
      value: data.leads.filter((item) => item.stage === stage.value).length,
    })).filter((item) => item.value > 0);

    const projectStatus = PROJECT_STATUSES.map((status) => ({
      name: status.label,
      value: data.projects.filter((item) => item.project_status === status.value).length,
    })).filter((item) => item.value > 0);

    const ticketStatus = TICKET_STATUSES.map((status) => ({
      name: status.label,
      value: data.tickets.filter((item) => item.status === status.value).length,
    })).filter((item) => item.value > 0);

    const topCustomers = data.customers
      .map((customer) => ({
        ...customer,
        revenue: sumBy(data.payments.filter((payment) => payment.customer_id === customer.id), "amount"),
        receivable: sumBy(openReceivables.filter((record) => record.customer_id === customer.id), "amount"),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const recentActivities = [
      ...data.activities.map((item) => ({ id: item.id, title: item.title, detail: item.content, date: item.created_at, tone: "activity" })),
      ...data.leads.slice(0, 4).map((item) => ({ id: `lead-${item.id}`, title: `Fırsat: ${item.prospect_name}`, detail: labelOf(LEAD_STAGES, item.stage), date: item.created_at, tone: "lead" })),
      ...data.tickets.slice(0, 4).map((item) => ({ id: `ticket-${item.id}`, title: `Destek: ${item.title}`, detail: labelOf(TICKET_STATUSES, item.status), date: item.created_at, tone: "ticket" })),
      ...data.payments.slice(0, 4).map((item) => ({ id: `payment-${item.id}`, title: "Tahsilat kaydedildi", detail: formatTRY(item.amount), date: item.created_at, tone: "payment" })),
    ]
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 8);

    return {
      activeLeads,
      openProjects,
      openTickets,
      overdueTasks,
      monthlyRevenue,
      monthlyExpenses,
      monthlyNet: monthlyRevenue - monthlyExpenses,
      pendingPayments: sumBy(pendingInvoices, "total") + sumBy(openReceivables, "amount"),
      revenueExpense,
      leadPipeline,
      projectStatus,
      ticketStatus,
      topCustomers,
      recentActivities,
      thisMonthClosedTasks: data.tasks.filter((item) => monthKey(item.completed_date) === thisMonth).length,
      thisMonthWonLeads: data.leads.filter((item) => item.stage === "won" && monthKey(item.updated_at) === thisMonth).length,
      thisMonthClosedTickets: data.tickets.filter((item) => ["resolved", "closed"].includes(item.status) && monthKey(item.updated_at) === thisMonth).length,
    };
  }, [data]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="CRM Genel Bakış"
        title="Yönetim Paneli"
        description="Müşteri ilişkileri, satış fırsatları, projeler, teknik destek, masraf ve nakit akışını tek ekranda izleyin."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={adminPath("/reports")}>
                <BarChart3 className="h-4 w-4" />
                Raporlar
              </Link>
            </Button>
            <Button asChild className="bg-gradient-electric text-white shadow-glow">
              <Link to={adminPath("/customers")}>
                <Plus className="h-4 w-4" />
                Yeni Kayıt
              </Link>
            </Button>
          </>
        }
      />

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          CRM tabloları okunamadı: {error}. Supabase migration dosyasının uygulanmış olduğundan emin olun.
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <AdminMetricCard label="Toplam Müşteri" value={data.customers.length} description="Aktif, potansiyel ve pasif kayıtlar" icon={Users} tone="accent" />
            <AdminMetricCard label="Aktif Fırsatlar" value={dashboard.activeLeads.length} description="Kazanılmamış/kaybedilmemiş lead sayısı" icon={TrendingUp} tone="success" />
            <AdminMetricCard label="Açık Projeler" value={dashboard.openProjects.length} description="Tamamlanmamış teknik işler" icon={BriefcaseBusiness} tone="accent" />
            <AdminMetricCard label="Aylık Gelir" value={formatTRY(dashboard.monthlyRevenue)} description="Bu ay kaydedilen tahsilat" icon={Wallet} tone="success" />
            <AdminMetricCard label="Aylık Masraf" value={formatTRY(dashboard.monthlyExpenses)} description="Bu ay kaydedilen masraflar" icon={Receipt} tone="danger" />
            <AdminMetricCard label="Net Kâr" value={formatTRY(dashboard.monthlyNet)} description="Aylık gelir eksi masraf" icon={dashboard.monthlyNet >= 0 ? TrendingUp : TrendingDown} tone={dashboard.monthlyNet >= 0 ? "success" : "danger"} />
            <AdminMetricCard label="Bekleyen Ödemeler" value={formatTRY(dashboard.pendingPayments)} description="Fatura + resmi olmayan açık alacak" icon={FileText} tone="warning" />
            <AdminMetricCard label="Açık Destek Talepleri" value={dashboard.openTickets.length} description={`${dashboard.overdueTasks.length} gecikmiş görev`} icon={Headphones} tone={dashboard.openTickets.length ? "warning" : "success"} />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <AdminSection title="Gelir / Masraf / Kâr" description="Son 6 aylık nakit akışı" className="xl:col-span-2">
              <ResponsiveContainer width="100%" height={310}>
                <AreaChart data={dashboard.revenueExpense} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={chartMoney} tickLine={false} axisLine={false} width={58} />
                  <Tooltip formatter={(value: number) => formatTRY(value)} />
                  <Legend />
                  <Area dataKey="revenue" name="Gelir" stroke="#10b981" fill="url(#revenueFill)" strokeWidth={2} />
                  <Area dataKey="expenses" name="Masraf" stroke="#ef4444" fill="transparent" strokeWidth={2} />
                  <Bar dataKey="profit" name="Net Kâr" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                </AreaChart>
              </ResponsiveContainer>
            </AdminSection>

            <AdminSection title="Bu Ayın Özeti" description="Operasyon ve satış sinyalleri" contentClassName="space-y-3">
              {[
                { label: "Kazanılan fırsat", value: dashboard.thisMonthWonLeads, icon: TrendingUp },
                { label: "Tamamlanan görev", value: dashboard.thisMonthClosedTasks, icon: CheckSquare },
                { label: "Kapanan destek talebi", value: dashboard.thisMonthClosedTickets, icon: Headphones },
                { label: "Gecikmiş görev", value: dashboard.overdueTasks.length, icon: AlertTriangle },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <item.icon className="h-4 w-4 text-accent" />
                    {item.label}
                  </div>
                  <div className="text-lg font-semibold">{item.value}</div>
                </div>
              ))}
            </AdminSection>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <AdminSection title="Fırsat Pipeline" description="Satış aşamalarına göre dağılım">
              {dashboard.leadPipeline.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={dashboard.leadPipeline}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar dataKey="value" name="Fırsat" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <AdminEmptyState title="Fırsat yok" description="İlk lead kaydı eklendiğinde pipeline burada görünür." icon={TrendingUp} />
              )}
            </AdminSection>

            <AdminSection title="Proje Durumu" description="Açık ve kapanan proje dağılımı">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={dashboard.projectStatus} dataKey="value" nameKey="name" innerRadius={55} outerRadius={92} paddingAngle={3}>
                    {dashboard.projectStatus.map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </AdminSection>

            <AdminSection title="Destek Talepleri" description="Servis/ticket iş yükü">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={dashboard.ticketStatus} dataKey="value" nameKey="name" innerRadius={55} outerRadius={92} paddingAngle={3}>
                    {dashboard.ticketStatus.map((_, index) => <Cell key={index} fill={colors[(index + 2) % colors.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </AdminSection>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <AdminSection title="Hızlı İşlemler" description="CRM kayıtlarını hızlı başlatın" contentClassName="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {[
                { to: adminPath("/customers"), label: "Müşteri ekle", icon: Users },
                { to: adminPath("/leads"), label: "Fırsat ekle", icon: TrendingUp },
                { to: adminPath("/offers"), label: "Teklif oluştur", icon: ClipboardList },
                { to: adminPath("/expenses"), label: "Masraf ekle", icon: Receipt },
                { to: adminPath("/tasks"), label: "Görev ekle", icon: CheckSquare },
                { to: adminPath("/tickets"), label: "Destek talebi aç", icon: Headphones },
              ].map((item) => (
                <Button key={item.to} asChild variant="outline" className="justify-start">
                  <Link to={item.to}>
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </Button>
              ))}
            </AdminSection>

            <AdminSection title="En Değerli Müşteriler" description="Tahsilata göre ilk 5" className="xl:col-span-1" contentClassName="space-y-3">
              {dashboard.topCustomers.length ? (
                dashboard.topCustomers.map((customer) => (
                  <Link key={customer.id} to={adminPath(`/customers/${customer.id}`)} className="block rounded-lg border border-border p-3 transition hover:border-accent/50 hover:bg-accent/5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{customerName(customer)}</div>
                        <div className="text-xs text-muted-foreground">{customer.sector || "Sektör girilmedi"}</div>
                      </div>
                      <div className="text-right text-sm font-semibold text-emerald-700">{formatTRY(customer.revenue)}</div>
                    </div>
                  </Link>
                ))
              ) : (
                <AdminEmptyState title="Tahsilat yok" description="Ödeme kayıtları eklendikçe müşteri sıralaması oluşur." icon={Wallet} />
              )}
            </AdminSection>

            <AdminSection title="Son Aktiviteler" description="CRM genel hareketleri" contentClassName="space-y-3">
              {dashboard.recentActivities.length ? (
                dashboard.recentActivities.map((activity) => (
                  <div key={activity.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{activity.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{activity.detail || "Detay yok"}</div>
                      </div>
                      <span className={cn("rounded-md border px-2 py-0.5 text-xs", statusBadgeClass(activity.tone))}>{formatDate(activity.date)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <AdminEmptyState title="Aktivite yok" description="Notlar, aramalar, ödemeler ve durum değişimleri burada listelenir." icon={ClipboardList} />
              )}
            </AdminSection>
          </div>
        </>
      )}
    </div>
  );
}
