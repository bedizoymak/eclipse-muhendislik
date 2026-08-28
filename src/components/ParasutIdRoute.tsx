import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { isValidParasutId } from "@/lib/parasutId";
import NotFound from "@/pages/NotFound";

// Phase 13.6: shared wrapper for every `/:parasutId`-style demo detail
// route. It reads the route param BEFORE the wrapped detail page ever
// mounts, and renders the real Not Found screen instead of the detail
// page when the param is not a valid positive-integer ID string -- so
// the wrapped page's own Supabase query effect never runs at all for an
// invalid ID (it is simply never mounted), rather than mounting and then
// being told to skip its query. This is what makes `/giderler/etiketler`
// and `/urunler/kategoriler` (which match the `/giderler/:parasutId` and
// `/urunler/:parasutId` patterns with parasutId="etiketler"/"kategoriler")
// land on Not Found instead of issuing a malformed bigint Supabase
// request.
const ParasutIdRoute = ({ children }: { children: ReactNode }) => {
  const { parasutId } = useParams<{ parasutId: string }>();
  if (!isValidParasutId(parasutId)) {
    return <NotFound />;
  }
  return <>{children}</>;
};

export default ParasutIdRoute;
