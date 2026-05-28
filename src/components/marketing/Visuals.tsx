import { CheckCircle2, LineChart } from "lucide-react";

export const DashboardVisual = () => (
  <div className="relative mx-auto w-full max-w-xl">
    <div className="absolute -inset-6 bg-electric/20 blur-3xl" aria-hidden />
    <div className="relative rounded-[1.25rem] border border-white/10 bg-white/[0.06] p-4 shadow-elevated backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-white/45">Eclipse Platform</div>
          <div className="mt-1 text-lg font-semibold text-white">Executive Dashboard</div>
        </div>
        <div className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-200">Live data</div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {["ERP", "CRM", "Analytics"].map((label, index) => (
          <div key={label} className="rounded-xl border border-white/10 bg-navy-deep/60 p-3">
            <div className="text-xs text-white/45">{label}</div>
            <div className="mt-2 text-xl font-semibold text-white">{["94%", "38", "12"][index]}</div>
            <div className="mt-2 h-1.5 rounded-full bg-white/10">
              <div className="h-1.5 rounded-full bg-electric-bright" style={{ width: `${[84, 62, 74][index]}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-white/10 bg-navy-deep/60 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white">Performance Trend</span>
            <LineChart className="h-4 w-4 text-electric-bright" />
          </div>
          <div className="mt-5 flex h-28 items-end gap-2">
            {[35, 54, 42, 76, 64, 88, 72].map((height, i) => (
              <div key={i} className="flex-1 rounded-t-lg bg-gradient-to-t from-electric to-electric-bright" style={{ height: `${height}%` }} />
            ))}
          </div>
        </div>
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
    </div>
  </div>
);
