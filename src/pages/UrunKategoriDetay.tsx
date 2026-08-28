import EmptyResourceDetail from "./EmptyResourceDetail";

interface ItemCategoryDemoRow {
  parasut_id: number;
  parasut_type: string | null;
  full_path: string | null;
  name: string | null;
  bg_color: string | null;
  text_color: string | null;
  category_type: string | null;
  parent_category_parasut_id: number | null;
  parent_category_parasut_type: string | null;
  subcategories: { id: string; type: string }[] | null;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
}

// Phase 13.3 section 6: first detail route for parasut.item_categories.
// subcategories is rendered directly from the stored jsonb array (real
// relationships.subcategories.data[] captured verbatim in Phase 13.2) --
// never recomputed from parent_category_parasut_id. Null bg_color/
// text_color are shown as "—", never defaulted to a fabricated color.
const UrunKategoriDetay = () => (
  <EmptyResourceDetail<ItemCategoryDemoRow>
    backTo="/stok/kategoriler"
    backLabel="Ürün Kategorileri"
    title="Ürün Kategorisi"
    view="parasut_item_categories_demo"
    selectColumns="parasut_id, parasut_type, full_path, name, bg_color, text_color, category_type, parent_category_parasut_id, parent_category_parasut_type, subcategories, parasut_created_at, parasut_updated_at"
    fields={[
      { label: "Kaynak tipi (parasut_type)", render: (r) => r.parasut_type ?? "—" },
      { label: "Ad", render: (r) => r.name ?? "—" },
      { label: "Tam yol", render: (r) => r.full_path ?? "—" },
      { label: "Kategori tipi", render: (r) => r.category_type ?? "—" },
      { label: "Arkaplan rengi", render: (r) => r.bg_color ?? "—" },
      { label: "Metin rengi", render: (r) => r.text_color ?? "—" },
      {
        label: "Üst kategori",
        render: (r) =>
          r.parent_category_parasut_id != null
            ? `#${r.parent_category_parasut_id} (${r.parent_category_parasut_type ?? "—"})`
            : "—",
      },
      {
        label: "Alt kategoriler",
        render: (r) =>
          r.subcategories && r.subcategories.length > 0
            ? r.subcategories.map((s) => `#${s.id} (${s.type})`).join(", ")
            : "—",
      },
      { label: "Oluşturulma (UTC)", render: (r) => r.parasut_created_at ?? "—" },
      { label: "Güncellenme (UTC)", render: (r) => r.parasut_updated_at ?? "—" },
    ]}
  />
);

export default UrunKategoriDetay;
