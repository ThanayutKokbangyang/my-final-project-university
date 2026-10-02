import TaxonomyManagement from "@/app/components/admin/TaxonomyManagement";
export default function Page() {
  return (
    <TaxonomyManagement endpoint="/api/formulas" title="Formula Management" itemLabel="Formula" />
  );
}
