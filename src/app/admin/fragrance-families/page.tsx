import TaxonomyManagement from "@/app/components/admin/TaxonomyManagement";
export default function Page() {
  return (
    <TaxonomyManagement
      endpoint="/api/fragrance-families"
      title="Fragrance Family Management"
      itemLabel="Fragrance Family"
    />
  );
}
