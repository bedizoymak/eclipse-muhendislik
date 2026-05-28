import { CheckCircle2, GitBranch, LineChart, LockKeyhole, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

type VisualKind = "executive" | "pipeline" | "analytics" | "tasks" | "finance" | "stock" | "architecture" | "security";

const bars = [35, 54, 42, 76, 64, 88, 72];

const Shell = ({ title, label, children }: { title: string; label: string; children: ReactNode }) => (
  <div className="relative mx-auto w-full max-w-xl">
    <div className="absolute -inset-6 animate-pulse-glow bg-electric/20 blur-3xl" aria-hidden />
    <div className="relative overflow-hidden rounded-[1.25rem] border border-white/10 bg-white/[0.06] p-4 shadow-elevated backdrop-blur-xl transition duration-500 hover:-translate-y-1 hover:border-electric-bright/35">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-white/45">{label}</div>
          <div className="mt-1 text-lg font-semibold text-white">{title}</div>
        </div>
        <div className="shrink-0 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-200">Live data</div>
      </div>
      {children}
    </div>
  </div>
);

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

const Trend = () => (
  <div className="rounded-xl border border-white/10 bg-navy-deep/60 p-4">
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-white">Performance Trend</span>
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
  if (kind === "pipeline") {
    return (
      <Shell title="CRM Pipeline" label="Forecast">
        <Kpis labels={["Lead", "Proposal", "Won"]} />
        <div className="mt-4 grid gap-3">
          {["Qualified", "Technical Review", "Contract"].map((stage, index) => (
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

  if (kind === "tasks") {
    return (
      <Shell title="Operational Task Board" label="KPI alert">
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {["Plan", "Active", "Review"].map((col, index) => (
            <div key={col} className="rounded-xl border border-white/10 bg-navy-deep/60 p-3">
              <div className="text-xs font-semibold text-white/55">{col}</div>
              {[0, 1, 2].map((item) => (
                <div key={item} className="mt-3 rounded-lg bg-white/[0.06] p-2 text-xs text-white/70">
                  {["ERP setup", "CRM sync", "Data model"][item]}
                </div>
              ))}
            </div>
          ))}
        </div>
      </Shell>
    );
  }

  if (kind === "finance" || kind === "stock") {
    return (
      <Shell title={kind === "finance" ? "Finance Control" : "Inventory Control"} label={kind === "finance" ? "Risk signal" : "Stock signal"}>
        <Kpis labels={kind === "finance" ? ["Cash", "Risk", "Forecast"] : ["Stock", "Critical", "Turnover"]} />
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_0.8fr]">
          <Trend />
          <div className="space-y-3">
            {["Risk signal", "Forecast", "KPI alert"].map((item) => (
              <div key={item} className="rounded-xl border border-white/10 bg-white/[0.05] p-3 text-sm text-white">
                <CheckCircle2 className="mr-2 inline h-4 w-4 text-electric-bright" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </Shell>
    );
  }

  if (kind === "architecture" || kind === "security") {
    return (
      <Shell title={kind === "architecture" ? "Scalable Architecture" : "Role-Based Access"} label={kind === "architecture" ? "Data flow" : "Security"}>
        <div className="mt-5 grid gap-3">
          {["ERP", "CRM", "AI", "Analytics"].map((node, index) => (
            <div key={node} className="flex items-center gap-3 rounded-xl border border-white/10 bg-navy-deep/60 p-3">
              {kind === "architecture" ? <GitBranch className="h-4 w-4 text-electric-bright" /> : index === 0 ? <ShieldCheck className="h-4 w-4 text-electric-bright" /> : <LockKeyhole className="h-4 w-4 text-electric-bright" />}
              <span className="text-sm text-white">{node}</span>
              <span className="ml-auto text-xs text-white/45">{kind === "architecture" ? "API ready" : "Role mapped"}</span>
            </div>
          ))}
        </div>
      </Shell>
    );
  }

  return (
    <Shell title={kind === "analytics" ? "Data Analytics Dashboard" : "Executive Dashboard"} label="Eclipse Platform">
      <Kpis />
      <div className="mt-3 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <Trend />
        <div className="space-y-3">
          {["Forecast", "Risk signal", "KPI alert"].map((item) => (
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
};
