import { AlertTriangle, BrainCircuit, CheckCircle2, GitBranch, LineChart, LockKeyhole } from "lucide-react";
import { Fragment, type ReactNode } from "react";

type VisualKind = "executive" | "pipeline" | "analytics" | "tasks" | "finance" | "stock" | "architecture" | "security" | "ai";

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

  if (kind === "analytics") {
    return (
      <Shell title="Data Analytics Dashboard" label="KPI alert">
        <Kpis labels={["Revenue", "Margin", "SLA"]} />
        <div className="mt-4 grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-3">
            {["Finance KPI", "Sales trend", "Stock movement"].map((item, index) => (
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
          <Trend />
        </div>
      </Shell>
    );
  }

  if (kind === "finance") {
    return (
      <Shell title="Finance Control" label="Risk signal">
        <Kpis labels={["Cash", "Risk", "Forecast"]} />
        <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-navy-deep/60">
          {[
            ["Receivables", "₺2.4M", "Forecast"],
            ["Overdue", "₺186K", "Risk signal"],
            ["Monthly burn", "₺420K", "KPI alert"],
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
      <Shell title="Operational Task Board" label="KPI alert">
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {["Plan", "Active", "Review"].map((col) => (
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

  if (kind === "stock") {
    return (
      <Shell title="Inventory Control" label="Stock signal">
        <Kpis labels={["Stock", "Critical", "Turnover"]} />
        <div className="mt-4 space-y-3">
          {[
            ["Raw material", 82],
            ["Finished goods", 64],
            ["Critical parts", 28],
            ["Reserved stock", 51],
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
      <Shell title="Executive Dashboard" label="Eclipse Platform">
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
  }

  if (kind === "architecture") {
    return (
      <Shell title="Scalable Architecture" label="Data flow">
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {["ERP API", "CRM Sync", "AI Layer", "Analytics Warehouse"].map((node) => (
            <div key={node} className="rounded-xl border border-white/10 bg-navy-deep/60 p-4">
              <GitBranch className="h-4 w-4 text-electric-bright" />
              <div className="mt-3 text-sm font-semibold text-white">{node}</div>
              <div className="mt-1 text-xs text-white/45">API ready</div>
            </div>
          ))}
        </div>
      </Shell>
    );
  }

  if (kind === "security") {
    return (
      <Shell title="Role-Based Access" label="Security">
        <div className="mt-5 grid grid-cols-[1fr_repeat(3,0.7fr)] overflow-hidden rounded-xl border border-white/10 text-xs">
          {["Role", "ERP", "CRM", "AI"].map((head) => <div key={head} className="bg-white/[0.06] p-3 font-semibold text-white/70">{head}</div>)}
          {["Admin", "Finance", "Sales", "Field"].map((role) => (
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

  return (
    <Shell title="AI Insight Engine" label="AI insights">
      <div className="mt-4 space-y-3">
        {["Customer churn risk detected", "Sales forecast revised", "Margin anomaly requires review"].map((item, index) => (
          <div key={item} className="rounded-xl border border-white/10 bg-navy-deep/60 p-4">
            <div className="flex items-start gap-3">
              {index === 0 ? <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-300" /> : <BrainCircuit className="mt-0.5 h-4 w-4 text-electric-bright" />}
              <div>
                <div className="text-sm font-semibold text-white">{item}</div>
                <div className="mt-1 text-xs text-white/45">Confidence {[91, 84, 78][index]}%</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
};
