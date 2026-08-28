import EmptyResourceDetail from "./EmptyResourceDetail";

interface TagDemoRow {
  parasut_id: number;
  name: string | null;
}

const EtiketDetay = () => (
  <EmptyResourceDetail<TagDemoRow>
    backTo="/ayarlar/etiketler"
    backLabel="Etiketler"
    title="Etiket"
    view="parasut_tags_demo"
    selectColumns="parasut_id, name"
    fields={[{ label: "Ad", render: (r) => r.name ?? "—" }]}
  />
);

export default EtiketDetay;
