import { AlertTriangle, BrainCircuit, CheckCircle2, GitBranch, LineChart, LockKeyhole } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { useLang } from "@/i18n/LanguageContext";

type VisualKind = "executive" | "pipeline" | "analytics" | "tasks" | "finance" | "stock" | "architecture" | "security" | "ai" | "mobile";

const bars = [35, 54, 42, 76, 64, 88, 72];

const ui = {
  tr: {
    live: "Canlı veri",
    executive: "Yönetici Kontrol Paneli",
    platform: "Eclipse Platformu",
    trend: "Performans eğilimi",
    forecast: "Öngörü",
    risk: "Risk sinyali",
    kpi: "Performans uyarısı",
    analytics: "Analitik",
    dataAnalyticsDashboard: "Veri Analizi Kontrol Paneli",
    revenue: "Gelir",
    margin: "Marj",
    serviceLevel: "Hizmet seviyesi",
    financeKpi: "Finans göstergesi",
    salesTrend: "Satış eğilimi",
    stockMovement: "Stok hareketi",
    financeControl: "Finans Kontrolü",
    cash: "Nakit",
    receivables: "Alacaklar",
    overdue: "Geciken tahsilat",
    burn: "Aylık gider",
    taskBoard: "Operasyon Görev Panosu",
    plan: "Plan",
    active: "Aktif",
    review: "Kontrol",
    erpSetup: "ERP yapılandırma",
    crmSync: "CRM eşleme",
    dataModel: "Veri modeli",
    inventory: "Stok Kontrolü",
    stockSignal: "Stok sinyali",
    stock: "Stok",
    critical: "Kritik",
    turnover: "Devir",
    raw: "Hammadde",
    finished: "Mamül",
    criticalParts: "Kritik parça",
    reserved: "Rezerve stok",
    salesPipeline: "CRM Satış Hattı",
    lead: "Aday",
    proposal: "Teklif",
    won: "Kazanım",
    qualified: "Nitelikli fırsat",
    technicalReview: "Teknik değerlendirme",
    contract: "Sözleşme",
    architecture: "Ölçeklenebilir Mimari",
    dataFlow: "Veri akışı",
    apiReady: "API hazır",
    crmSyncNode: "CRM eşleme",
    aiLayer: "AI-Yapay Zeka katmanı",
    analyticsWarehouse: "Analitik veri deposu",
    security: "Güvenlik",
    roleAccess: "Rol Bazlı Erişim",
    role: "Rol",
    admin: "Yönetici",
    finance: "Finans",
    sales: "Satış",
    field: "Saha",
    aiInsights: "AI-Yapay Zeka içgörüleri",
    aiEngine: "AI-Yapay Zeka İçgörü Motoru",
    churn: "Müşteri kaybı riski algılandı",
    salesForecast: "Satış öngörüsü güncellendi",
    marginAnomaly: "Marj sapması inceleme gerektiriyor",
    confidence: "Güven skoru",
    mobile: "Mobil Operasyon",
    mobileLabel: "Saha erişimi",
  },
  en: {
    live: "Live data",
    executive: "Executive Dashboard",
    platform: "Eclipse Platform",
    trend: "Performance Trend",
    forecast: "Forecast",
    risk: "Risk signal",
    kpi: "KPI alert",
    analytics: "Analytics",
    dataAnalyticsDashboard: "Data Analytics Dashboard",
    revenue: "Revenue",
    margin: "Margin",
    serviceLevel: "SLA",
    financeKpi: "Finance KPI",
    salesTrend: "Sales trend",
    stockMovement: "Stock movement",
    financeControl: "Finance Control",
    cash: "Cash",
    receivables: "Receivables",
    overdue: "Overdue",
    burn: "Monthly burn",
    taskBoard: "Operational Task Board",
    plan: "Plan",
    active: "Active",
    review: "Review",
    erpSetup: "ERP setup",
    crmSync: "CRM sync",
    dataModel: "Data model",
    inventory: "Inventory Control",
    stockSignal: "Stock signal",
    stock: "Stock",
    critical: "Critical",
    turnover: "Turnover",
    raw: "Raw material",
    finished: "Finished goods",
    criticalParts: "Critical parts",
    reserved: "Reserved stock",
    salesPipeline: "CRM Pipeline",
    lead: "Lead",
    proposal: "Proposal",
    won: "Won",
    qualified: "Qualified",
    technicalReview: "Technical Review",
    contract: "Contract",
    architecture: "Scalable Architecture",
    dataFlow: "Data flow",
    apiReady: "API ready",
    crmSyncNode: "CRM Sync",
    aiLayer: "AI Layer",
    analyticsWarehouse: "Analytics Warehouse",
    security: "Security",
    roleAccess: "Role-Based Access",
    role: "Role",
    admin: "Admin",
    finance: "Finance",
    sales: "Sales",
    field: "Field",
    aiInsights: "AI insights",
    aiEngine: "AI Insight Engine",
    churn: "Customer churn risk detected",
    salesForecast: "Sales forecast revised",
    marginAnomaly: "Margin anomaly requires review",
    confidence: "Confidence",
    mobile: "Mobile Operations",
    mobileLabel: "Field access",
  },
} as const;

