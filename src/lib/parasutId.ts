// Phase 13.6: shared numeric route-ID guard for all Parasut detail
// routes (`/:parasutId`-style). Applied so a Supabase query is only ever
// started when the URL segment is a genuine positive integer string --
// never on a partial/`parseInt()`-style match, never on a decimal,
// negative, zero, empty, or alphanumeric value. The ID is kept and
// compared as a STRING throughout (never coerced through `Number`/
// `parseInt`) to avoid JS double-precision loss on real large Parasut
// IDs (Paraşüt IDs can exceed Number.MAX_SAFE_INTEGER-adjacent ranges).
//
// This exists because static sibling paths like `/giderler/etiketler`
// and `/urunler/kategoriler` were previously falling through to the
// `/giderler/:parasutId` / `/urunler/:parasutId` catch-all patterns
// with a non-numeric `parasutId` ("etiketler", "kategoriler"), which
// then reached a Supabase `.eq("parasut_id", parasutId)` call against a
// bigint column -- a malformed-request risk, not a real query result.

const NUMERIC_ID_PATTERN = /^[1-9][0-9]*$/;

/**
 * Returns true only for a full-string match of one or more digits, no
 * leading zero (except the guard also rejects "0" itself since a
 * Paraşüt resource ID is never 0), no sign, no decimal point, no
 * surrounding whitespace, and no trailing/leading non-digit characters
 * (so "123abc" / "abc123" are rejected, unlike `parseInt`).
 */
export function isValidParasutId(value: string | undefined | null): value is string {
  if (value == null) return false;
  return NUMERIC_ID_PATTERN.test(value);
}
