import TaxonomyManagement from "@/app/components/admin/TaxonomyManagement";
export default function Page() {
  return (
    <TaxonomyManagement
      endpoint="/api/product-types"
      title="Product Type Management"
      itemLabel="Product Type"
    />
  );
}
