import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type AdminPageHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
};

export function AdminPageHeader({ title, description, eyebrow, actions }: AdminPageHeaderProps) {
  return (
    <div className="mb-6 flex w-full max-w-full flex-col gap-4 overflow-x-hidden lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">{eyebrow}</div>}
        <h1 className="font-display text-2xl font-semibold leading-tight tracking-normal text-foreground md:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap lg:justify-end [&>*]:w-full sm:[&>*]:w-auto">{actions}</div>}
    </div>
  );
}

type AdminMetricCardProps = {
  label: string;
  value: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger" | "accent";
};

const metricToneClass = {
  default: "text-muted-foreground",
  success: "text-emerald-700",
  warning: "text-amber-700",
  danger: "text-red-700",
  accent: "text-accent",
};

const metricAccentClass = {
  default: "bg-border",
  success: "bg-emerald-600",
  warning: "bg-amber-500",
  danger: "bg-red-600",
  accent: "bg-accent",
};

const metricValueToneClass = {
  default: "text-foreground",
  success: "text-emerald-700",
  warning: "text-amber-700",
  danger: "text-red-700",
  accent: "text-accent",
};

function AutoFitMetricValue({ children, className }: { children: ReactNode; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState<number>();

  useLayoutEffect(() => {
    const fit = () => {
      const container = containerRef.current;
      const value = valueRef.current;
      if (!container || !value) return;

      const maxFontSize = Math.min(42, Math.max(28, window.innerWidth * 0.024));
      value.style.fontSize = `${maxFontSize}px`;

      const availableWidth = Math.max(0, container.clientWidth - 4);
      const neededWidth = value.scrollWidth;
      const nextFontSize = availableWidth > 0 && neededWidth > availableWidth
        ? Math.max(10, Math.floor((maxFontSize * availableWidth) / neededWidth) - 1)
        : maxFontSize;

      setFontSize(nextFontSize);
    };

    fit();
    const observer = new ResizeObserver(fit);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener("resize", fit);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [children]);

  return (
    <div ref={containerRef} className={cn("mt-3 w-full min-w-0 whitespace-nowrap leading-none tabular-nums tracking-normal", className)}>
      <span ref={valueRef} className="inline-block whitespace-nowrap" style={fontSize ? { fontSize } : undefined}>{children}</span>
    </div>
  );
}

export function AdminMetricCard({ label, value, description, icon: Icon, tone = "accent" }: AdminMetricCardProps) {
  return (
    <div className="relative flex min-h-[138px] w-full min-w-0 max-w-full flex-col justify-between overflow-hidden rounded-md border border-border/80 bg-card p-5 shadow-soft transition-colors hover:border-foreground/20">
      <div className={cn("absolute inset-x-0 top-0 h-1", metricAccentClass[tone])} />
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold tracking-normal text-muted-foreground">{label}</div>
          {Icon && (
            <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background", metricToneClass[tone])}>
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>
        <AutoFitMetricValue className={cn("font-extrabold", metricValueToneClass[tone])}>{value}</AutoFitMetricValue>
      </div>
      {description && <div className="mt-4 overflow-hidden text-ellipsis whitespace-nowrap border-t border-border/60 pt-3 text-xs leading-relaxed text-muted-foreground">{description}</div>}
    </div>
  );
}

type AdminSectionProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function AdminSection({ title, description, actions, children, className, contentClassName }: AdminSectionProps) {
  return (
    <section className={cn("min-w-0 max-w-full overflow-hidden rounded-md border border-border bg-card shadow-soft", className)}>
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-normal">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      <div className={cn("p-5", contentClassName)}>{children}</div>
    </section>
  );
}

type AdminEmptyStateProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
};

export function AdminEmptyState({ title, description, icon: Icon, action }: AdminEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-secondary/40 px-6 py-10 text-center">
      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-card text-accent shadow-soft">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <div className="font-semibold text-foreground">{title}</div>
      {description && <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
