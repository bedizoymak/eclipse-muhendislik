import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  AccountRecordRow,
  ActivityLogRow,
  CrmFileRow,
  CustomerRow,
  ExpenseRow,
  InvoiceRow,
  LeadRow,
  OfferItemRow,
  OfferRow,
  PaymentRow,
  ProfileRow,
  ProjectRow,
  ServiceRow,
  SupportTicketRow,
  TaskRow,
} from "@/lib/crm";

export type CrmData = {
  customers: CustomerRow[];
  services: ServiceRow[];
  leads: LeadRow[];
  projects: ProjectRow[];
  tasks: TaskRow[];
  offers: OfferRow[];
  offerItems: OfferItemRow[];
  invoices: InvoiceRow[];
  payments: PaymentRow[];
  accountRecords: AccountRecordRow[];
  expenses: ExpenseRow[];
  tickets: SupportTicketRow[];
  activities: ActivityLogRow[];
  files: CrmFileRow[];
  users: ProfileRow[];
};

export type CrmDataKey = keyof CrmData;
export type CrmErrors = Partial<Record<CrmDataKey, string>>;

type QueryResponse<K extends CrmDataKey> = {
  data: CrmData[K] | null;
  error: { message: string } | null;
};

type ModuleResult<K extends CrmDataKey = CrmDataKey> = {
  key: K;
  data: CrmData[K];
  error?: string;
};

const emptyData: CrmData = {
  customers: [],
  services: [],
  leads: [],
  projects: [],
  tasks: [],
  offers: [],
  offerItems: [],
  invoices: [],
  payments: [],
  accountRecords: [],
  expenses: [],
  tickets: [],
  activities: [],
  files: [],
  users: [],
};

function firstError(errors: CrmErrors) {
  const [key, message] = Object.entries(errors)[0] ?? [];
  return key && message ? `${key}: ${message}` : null;
}

function emptyModuleData<K extends CrmDataKey>(key: K): CrmData[K] {
  return emptyData[key];
}

async function loadModule<K extends CrmDataKey>(
  key: K,
  query: PromiseLike<QueryResponse<K>>,
): Promise<ModuleResult<K>> {
  try {
    const result = await query;

    if (result.error) {
      return {
        key,
        data: emptyModuleData(key),
        error: result.error.message,
      };
    }

    return {
      key,
      data: result.data ?? emptyModuleData(key),
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Bilinmeyen veri yukleme hatasi.";

    return {
      key,
      data: emptyModuleData(key),
      error: message,
    };
  }
}

function mergeResults(results: ModuleResult[]) {
  const nextData: CrmData = { ...emptyData };
  const nextErrors: CrmErrors = {};

  for (const result of results) {
    (nextData[result.key] as CrmData[typeof result.key]) = result.data;

    if (result.error) {
      nextErrors[result.key] = result.error;
    }
  }

  return { nextData, nextErrors };
}

export function useCrmData() {
  const [data, setData] = useState<CrmData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<CrmErrors>({});
  const error = firstError(errors);

  const load = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      setData(emptyData);
      setErrors({ customers: "Supabase baglantisi yok." });
      return;
    }

    setLoading(true);
    setErrors({});

    const results = await Promise.all([
      loadModule(
        "customers",
        supabase.from("customers").select("*").order("created_at", {
          ascending: false,
        }),
      ),
      loadModule(
        "services",
        supabase
          .from("services")
          .select("*")
          .order("sort_order")
          .order("created_at", { ascending: false }),
      ),
      loadModule(
        "leads",
        supabase.from("leads").select("*").order("created_at", {
          ascending: false,
        }),
      ),
      loadModule(
        "projects",
        supabase.from("projects").select("*").order("created_at", {
          ascending: false,
        }),
      ),
      loadModule(
        "tasks",
        supabase.from("tasks").select("*").order("due_date", {
          ascending: true,
        }),
      ),
      loadModule(
        "offers",
        supabase.from("offers").select("*").order("offer_date", {
          ascending: false,
        }),
      ),
      loadModule(
        "offerItems",
        supabase.from("offer_items").select("*").order("sort_order"),
      ),
      loadModule(
        "invoices",
        supabase.from("invoices").select("*").order("issue_date", {
          ascending: false,
        }),
      ),
      loadModule(
        "payments",
        supabase.from("payments").select("*").order("payment_date", {
          ascending: false,
        }),
      ),
      loadModule(
        "accountRecords",
        supabase.from("account_records").select("*").order("record_date", {
          ascending: false,
        }),
      ),
      loadModule(
        "expenses",
        supabase.from("expenses").select("*").order("expense_date", {
          ascending: false,
        }),
      ),
      loadModule(
        "tickets",
        supabase.from("support_tickets").select("*").order("opened_date", {
          ascending: false,
        }),
      ),
      loadModule(
        "activities",
        supabase.from("activity_logs").select("*").order("created_at", {
          ascending: false,
        }),
      ),
      loadModule(
        "files",
        supabase.from("crm_files").select("*").order("created_at", {
          ascending: false,
        }),
      ),
      loadModule(
        "users",
        supabase
          .from("profiles")
          .select("id,user_id,email,display_name,created_at")
          .order("created_at", { ascending: false }),
      ),
    ]);

    const { nextData, nextErrors } = mergeResults(results);

    setData(nextData);
    setErrors(nextErrors);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, errors, reload: load };
}
