import EmptyResourceList from "./EmptyResourceList";

interface ItemCategoryDemoRow {
  parasut_id: number;
  full_path: string | null;
  name: string | null;
}

// Phase 13.3 section 6: first UI route for parasut.item_categories (mapper
// and view already existed since Phase 5/13.2 -- this resource never had a
// list/detail page). 0 real records today (GET /item_categories -> real
// data:[]), so this renders a genuine empty state, never fabricated rows.
const UrunKategorileri = () => (
  <EmptyResourceList<ItemCategoryDemoRow>
    backTo="/urunler"
    backLabel="Ürünler"
    title="Ürün Kategorileri"
    description="Paraşüt'ten senkronize edilen gerçek ürün kategori kayıtları."
    listView="parasut_item_categories_demo"
    countView="parasut_item_category_counts_demo"
    selectColumns="parasut_id, full_path, name"
    emptyExplanation="Paraşüt hesabında bu kaynak için mevcut kayıt yok (GET /item_categories gerçek olarak boş liste döndürüyor)."
    detailBase="/stok/kategoriler"
    columns={[
      { header: "Yol", render: (r) => r.full_path ?? "—" },
      { header: "Ad", render: (r) => r.name ?? "—" },
    ]}
  />
);

export default UrunKategorileri;
