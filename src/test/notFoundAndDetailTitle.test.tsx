import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import NotFound from "@/pages/NotFound";
import EmptyResourceDetail from "@/pages/EmptyResourceDetail";

// Renders EmptyResourceDetail behind a real ":parasutId" route param (as it
// is always mounted in the app) so useParams() resolves the id instead of
// coming back empty, which would otherwise short-circuit the fetch entirely.
function renderDetail(path: string, props: Omit<Parameters<typeof EmptyResourceDetail>[0], "">) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/giderler/maaslar/:parasutId" element={<EmptyResourceDetail {...props} />} />
      </Routes>
    </MemoryRouter>,
  );
}

// Phase 13.7: regression tests for the two issues found in the Phase 13.6
// self-review -- (1) NotFound must never log to the console during normal
// navigation, and (2) a detail page must never show a route-ID-derived
// business title ("Maaş #999") before the main query confirms the record
// really exists.

function makeSupabaseMock(result: { data: unknown; error: { message: string } | null }, deferred = false) {
  const promise = deferred ? new Promise(() => {}) : Promise.resolve(result);
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: () => promise,
  };
  const from = vi.fn(() => chain);
  return { from };
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from "@/integrations/supabase/client";

describe("NotFound", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("never calls console.error or console.warn during normal render", async () => {
    render(
      <MemoryRouter
        initialEntries={["/bilinmeyen-route"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <NotFound />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Sayfa bulunamadı")).toBeInTheDocument();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("renders a link back home and no route-derived text", () => {
    render(
      <MemoryRouter initialEntries={["/satislar/bilinmeyen/123"]}>
        <NotFound />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link")).toHaveAttribute("href", "/");
    expect(screen.queryByText(/123/)).not.toBeInTheDocument();
  });
});

describe("EmptyResourceDetail title timing", () => {
  beforeEach(() => {
    vi.mocked(supabase!.from).mockReset();
  });

  it("shows no #ID title while loading (row not yet resolved)", () => {
    const mock = makeSupabaseMock({ data: null, error: null }, true);
    vi.mocked(supabase!.from).mockImplementation(mock.from as never);

    renderDetail("/giderler/maaslar/999", {
      backTo: "/giderler/maaslar",
      backLabel: "Maaşlar",
      title: "Maaş",
      view: "parasut_salaries_demo",
      selectColumns: "parasut_id",
      fields: [],
    });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Maaş");
    expect(screen.queryByText(/#999/)).not.toBeInTheDocument();
    expect(screen.getByText("Yükleniyor…")).toBeInTheDocument();
  });

  it("shows 'Kayıt bulunamadı' and no #999 title when the record is confirmed absent", async () => {
    const mock = makeSupabaseMock({ data: null, error: null });
    vi.mocked(supabase!.from).mockImplementation(mock.from as never);

    renderDetail("/giderler/maaslar/999", {
      backTo: "/giderler/maaslar",
      backLabel: "Maaşlar",
      title: "Maaş",
      view: "parasut_salaries_demo",
      selectColumns: "parasut_id",
      fields: [],
    });

    await waitFor(() => expect(screen.getByText("Kayıt bulunamadı.")).toBeInTheDocument());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Maaş");
    expect(screen.queryByText(/#999/)).not.toBeInTheDocument();
  });

  it("shows the real parasut_id as the title once the record is confirmed found", async () => {
    const mock = makeSupabaseMock({ data: { parasut_id: 42 }, error: null });
    vi.mocked(supabase!.from).mockImplementation(mock.from as never);

    renderDetail("/giderler/maaslar/42", {
      backTo: "/giderler/maaslar",
      backLabel: "Maaşlar",
      title: "Maaş",
      view: "parasut_salaries_demo",
      selectColumns: "parasut_id",
      fields: [],
    });

    await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Maaş #42"));
  });

  it("never fires onRowLoaded with a fabricated row before the query resolves", () => {
    const mock = makeSupabaseMock({ data: null, error: null }, true);
    vi.mocked(supabase!.from).mockImplementation(mock.from as never);
    const onRowLoaded = vi.fn();

    renderDetail("/giderler/maaslar/999", {
      backTo: "/giderler/maaslar",
      backLabel: "Maaşlar",
      title: "Maaş",
      view: "parasut_salaries_demo",
      selectColumns: "parasut_id",
      fields: [],
      onRowLoaded,
    });

    expect(onRowLoaded).not.toHaveBeenCalled();
  });
});