const Shell = ({ title, label, children }: { title: string; label: string; children: ReactNode }) => {
  const { lang } = useLang();
  const L = ui[lang];

  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="absolute -inset-6 animate-pulse-glow bg-electric/20 blur-3xl" aria-hidden />
      <div className="relative overflow-hidden rounded-[1.25rem] border border-white/10 bg-white/[0.06] p-4 shadow-elevated backdrop-blur-xl transition duration-500 hover:-translate-y-1 hover:border-electric-bright/35">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-white/45">{label}</div>
            <div className="mt-1 text-lg font-semibold text-white">{title}</div>
          </div>
          <div className="shrink-0 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-200">{L.live}</div>
        </div>
        {children}
      </div>
    </div>
  );
};

const Kpis = ({ labels = ["ERP", "CRM", "Analytics"] }: { labels?: string[] }) => (
  <div className="mt-4 grid gap-3 sm:grid-cols-3">
    {labels.map((label, index) => (
      <div key={label} className="rounded-xl border border-white/10 bg-navy-deep/60 p-3">
        <div className="text-xs text-white/45">{label}</div>
        <div className="mt-2 text-xl font-semibold text-white transition group-hover:text-electric-bright">{["94%", "38", "12"][index] ?? "82%"}</div>
        <div className="mt-2 h-1.5 rounded-full bg-white/10">
          <div className="h-1.5 rounded-full bg-electric-bright transition-all duration-700" style={{ width: `${[84, 62, 74][index] ?? 68}%` }} />
        </div>
      </div>
    ))}
  </div>
);

const Trend = ({ label }: { label: string }) => (
  <div className="rounded-xl border border-white/10 bg-navy-deep/60 p-4">
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-white">{label}</span>
      <LineChart className="h-4 w-4 text-electric-bright" />
    </div>
    <div className="mt-5 flex h-28 items-end gap-2">
      {bars.map((height, i) => (
        <div key={i} className="flex-1 rounded-t-lg bg-gradient-to-t from-electric to-electric-bright transition-all duration-700 hover:opacity-80" style={{ height: `${height}%` }} />
      ))}
    </div>
  </div>
);

