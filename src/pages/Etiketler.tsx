import EmptyResourceList from "./EmptyResourceList";

interface TagDemoRow {
  parasut_id: number;
  name: string | null;
}

const Etiketler = () => (
  <EmptyResourceList<TagDemoRow>
    backTo="/"
    backLabel="Ana Sayfa"
    title="Etiketler"
    description="Paraşüt'ten senkronize edilen gerçek etiket kayıtları."
    functionName="tags-and-settings"
    resource="tags"
    emptyExplanation="Paraşüt hesabında bu kaynak için mevcut kayıt yok (GET /tags gerçek olarak boş liste döndürüyor)."
    detailBase="/ayarlar/etiketler"
    columns={[{ header: "Ad", render: (r) => r.name ?? "—" }]}
  />
);

export default Etiketler;
