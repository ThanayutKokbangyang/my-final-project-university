import TaxonomyManagement from "@/app/components/admin/TaxonomyManagement";
export default function Page() {
  return (
    <TaxonomyManagement
      endpoint="/api/ingredients"
      title="Ingredient Management"
      itemLabel="Ingredient"
    />
  );
}
