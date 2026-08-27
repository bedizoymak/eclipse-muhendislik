import { useState, type ReactNode } from "react";
import { E_DOCUMENT_TYPE_LABELS, formatEDocValue, resolveEDocumentUrl, type EDocument } from "@/lib/eDocuments";

function formatAmount(value: number | null, currency: string | null): string {
  if (value == null) return "—";
  const formatted = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  return currency ? `${formatted} ${currency}` : formatted;
}

// Displays the API's own timestamp as-is -- formatting only, never shifting
// the underlying instant to the browser's local timezone.
function formatApiTimestamp(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleString("tr-TR", { timeZone: "UTC" })} UTC`;
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-white/50">{label}</dt>
      <dd className="mt-1 break-words">{value}</dd>
    </div>
  );
}

function LinkButton({ href, label }: { href: string | null; label: string }) {
  const resolved = resolveEDocumentUrl(href);
  if (!resolved) return <span>—</span>;
  return (
    <a
      href={resolved}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block rounded-lg border border-electric-bright/40 px-3 py-1 text-xs text-electric-bright hover:bg-electric-bright/10"
    >
      {label}
    </a>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/40">{title}</p>
      <dl className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-3">{children}</dl>
    </div>
  );
}

/**
 * Shared by FaturaDetay.tsx (sales_invoices) and GiderDetay.tsx
 * (purchase_bills) -- both parent types resolve their real active
 * e-document (e_invoices or e_archives) the same way and every real,
 * safe API attribute is shown here, grouped into readable subsections.
 * Nothing here is computed, guessed, or copied from the parent -- every
 * value comes from the e-document's own row.
 */
export function EDocumentSection({ eDoc }: { eDoc: EDocument | null | undefined }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold">E-Belge</h2>

      {eDoc === undefined ? (
        <p className="mt-2 text-white/50">Yükleniyor…</p>
      ) : eDoc === null ? (
        <p className="mt-2 text-white/50">E-belge yok.</p>
      ) : (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-white/90">
              {E_DOCUMENT_TYPE_LABELS[eDoc.kind]} — #{eDoc.row.parasut_id}
            </span>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-electric-bright hover:underline"
            >
              {expanded ? "Alanları gizle" : "Tüm e-belge alanlarını göster"}
            </button>
          </div>

          {expanded &&
            (eDoc.kind === "e_invoices" ? (
              <>
                <Group title="Belge bilgileri">
                  <Field label="E-belge Paraşüt ID" value={eDoc.row.parasut_id} />
                  <Field label="external_id" value={formatEDocValue(eDoc.row.external_id)} />
                  <Field label="uuid" value={<span className="break-all">{formatEDocValue(eDoc.row.uuid)}</span>} />
                  <Field label="env_uuid" value={<span className="break-all">{formatEDocValue(eDoc.row.env_uuid)}</span>} />
                  <Field label="item_type" value={formatEDocValue(eDoc.row.item_type)} />
                  <Field label="invoice_type_code" value={formatEDocValue(eDoc.row.invoice_type_code)} />
                  <Field label="profile_id" value={formatEDocValue(eDoc.row.profile_id)} />
                  <Field label="archived" value={formatEDocValue(eDoc.row.archived)} />
                  <Field label="non_standard_e_invoice" value={formatEDocValue(eDoc.row.non_standard_e_invoice)} />
                  <Field label="refund_of_id" value={formatEDocValue(eDoc.row.refund_of_id)} />
                  <Field label="vat_exemption_reason_code" value={formatEDocValue(eDoc.row.vat_exemption_reason_code)} />
                </Group>

                <Group title="Durum ve yanıt">
                  <Field label="direction" value={formatEDocValue(eDoc.row.direction)} />
                  <Field label="scenario" value={formatEDocValue(eDoc.row.scenario)} />
                  <Field label="status" value={formatEDocValue(eDoc.row.status)} />
                  <Field label="status_code" value={formatEDocValue(eDoc.row.status_code)} />
                  <Field label="status_message" value={<span className="break-words">{formatEDocValue(eDoc.row.status_message)}</span>} />
                  <Field label="response_type" value={formatEDocValue(eDoc.row.response_type)} />
                </Group>

                <Group title="Taraf bilgileri">
                  <Field label="contact_name" value={formatEDocValue(eDoc.row.contact_name)} />
                  <Field label="from_vkn" value={formatEDocValue(eDoc.row.from_vkn)} />
                  <Field label="to_vkn" value={formatEDocValue(eDoc.row.to_vkn)} />
                  <Field label="from_address" value={<span className="break-words">{formatEDocValue(eDoc.row.from_address)}</span>} />
                  <Field label="to_address" value={<span className="break-words">{formatEDocValue(eDoc.row.to_address)}</span>} />
                </Group>

                <Group title="Tutarlar">
                  <Field label="currency" value={formatEDocValue(eDoc.row.currency)} />
                  <Field label="net_total" value={formatAmount(eDoc.row.net_total, eDoc.row.currency)} />
                  <Field label="total_vat" value={formatAmount(eDoc.row.total_vat, eDoc.row.currency)} />
                </Group>

                <Group title="Tarihler ve bayraklar">
                  <Field label="issue_date" value={formatEDocValue(eDoc.row.issue_date)} />
                  <Field label="expires_at" value={formatEDocValue(eDoc.row.expires_at)} />
                  <Field label="is_expired" value={formatEDocValue(eDoc.row.is_expired)} />
                  <Field label="is_answerable" value={formatEDocValue(eDoc.row.is_answerable)} />
                  <Field label="is_seen" value={formatEDocValue(eDoc.row.is_seen)} />
                  <Field label="parasut_created_at" value={formatApiTimestamp(eDoc.row.parasut_created_at)} />
                  <Field label="parasut_updated_at" value={formatApiTimestamp(eDoc.row.parasut_updated_at)} />
                </Group>

                <Group title="Dosyalar">
                  <Field label="pdf_url" value={<LinkButton href={eDoc.row.pdf_url} label="PDF'i görüntüle" />} />
                  <Field label="signed_ubl_url" value={<LinkButton href={eDoc.row.signed_ubl_url} label="UBL'i görüntüle" />} />
                  <Field label="html_url" value={<LinkButton href={eDoc.row.html_url} label="HTML'i görüntüle" />} />
                </Group>

                <Group title="Ek alanlar">
                  <Field label="note" value={<span className="break-words">{formatEDocValue(eDoc.row.note)}</span>} />
                  <Field label="gtb_ref_no" value={formatEDocValue(eDoc.row.gtb_ref_no)} />
                  <Field label="migration_source" value={formatEDocValue(eDoc.row.migration_source)} />
                </Group>
              </>
            ) : (
              <>
                <Group title="Belge bilgileri">
                  <Field label="E-belge Paraşüt ID" value={eDoc.row.parasut_id} />
                  <Field label="uuid" value={<span className="break-all">{formatEDocValue(eDoc.row.uuid)}</span>} />
                  <Field label="vkn" value={formatEDocValue(eDoc.row.vkn)} />
                  <Field label="invoice_number" value={formatEDocValue(eDoc.row.invoice_number)} />
                </Group>

                <Group title="Durum ve yanıt">
                  <Field label="status" value={formatEDocValue(eDoc.row.status)} />
                  <Field label="is_printed" value={formatEDocValue(eDoc.row.is_printed)} />
                  <Field label="is_signed" value={formatEDocValue(eDoc.row.is_signed)} />
                  <Field label="email_status" value={formatEDocValue(eDoc.row.email_status)} />
                </Group>

                <Group title="Tarihler ve bayraklar">
                  <Field label="printed_at" value={formatApiTimestamp(eDoc.row.printed_at)} />
                  <Field label="cancellable_until" value={formatApiTimestamp(eDoc.row.cancellable_until)} />
                  <Field label="parasut_created_at" value={formatApiTimestamp(eDoc.row.parasut_created_at)} />
                  <Field label="parasut_updated_at" value={formatApiTimestamp(eDoc.row.parasut_updated_at)} />
                </Group>

                <Group title="Dosyalar">
                  <Field label="pdf_url" value={<LinkButton href={eDoc.row.pdf_url} label="PDF'i görüntüle" />} />
                  <Field label="signed_ubl_url" value={<LinkButton href={eDoc.row.signed_ubl_url} label="UBL'i görüntüle" />} />
                  <Field label="html_url" value={<LinkButton href={eDoc.row.html_url} label="HTML'i görüntüle" />} />
                </Group>

                <Group title="Ek alanlar">
                  <Field label="note" value={<span className="break-words">{formatEDocValue(eDoc.row.note)}</span>} />
                  <Field label="migration_source" value={formatEDocValue(eDoc.row.migration_source)} />
                </Group>
              </>
            ))}
        </div>
      )}
    </div>
  );
}
