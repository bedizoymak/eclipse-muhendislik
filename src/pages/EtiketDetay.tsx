import EmptyResourceDetail from "./EmptyResourceDetail";

interface TagDemoRow {
  parasut_id: number;
  parasut_type: string | null;
  name: string | null;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
}

// Phase 13.2 section 5: adds parasut_type + created_at/updated_at (UTC)
// to the Tag detail view -- Tag has no relationships in the real Swagger
// schema (Tag.relationships: {}), so no relationship fields apply here.
const EtiketDetay = () => (
  <EmptyResourceDetail<TagDemoRow>
    backTo="/ayarlar/etiketler"
    backLabel="Etiketler"
    title="Etiket"
    functionName="tags-and-settings"
    resource="tags"
    fields={[
      { label: "Kaynak tipi (parasut_type)", render: (r) => r.parasut_type ?? "—" },
      { label: "Ad", render: (r) => r.name ?? "—" },
      { label: "Oluşturulma (UTC)", render: (r) => r.parasut_created_at ?? "—" },
      { label: "Güncellenme (UTC)", render: (r) => r.parasut_updated_at ?? "—" },
    ]}
  />
);

export default EtiketDetay;