export const DashboardVisual = ({ kind = "executive" }: { kind?: VisualKind }) => {
  const { lang } = useLang();
  const L = ui[lang];

  if (kind === "pipeline") {
    return (
      <Shell title={L.salesPipeline} label={L.forecast}>
        <Kpis labels={[L.lead, L.proposal, L.won]} />
        <div className="mt-4 grid gap-3">
          {[L.qualified, L.technicalReview, L.contract].map((stage, index) => (
            <div key={stage} className="rounded-xl border border-white/10 bg-navy-deep/60 p-3">
              <div className="flex items-center justify-between text-sm text-white">
                <span>{stage}</span>
                <span className="text-electric-bright">{[18, 9, 4][index]}</span>
              </div>
            </div>
          ))}
        </div>
      </Shell>
    );
  }

  if (kind === "analytics") {
    return (
      <Shell title={L.dataAnalyticsDashboard} label={L.kpi}>
        <Kpis labels={[L.revenue, L.margin, L.serviceLevel]} />
        <div className="mt-4 grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-3">
            {[L.financeKpi, L.salesTrend, L.stockMovement].map((item, index) => (
              <div key={item} className="rounded-xl border border-white/10 bg-navy-deep/60 p-3">
                <div className="flex items-center justify-between text-sm text-white">
                  <span>{item}</span>
                  <span className="text-electric-bright">{["92%", "+18%", "74%"][index]}</span>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-white/10">
                  <div className="h-1.5 rounded-full bg-electric-bright" style={{ width: `${[92, 68, 74][index]}%` }} />
                </div>
              </div>
            ))}
          </div>
          <Trend label={L.trend} />
        </div>
      </Shell>
    );
  }

  if (kind === "finance") {
    return (
      <Shell title={L.financeControl} label={L.risk}>
        <Kpis labels={[L.cash, L.risk, L.forecast]} />
        <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-navy-deep/60">
          {[
            [L.receivables, "₺2.4M", L.forecast],
            [L.overdue, "₺186K", L.risk],
            [L.burn, "₺420K", L.kpi],
          ].map((row) => (
            <div key={row[0]} className="grid grid-cols-[1fr_0.8fr_0.8fr] gap-3 border-b border-white/10 px-4 py-3 text-sm last:border-0">
              <span className="text-white/65">{row[0]}</span>
              <span className="font-semibold text-white">{row[1]}</span>
              <span className="text-electric-bright">{row[2]}</span>
            </div>
          ))}
        </div>
      </Shell>
    );
  }

  if (kind === "tasks") {
    return (
      <Shell title={L.taskBoard} label={L.kpi}>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[L.plan, L.active, L.review].map((col) => (
            <div key={col} className="rounded-xl border border-white/10 bg-navy-deep/60 p-3">
              <div className="text-xs font-semibold text-white/55">{col}</div>
              {[0, 1, 2].map((item) => (
                <div key={item} className="mt-3 rounded-lg bg-white/[0.06] p-2 text-xs text-white/70">
                  {[L.erpSetup, L.crmSync, L.dataModel][item]}
                </div>
              ))}
            </div>
          ))}
        </div>
      </Shell>
    );
  }

  if (kind === "stock") {
    return (
      <Shell title={L.inventory} label={L.stockSignal}>
        <Kpis labels={[L.stock, L.critical, L.turnover]} />
        <div className="mt-4 space-y-3">
          {[
            [L.raw, 82],
            [L.finished, 64],
            [L.criticalParts, 28],
            [L.reserved, 51],
          ].map(([label, width]) => (
            <div key={label as string} className="rounded-xl border border-white/10 bg-navy-deep/60 p-3">
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-white/65">{label}</span>
                <span className="text-electric-bright">{width}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/10">
                <div className="h-2 rounded-full bg-gradient-to-r from-electric to-electric-bright" style={{ width: `${width}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Shell>
    );
  }

  if (kind === "executive") {
    return (
      <Shell title={L.executive} label={L.platform}>
        <Kpis labels={["ERP", "CRM", L.analytics]} />
        <div className="mt-3 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <Trend label={L.trend} />
          <div className="space-y-3">
            {[L.forecast, L.risk, L.kpi].map((item) => (
              <div key={item} className="rounded-xl border border-white/10 bg-white/[0.05] p-3">
                <div className="flex items-center gap-2 text-sm text-white">
                  <CheckCircle2 className="h-4 w-4 text-electric-bright" />
                  {item}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Shell>
    );
  }

  if (kind === "architecture") {
    return (
      <Shell title={L.architecture} label={L.dataFlow}>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {["ERP API", L.crmSyncNode, L.aiLayer, L.analyticsWarehouse].map((node) => (
            <div key={node} className="rounded-xl border border-white/10 bg-navy-deep/60 p-4">
              <GitBranch className="h-4 w-4 text-electric-bright" />
              <div className="mt-3 text-sm font-semibold text-white">{node}</div>
              <div className="mt-1 text-xs text-white/45">{L.apiReady}</div>
            </div>
          ))}
        </div>
      </Shell>
    );
  }

  if (kind === "security") {
    return (
      <Shell title={L.roleAccess} label={L.security}>
        <div className="mt-5 grid grid-cols-[1fr_repeat(3,0.7fr)] overflow-hidden rounded-xl border border-white/10 text-xs">
          {[L.role, "ERP", "CRM", lang === "tr" ? "AI" : "AI"].map((head) => <div key={head} className="bg-white/[0.06] p-3 font-semibold text-white/70">{head}</div>)}
          {[L.admin, L.finance, L.sales, L.field].map((role) => (
            <Fragment key={role}>
              <div key={`${role}-role`} className="border-t border-white/10 p-3 text-white">{role}</div>
              {[0, 1, 2].map((i) => (
                <div key={`${role}-${i}`} className="border-t border-white/10 p-3 text-center text-electric-bright">
                  <LockKeyhole className="mx-auto h-4 w-4" />
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      </Shell>
    );
  }

  if (kind === "mobile") {
    return (
      <div className="relative mx-auto w-full max-w-sm">
        <div className="absolute -inset-8 animate-pulse-glow bg-electric/20 blur-3xl" aria-hidden />
        <div className="relative mx-auto rounded-[2rem] border border-white/15 bg-white/[0.06] p-3 shadow-elevated backdrop-blur-xl">
          <div className="rounded-[1.5rem] border border-white/10 bg-navy-deep/80 p-4">
            <div className="mx-auto mb-4 h-1 w-14 rounded-full bg-white/20" />
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-white/40">{L.mobileLabel}</div>
                <div className="mt-1 text-lg font-semibold text-white">{L.mobile}</div>
              </div>
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-300" />
            </div>
            <div className="mt-5 space-y-3">
              {[L.erpSetup, L.stockSignal, L.risk].map((item, index) => (
                <div key={item} className="rounded-xl border border-white/10 bg-white/[0.06] p-3">
                  <div className="flex items-center justify-between text-sm text-white">
                    <span>{item}</span>
                    <span className="text-electric-bright">{[12, 4, 2][index]}</span>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-white/10">
                    <div className="h-1.5 rounded-full bg-electric-bright" style={{ width: `${[82, 48, 32][index]}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Shell title={L.aiEngine} label={L.aiInsights}>
      <div className="mt-4 space-y-3">
        {[L.churn, L.salesForecast, L.marginAnomaly].map((item, index) => (
          <div key={item} className="rounded-xl border border-white/10 bg-navy-deep/60 p-4">
            <div className="flex items-start gap-3">
              {index === 0 ? <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-300" /> : <BrainCircuit className="mt-0.5 h-4 w-4 text-electric-bright" />}
              <div>
                <div className="text-sm font-semibold text-white">{item}</div>
                <div className="mt-1 text-xs text-white/45">{L.confidence} {[91, 84, 78][index]}%</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
};
